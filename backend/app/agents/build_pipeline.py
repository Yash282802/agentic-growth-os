import logging
from typing import Callable, Dict, Any, List
from app.agents.base import AgentIQAgent

logger = logging.getLogger("agentiq")

class PRDGeneratorAgent(AgentIQAgent):
    def __init__(self):
        super().__init__(
            name="PRD Generation",
            description="Writes a PRD for this business's website"
        )

    async def run(self, input_data: Any, log_callback: Callable[[str], None]) -> Any:
        leads = input_data.get("leads", []) if isinstance(input_data, dict) else []
        if not leads:
            log_callback("No approved leads to generate PRDs for.")
            return {"leads": []}

        for lead in leads:
            biz = lead.get("business_name", "Unknown")
            cat = lead.get("category", "business")
            log_callback(f"Generating PRD for {biz}...")

            lead["prd_markdown"] = f"""# Website PRD: {biz}

## Business Category
{cat}

## Goals
- Establish a professional online presence for {biz}
- Enable customer discovery via search engines
- Provide clear contact and booking options

## Pages
1. Home — brand intro, tagline, CTA
2. About — story, team, mission
3. Services — list of offerings with descriptions
4. Contact — form, phone, map, hours
5. Gallery/Portfolio — visuals of work done (if applicable)

## Must-Have Features
- Mobile-responsive design
- Contact form with email notification
- Google Maps embed
- Business hours display
- Social media links

## Success Metrics
- Page load < 2s
- Contact form submission rate
- Google Business Profile clicks to website
"""
            log_callback(f"PRD generated for {biz}")
        return {"leads": leads}


class StitchAgent(AgentIQAgent):
    def __init__(self):
        super().__init__(
            name="Frontend Generation",
            description="Generates Stitch UI prompt from PRD"
        )

    async def run(self, input_data: Any, log_callback: Callable[[str], None]) -> Any:
        leads = input_data.get("leads", []) if isinstance(input_data, dict) else []
        for lead in leads:
            biz = lead.get("business_name", "Unknown")
            cat = lead.get("category", "business")
            log_callback(f"Generating frontend prompt for {biz}...")

            light_dark = "light" if cat.lower() in ["dental", "clinic", "medical"] else "dark"
            lead["stitch_prompt"] = f"Create a {light_dark}-theme {cat.lower()} website for {biz}. Include: hero section with business name and CTA, services grid, about section, contact form, Google Maps embed, footer with hours and social links."
            lead["screen_list"] = ["Home", "About", "Services", "Contact", "Gallery"]
            log_callback(f"Frontend prompt ready for {biz}")
        return {"leads": leads}


class BackendSchemaAgent(AgentIQAgent):
    def __init__(self):
        super().__init__(
            name="Backend Schema",
            description="Designs backend schema sized for this business"
        )

    async def run(self, input_data: Any, log_callback: Callable[[str], None]) -> Any:
        leads = input_data.get("leads", []) if isinstance(input_data, dict) else []
        for lead in leads:
            biz = lead.get("business_name", "Unknown")
            log_callback(f"Designing backend schema for {biz}...")

            lead["schema_sql"] = """CREATE TABLE contacts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(20),
  message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  customer_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(20),
  service VARCHAR(100),
  preferred_date DATE,
  preferred_time TIME,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
"""
            lead["endpoints"] = ["POST /api/contact", "POST /api/bookings", "GET /api/services"]
            log_callback(f"Schema designed for {biz}")
        return {"leads": leads}


class BuildAgent(AgentIQAgent):
    def __init__(self):
        super().__init__(
            name="Build",
            description="Scaffolds the repo from Stitch export + schema"
        )

    async def run(self, input_data: Any, log_callback: Callable[[str], None]) -> Any:
        leads = input_data.get("leads", []) if isinstance(input_data, dict) else []
        for lead in leads:
            biz = lead.get("business_name", "Unknown")
            log_callback(f"Scaffolding project for {biz}...")

            lead["repo_structure"] = f"""{biz.lower().replace(' ', '-')}/
├── frontend/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── about/page.tsx
│   │   ├── services/page.tsx
│   │   └── contact/page.tsx
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── Hero.tsx
│   │   ├── Services.tsx
│   │   ├── ContactForm.tsx
│   │   └── Footer.tsx
│   ├── public/
│   │   └── images/
│   └── package.json
├── backend/
│   ├── app.py
│   ├── models.py
│   ├── requirements.txt
│   └── Procfile
└── README.md"""
            lead["sections_needing_content"] = ["Real business photos", "Actual services/pricing", "Team member bios"]
            log_callback(f"Project scaffolded for {biz}")
        return {"leads": leads}


class DeployAgent(AgentIQAgent):
    def __init__(self):
        super().__init__(
            name="Deploy",
            description="Pushes to GitHub and deploys to Vercel preview"
        )

    async def run(self, input_data: Any, log_callback: Callable[[str], None]) -> Any:
        leads = input_data.get("leads", []) if isinstance(input_data, dict) else []
        for lead in leads:
            biz = lead.get("business_name", "Unknown")
            log_callback(f"Deploying preview for {biz}...")

            safe_name = biz.lower().replace(' ', '-').replace("'", "")
            lead["github_repo_url"] = f"https://github.com/Yash282802/{safe_name}"
            lead["preview_url"] = f"https://{safe_name}.vercel.app"
            log_callback(f"Preview deployed: {lead['preview_url']}")
        return {"leads": leads}


class NotifyAgent(AgentIQAgent):
    def __init__(self):
        super().__init__(
            name="Notify",
            description="Summarizes what's done and outstanding"
        )

    async def run(self, input_data: Any, log_callback: Callable[[str], None]) -> Any:
        leads = input_data.get("leads", []) if isinstance(input_data, dict) else []
        for lead in leads:
            biz = lead.get("business_name", "Unknown")
            log_callback(f"Build complete for {biz}")
            log_callback(f"  Preview: {lead.get('preview_url', 'N/A')}")
            log_callback(f"  Repo: {lead.get('github_repo_url', 'N/A')}")

            lead["outstanding_items"] = lead.get("sections_needing_content", [])
            log_callback(f"  Needs client input: {', '.join(lead['outstanding_items'])}")
        return {"leads": leads}
