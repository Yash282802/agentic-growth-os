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
from app.schemas import RunRequest, SessionResponse, SessionDetailsResponse, ContactRequest, ApproveRequest
from app.models import SessionModel, LeadModel, OutreachMessageModel, ContactModel
from app.agents.base import AgentIQWorkflow
from app.agents.lead_discovery import LeadDiscoveryAgent
from app.agents.website_audit import WebsiteAuditAgent
from app.agents.opportunity_score import OpportunityScoringAgent
from app.agents.outreach_agent import OutreachAgent
from app.agents.crm_agent import CRMAgent
from app.agents.build_pipeline import PRDGeneratorAgent, StitchAgent, BackendSchemaAgent, BuildAgent, DeployAgent, NotifyAgent

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

init_db()

app = FastAPI(title=APP_NAME)

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

session_queues: Dict[str, asyncio.Queue] = {}
session_csv_data: Dict[str, str] = {}

async def run_agent_workflow(session_id: str, niche: str, location: str, max_leads: int = 10):
    queue = session_queues.get(session_id)
    if not queue:
        logger.error(f"No queue registered for session {session_id}")
        return

    def sse_callback(event: Dict[str, Any]):
        asyncio.run_coroutine_threadsafe(queue.put(event), asyncio.get_running_loop())

    try:
        workflow = AgentIQWorkflow()
        workflow.register_agent(LeadDiscoveryAgent())
        workflow.register_agent(WebsiteAuditAgent())
        workflow.register_agent(OpportunityScoringAgent())
        workflow.register_agent(OutreachAgent())

        crm_agent = CRMAgent()
        crm_agent.session_id = session_id
        workflow.register_agent(crm_agent)

        workflow.set_execution_order([
            "Lead Discovery",
            "Website Audit",
            "Opportunity Scoring",
            "Outreach Generation",
            "CRM Storage"
        ])

        crm_result = await workflow.execute({"niche": niche, "location": location, "max_leads": max_leads}, sse_callback)

        session_csv_data[session_id] = crm_result.get("csv_data", "")

        await queue.put({"type": "complete", "session_id": session_id})

    except Exception as e:
        logger.exception(f"Workflow execution failed for session {session_id}")
        db = SessionLocal()
        try:
            session_db = db.query(SessionModel).filter(SessionModel.id == session_id).first()
            if session_db:
                session_db.status = "FAILED"
                db.commit()
        finally:
            db.close()
        await queue.put({"type": "error", "message": str(e)})

async def run_build_pipeline(session_id: str, lead_ids: List[str]):
    queue = session_queues.get(session_id)
    if not queue:
        return

    def sse_callback(event: Dict[str, Any]):
        asyncio.run_coroutine_threadsafe(queue.put(event), asyncio.get_running_loop())

    try:
        db = SessionLocal()
        leads_data = []
        for lid in lead_ids:
            lead_db = db.query(LeadModel).filter(LeadModel.id == lid).first()
            if lead_db and lead_db.human_approved:
                leads_data.append({
                    "id": lid,
                    "business_name": lead_db.business_name,
                    "category": lead_db.category or "business",
                })
        db.close()

        if not leads_data:
            return

        workflow = AgentIQWorkflow()
        workflow.register_agent(PRDGeneratorAgent())
        workflow.register_agent(StitchAgent())
        workflow.register_agent(BackendSchemaAgent())
        workflow.register_agent(BuildAgent())
        workflow.register_agent(DeployAgent())
        workflow.register_agent(NotifyAgent())

        workflow.set_execution_order([
            "PRD Generation",
            "Frontend Generation",
            "Backend Schema",
            "Build",
            "Deploy",
            "Notify"
        ])

        result = await workflow.execute({"leads": leads_data}, sse_callback)

        db = SessionLocal()
        for lead_out in result.get("leads", []):
            lid = lead_out.get("id")
            if not lid:
                continue
            lead_db = db.query(LeadModel).filter(LeadModel.id == lid).first()
            if not lead_db:
                continue
            lead_db.prd_markdown = lead_out.get("prd_markdown", "")
            lead_db.stitch_prompt = lead_out.get("stitch_prompt", "")
            lead_db.screen_list = json.dumps(lead_out.get("screen_list", []))
            lead_db.schema_sql = lead_out.get("schema_sql", "")
            lead_db.endpoints = json.dumps(lead_out.get("endpoints", []))
            lead_db.repo_structure = lead_out.get("repo_structure", "")
            lead_db.sections_needing_content = json.dumps(lead_out.get("sections_needing_content", []))
            lead_db.github_repo_url = lead_out.get("github_repo_url", "")
            lead_db.preview_url = lead_out.get("preview_url", "")
            lead_db.outstanding_items = json.dumps(lead_out.get("outstanding_items", []))
        db.commit()
        db.close()

        await queue.put({"type": "build_complete", "session_id": session_id})

    except Exception as e:
        logger.exception(f"Build pipeline failed")
        await queue.put({"type": "error", "message": f"Build pipeline failed: {str(e)}"})

