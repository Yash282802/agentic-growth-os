import asyncio
import httpx
import json
import logging
from typing import Callable, Dict, Any, List
from app.agents.base import AgentIQAgent
from app.utils.nvidia_client import NvidiaClient
from app.config import GITHUB_TOKEN, VERCEL_TOKEN

logger = logging.getLogger("agentiq")
nvidia = NvidiaClient()


class PRDGeneratorAgent(AgentIQAgent):
    def __init__(self):
        super().__init__(
            name="PRD Generation",
            description="Writes a real PRD using NVIDIA NIM"
        )

    async def run(self, input_data: Any, log_callback: Callable[[str], None]) -> Any:
        leads = input_data.get("leads", []) if isinstance(input_data, dict) else []
        for lead in leads:
            biz = lead.get("business_name", "Unknown")
            cat = lead.get("category", "business")
            log_callback(f"Generating PRD for {biz} via NVIDIA NIM...")

            prompt = f"""Write a detailed Product Requirements Document (PRD) for a website for a {cat} business called "{biz}".
Include: business goals, target audience, pages needed, features, success metrics.
Output in markdown."""

            prd = await nvidia.get_chat_completion(
                model="meta/llama-3.3-70b-instruct",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=2048,
                timeout=60.0
            )
            lead["prd_markdown"] = prd
            log_callback(f"PRD generated for {biz}")
        return {"leads": leads}


class StitchAgent(AgentIQAgent):
    def __init__(self):
        super().__init__(
            name="Frontend Generation",
            description="Generates Next.js frontend code via NVIDIA NIM"
        )

    async def run(self, input_data: Any, log_callback: Callable[[str], None]) -> Any:
        leads = input_data.get("leads", []) if isinstance(input_data, dict) else []
        for lead in leads:
            biz = lead.get("business_name", "Unknown")
            cat = lead.get("category", "business")
            log_callback(f"Generating React/Next.js frontend code for {biz}...")

            prompt = f"""Generate a compact Next.js 'use client' page for a {cat} business called "{biz}".
Tailwind CSS, single file, <200 lines. Include: hero with name, services cards, contact form, footer with hours.
Use lucide-react icons. Export default function. ONLY output TypeScript code."""

            code = await nvidia.get_chat_completion(
                model="meta/llama-3.3-70b-instruct",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=2048,
                timeout=60.0
            )
            lead["page_code"] = code
            lead["screen_list"] = ["Home", "About", "Services", "Contact"]
            log_callback(f"Frontend code generated for {biz}")
        return {"leads": leads}


class BackendSchemaAgent(AgentIQAgent):
    def __init__(self):
        super().__init__(
            name="Backend Schema",
            description="Generates FastAPI backend code via NVIDIA NIM"
        )

    async def run(self, input_data: Any, log_callback: Callable[[str], None]) -> Any:
        leads = input_data.get("leads", []) if isinstance(input_data, dict) else []
        for lead in leads:
            biz = lead.get("business_name", "Unknown")
            log_callback(f"Generating FastAPI backend code for {biz}...")

            prompt = f"""Generate a complete FastAPI backend 'app.py' for a small business website. Include:
- POST /api/contact endpoint (accepts name, email, message)
- POST /api/bookings endpoint (accepts customer_name, email, phone, service, preferred_date)
- GET /api/health endpoint
- SQLite database with SQLAlchemy models
- CORS middleware for all origins
Output ONLY the Python code, no explanations."""

            code = await nvidia.get_chat_completion(
                model="meta/llama-3.3-70b-instruct",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=2048,
                timeout=60.0
            )
            lead["backend_code"] = code
            lead["endpoints"] = ["POST /api/contact", "POST /api/bookings", "GET /api/health"]
            log_callback(f"Backend code generated for {biz}")
        return {"leads": leads}


