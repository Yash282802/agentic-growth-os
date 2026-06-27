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
    review_count: Optional[int] = None
    hours: Optional[str] = None
    photos: List[str] = []

class AuditedLeadRecord(LeadRecord):
    has_website: bool
    website_url: Optional[str] = None
    website_quality: str
    audit_notes: Optional[str] = None
    is_ssl: bool
    pain_points: List[Dict] = []
    opportunities: List[Dict] = []
    visual_confidence: float = 0.0

class ScoredLeadRecord(AuditedLeadRecord):
    opportunity_score: int
    priority_tier: str
    scoring_reasoning: str = ""

class OutreachMessageSchema(BaseModel):
    channel: str
    message_text: str

class OutreachGeneratedLeadRecord(ScoredLeadRecord):
    outreach_messages: Dict[str, str] = {}

# --- Build Pipeline Schemas ---

class BuildPipelineData(BaseModel):
    human_approved: bool = False
    prd_markdown: str = ""
    stitch_prompt: str = ""
    screen_list: List[str] = []
    schema_sql: str = ""
    endpoints: List[str] = []
    repo_structure: str = ""
    sections_needing_content: List[str] = []
    github_repo_url: str = ""
    preview_url: str = ""
    outstanding_items: List[str] = []

# --- API Request / Response Schemas ---

class RunRequest(BaseModel):
    niche: str
    location: str
    max_leads: int = 10

class ContactRequest(BaseModel):
    channel: str

class ApproveRequest(BaseModel):
    lead_id: str

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

class BuildPipelineResponse(BaseModel):
    human_approved: bool = False
    prd_markdown: str = ""
    stitch_prompt: str = ""
    screen_list: List[str] = []
    schema_sql: str = ""
    endpoints: List[str] = []
    repo_structure: str = ""
    sections_needing_content: List[str] = []
    github_repo_url: str = ""
    preview_url: str = ""
    outstanding_items: List[str] = []

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
    human_approved: bool = False
    prd_markdown: str = ""
    repo_structure: str = ""
    github_repo_url: str = ""
    preview_url: str = ""

    class Config:
        from_attributes = True

class SessionDetailsResponse(SessionResponse):
    leads: List[LeadResponse] = []
