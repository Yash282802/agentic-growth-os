import asyncio
import logging
from fastapi import FastAPI, BackgroundTasks, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.orm import Session
from typing import Dict, Any, List
import json

from app.database import engine, Base, get_db, SessionLocal, init_db
from app.config import APP_NAME, FRONTEND_URL
from app.schemas import RunRequest, SessionResponse, SessionDetailsResponse, ContactRequest
from app.models import SessionModel, LeadModel, OutreachMessageModel, ContactModel
from app.agents.base import AgentIQWorkflow
from app.agents.lead_discovery import LeadDiscoveryAgent
from app.agents.website_audit import WebsiteAuditAgent
from app.agents.opportunity_score import OpportunityScoringAgent
from app.agents.outreach_agent import OutreachAgent
from app.agents.crm_agent import CRMAgent

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

# Initialize Database tables (gracefully handles connection issues)
init_db()

app = FastAPI(title=APP_NAME)

# CORS configuration
CORS_ORIGINS = [
    FRONTEND_URL,
    "http://localhost:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "ok", "app": APP_NAME}

@app.get("/api/db-check")
async def db_check():
    try:
        from sqlalchemy import text as sql_text
        db = SessionLocal()
        db.execute(sql_text("SELECT 1"))
        db.close()
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "database": str(e)}

# Global dictionary to hold SSE message queues for active sessions
session_queues: Dict[str, asyncio.Queue] = {}
# Global dict to store generated CSV data in memory for download
session_csv_data: Dict[str, str] = {}

async def run_agent_workflow(session_id: str, niche: str, location: str, max_leads: int = 10):
    """
    Runs the 5-agent pipeline in the background and streams logs/status through the session queue.
    """
    queue = session_queues.get(session_id)
    if not queue:
        logger.error(f"No queue registered for session {session_id}")
        return

    def sse_callback(event: Dict[str, Any]):
        # Put the event in the session's stream queue
        asyncio.run_coroutine_threadsafe(queue.put(event), asyncio.get_running_loop())

    try:
        # 1. Initialize workflow orchestration graph
        workflow = AgentIQWorkflow()
        workflow.register_agent(LeadDiscoveryAgent())
        workflow.register_agent(WebsiteAuditAgent())
        workflow.register_agent(OpportunityScoringAgent())
        workflow.register_agent(OutreachAgent())
        
        crm_agent = CRMAgent()
        crm_agent.session_id = session_id # set session id for storage
        workflow.register_agent(crm_agent)
        
        workflow.set_execution_order([
            "Lead Discovery",
            "Website Audit",
            "Opportunity Scoring",
            "Outreach Generation",
            "CRM Storage"
        ])
        
        # 2. Run sequential agents in a single pass
        crm_result = await workflow.execute({"niche": niche, "location": location, "max_leads": max_leads}, sse_callback)
        
        # Store CSV data in memory for export downloads
        session_csv_data[session_id] = crm_result.get("csv_data", "")
        
        # Send completion signal
        await queue.put({"type": "complete", "session_id": session_id})
        
    except Exception as e:
        logger.exception(f"Workflow execution failed for session {session_id}")
        # Update session model in DB to FAILED
        db = SessionLocal()
        try:
            session_db = db.query(SessionModel).filter(SessionModel.id == session_id).first()
            if session_db:
                session_db.status = "FAILED"
                db.commit()
        finally:
            db.close()
            
        await queue.put({"type": "error", "message": str(e)})