@app.post("/api/run")
async def start_pipeline(request: RunRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    session_db = SessionModel(
        niche=request.niche,
        location=request.location,
        status="RUNNING"
    )
    db.add(session_db)
    db.commit()
    db.refresh(session_db)

    session_id = session_db.id
    session_queues[session_id] = asyncio.Queue()

    background_tasks.add_task(run_agent_workflow, session_id, request.niche, request.location, request.max_leads)

    return {"session_id": session_id, "status": "RUNNING"}

@app.post("/api/leads/approve")
async def approve_lead(request: ApproveRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    lead = db.query(LeadModel).filter(LeadModel.id == request.lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")

    lead.human_approved = True
    db.commit()

    session_id = lead.session_id
    if session_id not in session_queues:
        session_queues[session_id] = asyncio.Queue()

    background_tasks.add_task(run_build_pipeline, session_id, [request.lead_id])

    return {"status": "success", "message": "Lead approved. Build pipeline started."}

@app.post("/api/leads/{lead_id}/approve")
async def approve_lead_legacy(lead_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    lead = db.query(LeadModel).filter(LeadModel.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")

    lead.human_approved = True
    db.commit()

    session_id = lead.session_id
    if session_id not in session_queues:
        session_queues[session_id] = asyncio.Queue()

    background_tasks.add_task(run_build_pipeline, session_id, [lead_id])

    return {"status": "success", "message": "Lead approved. Build pipeline started."}

@app.get("/api/stream/{session_id}")
async def stream_session_logs(session_id: str):
    if session_id not in session_queues:
        db = SessionLocal()
        session_db = db.query(SessionModel).filter(SessionModel.id == session_id).first()
        db.close()
        if not session_db:
            raise HTTPException(status_code=404, detail="Session stream not found.")

        async def single_complete():
            yield f"data: {json.dumps({'type': 'complete', 'session_id': session_id})}\n\n"
        return StreamingResponse(single_complete(), media_type="text/event-stream")

    async def event_generator():
        queue = session_queues[session_id]
        try:
            while True:
                event = await queue.get()
                yield f"data: {json.dumps(event)}\n\n"
                if event.get("type") in ["complete", "build_complete", "error"]:
                    break
        finally:
            if session_id in session_queues:
                del session_queues[session_id]

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/api/sessions", response_model=List[SessionResponse])
async def list_sessions(db: Session = Depends(get_db)):
    sessions = db.query(SessionModel).order_by(SessionModel.created_at.desc()).all()
    return sessions

@app.get("/api/session/{session_id}", response_model=SessionDetailsResponse)
async def get_session_details(session_id: str, db: Session = Depends(get_db)):
    session_db = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session_db:
        raise HTTPException(status_code=404, detail="Session not found.")
    return session_db

@app.get("/api/export/{session_id}")
async def export_session_csv(session_id: str, db: Session = Depends(get_db)):
    csv_str = session_csv_data.get(session_id)

    if not csv_str:
        leads_db = db.query(LeadModel).filter(LeadModel.session_id == session_id).all()
        if not leads_db:
            raise HTTPException(status_code=404, detail="No lead records found for this session.")

        import csv
        import io
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Business Name", "Category", "Address", "Phone", "Rating", "Website", "Quality", "SSL Status",
            "Opportunity Score", "Priority Tier", "Email Message", "LinkedIn DM", "WhatsApp", "Facebook Message"
        ])

        for l in leads_db:
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
