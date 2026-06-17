from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime

# --- Inter-Agent Communication Schemas ---

class LeadRecord(BaseModel):
    business_name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    category: Optional[str] = None
    google_maps_url: Optional[str] = None
    rating: Optional[float] = None

class AuditedLeadRecord(LeadRecord):
    has_website: bool
    website_url: Optional[str] = None
    website_quality: str # NO_WEBSITE, BASIC_LANDING, OUTDATED, DECENT, PROFESSIONAL
    audit_notes: Optional[str] = None
    is_ssl: bool

class ScoredLeadRecord(AuditedLeadRecord):
    opportunity_score: int
    priority_tier: str # HOT, WARM, COLD, SKIP

class OutreachMessageSchema(BaseModel):
    channel: str # email, linkedin, whatsapp, facebook
    message_text: str

class OutreachGeneratedLeadRecord(ScoredLeadRecord):
    outreach_messages: Dict[str, str] # channel -> message_text

# --- API Request / Response Schemas ---

class RunRequest(BaseModel):
    niche: str
    location: str

class ContactRequest(BaseModel):
    channel: str

class SessionResponse(BaseModel):
    id: str
    niche: str
    location: str
    status: str
    total_leads: int
    hot_leads_count: int
    created_at: datetime

    class Config:
        from_attributes = True

class OutreachMessageResponse(BaseModel):
    channel: str
    message_text: str

    class Config:
        from_attributes = True

class LeadResponse(BaseModel):
    id: str
    session_id: str
    business_name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    category: Optional[str] = None
    google_maps_url: Optional[str] = None
    rating: Optional[float] = None
    has_website: bool
    website_url: Optional[str] = None
    website_quality: str
    audit_notes: Optional[str] = None
    is_ssl: bool
    opportunity_score: int
    priority_tier: str
    is_duplicate: bool
    created_at: datetime
    outreach_messages: List[OutreachMessageResponse] = []

    class Config:
        from_attributes = True

class SessionDetailsResponse(SessionResponse):
    leads: List[LeadResponse] = []