@app.post("/api/run")
async def start_pipeline(request: RunRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Triggers the 5-agent client acquisition pipeline.
    """
    # Create database entry for this session
    session_db = SessionModel(
        niche=request.niche,
        location=request.location,
        status="RUNNING"
    )
    db.add(session_db)
    db.commit()
    db.refresh(session_db)
    
    session_id = session_db.id
    
    # Initialize the SSE queue
    session_queues[session_id] = asyncio.Queue()
    
    # Run agent DAG in background thread/task
    background_tasks.add_task(run_agent_workflow, session_id, request.niche, request.location, request.max_leads)
    
    return {"session_id": session_id, "status": "RUNNING"}

@app.get("/api/stream/{session_id}")
async def stream_session_logs(session_id: str):
    """
    Server-Sent Events endpoint to stream logs and progress details for the session.
    """
    if session_id not in session_queues:
        # If workflow finished or wasn't started, check DB to see if it exists
        db = SessionLocal()
        session_db = db.query(SessionModel).filter(SessionModel.id == session_id).first()
        db.close()
        if not session_db:
            raise HTTPException(status_code=404, detail="Session stream not found.")
            
        # Return a quick complete signal if already done
        async def single_complete():
            yield f"data: {json.dumps({'type': 'complete', 'session_id': session_id})}\n\n"
        return StreamingResponse(single_complete(), media_type="text/event-stream")

    async def event_generator():
        queue = session_queues[session_id]
        try:
            while True:
                event = await queue.get()
                yield f"data: {json.dumps(event)}\n\n"
                
                # Check for completion/error signals to stop streaming
                if event.get("type") in ["complete", "error"]:
                    break
        finally:
            # Clean up the queue once disconnected or completed
            if session_id in session_queues:
                del session_queues[session_id]

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/api/sessions", response_model=List[SessionResponse])
async def list_sessions(db: Session = Depends(get_db)):
    """
    Retrieves previous run sessions.
    """
    sessions = db.query(SessionModel).order_by(SessionModel.created_at.desc()).all()
    return sessions

@app.get("/api/session/{session_id}", response_model=SessionDetailsResponse)
async def get_session_details(session_id: str, db: Session = Depends(get_db)):
    """
    Retrieves the full results of a session including the leads and their outreach messages.
    """
    session_db = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session_db:
        raise HTTPException(status_code=404, detail="Session not found.")
        
    return session_db

@app.get("/api/export/{session_id}")
async def export_session_csv(session_id: str, db: Session = Depends(get_db)):
    """
    Downloads the session results as a CSV spreadsheet.
    """
    # Try fetching from in-memory cache first
    csv_str = session_csv_data.get(session_id)
    
    if not csv_str:
        # Regenerate from DB if cache expired
        leads_db = db.query(LeadModel).filter(LeadModel.session_id == session_id).all()
        if not leads_db:
            raise HTTPException(status_code=404, detail="No lead records found for this session.")
        
        # Format leads database records back into CSV
        import csv
        import io
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Business Name", "Category", "Address", "Phone", "Rating", "Website", "Quality", "SSL Status", 
            "Opportunity Score", "Priority Tier", "Email Message", "LinkedIn DM", "WhatsApp", "Facebook Message"
        ])
        
        for l in leads_db:
            # Fetch messages
            msgs = db.query(OutreachMessageModel).filter(OutreachMessageModel.lead_id == l.id).all()
            msg_dict = {m.channel: m.message_text for m in msgs}
            
            writer.writerow([
                l.business_name,
                l.category or "",
                l.address or "",
                l.phone or "",
                l.rating or "",
                l.website_url or "",
                l.website_quality or "",
                "Secure" if l.is_ssl else "Insecure",
                l.opportunity_score,
                l.priority_tier,
                msg_dict.get("email", ""),
                msg_dict.get("linkedin", ""),
                msg_dict.get("whatsapp", ""),
                msg_dict.get("facebook", "")
            ])
        csv_str = output.getvalue()
        session_csv_data[session_id] = csv_str

    headers = {
        'Content-Disposition': f'attachment; filename=leads_report_{session_id[:8]}.csv',
        'Content-Type': 'text/csv'
    }
    return Response(content=csv_str, headers=headers)

@app.post("/api/leads/{lead_id}/contact")
async def log_lead_contact(lead_id: str, request: ContactRequest, db: Session = Depends(get_db)):
    """
    Logs an outreach contact event in the CRM database.
    """
    lead = db.query(LeadModel).filter(LeadModel.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")
        
    contact = ContactModel(
        lead_id=lead_id,
        channel=request.channel
    )
    db.add(contact)
    db.commit()
    
    return {"status": "success", "message": f"Logged contact via {request.channel}."}
