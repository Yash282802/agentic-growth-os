const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, Header, Footer,
  TabStopType, TabStopPosition
} = require('docx');
const fs = require('fs');

// ─── Color palette ───────────────────────────────────────────────────────────
const C = {
  black:      "000000",
  white:      "FFFFFF",
  accent:     "76B900",   // NVIDIA green
  accentDark: "4D7A00",
  headerBg:   "1A1A1A",
  rowAlt:     "F4F7F0",
  gray:       "666666",
  lightGray:  "F2F2F2",
  border:     "CCCCCC",
  sectionBg:  "EEF5E6",
};

// ─── Reusable border object ───────────────────────────────────────────────────
const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: C.border };
const allBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 160 },
    children: [new TextRun({ text, bold: true, size: 36, font: "Arial", color: C.black })]
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.accent, space: 4 } },
    children: [new TextRun({ text, bold: true, size: 28, font: "Arial", color: C.accent })]
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, bold: true, size: 24, font: "Arial", color: C.accentDark })]
  });
}

function body(text, options = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 80 },
    children: [new TextRun({ text, size: 22, font: "Arial", color: C.black, ...options })]
  });
}

function bodyBold(text) {
  return body(text, { bold: true });
}

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: 22, font: "Arial", color: C.black })]
  });
}

function numbered(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "numbers", level },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: 22, font: "Arial", color: C.black })]
  });
}

function spacer(lines = 1) {
  return new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text: "", size: lines * 22 })] });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function infoBox(label, value) {
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 22, font: "Arial", color: C.accentDark }),
      new TextRun({ text: value, size: 22, font: "Arial", color: C.black })
    ]
  });
}

// ─── Table builders ───────────────────────────────────────────────────────────
function makeHeaderCell(text, widthDXA) {
  return new TableCell({
    borders: allBorders,
    width: { size: widthDXA, type: WidthType.DXA },
    shading: { fill: C.headerBg, type: ShadingType.CLEAR },
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text, bold: true, size: 20, font: "Arial", color: C.white })]
    })]
  });
}

function makeCell(text, widthDXA, isAlt = false, bold = false) {
  return new TableCell({
    borders: allBorders,
    width: { size: widthDXA, type: WidthType.DXA },
    shading: { fill: isAlt ? C.rowAlt : C.white, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 140, right: 140 },
    children: [new Paragraph({
      children: [new TextRun({ text, size: 20, font: "Arial", color: C.black, bold })]
    })]
  });
}

function makeGreenCell(text, widthDXA) {
  return new TableCell({
    borders: allBorders,
    width: { size: widthDXA, type: WidthType.DXA },
    shading: { fill: C.sectionBg, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 140, right: 140 },
    children: [new Paragraph({
      children: [new TextRun({ text, size: 20, font: "Arial", color: C.accentDark, bold: true })]
    })]
  });
}

