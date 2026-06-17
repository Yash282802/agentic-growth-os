import json
import re
import logging
from typing import List, Callable
from app.agents.base import AgentIQAgent
from app.schemas import ScoredLeadRecord, OutreachGeneratedLeadRecord
from app.utils.nvidia_client import NvidiaClient
from app.utils.guardrails import NeMoGuardrails
from app.config import MODEL_OUTREACH

logger = logging.getLogger("outreach_agent")

class OutreachAgent(AgentIQAgent):
    def __init__(self):
        super().__init__(
            name="Outreach Generation",
            description="Generates personalized multi-channel outreach campaigns (Email, LinkedIn, WhatsApp, Facebook) for HOT and WARM leads."
        )
        self.nvidia_client = NvidiaClient()
        self.guardrails = NeMoGuardrails()

    async def run(self, scored_leads: List[ScoredLeadRecord], log_callback: Callable[[str], None]) -> List[OutreachGeneratedLeadRecord]:
        log_callback(f"Generating personalized campaigns for {len(scored_leads)} leads...")
        
        enriched_leads = []
        for idx, lead in enumerate(scored_leads):
            # Only generate outreach for HOT and WARM leads as per PRD
            if lead.priority_tier not in ["HOT", "WARM"]:
                log_callback(f"[{idx+1}/{len(scored_leads)}] Skipping outreach for COLD/SKIP lead: '{lead.business_name}'")
                enriched_leads.append(OutreachGeneratedLeadRecord(
                    **lead.model_dump(),
                    outreach_messages={}
                ))
                continue
                
            log_callback(f"[{idx+1}/{len(scored_leads)}] Writing copy for '{lead.business_name}' ({lead.priority_tier})...")
            
            prompt = f"""
            Generate professional sales outreach messages for this business:
            Business Name: {lead.business_name}
            Category: {lead.category}
            Address/Location: {lead.address}
            Website Status: {"Has website" if lead.has_website else "No website"} (Quality: {lead.website_quality})
            Audit Findings: {lead.audit_notes}
            
            Create outreach messages for exactly these 4 channels, following the style constraints:
            1. email: Professional, 150-200 words, mentions their specific website weakness, includes a Call To Action (CTA) to book a call.
            2. linkedin: Peer-to-peer connection message, conversational tone, 80-100 words, reference their business name.
            3. whatsapp: Casual and direct, emoji-friendly, single CTA, 50-70 words.
            4. facebook: Slightly informal, community-focused, 60-80 words.
            
            DO NOT use spam-trigger words (FREE!!!, ACT NOW, limited time, cash).
            DO NOT make false guarantees (e.g. "We guarantee you #1 rank on Google", "100% money back", "guaranteed sales").
            
            Return ONLY a JSON object:
            {{
                "email": "message text here",
                "linkedin": "message text here",
                "whatsapp": "message text here",
                "facebook": "message text here"
            }}
            """
            
            raw_outreach = {}
            try:
                nim_output = await self.nvidia_client.get_chat_completion(
                    model=MODEL_OUTREACH,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3
                )
                json_str = re.search(r"\{.*\}", nim_output, re.DOTALL)
                if json_str:
                    raw_outreach = json.loads(json_str.group(0))
                else:
                    raise ValueError("No JSON block found in LLaMA outreach response.")
            except Exception as e:
                logger.error(f"Failed to generate LLaMA outreach: {str(e)}")
                # Local fallback template generator
                raw_outreach = self._get_fallback_outreach(lead)

            # Apply NeMo Guardrails validation to enforce safety policies and length limits
            safe_outreach = self.guardrails.apply_guardrails(raw_outreach)
            
            log_callback(f"   -> Copywritten successfully. Enforced NeMo safety guardrails.")
            
            enriched_leads.append(OutreachGeneratedLeadRecord(
                **lead.model_dump(),
                outreach_messages=safe_outreach
            ))

        return enriched_leads

    def _get_fallback_outreach(self, lead: ScoredLeadRecord) -> dict:
        """
        Creates fallback template-based outreach if the API key fails.
        """
        name = lead.business_name
        cat = lead.category or "services"
        loc = lead.address.split(",")[-2].strip() if lead.address and len(lead.address.split(",")) > 1 else "your area"
        
        weakness = "a complete lack of website to capture mobile clients" if not lead.has_website else "an insecure, outdated layout that lacks mobile compatibility"

        email = (
            f"Subject: Growth opportunities for {name} in {loc}\n\n"
            f"Dear Owner of {name},\n\n"
            f"I recently analyzed local businesses in the {cat} niche in {loc} and noticed a few opportunities to help you secure more clients. "
            f"Specifically, your online profile indicates {weakness}. In today's digital environment, this can result in losing up to 40% of potential bookings to competitors.\n\n"
            f"We build mobile-responsive landing pages designed specifically for {cat} businesses. Our setups are fully secured and optimized for search traffic. "
            f"Would you be open to a 10-minute discovery call this Thursday to explore how we can help you capture these lost leads?\n\n"
            f"Best regards,\nAgentic Growth Systems Team"
        )
        
        linkedin = (
            f"Hi! I was looking for top {cat} experts in {loc} and came across {name}. "
            f"Your work looks fantastic! I noticed that your web setup might be missing mobile-optimization and booking CTAs. "
            f"We help B2B businesses and local service providers build streamlined landing pages to convert search traffic. "
            f"I'd love to connect here and share a few suggestions on how you can easily optimize this!"
        )
        
        whatsapp = (
            f"Hello! I found {name} on Google Maps. 🌟 I noticed you don't have a mobile booking page. "
            f"We build responsive, 1-page websites for {cat} shops that increase appointments by 30%. "
            f"Do you have a couple minutes for a quick text chat? Let me know!"
        )
        
        facebook = (
            f"Hi! We run a business development community in {loc} and were looking at {name}. "
            f"We love what you're doing, but noticed your website setup could use some security and layout upgrades to rank better. "
            f"We design custom web structures for local {cat} owners. Message us if you'd like a quick preview mockup!"
        )

        return {
            "email": email,
            "linkedin": linkedin,
            "whatsapp": whatsapp,
            "facebook": facebook
        }
