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
    status = Column(String(20), default="RUNNING") # RUNNING, COMPLETED, FAILED
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
    website_quality = Column(String(50), nullable=True) # NO_WEBSITE, BASIC_LANDING, OUTDATED, DECENT, PROFESSIONAL
    audit_notes = Column(Text, nullable=True)
    is_ssl = Column(Boolean, default=False)
    opportunity_score = Column(Integer, default=0)
    priority_tier = Column(String(10), nullable=True) # HOT, WARM, COLD, SKIP
    is_duplicate = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("SessionModel", back_populates="leads")
    outreach_messages = relationship("OutreachMessageModel", back_populates="lead", cascade="all, delete-orphan")
    contacts = relationship("ContactModel", back_populates="lead", cascade="all, delete-orphan")

class OutreachMessageModel(Base):
    __tablename__ = "outreach_messages"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    lead_id = Column(String(36), ForeignKey("leads.id"), nullable=False)
    channel = Column(String(20), nullable=False) # email, linkedin, whatsapp, facebook
    message_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    lead = relationship("LeadModel", back_populates="outreach_messages")

class ContactModel(Base):
    __tablename__ = "contacts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    lead_id = Column(String(36), ForeignKey("leads.id"), nullable=False)
    channel = Column(String(20), nullable=False) # email, linkedin, whatsapp, facebook
    date_sent = Column(DateTime, default=datetime.utcnow)

    lead = relationship("LeadModel", back_populates="contacts")
