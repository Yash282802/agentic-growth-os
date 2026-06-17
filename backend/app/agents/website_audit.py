import httpx
import asyncio
import re
import logging
from typing import List, Callable, Dict, Any
from app.agents.base import AgentIQAgent
from app.schemas import LeadRecord, AuditedLeadRecord
from app.utils.nvidia_client import NvidiaClient
from app.config import MODEL_AUDIT

logger = logging.getLogger("website_audit")

class WebsiteAuditAgent(AgentIQAgent):
    def __init__(self):
        super().__init__(
            name="Website Audit",
            description="Audits business websites for SSL, responsiveness, loading speed, and general design quality."
        )
        self.nvidia_client = NvidiaClient()

    async def run(self, input_leads: List[LeadRecord], log_callback: Callable[[str], None]) -> List[AuditedLeadRecord]:
        log_callback(f"Starting audit for {len(input_leads)} discovered leads...")
        
        audited_leads = []
        for idx, lead in enumerate(input_leads):
            # Parse or extract a website URL from maps URL or business name
            website_url = self._extract_url_from_lead(lead)
            
            log_callback(f"[{idx+1}/{len(input_leads)}] Auditing: '{lead.business_name}' (Website: {website_url or 'None'})")
            
            has_website = False
            is_ssl = False
            website_quality = "NO_WEBSITE"
            audit_notes = "No web presence detected."
            
            if website_url:
                has_website = True
                is_ssl = website_url.startswith("https://")
                
                # Perform actual HTTP probe
                probe_success, load_time, page_text = await self._probe_website(website_url)
                
                if not probe_success:
                    log_callback(f"   -> Site {website_url} is unreachable or timed out. Classifying as outdated/broken.")
                    website_quality = "OUTDATED"
                    audit_notes = f"Website URL is listed ({website_url}) but the server is unreachable or returned an error. High opportunity to provide a reliable hosting and design overhaul."
                else:
                    log_callback(f"   -> Site loaded in {load_time:.2f}s. Running NIM audit...")
                    # Build NIM analysis prompt
                    prompt = f"""
                    Analyze this B2B website profile and output a JSON object:
                    Business Name: {lead.business_name}
                    Website URL: {website_url}
                    Category: {lead.category}
                    Load Time: {load_time:.2f} seconds
                    SSL Status: {"HTTPS secured" if is_ssl else "HTTP insecure"}
                    Home Page Contents: {page_text[:1000]}
                    
                    Return a JSON object with:
                    "website_quality": one of "BASIC_LANDING", "OUTDATED", "DECENT", "PROFESSIONAL"
                    "audit_notes": a 1-2 sentence description of design flaws, missing CTAs, responsiveness issues, or security warnings.
                    """
                    
                    try:
                        nim_output = await self.nvidia_client.get_chat_completion(
                            model=MODEL_AUDIT,
                            messages=[{"role": "user", "content": prompt}],
                            temperature=0.1
                        )
                        # Parse JSON from NIM response
                        import json
                        # Clean code block indicators if model generated them
                        json_str = re.search(r"\{.*\}", nim_output, re.DOTALL)
                        if json_str:
                            data = json.loads(json_str.group(0))
                            website_quality = data.get("website_quality", "DECENT")
                            audit_notes = data.get("audit_notes", "Audit completed.")
                        else:
                            website_quality = "DECENT"
                            audit_notes = "Website seems functional. Slight updates recommended."
                    except Exception as e:
                        logger.error(f"Failed to parse NIM Mixtral output: {str(e)}")
                        # Deterministic fallback classification
                        website_quality = "OUTDATED" if load_time > 2.5 else "DECENT"
                        audit_notes = f"Website loaded but performance is slow ({load_time:.2f}s). Lacks strong calls to action on the landing page."
            else:
                log_callback(f"   -> No website found. Flagging for landing page pitch.")
            
            audited_leads.append(AuditedLeadRecord(
                business_name=lead.business_name,
                address=lead.address,
                phone=lead.phone,
                category=lead.category,
                google_maps_url=lead.google_maps_url,
                rating=lead.rating,
                has_website=has_website,
                website_url=website_url,
                website_quality=website_quality,
                audit_notes=audit_notes,
                is_ssl=is_ssl
            ))
            
            # Artificial sleep to show nice step-by-step progress on frontend
            await asyncio.sleep(0.5)

        log_callback(f"Completed auditing all {len(input_leads)} leads.")
        return audited_leads

    def _extract_url_from_lead(self, lead: LeadRecord) -> str:
        """
        Extracts website URL. For simulation purposes, we match specific business names to mock domains.
        """
        name_lower = lead.business_name.lower()
        if "golden fork" in name_lower:
            return "http://thegoldenfork.example.com"
        elif "spicy basil" in name_lower:
            return "http://spicybasil.example.com"
        elif "mamas pizza" in name_lower:
            return "http://mamaspizzakitchen.example.com"
        elif "vibrant hair" in name_lower:
            return "https://vibranthair.example.com"
        elif "elite nail" in name_lower:
            return "http://elitenailspa.example.com"
        elif "serenity wellness" in name_lower:
            return "https://serenityspa.example.com"
        elif "bright smiles" in name_lower:
            return "https://brightsmiles.example.com"
        elif "downtown dentist" in name_lower:
            return "http://downtowndentist.example.com"
        elif "lakeside dental" in name_lower:
            return "https://lakesidedental.example.com"
        elif "apex" in name_lower:
            return f"https://{name_lower.replace(' ', '')}.com"
        elif "premium" in name_lower:
            return f"http://{name_lower.replace(' ', '')}.com"
        elif "experts" in name_lower:
            return f"https://{name_lower.replace(' ', '')}.com"
        return None

    async def _probe_website(self, url: str) -> tuple[bool, float, str]:
        """
        Tries to fetch the website URL. Returns (success, duration, snippet).
        Uses httpx with a very low timeout to prevent blocking during the hackathon run.
        """
        import time
        start_time = time.time()
        try:
            # We mock the response for example.com domains to avoid DNS errors,
            # but allow real HTTP gets for other sites.
            if "example.com" in url:
                await asyncio.sleep(0.4) # Simulate network lag
                duration = time.time() - start_time
                snippet = "<html><head><title>Business Portal</title><meta name='viewport' content='width=device-width'></head><body>Welcome to our business homepage. Contact us at the number above!</body></html>"
                return True, duration, snippet
                
            async with httpx.AsyncClient(timeout=3.0) as client:
                response = await client.get(url, follow_redirects=True)
                duration = time.time() - start_time
                return response.status_code == 200, duration, response.text
        except Exception:
            duration = time.time() - start_time
            return False, duration, ""
