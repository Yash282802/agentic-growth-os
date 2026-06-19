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
        max_leads = input_data.get("max_leads", 10)
        
        log_callback(f"Analyzing query: searching for '{niche}' in '{location}'")
        
        if not self.api_key:
            log_callback("Google Places API Key not found. Initiating dynamic Lead Simulation engine.")
            return await self._simulate_leads(niche, location, max_leads, log_callback)

        log_callback(f"Connecting to Google Places API to find {niche} in {location}...")
        
        leads = []
        import asyncio
        try:
            # Step 1: Text Search to find Place IDs (with pagination)
            query = f"{niche} in {location}"
            encoded_query = urllib.parse.quote(query)
            
            async with httpx.AsyncClient(timeout=15.0) as client:
                all_results = []
                next_page_token = None
                
                while len(all_results) < max_leads:
                    if next_page_token:
                        await asyncio.sleep(2)
                        search_url = f"https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken={next_page_token}&key={self.api_key}"
                    else:
                        search_url = f"https://maps.googleapis.com/maps/api/place/textsearch/json?query={encoded_query}&key={self.api_key}"
                    
                    search_response = await client.get(search_url)
                    if search_response.status_code != 200:
                        log_callback(f"Google Places API Error: {search_response.status_code}. Falling back to simulation.")
                        return await self._simulate_leads(niche, location, max_leads, log_callback)
                    
                    search_data = search_response.json()
                    results_batch = search_data.get("results", [])
                    all_results.extend(results_batch)
                    
                    next_page_token = search_data.get("next_page_token")
                    if not next_page_token:
                        break
                
                results = all_results[:max_leads]
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
            return await self._simulate_leads(niche, location, max_leads, log_callback)
            
        return leads

    async def _simulate_leads(self, niche: str, location: str, max_leads: int, log_callback: Callable[[str], None]) -> List[LeadRecord]:
        """
        Simulates structured lead records based on the niche and location.
        """
        import asyncio
        await asyncio.sleep(1.5)
        
        niche_lower = niche.lower()
        
        templates = []
        if "restaurant" in niche_lower or "food" in niche_lower or "cafe" in niche_lower:
            templates = [
                ("The Golden Fork", "http://thegoldenfork.example.com", True),
                ("Corner Bakery & Cafe", None, False),
                ("Spicy Basil Bistro", "http://spicybasil.example.com", True),
                ("Urban Eats Grill", None, False),
                ("Mama's Pizza Kitchen", "http://mamaspizzakitchen.example.com", False),
                ("Riverside Bistro & Bar", "https://riversidebistro.example.com", True),
                ("The Daily Grind Cafe", None, False),
                ("Savory Spice Kitchen", "http://savoryspice.example.com", True),
                ("Harbor View Restaurant", None, False),
                ("Twisted Olive Tapas", "https://twistedolive.example.com", True),
                ("Maple Street Diner", "http://maplestreet.example.com", False),
                ("Fusion Bowl Kitchen", None, False),
                ("Sunset Grill & Bar", "https://sunsetgrill.example.com", True),
                ("Bella Vita Ristorante", None, False),
                ("Golden Dragon Chinese", "http://goldendragon.example.com", True),
            ]
        elif "salon" in niche_lower or "hair" in niche_lower or "spa" in niche_lower:
            templates = [
                ("Vibrant Hair Studio", "https://vibranthair.example.com", True),
                ("Urban Roots Salon", None, False),
                ("Elite Nail Spa", "http://elitenailspa.example.com", False),
                ("Sleek & Chic Cuts", None, False),
                ("Serenity Wellness Spa", "https://serenityspa.example.com", True),
                ("Luxe Beauty Lounge", "https://luxebeauty.example.com", True),
                ("The Barber Collective", None, False),
                ("Glow Skin Clinic", "http://glowskin.example.com", False),
                ("Polished Nail Bar", None, False),
                ("Tranquil Day Spa", "https://tranquilspa.example.com", True),
                ("Bold Cuts Barber Shop", "http://boldcuts.example.com", False),
                ("Radiance Beauty Studio", None, False),
                ("The Mane Attraction", "https://maneattraction.example.com", True),
                ("Pure Bliss Spa", None, False),
                ("Golden Shears Salon", "https://goldenshears.example.com", True),
            ]
        elif "dental" in niche_lower or "dentist" in niche_lower or "clinic" in niche_lower:
            templates = [
                ("Bright Smiles Dental", "https://brightsmiles.example.com", True),
                ("Metro Family Clinic", None, False),
                ("Downtown Dentist Office", "http://downtowndentist.example.com", False),
                ("Lakeside Dental Care", "https://lakesidedental.example.com", True),
                ("Apex Health Center", None, False),
                ("Premier Dental Associates", "https://premierdental.example.com", True),
                ("Community Health Clinic", None, False),
                ("Elite Dental Spa", "http://elitedental.example.com", False),
                ("Westside Medical Center", None, False),
                ("Smile Bright Orthodontics", "https://smilebright.example.com", True),
                ("Pine Valley Clinic", "http://pinevalley.example.com", True),
                ("Harbor Dental Group", None, False),
                ("Advanced Care Dental", "https://advancedcare.example.com", True),
                ("Oakwood Family Health", None, False),
                ("City Dental Studio", "https://citydental.example.com", True),
            ]
        else:
            templates = [
                (f"Apex {niche.capitalize()} Services", f"https://apex{niche.lower()}.example.com", True),
                (f"Local {niche.capitalize()} Co.", None, False),
                (f"Premium {niche.capitalize()} Partners", f"http://premium{niche.lower()}.example.com", False),
                (f"Metro {niche.capitalize()} Hub", None, False),
                (f"{location.split(',')[0]} {niche.capitalize()} Experts", f"https://{location.split(',')[0].lower().strip()}{niche.lower()}.example.com", True),
                (f"National {niche.capitalize()} Solutions", f"https://national{niche.lower()}.example.com", True),
                (f"{niche.capitalize()} Pro Services", None, False),
                (f"Allied {niche.capitalize()} Group", f"http://allied{niche.lower()}.example.com", False),
                (f"Prime {niche.capitalize()} Hub", None, False),
                (f"Elite {niche.capitalize()} Network", f"https://elite{niche.lower()}.example.com", True),
                (f"Blue Ribbon {niche.capitalize()}", f"http://blueribbon{niche.lower()}.example.com", True),
                (f"First Choice {niche.capitalize()}", None, False),
                (f"Citywide {niche.capitalize()} Pros", f"https://citywide{niche.lower()}.example.com", True),
                (f"Trusted {niche.capitalize()} Care", None, False),
                (f"Superior {niche.capitalize()} Ltd", f"https://superior{niche.lower()}.example.com", True),
            ]
            
        names = templates[:max_leads]
        leads = []
        for idx, (name, website, has_ssl) in enumerate(names):
            address = f"{100 + idx * 45} Main Street, {location}"
            phone = f"+1 (512) 555-{str(idx).zfill(4)}" if "us" in location.lower() or "texas" in location.lower() or "austin" in location.lower() else f"+91 98765 {str(idx).zfill(5)}"
            rating = round(random_rating(idx), 1)
            
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
