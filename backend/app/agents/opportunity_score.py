import json
import re
import logging
from typing import List, Callable
from app.agents.base import AgentIQAgent
from app.schemas import AuditedLeadRecord, ScoredLeadRecord
from app.utils.nvidia_client import NvidiaClient
from app.config import MODEL_SCORING

logger = logging.getLogger("opportunity_score")

class OpportunityScoringAgent(AgentIQAgent):
    def __init__(self):
        super().__init__(
            name="Opportunity Scoring",
            description="Scores leads out of 100 and prioritizes them as HOT, WARM, COLD, or SKIP."
        )
        self.nvidia_client = NvidiaClient()

    async def run(self, audited_leads: List[AuditedLeadRecord], log_callback: Callable[[str], None]) -> List[ScoredLeadRecord]:
        log_callback(f"Scoring {len(audited_leads)} audited leads...")
        
        scored_leads = []
        for idx, lead in enumerate(audited_leads):
            # Calculate mathematically based on the exact rubric
            score = 0
            
            # 1. No website (40 pts) vs Outdated/low quality (30 pts)
            if not lead.has_website or lead.website_quality == "NO_WEBSITE":
                score += 40
            elif lead.website_quality in ["OUTDATED", "BASIC_LANDING"]:
                score += 30
                
            # 2. No SSL (10 pts)
            if lead.has_website and not lead.is_ssl:
                score += 10
            elif not lead.has_website:
                score += 10 # Lack of SSL is automatic if no site exists
                
            # 3. Rating under 4.0 (10 pts)
            if lead.rating is not None and lead.rating < 4.0:
                score += 10
                
            # 4. Phone number available (5 pts)
            if lead.phone:
                score += 5
                
            # 5. Category match (5 pts)
            if lead.category:
                score += 5

            # Priority tier mapping
            if score >= 75:
                tier = "HOT"
            elif score >= 50:
                tier = "WARM"
            elif score >= 25:
                tier = "COLD"
            else:
                tier = "SKIP"

            log_callback(f"[{idx+1}/{len(audited_leads)}] Evaluated: {lead.business_name} -> Score: {score} ({tier})")

            # Call LLaMA 3.1 70B via NIM to double-check and refine audit notes/reasoning
            prompt = f"""
            Verify this sales opportunity scoring:
            Business Name: {lead.business_name}
            Category: {lead.category}
            Website Status: {"Has website" if lead.has_website else "No website"} (Quality: {lead.website_quality})
            Google Rating: {lead.rating}
            Calculated Score: {score}
            Priority Tier: {tier}
            Audit Notes: {lead.audit_notes}
            
            Write a brief, punchy sales rationale (max 15 words) explaining why this business is ranked as {tier} opportunity.
            Return a JSON object:
            {{"sales_rationale": "your sentence here"}}
            """
            
            sales_rationale = f"Lack of web presence makes this a prime {tier} sales target."
            try:
                nim_output = await self.nvidia_client.get_chat_completion(
                    model=MODEL_SCORING,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.1
                )
                json_str = re.search(r"\{.*\}", nim_output, re.DOTALL)
                if json_str:
                    data = json.loads(json_str.group(0))
                    sales_rationale = data.get("sales_rationale", sales_rationale)
            except Exception as e:
                logger.error(f"Failed to fetch LLaMA scoring rationale: {str(e)}")

            # Update the audit notes with the sales rationale
            refined_notes = f"{lead.audit_notes or ''} | Sales Rationale: {sales_rationale}"

            scored_leads.append(ScoredLeadRecord(
                business_name=lead.business_name,
                address=lead.address,
                phone=lead.phone,
                category=lead.category,
                google_maps_url=lead.google_maps_url,
                rating=lead.rating,
                has_website=lead.has_website,
                website_url=lead.website_url,
                website_quality=lead.website_quality,
                audit_notes=refined_notes,
                is_ssl=lead.is_ssl,
                opportunity_score=score,
                priority_tier=tier
            ))

        log_callback(f"Scoring complete. Outputting ranked lead listings.")
        # Sort leads by score descending
        scored_leads.sort(key=lambda x: x.opportunity_score, reverse=True)
        return scored_leads
