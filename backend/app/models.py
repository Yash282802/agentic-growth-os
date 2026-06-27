import uuid
from sqlalchemy import Column, String, Integer, Float, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class SessionModel(Base):
    __tablename__ = "sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    niche = Column(String(100), nullable=False)
    location = Column(String(100), nullable=False)
    status = Column(String(20), default="RUNNING")
    total_leads = Column(Integer, default=0)
    hot_leads_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    leads = relationship("LeadModel", back_populates="session", cascade="all, delete-orphan")

class LeadModel(Base):
    __tablename__ = "leads"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("sessions.id"), nullable=False)
    business_name = Column(String(255), nullable=False)
    address = Column(Text, nullable=True)
    phone = Column(String(50), nullable=True)
    category = Column(String(100), nullable=True)
    google_maps_url = Column(Text, nullable=True)
    rating = Column(Float, nullable=True)
    has_website = Column(Boolean, default=False)
    website_url = Column(Text, nullable=True)
    website_quality = Column(String(50), nullable=True)
    audit_notes = Column(Text, nullable=True)
    is_ssl = Column(Boolean, default=False)
    opportunity_score = Column(Integer, default=0)
    priority_tier = Column(String(10), nullable=True)
    is_duplicate = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Build pipeline fields
    human_approved = Column(Boolean, default=False)
    prd_markdown = Column(Text, nullable=True)
    stitch_prompt = Column(Text, nullable=True)
    screen_list = Column(Text, nullable=True)
    schema_sql = Column(Text, nullable=True)
    endpoints = Column(Text, nullable=True)
    repo_structure = Column(Text, nullable=True)
    sections_needing_content = Column(Text, nullable=True)
    github_repo_url = Column(Text, nullable=True)
    preview_url = Column(Text, nullable=True)
    outstanding_items = Column(Text, nullable=True)

    session = relationship("SessionModel", back_populates="leads")
    outreach_messages = relationship("OutreachMessageModel", back_populates="lead", cascade="all, delete-orphan")
    contacts = relationship("ContactModel", back_populates="lead", cascade="all, delete-orphan")

class OutreachMessageModel(Base):
    __tablename__ = "outreach_messages"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    lead_id = Column(String(36), ForeignKey("leads.id"), nullable=False)
    channel = Column(String(20), nullable=False)
    message_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    lead = relationship("LeadModel", back_populates="outreach_messages")

class ContactModel(Base):
    __tablename__ = "contacts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    lead_id = Column(String(36), ForeignKey("leads.id"), nullable=False)
    channel = Column(String(20), nullable=False)
    date_sent = Column(DateTime, default=datetime.utcnow)

    lead = relationship("LeadModel", back_populates="contacts")
