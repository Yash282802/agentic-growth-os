import httpx
import urllib.parse
from typing import List, Callable, Dict, Any
from app.agents.base import AgentIQAgent
from app.schemas import LeadRecord
from app.config import GOOGLE_PLACES_API_KEY

class LeadDiscoveryAgent(AgentIQAgent):
    def __init__(self):
        super().__init__(
            name="Lead Discovery",
            description="Finds real businesses matching a niche and location using Google Places API or mock simulation."
        )
        self.api_key = GOOGLE_PLACES_API_KEY

    async def run(self, input_data: Dict[str, str], log_callback: Callable[[str], None]) -> List[LeadRecord]:
        niche = input_data.get("niche", "")
        location = input_data.get("location", "")
        
        log_callback(f"Analyzing query: searching for '{niche}' in '{location}'")
        
        if not self.api_key:
            log_callback("Google Places API Key not found. Initiating dynamic Lead Simulation engine.")
            return await self._simulate_leads(niche, location, log_callback)

        log_callback(f"Connecting to Google Places API to find {niche} in {location}...")
        
        leads = []
        try:
            # Step 1: Text Search to find Place IDs
            query = f"{niche} in {location}"
            encoded_query = urllib.parse.quote(query)
            search_url = f"https://maps.googleapis.com/maps/api/place/textsearch/json?query={encoded_query}&key={self.api_key}"
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                search_response = await client.get(search_url)
                if search_response.status_code != 200:
                    log_callback(f"Google Places API Error: {search_response.status_code}. Falling back to simulation.")
                    return await self._simulate_leads(niche, location, log_callback)
                
                search_data = search_response.json()
                results = search_data.get("results", [])[:10] # Limit to top 10 for speed
                
                log_callback(f"Found {len(results)} raw business listings. Fetching contact details...")
                
                for idx, result in enumerate(results):
                    place_id = result.get("place_id")
                    name = result.get("name")
                    address = result.get("formatted_address")
                    rating = result.get("rating")
                    
                    # Step 2: Place Details to get phone, website, and maps URL
                    details_url = f"https://maps.googleapis.com/maps/api/place/details/json?place_id={place_id}&fields=formatted_phone_number,website,url&key={self.api_key}"
                    phone = None
                    website = None
                    maps_url = f"https://www.google.com/maps/place/?q=place_id:{place_id}"
                    
                    try:
                        details_response = await client.get(details_url)
                        if details_response.status_code == 200:
                            details_data = details_response.json().get("result", {})
                            phone = details_data.get("formatted_phone_number")
                            website = details_data.get("website")
                            maps_url = details_data.get("url", maps_url)
                    except Exception as details_err:
                        log_callback(f"Failed to fetch details for '{name}': {str(details_err)}")
                    
                    leads.append(LeadRecord(
                        business_name=name,
                        address=address,
                        phone=phone,
                        category=niche.capitalize(),
                        google_maps_url=maps_url,
                        rating=rating
                    ))
                    log_callback(f"[{idx+1}/{len(results)}] Discovered: {name} (Rating: {rating}, Web: {website or 'None'})")
                    
        except Exception as e:
            log_callback(f"Failed to execute Google Places search: {str(e)}. Falling back to simulation.")
            return await self._simulate_leads(niche, location, log_callback)
            
        return leads

    async def _simulate_leads(self, niche: str, location: str, log_callback: Callable[[str], None]) -> List[LeadRecord]:
        """
        Simulates structured lead records based on the niche and location.
        """
        import asyncio
        await asyncio.sleep(1.5) # Simulate latency
        
        niche_lower = niche.lower()
        
        # Templates for different niches
        names = []
        if "restaurant" in niche_lower or "food" in niche_lower or "cafe" in niche_lower:
            names = [
                ("The Golden Fork", "http://thegoldenfork.example.com", True),
                ("Corner Bakery & Cafe", None, False),
                ("Spicy Basil Bistro", "http://spicybasil.example.com", True),
                ("Urban Eats Grill", None, False),
                ("Mama's Pizza Kitchen", "http://mamaspizzakitchen.example.com", False) # SSL false
            ]
        elif "salon" in niche_lower or "hair" in niche_lower or "spa" in niche_lower:
            names = [
                ("Vibrant Hair Studio", "https://vibranthair.example.com", True),
                ("Urban Roots Salon", None, False),
                ("Elite Nail Spa", "http://elitenailspa.example.com", False),
                ("Sleek & Chic Cuts", None, False),
                ("Serenity Wellness Spa", "https://serenityspa.example.com", True)
            ]
        elif "dental" in niche_lower or "dentist" in niche_lower or "clinic" in niche_lower:
            names = [
                ("Bright Smiles Dental", "https://brightsmiles.example.com", True),
                ("Metro Family Clinic", None, False),
                ("Downtown Dentist Office", "http://downtowndentist.example.com", False),
                ("Lakeside Dental Care", "https://lakesidedental.example.com", True),
                ("Apex Health Center", None, False)
            ]
        else:
            # Generic B2B templates
            names = [
                (f"Apex {niche.capitalize()} Services", f"https://apex{niche.lower()}.example.com", True),
                (f"Local {niche.capitalize()} Co.", None, False),
                (f"Premium {niche.capitalize()} Partners", f"http://premium{niche.lower()}.example.com", False),
                (f"Metro {niche.capitalize()} Hub", None, False),
                (f"{location.split(',')[0]} {niche.capitalize()} Experts", f"https://{location.split(',')[0].lower().strip()}{niche.lower()}.example.com", True)
            ]
            
        leads = []
        for idx, (name, website, has_ssl) in enumerate(names):
            address = f"{100 + idx * 45} Main Street, {location}"
            phone = f"+1 (512) 555-019{idx}" if "us" in location.lower() or "texas" in location.lower() or "austin" in location.lower() else f"+91 98765 4321{idx}"
            rating = round(random_rating(idx), 1)
            
            # Formulate a simulated Google Maps URL
            query_name = urllib.parse.quote(f"{name} {location}")
            maps_url = f"https://www.google.com/maps/search/?api=1&query={query_name}"
            
            leads.append(LeadRecord(
                business_name=name,
                address=address,
                phone=phone,
                category=niche.capitalize(),
                google_maps_url=maps_url,
                rating=rating
            ))
            
            log_callback(f"[{idx+1}/{len(names)}] Discovered: {name} (Rating: {rating}, Web: {website or 'None'})")
            
        return leads

def random_rating(seed: int) -> float:
    # Deterministic rating generation
    ratings = [4.2, 3.8, 4.8, 3.5, 4.0]
    return ratings[seed % len(ratings)]