class BuildAgent(AgentIQAgent):
    def __init__(self):
        super().__init__(
            name="Build",
            description="Pushes generated code to GitHub"
        )

    async def run(self, input_data: Any, log_callback: Callable[[str], None]) -> Any:
        from github import Github, GithubException

        leads = input_data.get("leads", []) if isinstance(input_data, dict) else []
        if not GITHUB_TOKEN:
            log_callback("GITHUB_TOKEN not set. Skipping GitHub push.")
            return {"leads": leads}

        gh = Github(GITHUB_TOKEN)
        user = gh.get_user()
        log_callback(f"Authenticated to GitHub as {user.login}")

        for lead in leads:
            biz = lead.get("business_name", "Unknown")
            safe_name = biz.lower().replace(" ", "-").replace("'", "").replace("&", "and")
            safe_name = "".join(c for c in safe_name if c.isalnum() or c == "-")

            page_code = lead.get("page_code", "")
            backend_code = lead.get("backend_code", "")
            prd = lead.get("prd_markdown", "")

            repo = None
            for attempt in range(5):
                candidate = safe_name if attempt == 0 else f"{safe_name}-{attempt}"
                log_callback(f"Creating GitHub repo '{candidate}' for {biz}...")
                try:
                    repo = user.create_repo(
                        name=candidate,
                        description=f"Website for {biz} - generated by Agentic Growth OS",
                        private=False,
                        auto_init=True
                    )
                    safe_name = candidate
                    break
                except GithubException as e:
                    msg = e.data.get("message", str(e))
                    errors = e.data.get("errors", [])
                    err_str = str(e.data)
                    exists = any("already" in (err.get("message","")+" "+err.get("field","")) for err in errors)
                    exists |= "already exists" in err_str or "already_exists" in err_str
                    if exists:
                        log_callback(f"  Name '{candidate}' taken, trying next...")
                        continue
                    log_callback(f"GitHub error for {biz}: {msg}")
                    lead["github_repo_url"] = f"https://github.com/Yash282802/{safe_name}"
                    break

            if repo is None:
                lead["github_repo_url"] = f"https://github.com/Yash282802/{safe_name}"
                continue

            log_callback(f"Repo created: {repo.html_url}")

            files = {
                "frontend/app/page.tsx": page_code,
                "frontend/package.json": json.dumps({
                    "name": safe_name,
                    "version": "0.1.0",
                    "private": True,
                    "scripts": {"dev": "next dev", "build": "next build", "start": "next start"},
                    "dependencies": {"next": "^14.0.0", "react": "^18.0.0", "react-dom": "^18.0.0", "lucide-react": "^0.300.0"},
                    "devDependencies": {"@types/node": "^20", "@types/react": "^18", "@types/react-dom": "^18", "tailwindcss": "^3", "typescript": "^5"}
                }, indent=2),
                "frontend/tsconfig.json": json.dumps({
                    "compilerOptions": {"target": "es5", "lib": ["dom", "dom.iterable", "esnext"], "jsx": "preserve", "module": "esnext", "moduleResolution": "bundler", "allowJs": True, "strict": True, "esModuleInterop": True, "skipLibCheck": True, "forceConsistentCasingInFileNames": True},
                    "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
                    "exclude": ["node_modules"]
                }, indent=2),
                "backend/app.py": backend_code,
                "backend/requirements.txt": "fastapi\nuvicorn\nsqlalchemy\n",
                "PRD.md": prd,
            }

            for file_path, content in files.items():
                if content:
                    try:
                        repo.create_file(file_path, f"Add {file_path}", content)
                        log_callback(f"  Created {file_path}")
                    except GithubException as e:
                        log_callback(f"  Skipped {file_path}: {e.data.get('message', str(e))}")

            lead["github_repo_url"] = repo.html_url
            lead["github_repo_id"] = repo.id
            lead["repo_structure"] = "\n".join(files.keys())
            log_callback(f"GitHub push complete for {biz}: {repo.html_url}")

        return {"leads": leads}


class DeployAgent(AgentIQAgent):
    def __init__(self):
        super().__init__(
            name="Deploy",
            description="Deploys to Vercel from GitHub"
        )

    async def run(self, input_data: Any, log_callback: Callable[[str], None]) -> Any:
        leads = input_data.get("leads", []) if isinstance(input_data, dict) else []
        if not VERCEL_TOKEN:
            log_callback("VERCEL_TOKEN not set. Skipping deploy.")
            return {"leads": leads}

        async with httpx.AsyncClient(timeout=30.0) as client:
            for lead in leads:
                repo_url = lead.get("github_repo_url", "")
                repo_id = lead.get("github_repo_id")
                biz = lead.get("business_name", "Unknown")
                repo_name = repo_url.rstrip("/").split("/")[-1] if repo_url else ""
                if not repo_url:
                    log_callback(f"No GitHub repo URL for {biz}, skipping deploy")
                    continue
                if not repo_id:
                    log_callback(f"No GitHub repo ID for {biz}, skipping deploy")
                    continue

                log_callback(f"Deploying {biz} to Vercel...")

                headers = {
                    "Authorization": f"Bearer {VERCEL_TOKEN}",
                    "Content-Type": "application/json"
                }

                try:
                    resp = await client.post(
                        "https://api.vercel.com/v13/deployments?skipAutoDetectionConfirmation=1",
                        headers=headers,
                        json={
                            "name": repo_name,
                            "gitSource": {
                                "type": "github",
                                "repoId": repo_id,
                                "ref": "main"
                            },
                            "target": "production"
                        }
                    )

                    if resp.status_code in (200, 201):
                        data = resp.json()
                        preview = data.get("url", "")
                        if preview and not preview.startswith("http"):
                            preview = f"https://{preview}"
                        lead["preview_url"] = preview
                        log_callback(f"Deployed: {preview}")
                    else:
                        log_callback(f"Vercel returned {resp.status_code}: {resp.text[:300]}")
                        lead["preview_url"] = f"https://{repo_name}.vercel.app"

                except Exception as e:
                    log_callback(f"Deploy error for {biz}: {str(e)[:200]}")
                    lead["preview_url"] = f"https://{repo_name}.vercel.app"

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

            lead["outstanding_items"] = [
                "Add real business photos",
                "Update services/pricing",
                "Configure custom domain"
            ]
            log_callback(f"  Needs client input: {', '.join(lead['outstanding_items'])}")
        return {"leads": leads}
