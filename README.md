# Agentic Growth OS

B2B client acquisition pipeline powered by NVIDIA AI Stack. Multi-agent orchestration that discovers, audits, scores, and reaches out to business leads automatically.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│  Frontend   │────▶│   Backend    │────▶│   PostgreSQL   │
│  (Vercel)   │     │  (Railway)   │     │   (Railway)    │
└─────────────┘     └──────────────┘     └────────────────┘
```

### Agent Pipeline

1. **Lead Discovery** — Discovers businesses via Google Places API
2. **Website Audit** — Checks website accessibility and layout quality
3. **Opportunity Scoring** — Multi-factor rubric scoring (HOT/WARM/COLD)
4. **Outreach Generation** — Drafts personalized copy for email, LinkedIn, WhatsApp, Facebook
5. **CRM Storage** — Deduplication with embeddings, saves to PostgreSQL

## Deployment

| Layer | Platform | URL |
|-------|----------|-----|
| Frontend | Vercel | [agentic-growth-os.vercel.app](https://agentic-growth-os.vercel.app) |
| Backend | Railway | `https://backend-production-9c52.up.railway.app` |
| Database | Railway Postgres | Internal |

## Tech Stack

- **Frontend:** Next.js 16, TypeScript, Tailwind CSS, Lucide Icons
- **Backend:** Python, FastAPI, SQLAlchemy, Uvicorn
- **Database:** PostgreSQL 17
- **APIs:** Google Places, NVIDIA NIM (Nemotron 49B)
- **Infrastructure:** Vercel, Railway

## Local Development

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_URL=http://localhost:8000` in frontend `.env.local`.

## License

MIT