// ─── Document assembly ────────────────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "\u2022",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }, {
          level: 1, format: LevelFormat.BULLET, text: "\u25E6",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 1080, hanging: 360 } } }
        }]
      },
      {
        reference: "numbers",
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: "%1.",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      }
    ]
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: C.black },
        paragraph: { spacing: { before: 400, after: 160 }, outlineLevel: 0 }
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: C.accent },
        paragraph: { spacing: { before: 300, after: 120 }, outlineLevel: 1 }
      },
      {
        id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: C.accentDark },
        paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 }
      }
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1260, bottom: 1440, left: 1260 }
      }
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.accent, space: 4 } },
            spacing: { after: 120 },
            children: [
              new TextRun({ text: "SCALIX AGENTIC GROWTH OS", bold: true, size: 18, font: "Arial", color: C.accentDark }),
              new TextRun({ text: "   |   Product Requirements Document   |   India Agentic AI Open Hackathon 2026", size: 18, font: "Arial", color: C.gray })
            ]
          })
        ]
      })
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.accent, space: 4 } },
            spacing: { before: 80 },
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            children: [
              new TextRun({ text: "Scalix Systems  |  Confidential", size: 18, font: "Arial", color: C.gray }),
              new TextRun({ text: "\tPage ", size: 18, font: "Arial", color: C.gray }),
              new TextRun({ children: [new PageNumber()], size: 18, font: "Arial", color: C.gray })
            ]
          })
        ]
      })
    },
    children: [

      // ═══════════════════════════════════════════════════════
      // COVER PAGE
      // ═══════════════════════════════════════════════════════
      spacer(4),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: "PRODUCT REQUIREMENTS DOCUMENT", size: 20, font: "Arial", color: C.gray, allCaps: true, characterSpacing: 80 })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 200 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.accent, space: 8 } },
        children: [new TextRun({ text: "Scalix Agentic Growth OS", bold: true, size: 64, font: "Arial", color: C.black })]
      }),
      spacer(1),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 80 },
        children: [new TextRun({ text: "Multi-Agent Client Acquisition Automation Platform", size: 28, font: "Arial", color: C.gray, italics: true })]
      }),
      spacer(2),

      // Meta table
      new Table({
        width: { size: 7200, type: WidthType.DXA },
        columnWidths: [2400, 4800],
        alignment: AlignmentType.CENTER,
        rows: [
          new TableRow({ children: [makeGreenCell("Hackathon", 2400), makeCell("India Agentic AI Open Hackathon 2026", 4800)] }),
          new TableRow({ children: [makeGreenCell("Track", 2400), makeCell("Track A — Agentic Workflows", 4800, true)] }),
          new TableRow({ children: [makeGreenCell("Team / Agency", 2400), makeCell("Scalix Systems", 4800, true)] }),
          new TableRow({ children: [makeGreenCell("Submission Deadline", 2400), makeCell("19 June 2026, 5:00 PM IST", 4800, true)] }),
          new TableRow({ children: [makeGreenCell("Winners Announced", 2400), makeCell("25 July 2026", 4800, true)] }),
          new TableRow({ children: [makeGreenCell("Document Version", 2400), makeCell("v1.0 — Final", 4800, true)] }),
        ]
      }),

      spacer(3),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Powered exclusively by NVIDIA AI Stack", size: 20, font: "Arial", color: C.accentDark, bold: true })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: "NIM  \u00B7  AgentIQ  \u00B7  NeMo Guardrails  \u00B7  LLaMA 3.1 70B  \u00B7  Mistral NIM", size: 20, font: "Arial", color: C.gray })]
      }),

      pageBreak(),

      // ═══════════════════════════════════════════════════════
      // SECTION 1 — EXECUTIVE SUMMARY
      // ═══════════════════════════════════════════════════════
      h1("1. Executive Summary"),
      body("Scalix Agentic Growth OS is a five-agent AI system that fully automates the client acquisition pipeline for digital agencies and freelancers. A user enters a business niche and target location; the system then autonomously discovers leads, audits their online presence, scores opportunities, generates personalised outreach messages, and stores everything in a structured CRM — all without any manual intervention."),
      spacer(1),
      body("The entire intelligence layer is powered exclusively by NVIDIA's AI stack: NVIDIA NIM for LLM inference, NVIDIA AgentIQ for multi-agent orchestration, and NVIDIA NeMo Guardrails for safe, on-policy agent behaviour. This ensures full compliance with the hackathon's Track A requirements while delivering production-ready performance at scale."),
      spacer(1),

      // Problem / Solution summary table
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [4680, 4680],
        rows: [
          new TableRow({ children: [makeHeaderCell("The Problem", 4680), makeHeaderCell("Our Solution", 4680)] }),
          new TableRow({ children: [makeCell("Agencies spend 4–6 hours daily on manual lead research", 4680, false), makeCell("Lead Discovery Agent finds businesses in seconds", 4680, true)] }),
          new TableRow({ children: [makeCell("Manually checking websites is slow and inconsistent", 4680, false), makeCell("Website Audit Agent automatically checks every prospect", 4680, true)] }),
          new TableRow({ children: [makeCell("No systematic way to prioritise leads", 4680, false), makeCell("Opportunity Scoring Agent ranks by revenue potential", 4680, true)] }),
          new TableRow({ children: [makeCell("Generic outreach gets ignored", 4680, false), makeCell("Outreach Agent writes personalised messages per lead", 4680, true)] }),
          new TableRow({ children: [makeCell("Lead data scattered across spreadsheets and notes", 4680, false), makeCell("CRM Agent stores and exports everything automatically", 4680, true)] }),
        ]
      }),

      pageBreak(),

      // ═══════════════════════════════════════════════════════
      // SECTION 2 — PROJECT OVERVIEW
      // ═══════════════════════════════════════════════════════
      h1("2. Project Overview"),

      h2("2.1 Project Identity"),
      infoBox("Project Name", "Scalix Agentic Growth OS"),
      infoBox("Tagline", "Systems That Scale — Automatically"),
      infoBox("Category", "B2B SaaS / Agentic AI Tool"),
      infoBox("Primary Users", "Digital agencies, freelancers, sales teams"),
      infoBox("Hackathon Track", "Track A — Agentic Workflows"),
      spacer(1),

      h2("2.2 Core Problem Statement"),
      body("Business owners, agency founders, and freelancers who want to acquire new clients face a labour-intensive, repetitive process:"),
      bullet("Finding businesses in a target niche and location (Google searches, directories)"),
      bullet("Checking whether each business has a functional website"),
      bullet("Evaluating which businesses are worth approaching"),
      bullet("Writing personalised outreach emails, WhatsApp messages, and LinkedIn DMs"),
      bullet("Keeping track of who was contacted and what was said"),
      spacer(1),
      body("This process takes an average of 4–6 hours per day and is prone to human error, inconsistency, and burnout. Scalix Agentic Growth OS eliminates all five steps with a single-click, multi-agent workflow."),
      spacer(1),

      h2("2.3 Why Track A — Agentic Workflows"),
      body("The project is a textbook Track A submission:"),
      bullet("Five specialised agents, each with a single responsibility"),
      bullet("Structured context passing between agents (output of Agent N = input of Agent N+1)"),
      bullet("Orchestrated using NVIDIA AgentIQ, the NVIDIA-native multi-agent framework"),
      bullet("LLM inference via NVIDIA NIM APIs (not OpenAI, not Hugging Face)"),
      bullet("Practical enterprise application: client acquisition automation"),

      pageBreak(),

      // ═══════════════════════════════════════════════════════
      // SECTION 3 — NVIDIA AI STACK
      // ═══════════════════════════════════════════════════════
      h1("3. NVIDIA AI Stack — Technology Architecture"),

      body("Every piece of intelligence in this system runs on NVIDIA's AI infrastructure. There is no OpenAI, no Anthropic, no Hugging Face used in the agent pipeline. This is a deliberate hackathon compliance decision."),
      spacer(1),

      h2("3.1 NVIDIA NIM — Inference Layer"),
      body("NVIDIA NIM (NVIDIA Inference Microservices) provides optimised, production-grade API access to large language models hosted on NVIDIA infrastructure. NIM is the inference backbone for all four LLM-powered agents."),
      spacer(1),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2500, 3000, 3860],
        rows: [
          new TableRow({ children: [makeHeaderCell("NIM Model", 2500), makeHeaderCell("Used In", 3000), makeHeaderCell("Reason for Choice", 3860)] }),
          new TableRow({ children: [makeCell("meta/llama-3.1-70b-instruct", 2500, false), makeCell("Outreach Agent, Scoring Agent", 3000, false), makeCell("Best instruction-following, long context for nuanced message writing", 3860, true)] }),
          new TableRow({ children: [makeCell("mistralai/mixtral-8x7b-instruct", 2500, false), makeCell("Website Audit Agent", 3000, false), makeCell("Fast, cost-efficient for structured JSON output tasks", 3860, true)] }),
          new TableRow({ children: [makeCell("nvidia/nv-embedqa-e5-v5", 2500, false), makeCell("CRM Agent (deduplication)", 3000, false), makeCell("Semantic similarity for detecting duplicate leads", 3860, true)] }),
        ]
      }),
      spacer(1),
      infoBox("NIM API Base URL", "https://integrate.api.nvidia.com/v1"),
      infoBox("Auth", "NVIDIA_API_KEY environment variable (free tier available)"),
      spacer(1),

      h2("3.2 NVIDIA AgentIQ — Orchestration Layer"),
      body("NVIDIA AgentIQ is the official NVIDIA toolkit for building, evaluating, and deploying multi-agent AI systems. It provides:"),
      bullet("Agent lifecycle management (initialise, run, terminate)"),
      bullet("Structured inter-agent message passing with typed schemas"),
      bullet("Built-in observability: each agent's reasoning steps are logged"),
      bullet("Workflow graphs: agents are nodes; data flows are edges"),
      spacer(1),
      body("In Scalix Agentic Growth OS, AgentIQ manages the five-agent pipeline as a directed acyclic graph (DAG). Each agent registers with AgentIQ, declares its input/output schema, and AgentIQ handles routing, retries, and error propagation."),
      spacer(1),

      h2("3.3 NVIDIA NeMo Guardrails — Safety Layer"),
      body("NeMo Guardrails ensures agents stay on-policy and produce safe, professional output:"),
      bullet("Prevents agents from generating misleading claims in outreach messages"),
      bullet("Blocks hallucinated website audit results"),
      bullet("Enforces tone guidelines: outreach must be professional, not spammy"),
      bullet("Validates output schemas before passing between agents"),
      spacer(1),

      h2("3.4 Full NVIDIA Stack Summary"),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2800, 2200, 4360],
        rows: [
          new TableRow({ children: [makeHeaderCell("Layer", 2800), makeHeaderCell("NVIDIA Tool", 2200), makeHeaderCell("What It Does", 4360)] }),
          new TableRow({ children: [makeCell("LLM Inference", 2800, false), makeCell("NVIDIA NIM", 2200, false), makeCell("Runs LLaMA 3.1 70B, Mixtral for all agent reasoning", 4360, true)] }),
          new TableRow({ children: [makeCell("Agent Orchestration", 2800, false), makeCell("NVIDIA AgentIQ", 2200, false), makeCell("Manages 5-agent DAG pipeline, routing, retries", 4360, true)] }),
          new TableRow({ children: [makeCell("Safety & Guardrails", 2800, false), makeCell("NeMo Guardrails", 2200, false), makeCell("Enforces output policies, prevents hallucination", 4360, true)] }),
          new TableRow({ children: [makeCell("Embeddings", 2800, false), makeCell("NVIDIA NIM (E5-v5)", 2200, false), makeCell("Semantic deduplication of leads in CRM", 4360, true)] }),
        ]
      }),

      pageBreak(),

      // ═══════════════════════════════════════════════════════
      // SECTION 4 — AGENT ARCHITECTURE
      // ═══════════════════════════════════════════════════════
      h1("4. Agent Architecture — Detailed Specifications"),

      body("The system is composed of five specialised agents. Each agent is an independent Python class registered with NVIDIA AgentIQ. Agents communicate through typed Pydantic schemas — the output of one agent is the validated input of the next."),
      spacer(1),

      // Agent pipeline overview table
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [400, 2000, 2200, 2200, 2560],
        rows: [
          new TableRow({ children: [makeHeaderCell("#", 400), makeHeaderCell("Agent", 2000), makeHeaderCell("Input", 2200), makeHeaderCell("Output", 2200), makeHeaderCell("NVIDIA Tool", 2560)] }),
          new TableRow({ children: [makeCell("1", 400, false, true), makeCell("Lead Discovery Agent", 2000, false), makeCell("Niche + Location string", 2200, false), makeCell("List of raw business records", 2200, false), makeCell("Google Places + AgentIQ", 2560, true)] }),
          new TableRow({ children: [makeCell("2", 400, true, true), makeCell("Website Audit Agent", 2000, true), makeCell("Raw business records", 2200, true), makeCell("Audited leads with web status", 2200, true), makeCell("NIM Mixtral + HTTP checker", 2560, false)] }),
          new TableRow({ children: [makeCell("3", 400, false, true), makeCell("Opportunity Scoring Agent", 2000, false), makeCell("Audited leads", 2200, false), makeCell("Scored and ranked leads", 2200, false), makeCell("NIM LLaMA 3.1 70B", 2560, true)] }),
          new TableRow({ children: [makeCell("4", 400, true, true), makeCell("Outreach Agent", 2000, true), makeCell("Scored leads", 2200, true), makeCell("Personalised messages x4 channels", 2200, true), makeCell("NIM LLaMA 3.1 70B", 2560, false)] }),
          new TableRow({ children: [makeCell("5", 400, false, true), makeCell("CRM Agent", 2000, false), makeCell("All enriched lead data", 2200, false), makeCell("Stored records + CSV report", 2200, false), makeCell("NIM E5-v5 + Supabase", 2560, true)] }),
        ]
      }),
      spacer(1),

      h2("4.1 Agent 1 — Lead Discovery Agent"),
      h3("Role"),
      body("Finds real businesses matching the user's niche and location query. This agent is the entry point of the entire pipeline."),
      h3("Technical Implementation"),
      bullet("Parses the user's input (e.g. 'Restaurants in Austin, Texas') into structured fields"),
      bullet("Queries Google Places API with the parsed niche + location"),
      bullet("Extracts: business name, address, phone number, category, Google Maps URL, rating"),
      bullet("Returns a typed list of LeadRecord Pydantic objects to AgentIQ"),
      h3("NVIDIA Integration"),
      bullet("Registered as an AgentIQ tool node — AgentIQ manages retries on API failures"),
      bullet("NIM LLaMA 3.1 70B used to parse ambiguous user queries (e.g. 'coffee shops near downtown Delhi')"),
      h3("Output Schema"),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2800, 2000, 4560],
        rows: [
          new TableRow({ children: [makeHeaderCell("Field", 2800), makeHeaderCell("Type", 2000), makeHeaderCell("Description", 4560)] }),
          new TableRow({ children: [makeCell("business_name", 2800, false), makeCell("string", 2000, false), makeCell("Name of the business", 4560, true)] }),
          new TableRow({ children: [makeCell("address", 2800, true), makeCell("string", 2000, true), makeCell("Full formatted address", 4560, false)] }),
          new TableRow({ children: [makeCell("phone", 2800, false), makeCell("string | null", 2000, false), makeCell("Contact phone number", 4560, true)] }),
          new TableRow({ children: [makeCell("category", 2800, true), makeCell("string", 2000, true), makeCell("Business category from Google", 4560, false)] }),
          new TableRow({ children: [makeCell("google_maps_url", 2800, false), makeCell("string", 2000, false), makeCell("Direct Google Maps link", 4560, true)] }),
          new TableRow({ children: [makeCell("rating", 2800, true), makeCell("float | null", 2000, true), makeCell("Google rating (1.0–5.0)", 4560, false)] }),
        ]
      }),
      spacer(1),

      h2("4.2 Agent 2 — Website Audit Agent"),
      h3("Role"),
      body("For each discovered business, this agent determines whether a website exists and evaluates its quality. Missing or weak websites = high-opportunity prospects for Scalix's services."),
      h3("Technical Implementation"),
      bullet("Attempts HTTP GET on any website URL found via Google Places"),
      bullet("Checks domain registration via WHOIS if no URL is found"),
      bullet("Uses NIM Mixtral 8x7B to classify website quality from scraped homepage content"),
      bullet("Categories: NO_WEBSITE | BASIC_LANDING | OUTDATED | DECENT | PROFESSIONAL"),
      h3("Audit Criteria (NIM-powered analysis)"),
      bullet("Does the site have a mobile-responsive design?"),
      bullet("Is there a contact form or booking system?"),
      bullet("Is the site SSL-secured (HTTPS)?"),
      bullet("Does the homepage load in under 3 seconds?"),
      bullet("Are there clear calls-to-action?"),
      h3("Output Addition to Schema"),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2800, 2000, 4560],
        rows: [
          new TableRow({ children: [makeHeaderCell("Field", 2800), makeHeaderCell("Type", 2000), makeHeaderCell("Description", 4560)] }),
          new TableRow({ children: [makeCell("has_website", 2800, false), makeCell("boolean", 2000, false), makeCell("True if any web presence found", 4560, true)] }),
          new TableRow({ children: [makeCell("website_url", 2800, true), makeCell("string | null", 2000, true), makeCell("Actual URL if found", 4560, false)] }),
          new TableRow({ children: [makeCell("website_quality", 2800, false), makeCell("enum", 2000, false), makeCell("NO_WEBSITE / BASIC / OUTDATED / DECENT / PROFESSIONAL", 4560, true)] }),
          new TableRow({ children: [makeCell("audit_notes", 2800, true), makeCell("string", 2000, true), makeCell("NIM-generated summary of website weaknesses", 4560, false)] }),
          new TableRow({ children: [makeCell("is_ssl", 2800, false), makeCell("boolean", 2000, false), makeCell("HTTPS status", 4560, true)] }),
        ]
      }),
      spacer(1),

      h2("4.3 Agent 3 — Opportunity Scoring Agent"),
      h3("Role"),
      body("Scores each audited lead on a 0–100 scale and assigns a priority tier. This tells the user which businesses to contact first and why."),
      h3("Scoring Algorithm"),
      body("NIM LLaMA 3.1 70B receives the full lead record and applies a weighted scoring rubric:"),
      spacer(1),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3500, 1500, 4360],
        rows: [
          new TableRow({ children: [makeHeaderCell("Scoring Factor", 3500), makeHeaderCell("Max Points", 1500), makeHeaderCell("Rationale", 4360)] }),
          new TableRow({ children: [makeCell("No website at all", 3500, false), makeCell("40 pts", 1500, false), makeCell("Biggest pain point — highest conversion opportunity", 4360, true)] }),
          new TableRow({ children: [makeCell("Outdated or low-quality website", 3500, true), makeCell("30 pts", 1500, true), makeCell("Already aware of web presence, open to upgrade", 4360, false)] }),
          new TableRow({ children: [makeCell("No SSL / security issues", 3500, false), makeCell("10 pts", 1500, false), makeCell("Easy, concrete problem to pitch fixing", 4360, true)] }),
          new TableRow({ children: [makeCell("Google rating under 4.0", 3500, true), makeCell("10 pts", 1500, true), makeCell("Likely open to digital improvement", 4360, false)] }),
          new TableRow({ children: [makeCell("Phone number available", 3500, false), makeCell("5 pts", 1500, false), makeCell("Enables multi-channel outreach", 4360, true)] }),
          new TableRow({ children: [makeCell("Business category match", 3500, true), makeCell("5 pts", 1500, true), makeCell("Niche relevance to agency services", 4360, false)] }),
        ]
      }),
      spacer(1),
      h3("Priority Tiers"),
      bullet("HOT (75–100): Contact immediately — clear pain point, high conversion likelihood"),
      bullet("WARM (50–74): Good prospect — worth personalised outreach"),
      bullet("COLD (25–49): Low priority — include in bulk campaigns only"),
      bullet("SKIP (0–24): Not worth pursuing — strong online presence already"),
      spacer(1),

      h2("4.4 Agent 4 — Outreach Agent"),
      h3("Role"),
      body("The creative core of the system. For each HOT and WARM lead, this agent uses NIM LLaMA 3.1 70B to generate four distinct, personalised outreach messages — one per channel."),
      h3("Channels and Formats"),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [1800, 1800, 5760],
        rows: [
          new TableRow({ children: [makeHeaderCell("Channel", 1800), makeHeaderCell("Length", 1800), makeHeaderCell("Tone & Approach", 5760)] }),
          new TableRow({ children: [makeCell("Email", 1800, false), makeCell("150–200 words", 1800, false), makeCell("Professional, specific to their website weakness, CTA to book a call", 5760, true)] }),
          new TableRow({ children: [makeCell("LinkedIn DM", 1800, true), makeCell("80–100 words", 1800, true), makeCell("Conversational, peer-to-peer, mention their business specifically", 5760, false)] }),
          new TableRow({ children: [makeCell("WhatsApp", 1800, false), makeCell("50–70 words", 1800, false), makeCell("Casual, direct, emoji-friendly, clear single CTA", 5760, true)] }),
          new TableRow({ children: [makeCell("Facebook", 1800, true), makeCell("60–80 words", 1800, true), makeCell("Slightly informal, community-focused angle", 5760, false)] }),
        ]
      }),
      spacer(1),
      h3("Personalisation Variables"),
      body("Each message is customised with:"),
      bullet("Business name (always included)"),
      bullet("Specific website weakness identified by Audit Agent (e.g. 'I noticed Casa Taco doesn't have a booking form')"),
      bullet("Business category context (restaurant, salon, clinic, etc.)"),
      bullet("Location reference (e.g. 'businesses in Austin like yours')"),
      bullet("Opportunity score tier (HOT leads get more urgent CTAs)"),
      spacer(1),
      h3("NeMo Guardrails — Outreach Policies"),
      bullet("No false promises (guaranteed results, #1 on Google, etc.)"),
      bullet("No spam trigger words (FREE!!!, ACT NOW, Limited Time)"),
      bullet("Messages must reference a specific, real observation about the business"),
      bullet("WhatsApp messages must not exceed 70 words"),
      spacer(1),

      h2("4.5 Agent 5 — CRM Agent"),
      h3("Role"),
      body("Receives all enriched lead data and persists it to the Supabase database. Also handles deduplication, generates the final downloadable report, and maintains outreach history."),
      h3("Technical Implementation"),
      bullet("Uses NVIDIA NIM E5-v5 embeddings to detect semantic duplicates (same business, slightly different names)"),
      bullet("Inserts new unique leads into Supabase leads table"),
      bullet("Stores all four outreach messages per lead in outreach_messages table"),
      bullet("Generates a CSV report with all fields for the current session"),
      bullet("Flags leads already in CRM as 'previously contacted'"),
      h3("Database Schema"),
      spacer(1),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2500, 1800, 5060],
        rows: [
          new TableRow({ children: [makeHeaderCell("Table", 2500), makeHeaderCell("Key Fields", 1800), makeHeaderCell("Description", 5060)] }),
          new TableRow({ children: [makeCell("leads", 2500, false), makeCell("id, name, score", 1800, false), makeCell("Core lead record with all audit and scoring data", 5060, true)] }),
          new TableRow({ children: [makeCell("outreach_messages", 2500, true), makeCell("lead_id, channel", 1800, true), makeCell("4 messages per lead (email, linkedin, whatsapp, facebook)", 5060, false)] }),
          new TableRow({ children: [makeCell("sessions", 2500, false), makeCell("id, query, timestamp", 1800, false), makeCell("Each workflow run stored as a session", 5060, true)] }),
          new TableRow({ children: [makeCell("contacts", 2500, true), makeCell("lead_id, date_sent", 1800, true), makeCell("History of which leads were actually contacted", 5060, false)] }),
        ]
      }),

      pageBreak(),

      // ═══════════════════════════════════════════════════════
      // SECTION 5 — TECH STACK
      // ═══════════════════════════════════════════════════════
      h1("5. Full Technology Stack"),

      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2000, 2500, 4860],
        rows: [
          new TableRow({ children: [makeHeaderCell("Layer", 2000), makeHeaderCell("Technology", 2500), makeHeaderCell("Purpose", 4860)] }),
          new TableRow({ children: [makeCell("Frontend", 2000, false, true), makeCell("Next.js 14 (App Router)", 2500, false), makeCell("Dashboard UI — pipeline status, results, outreach display", 4860, true)] }),
          new TableRow({ children: [makeCell("UI Components", 2000, true), makeCell("Tailwind CSS + shadcn/ui", 2500, true), makeCell("Styling and reusable component library", 4860, false)] }),
          new TableRow({ children: [makeCell("Real-time Updates", 2000, false), makeCell("Server-Sent Events (SSE)", 2500, false), makeCell("Live agent status and reasoning log streaming", 4860, true)] }),
          new TableRow({ children: [makeCell("Backend", 2000, true, true), makeCell("Python 3.11 + FastAPI", 2500, true), makeCell("Agent pipeline API, business logic", 4860, false)] }),
          new TableRow({ children: [makeCell("Agent Framework", 2000, false), makeCell("NVIDIA AgentIQ", 2500, false), makeCell("Multi-agent orchestration, DAG management", 4860, true)] }),
          new TableRow({ children: [makeCell("LLM Inference", 2000, true), makeCell("NVIDIA NIM API", 2500, true), makeCell("LLaMA 3.1 70B, Mixtral 8x7B, E5-v5 embeddings", 4860, false)] }),
          new TableRow({ children: [makeCell("Guardrails", 2000, false), makeCell("NeMo Guardrails", 2500, false), makeCell("Output safety, tone policies, schema validation", 4860, true)] }),
          new TableRow({ children: [makeCell("Database", 2000, true), makeCell("Supabase (PostgreSQL)", 2500, true), makeCell("Lead storage, outreach history, session management", 4860, false)] }),
          new TableRow({ children: [makeCell("Lead Discovery", 2000, false), makeCell("Google Places API", 2500, false), makeCell("Fetching real business data", 4860, true)] }),
          new TableRow({ children: [makeCell("Web Audit", 2000, true), makeCell("Python httpx + WHOIS", 2500, true), makeCell("HTTP checks, domain lookup", 4860, false)] }),
          new TableRow({ children: [makeCell("Export", 2000, false), makeCell("Python csv module", 2500, false), makeCell("Downloadable lead report generation", 4860, true)] }),
          new TableRow({ children: [makeCell("Deployment", 2000, true), makeCell("Vercel (FE) + Railway (BE)", 2500, true), makeCell("Free-tier deployment for demo", 4860, false)] }),
        ]
      }),

      pageBreak(),

      // ═══════════════════════════════════════════════════════
      // SECTION 6 — FRONTEND / DASHBOARD
      // ═══════════════════════════════════════════════════════
      h1("6. Frontend Dashboard — UI Specification"),

      body("The dashboard is a Next.js web application. Its single job is to make the five-agent pipeline visible, real-time, and impressive for judges and end users alike. There are three main views."),
      spacer(1),

      h2("6.1 View 1 — Input Screen"),
      body("A clean, minimal form with two fields:"),
      bullet("Niche (text input): e.g. 'Restaurants', 'Hair Salons', 'Dental Clinics'"),
      bullet("Location (text input): e.g. 'Austin, Texas' or 'Bandra, Mumbai'"),
      body("A single Run Agents button triggers the workflow. No other configuration needed."),
      spacer(1),

      h2("6.2 View 2 — Live Pipeline Status Panel"),
      body("This is the most important UI element for the hackathon demo. It shows each agent as a card that updates in real time via SSE:"),
      spacer(1),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2000, 2000, 5360],
        rows: [
          new TableRow({ children: [makeHeaderCell("Agent Card", 2000), makeHeaderCell("Status States", 2000), makeHeaderCell("What Is Displayed Live", 5360)] }),
          new TableRow({ children: [makeCell("Lead Discovery", 2000, false), makeCell("Waiting / Running / Done", 2000, false), makeCell("Number of businesses found, query used", 5360, true)] }),
          new TableRow({ children: [makeCell("Website Audit", 2000, true), makeCell("Waiting / Running / Done", 2000, true), makeCell("X of N websites checked, current business name", 5360, false)] }),
          new TableRow({ children: [makeCell("Opportunity Scoring", 2000, false), makeCell("Waiting / Running / Done", 2000, false), makeCell("HOT / WARM / COLD / SKIP counts updating", 5360, true)] }),
          new TableRow({ children: [makeCell("Outreach Generation", 2000, true), makeCell("Waiting / Running / Done", 2000, true), makeCell("Messages generated count, current business", 5360, false)] }),
          new TableRow({ children: [makeCell("CRM Storage", 2000, false), makeCell("Waiting / Running / Done", 2000, false), makeCell("Leads saved, duplicates detected", 5360, true)] }),
        ]
      }),
      spacer(1),

      h2("6.3 View 3 — Agent Reasoning Log"),
      body("A scrollable, terminal-style log panel below the agent cards. Streams real-time reasoning steps from each agent:"),
      spacer(1),
      new Paragraph({
        spacing: { before: 80, after: 80 },
        shading: { fill: C.headerBg, type: ShadingType.CLEAR },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: C.accent, space: 4 } },
        indent: { left: 360, right: 360 },
        children: [
          new TextRun({ text: "[Lead Discovery] Searching Google for 'Restaurants in Austin TX'...", size: 18, font: "Courier New", color: "76B900" }),
        ]
      }),
      new Paragraph({
        spacing: { before: 40, after: 40 },
        shading: { fill: C.headerBg, type: ShadingType.CLEAR },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: C.accent, space: 4 } },
        indent: { left: 360, right: 360 },
        children: [new TextRun({ text: "[Lead Discovery] Found 20 businesses. Passing to Website Audit Agent.", size: 18, font: "Courier New", color: "76B900" })]
      }),
      new Paragraph({
        spacing: { before: 40, after: 40 },
        shading: { fill: C.headerBg, type: ShadingType.CLEAR },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: C.accent, space: 4 } },
        indent: { left: 360, right: 360 },
        children: [new TextRun({ text: "[Website Audit] Checking 'Casa Taco'... No website found. Score potential: HIGH.", size: 18, font: "Courier New", color: "AAAAAA" })]
      }),
      new Paragraph({
        spacing: { before: 40, after: 80 },
        shading: { fill: C.headerBg, type: ShadingType.CLEAR },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: C.accent, space: 4 } },
        indent: { left: 360, right: 360 },
        children: [new TextRun({ text: "[Outreach Agent] Writing personalised Email + WhatsApp for Casa Taco...", size: 18, font: "Courier New", color: "AAAAAA" })]
      }),
      spacer(1),
      body("This log panel is streamed via SSE. Each log line includes a timestamp and agent name prefix. This is the single most convincing proof of agentic behaviour for any judge watching the demo."),
      spacer(1),

      h2("6.4 View 4 — Results Dashboard"),
      body("Once the pipeline completes, a results section appears with:"),
      bullet("Lead cards with name, address, score badge (HOT/WARM/COLD), and website status"),
      bullet("Expandable outreach message panel per lead (tabs for Email / LinkedIn / WhatsApp / Facebook)"),
      bullet("One-click copy button per message"),
      bullet("Download Report button — exports full CSV with all lead data and messages"),
      bullet("Session summary: total leads, HOT count, time taken"),

      pageBreak(),

      // ═══════════════════════════════════════════════════════
      // SECTION 7 — DEMO FLOW
      // ═══════════════════════════════════════════════════════
      h1("7. Demo Flow — Judge Presentation Script"),

      body("The demo is designed for a 3-minute walkthrough. Every second is planned to maximise judge impact."),
      spacer(1),

      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [800, 2000, 3280, 3280],
        rows: [
          new TableRow({ children: [makeHeaderCell("Time", 800), makeHeaderCell("Action", 2000), makeHeaderCell("What the Judge Sees", 3280), makeHeaderCell("What It Proves", 3280)] }),
          new TableRow({ children: [makeCell("0:00", 800, false), makeCell("Open dashboard", 2000, false), makeCell("Clean input screen, two fields", 3280, false), makeCell("Production-quality UI", 3280, true)] }),
          new TableRow({ children: [makeCell("0:15", 800, true), makeCell("Type 'Restaurants in Austin TX', click Run", 2000, true), makeCell("All 5 agent cards appear, Agent 1 starts spinning", 3280, true), makeCell("Real multi-agent pipeline triggered", 3280, false)] }),
          new TableRow({ children: [makeCell("0:30", 800, false), makeCell("Watch Agent 1 complete", 2000, false), makeCell("Reasoning log fills with search queries, 20 businesses found", 3280, false), makeCell("Live NVIDIA AgentIQ execution", 3280, true)] }),
          new TableRow({ children: [makeCell("1:00", 800, true), makeCell("Agent 2 runs", 2000, true), makeCell("Each business checked live, NO_WEBSITE tags appearing", 3280, true), makeCell("Audit agent working independently", 3280, false)] }),
          new TableRow({ children: [makeCell("1:45", 800, false), makeCell("Agent 3 scores", 2000, false), makeCell("HOT/WARM/COLD badges appear on lead cards", 3280, false), makeCell("NIM LLaMA scoring in real time", 3280, true)] }),
          new TableRow({ children: [makeCell("2:15", 800, true), makeCell("Agent 4 generates messages", 2000, true), makeCell("Outreach log shows personalised messages being written", 3280, true), makeCell("NVIDIA NIM generating per-lead content", 3280, false)] }),
          new TableRow({ children: [makeCell("2:45", 800, false), makeCell("Agent 5 stores + export", 2000, false), makeCell("CRM saved confirmation, Download Report button lights up", 3280, false), makeCell("Full pipeline completion", 3280, true)] }),
          new TableRow({ children: [makeCell("3:00", 800, true), makeCell("Open a lead, show messages", 2000, true), makeCell("4 personalised messages ready to copy/send", 3280, true), makeCell("Real business value delivered", 3280, false)] }),
        ]
      }),

      pageBreak(),

      // ═══════════════════════════════════════════════════════
      // SECTION 8 — PROOF OF AGENTIC BEHAVIOUR
      // ═══════════════════════════════════════════════════════
      h1("8. Proof of Agentic Behaviour — Judge Evidence Checklist"),

      body("Because this is a new team's first hackathon, this section documents specifically how the submission proves genuine multi-agent architecture to judges. Each item below is a concrete, verifiable proof point."),
      spacer(1),

      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [300, 3000, 3000, 3060],
        rows: [
          new TableRow({ children: [makeHeaderCell("#", 300), makeHeaderCell("Proof Point", 3000), makeHeaderCell("Where to See It", 3000), makeHeaderCell("What It Proves", 3060)] }),
          new TableRow({ children: [makeCell("1", 300, false, true), makeCell("5 separate Python agent classes in /agents/ directory", 3000, false), makeCell("GitHub repository, source code", 3000, false), makeCell("Distinct agents, not one monolithic script", 3060, true)] }),
          new TableRow({ children: [makeCell("2", 300, true, true), makeCell("AgentIQ workflow graph with 5 nodes", 3000, true), makeCell("AgentIQ config file, repo README", 3000, true), makeCell("NVIDIA-native orchestration", 3060, false)] }),
          new TableRow({ children: [makeCell("3", 300, false, true), makeCell("Live agent status cards updating independently", 3000, false), makeCell("Dashboard demo video", 3000, false), makeCell("Agents run sequentially, each has distinct state", 3060, true)] }),
          new TableRow({ children: [makeCell("4", 300, true, true), makeCell("Reasoning log streaming per agent with agent name prefix", 3000, true), makeCell("Dashboard demo video, log panel", 3000, true), makeCell("Each agent's thinking is observable and distinct", 3060, false)] }),
          new TableRow({ children: [makeCell("5", 300, false, true), makeCell("NIM API call logs showing LLaMA 3.1 70B model ID", 3000, false), makeCell("Backend logs, README screenshots", 3000, false), makeCell("NVIDIA NIM is the actual inference engine", 3060, true)] }),
          new TableRow({ children: [makeCell("6", 300, true, true), makeCell("Pydantic schemas for inter-agent communication", 3000, true), makeCell("Source code /schemas/ directory", 3000, true), makeCell("Typed, structured agent communication", 3060, false)] }),
          new TableRow({ children: [makeCell("7", 300, false, true), makeCell("NeMo Guardrails config file in repository", 3000, false), makeCell("GitHub /guardrails/ directory", 3000, false), makeCell("Safety layer is real, not just mentioned", 3060, true)] }),
        ]
      }),

      pageBreak(),

      // ═══════════════════════════════════════════════════════
      // SECTION 9 — DEVELOPMENT ROADMAP
      // ═══════════════════════════════════════════════════════
      h1("9. Development Roadmap"),

      h2("Phase 1 — NVIDIA Backend (Days 1–3)"),
      numbered("Set up NVIDIA NIM API access (free tier at build.nvidia.com)"),
      numbered("Install NVIDIA AgentIQ: pip install agentiq"),
      numbered("Build and test Lead Discovery Agent with AgentIQ registration"),
      numbered("Build Website Audit Agent with NIM Mixtral integration"),
      numbered("Build Opportunity Scoring Agent with NIM LLaMA 3.1 70B"),
      numbered("Build Outreach Agent with NeMo Guardrails config"),
      numbered("Build CRM Agent with Supabase + NIM E5-v5 embeddings"),
      numbered("Test full 5-agent pipeline end to end on 'Restaurants in Austin'"),
      spacer(1),

      h2("Phase 2 — Frontend Dashboard (Days 4–5)"),
      numbered("Set up Next.js 14 project with Tailwind CSS"),
      numbered("Build Input Screen (niche + location form)"),
      numbered("Implement SSE endpoint in FastAPI backend for live log streaming"),
      numbered("Build Agent Status Pipeline Panel (5 cards, real-time status)"),
      numbered("Build Agent Reasoning Log panel (terminal-style, SSE-fed)"),
      numbered("Build Results Dashboard with lead cards and outreach message tabs"),
      numbered("Add Download Report (CSV export) functionality"),
      spacer(1),

      h2("Phase 3 — Polish and Demo Prep (Day 6)"),
      numbered("Run full demo scenario: 'Digital Marketing Agencies in Austin, Texas'"),
      numbered("Record 3-minute demo video following judge presentation script (Section 7)"),
      numbered("Write README with architecture diagram, NVIDIA stack explanation, and run instructions"),
      numbered("Deploy frontend to Vercel, backend to Railway"),
      numbered("Final submission on openhackathons.org before 19 June 2026 5:00 PM IST"),
      spacer(1),

      h2("What Already Exists (Reused from Scalix Existing Systems)"),
      bullet("Lead scraping pipeline logic (Google Places integration)"),
      bullet("Personalised outreach message generation (adapted to NVIDIA NIM)"),
      bullet("Supabase schema design (from UR Fire Safety project experience)"),
      body("These existing components significantly reduce development risk, making this project achievable well within the submission deadline."),

      pageBreak(),

      // ═══════════════════════════════════════════════════════
      // SECTION 10 — SUCCESS METRICS
      // ═══════════════════════════════════════════════════════
      h1("10. Success Metrics"),

      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2500, 2500, 4360],
        rows: [
          new TableRow({ children: [makeHeaderCell("Metric", 2500), makeHeaderCell("Target", 2500), makeHeaderCell("How Measured", 4360)] }),
          new TableRow({ children: [makeCell("Leads discovered per run", 2500, false), makeCell("15–25 businesses", 2500, false), makeCell("Count in results dashboard", 4360, true)] }),
          new TableRow({ children: [makeCell("Pipeline completion time", 2500, true), makeCell("Under 3 minutes", 2500, true), makeCell("Session timestamp diff", 4360, false)] }),
          new TableRow({ children: [makeCell("Outreach messages generated", 2500, false), makeCell("4 per HOT/WARM lead", 2500, false), makeCell("Outreach table row count", 4360, true)] }),
          new TableRow({ children: [makeCell("Duplicate lead detection", 2500, true), makeCell("100% accuracy", 2500, true), makeCell("NIM embedding similarity > 0.92", 4360, false)] }),
          new TableRow({ children: [makeCell("Demo video clarity", 2500, false), makeCell("All 5 agents visible", 2500, false), makeCell("Judge can see each agent run", 4360, true)] }),
          new TableRow({ children: [makeCell("NVIDIA stack compliance", 2500, true), makeCell("Zero non-NVIDIA LLM calls", 2500, true), makeCell("Backend log inspection", 4360, false)] }),
        ]
      }),

      pageBreak(),

      // ═══════════════════════════════════════════════════════
      // SECTION 11 — HACKATHON COMPLIANCE CHECKLIST
      // ═══════════════════════════════════════════════════════
      h1("11. Hackathon Compliance Checklist"),

      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [600, 5000, 3760],
        rows: [
          new TableRow({ children: [makeHeaderCell("", 600), makeHeaderCell("Requirement", 5000), makeHeaderCell("Our Compliance", 3760)] }),
          new TableRow({ children: [makeCell("\u2705", 600, false), makeCell("Indian citizen, 18+, valid PAN", 5000, false), makeCell("All team members comply", 3760, true)] }),
          new TableRow({ children: [makeCell("\u2705", 600, true), makeCell("Track A — Agentic Workflows", 5000, true), makeCell("5-agent pipeline submitted under Track A only", 3760, false)] }),
          new TableRow({ children: [makeCell("\u2705", 600, false), makeCell("NVIDIA agentic AI stack used", 5000, false), makeCell("NIM + AgentIQ + NeMo Guardrails — exclusively", 3760, true)] }),
          new TableRow({ children: [makeCell("\u2705", 600, true), makeCell("Practical application demonstrated", 5000, true), makeCell("Real lead generation with live business data", 3760, false)] }),
          new TableRow({ children: [makeCell("\u2705", 600, false), makeCell("Multi-agent workflow (not single model)", 5000, false), makeCell("5 distinct agents with typed inter-agent communication", 3760, true)] }),
          new TableRow({ children: [makeCell("\u2705", 600, true), makeCell("Max 5 team members", 5000, true), makeCell("Team size within limit", 3760, false)] }),
          new TableRow({ children: [makeCell("\u2705", 600, false), makeCell("Submission before 19 June 2026, 5:00 PM IST", 5000, false), makeCell("Roadmap targets completion by Day 6", 3760, true)] }),
          new TableRow({ children: [makeCell("\u2705", 600, true), makeCell("Only one track selected", 5000, true), makeCell("Track A only — no Track B or C elements", 3760, false)] }),
        ]
      }),

      spacer(2),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
        border: {
          top: { style: BorderStyle.SINGLE, size: 4, color: C.accent, space: 8 },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: C.accent, space: 8 }
        },
        children: [
          new TextRun({ text: "Scalix Systems  \u00B7  Vadodara, Gujarat, India  \u00B7  India Agentic AI Open Hackathon 2026", size: 20, font: "Arial", color: C.gray }),
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80 },
        children: [new TextRun({ text: "Built with NVIDIA NIM \u00B7 NVIDIA AgentIQ \u00B7 NVIDIA NeMo Guardrails", size: 20, font: "Arial", color: C.accentDark, bold: true })]
      }),

    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('/home/claude/Scalix_Agentic_Growth_OS_PRD.docx', buffer);
  console.log('PRD generated successfully.');
});
