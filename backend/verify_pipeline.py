import asyncio
import logging
from app.database import engine, Base, SessionLocal
from app.models import SessionModel, LeadModel
from app.agents.base import AgentIQWorkflow
from app.agents.lead_discovery import LeadDiscoveryAgent
from app.agents.website_audit import WebsiteAuditAgent
from app.agents.opportunity_score import OpportunityScoringAgent
from app.agents.outreach_agent import OutreachAgent
from app.agents.crm_agent import CRMAgent

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("verify_pipeline")

async def main():
    logger.info("Initializing verify script...")
    
    # 1. Clean and recreate database tables
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized.")

    # 2. Create a test session in the database
    db = SessionLocal()
    session_db = SessionModel(
        niche="Dentists",
        location="Austin, TX",
        status="RUNNING"
    )
    db.add(session_db)
    db.commit()
    db.refresh(session_db)
    session_id = session_db.id
    logger.info(f"Created test session ID: {session_id}")
    db.close()

    # 3. Setup AgentIQ DAG Orchestrator
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

    # 4. Define log/sse receiver
    def mock_sse_callback(event):
        if event["type"] == "status":
            logger.info(f"STATUS CHANGE: Agent '{event['agent']}' is now {event['status']}. Message: {event['message']}")
        elif event["type"] == "log":
            logger.info(f"LOG: {event['message']}")

    # 5. Run execution
    logger.info("Starting execution of AgentIQ DAG...")
    crm_result = await workflow.execute({"niche": "Dentists", "location": "Austin, TX"}, mock_sse_callback)
    
    logger.info("AgentIQ Workflow complete.")
    logger.info(f"CRM results: {crm_result}")

    # 6. Verify Database insertions
    db = SessionLocal()
    leads_count = db.query(LeadModel).filter(LeadModel.session_id == session_id).count()
    hot_leads = db.query(LeadModel).filter(LeadModel.session_id == session_id, LeadModel.priority_tier == "HOT").all()
    
    logger.info("--- DATABASE VERIFICATION ---")
    logger.info(f"Total leads saved: {leads_count}")
    logger.info(f"HOT leads count: {len(hot_leads)}")
    
    assert leads_count > 0, "No leads were saved in database!"
    assert len(hot_leads) > 0 or leads_count >= 5, "Leads were not scored or categorized correctly!"
    
    for lead in hot_leads[:2]:
        logger.info(f"Lead: {lead.business_name} | Score: {lead.opportunity_score} | Tier: {lead.priority_tier}")
        # Verify outreach messages exist
        messages = lead.outreach_messages
        logger.info(f"  -> Generated {len(messages)} outreach channels.")
        assert len(messages) == 4, f"Outreach messages count should be 4, got {len(messages)}"
        for msg in messages:
            logger.info(f"    - {msg.channel}: {msg.message_text[:80]}...")

    db.close()
    logger.info("Verification Succeeded. All tests passed!")

if __name__ == "__main__":
    asyncio.run(main())
