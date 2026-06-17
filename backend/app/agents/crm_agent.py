import csv
import io
import math
import logging
from typing import List, Callable, Dict, Any
from sqlalchemy.orm import Session
from app.agents.base import AgentIQAgent
from app.schemas import OutreachGeneratedLeadRecord
from app.models import LeadModel, OutreachMessageModel, SessionModel
from app.database import SessionLocal
from app.utils.nvidia_client import NvidiaClient

logger = logging.getLogger("crm_agent")

class CRMAgent(AgentIQAgent):
    def __init__(self):
        super().__init__(
            name="CRM Storage",
            description="Performs semantic deduplication using NVIDIA E5-v5 embeddings, saves leads to CRM, and exports reports."
        )
        self.nvidia_client = NvidiaClient()

    async def run(self, leads: List[OutreachGeneratedLeadRecord], log_callback: Callable[[str], None]) -> Dict[str, Any]:
        """
        Input: List[OutreachGeneratedLeadRecord] from the Outreach Agent.
        """
        session_id = getattr(self, "session_id", None)
        if not session_id:
            # Fallback for testing/standalone runs
            import uuid
            session_id = str(uuid.uuid4())
            log_callback(f"No session ID set. Generated temporary ID: {session_id}")
            
        log_callback(f"Running CRM integration and semantic deduplication for {len(leads)} leads...")
        
        db: Session = SessionLocal()
        try:
            # Update session status
            session_db = db.query(SessionModel).filter(SessionModel.id == session_id).first()
            if not session_db:
                # If session does not exist in standalone tests, create a dummy session
                session_db = SessionModel(id=session_id, niche="Test", location="Test", status="RUNNING")
                db.add(session_db)
                db.commit()
                db.refresh(session_db)

            # Load all existing leads from the database to check for duplicates
            existing_leads = db.query(LeadModel).all()
            log_callback(f"Loaded {len(existing_leads)} existing database leads for cross-comparison.")
            
            saved_count = 0
            duplicate_count = 0
            hot_count = 0
            
            for idx, lead in enumerate(leads):
                is_duplicate = False
                
                # Check for duplicates using NVIDIA NIM E5-v5 embeddings
                # We combine name and address for semantic matching
                input_text = f"{lead.business_name} {lead.address or ''}".strip().lower()
                
                # Use E5-v5 embedding (or local mock fallback)
                lead_vector = await self.nvidia_client.get_embeddings(input_text)
                
                for ex in existing_leads:
                    # Compare names directly first for quick check
                    if ex.business_name.lower().strip() == lead.business_name.lower().strip():
                        is_duplicate = True
                        break
                    
                    # Semantic Cosine Similarity check
                    ex_text = f"{ex.business_name} {ex.address or ''}".strip().lower()
                    ex_vector = await self.nvidia_client.get_embeddings(ex_text)
                    
                    if lead_vector and ex_vector:
                        sim = cosine_similarity(lead_vector, ex_vector)
                        if sim > 0.92:
                            is_duplicate = True
                            log_callback(f"   -> Duplicate detected: '{lead.business_name}' is semantically similar to '{ex.business_name}' (Similarity: {sim:.4f})")
                            break
                
                if is_duplicate:
                    duplicate_count += 1
                else:
                    saved_count += 1
                    if lead.priority_tier == "HOT":
                        hot_count += 1

                # Save lead details to Database
                lead_db = LeadModel(
                    session_id=session_id,
                    business_name=lead.business_name,
                    address=lead.address,
                    phone=lead.phone,
                    category=lead.category,
                    google_maps_url=lead.google_maps_url,
                    rating=lead.rating,
                    has_website=lead.has_website,
                    website_url=lead.website_url,
                    website_quality=lead.website_quality,
                    audit_notes=lead.audit_notes,
                    is_ssl=lead.is_ssl,
                    opportunity_score=lead.opportunity_score,
                    priority_tier=lead.priority_tier,
                    is_duplicate=is_duplicate
                )
                db.add(lead_db)
                db.flush() # Flush to get lead_db.id
                
                # Save outreach messages for unique HOT and WARM leads
                if not is_duplicate and lead.outreach_messages:
                    for channel, text in lead.outreach_messages.items():
                        msg_db = OutreachMessageModel(
                            lead_id=lead_db.id,
                            channel=channel,
                            message_text=text
                        )
                        db.add(msg_db)

            # Generate final session CSV export string
            csv_data = generate_session_csv(leads)
            
            # Update Session metadata
            session_db.status = "COMPLETED"
            session_db.total_leads = len(leads)
            session_db.hot_leads_count = hot_count
            db.commit()
            
            log_callback(f"Database sync completed. Saved {saved_count} unique leads ({hot_count} HOT), flagged {duplicate_count} duplicates.")
            
            return {
                "session_id": session_id,
                "total_leads": len(leads),
                "saved_leads": saved_count,
                "duplicates": duplicate_count,
                "hot_leads": hot_count,
                "csv_data": csv_data
            }
            
        except Exception as e:
            db.rollback()
            log_callback(f"CRM storage failed with error: {str(e)}")
            raise e
        finally:
            db.close()

def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    if len(v1) != len(v2):
        return 0.0
    dot_prod = sum(a * b for a, b in zip(v1, v2))
    norm_a = math.sqrt(sum(a * a for a in v1))
    norm_b = math.sqrt(sum(b * b for b in v2))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot_prod / (norm_a * norm_b)

def generate_session_csv(leads: List[OutreachGeneratedLeadRecord]) -> str:
    """
    Generates a CSV file containing all fields for the lead session, including the generated copy.
    """
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Headers
    writer.writerow([
        "Business Name", "Category", "Address", "Phone", "Rating", "Website", "Quality", "SSL Status", 
        "Opportunity Score", "Priority Tier", "Email Message", "LinkedIn DM", "WhatsApp", "Facebook Message"
    ])
    
    for lead in leads:
        email = lead.outreach_messages.get("email", "")
        linkedin = lead.outreach_messages.get("linkedin", "")
        whatsapp = lead.outreach_messages.get("whatsapp", "")
        facebook = lead.outreach_messages.get("facebook", "")
        
        writer.writerow([
            lead.business_name,
            lead.category or "",
            lead.address or "",
            lead.phone or "",
            lead.rating or "",
            lead.website_url or "",
            lead.website_quality,
            "Secure" if lead.is_ssl else "Insecure",
            lead.opportunity_score,
            lead.priority_tier,
            email,
            linkedin,
            whatsapp,
            facebook
        ])
        
    return output.getvalue()
