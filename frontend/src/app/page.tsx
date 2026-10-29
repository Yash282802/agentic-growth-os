"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Check, RefreshCw, Download, Star, ThumbsUp, MapPin, Phone, Shield,
  ExternalLink, Globe, FileText, GitBranch, Rocket, CheckCircle2,
  MessageCircle, Clipboard, AlertTriangle, Eye, ChevronRight, X, History
} from "lucide-react";

interface Lead {
  id: string;
  business_name: string;
  address?: string;
  phone?: string;
  category?: string;
  google_maps_url?: string;
  rating?: number;
  has_website: boolean;
  website_url?: string;
  website_quality: string;
  audit_notes?: string;
  is_ssl: boolean;
  opportunity_score: number;
  priority_tier: string;
  is_duplicate: boolean;
  outreach_messages: { channel: string; message_text: string }[];
  contacted_channels?: string[];
  human_approved?: boolean;
  prd_markdown?: string;
  repo_structure?: string;
  github_repo_url?: string;
  preview_url?: string;
}

interface Session {
  id: string;
  niche: string;
  location: string;
  status: string;
  total_leads: number;
  hot_leads_count: number;
  created_at: string;
}

interface AgentState {
  name: string;
  status: "idle" | "running" | "done" | "failed";
  progress: string;
  message: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://agentic-growth-os-backend.onrender.com";

const AGENT_CONFIGS: { name: string; description: string }[] = [
  { name: "Lead Discovery", description: "Discovers businesses via Google Places" },
  { name: "Website Audit", description: "Checks website accessibility & quality" },
  { name: "Opportunity Scoring", description: "Multi-factor rubric out of 100" },
  { name: "CRM Storage", description: "E5 embeddings + DB deduplication" },
  { name: "Outreach Generation", description: "Personalized copy for 4 channels" },
];

const AGENT_ORDER = AGENT_CONFIGS.map(a => a.name);

const AGENT_LABEL: Record<string, string> = {
  "Lead Discovery": "Lead Discovery",
  "Website Audit": "Website Auditor",
  "Opportunity Scoring": "Opportunity Scorer",
  "CRM Storage": "CRM Enricher",
  "Outreach Generation": "Outreach Agent",
};

const NAV = ["Dashboard", "Leads", "Agents", "Reports", "Settings"];

function AgentNode({ agent, num }: { agent: AgentState; num: number }) {
  const s = agent.status;
  const wrap =
    s === "running" ? "border-[1.5px] border-berry bg-berry-soft"
    : s === "failed" ? "border-red-400 bg-red-50"
    : "border-line bg-panel";
  const badge =
    s === "running" ? "bg-berry border-berry text-white"
    : s === "done" ? "bg-moss border-moss text-white"
    : s === "failed" ? "bg-red-500 border-red-500 text-white"
    : "border-wait text-muted";
  const labelCls =
    s === "running" ? "text-berry font-medium"
    : s === "done" ? "text-moss"
    : s === "failed" ? "text-red-600"
    : "text-muted";
  const titleCls = s === "idle" ? "text-muted" : "text-ink";
  const text = s === "running" ? "Processing…" : s === "done" ? "Done" : s === "failed" ? "Failed" : "Waiting";

  return (
    <div className={`flex items-center gap-2.5 h-node px-3 border rounded-xl ${wrap}`}>
      <span className={`flex-none w-6 h-6 rounded-full grid place-items-center text-xs font-semibold border ${badge}`}>
        {s === "done" ? <Check className="w-3 h-3" /> : num}
      </span>
      <span className="min-w-0 leading-tight">
        <strong className={`block text-[13px] font-semibold truncate ${titleCls}`}>{AGENT_LABEL[agent.name] || agent.name}</strong>
        <small className={`text-xs flex items-center gap-1.5 ${labelCls}`}>
          {s === "running" && <i className="w-1.5 h-1.5 rounded-full bg-berry node-live-dot" />}
          {s === "failed" ? agent.message || text : text}
        </small>
      </span>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [niche, setNiche] = useState("Hair Salons");
  const [location, setLocation] = useState("Austin, Texas");
  const [maxLeads, setMaxLeads] = useState(10);
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"run" | "history">("run");
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const [logs, setLogs] = useState<string[]>([]);
  const [agents, setAgents] = useState<AgentState[]>(
    AGENT_CONFIGS.map(a => ({ name: a.name, status: "idle", progress: "Waiting", message: a.description }))
  );
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [outreachTab, setOutreachTab] = useState<"whatsapp" | "email" | "linkedin" | "facebook">("whatsapp");
  const [copiedChannel, setCopiedChannel] = useState<string | null>(null);
  const [contactingChannel, setContactingChannel] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [history, setHistory] = useState<Session[]>([]);
  const [showLeadPanel, setShowLeadPanel] = useState(false);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    checkBackendHealth();
    fetchHistory();
  }, []);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const checkBackendHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/sessions`);
      setBackendStatus(res.ok ? "online" : "offline");
    } catch {
      setBackendStatus("offline");
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/sessions`);
      if (res.ok) setHistory(await res.json());
    } catch (e) { console.error(e); }
  };

  const loadSessionDetails = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/session/${id}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
        setSelectedLead(data.leads?.[0] || null);
        setAgents(prev => prev.map(a => ({ ...a, status: "done", progress: "Completed", message: "Loaded from history." })));
        setLogs([`[System] Loaded history for Session ${id}`, `[System] Found ${data.leads?.length || 0} leads (Hot: ${data.hot_leads_count || 0})`]);
        setActiveTab("run");
        setShowLeadPanel(true);
      }
    } catch (e) { console.error(e); }
  };

  const startPipeline = async () => {
    if (running) return;
    setRunning(true);
    setShowLeadPanel(false);
    setLeads([]);
    setSelectedLead(null);
    setLogs(["[System] Initializing Agentic Growth OS workflow...", `[System] Target: ${niche} in ${location}`]);
    setAgents(AGENT_CONFIGS.map(a => ({ name: a.name, status: "idle", progress: "Waiting", message: a.description })));
    try {
      const response = await fetch(`${API_BASE}/api/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, location, max_leads: maxLeads })
      });
      if (!response.ok) throw new Error("Failed to start pipeline");
      const data = await response.json();
      setSessionId(data.session_id);
      connectSSE(data.session_id);
    } catch (err) {
      setLogs(prev => [...prev, `[System Error] ${err instanceof Error ? err.message : "Could not start workflow."}`]);
      setRunning(false);
      setAgents(prev => prev.map(a => ({ ...a, status: "failed", progress: "Error" })));
    }
  };

  const connectSSE = (sId: string) => {
    eventSourceRef.current?.close();
    const es = new EventSource(`${API_BASE}/api/stream/${sId}`);
    eventSourceRef.current = es;
    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "log") {
        setLogs(prev => [...prev, data.message]);
      } else if (data.type === "status") {
        setAgents(prev => prev.map(agent => {
          if (agent.name === data.agent) {
            return { ...agent, status: data.status, progress: data.status === "running" ? "Processing" : data.status === "done" ? "Completed" : "Failed", message: data.message };
          }
          const thisIdx = AGENT_ORDER.indexOf(data.agent);
          const currentAgentIdx = AGENT_ORDER.indexOf(agent.name);
          if (currentAgentIdx < thisIdx && agent.status !== "done") {
            return { ...agent, status: "done", progress: "Completed" };
          }
          return agent;
        }));
      } else if (data.type === "complete") {
        setLogs(prev => [...prev, "[System] Pipeline completed! Fetching lead CRM profiles..."]);
        fetchSessionDetails(sId);
        es.close();
        setRunning(false);
        fetchHistory();
      } else if (data.type === "error") {
        setLogs(prev => [...prev, `[System Error] Pipeline stopped: ${data.message}`]);
        es.close();
        setRunning(false);
      }
    };
    es.onerror = () => setLogs(prev => [...prev, "[System] Reconnecting to event stream..."]);
  };

  const fetchSessionDetails = async (sId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/session/${sId}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
        setSelectedLead(prev => prev || data.leads?.[0] || null);
        if (data.leads?.length) setShowLeadPanel(true);
      }
    } catch (e) { setLogs(prev => [...prev, `[System Error] Failed to fetch CRM records: ${e}`]); }
  };

  const handleApprove = async (leadId: string) => {
    setApprovingId(leadId);
    try {
      const res = await fetch(`${API_BASE}/api/leads/${leadId}/approve`, { method: "POST", headers: { "Content-Type": "application/json" } });
      if (res.ok) {
        setLogs(prev => [...prev, `[System] Lead approved. Redirecting to build pipeline...`]);
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, human_approved: true } : l));
        setSelectedLead(prev => prev?.id === leadId ? { ...prev, human_approved: true } : prev);
        router.push(`/build?session=${sessionId}&lead=${leadId}`);
      }
    } catch (e) { setLogs(prev => [...prev, `[System Error] Failed to approve lead: ${e}`]); }
    finally { setApprovingId(null); }
  };

  const handleCopyOutreach = (text: string, channel: string) => {
    navigator.clipboard.writeText(text);
    setCopiedChannel(channel);
    setTimeout(() => setCopiedChannel(null), 2000);
  };

  const handleMarkContacted = async (leadId: string, channel: string) => {
    if (!selectedLead) return;
    setContactingChannel(channel);
    try {
      const res = await fetch(`${API_BASE}/api/leads/${leadId}/contact`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel }) });
      if (res.ok) {
        const updated = leads.map(l => l.id === leadId ? { ...l, contacted_channels: [...(l.contacted_channels || []), channel] } : l);
        setLeads(updated);
        setSelectedLead(updated.find(l => l.id === leadId) || null);
      }
    } catch (e) { console.error(e); }
    finally { setContactingChannel(null); }
  };

  const getAgentStatus = (name: string) => agents.find(a => a.name === name);

  const priorityBadge = (tier: string) => {
    if (tier === "HOT") return "bg-berry-soft border-berry/30 text-berry";
    if (tier === "WARM") return "bg-amber/10 border-amber/30 text-amber";
    return "bg-sunk border-line text-muted";
  };

  const doneCount = agents.filter(a => a.status === "done").length;
  const pct = Math.round((doneCount / agents.length) * 100);
  const activeAgentName = agents.find(a => a.status === "running")?.name;

  const renderLog = (log: string) => {
    const m = log.match(/^\[([^\]]+)\]\s*([\s\S]*)$/);
    if (!m) return <span>{log}</span>;
    const isError = /error/i.test(m[1]);
    return (
      <span>
        <em className={`not-italic font-medium ${isError ? "text-red-600" : "text-moss"}`}>{m[1]}</em>{" "}
        <span className={isError ? "text-red-600" : ""}>{m[2]}</span>
      </span>
    );
  };

  const flowGroups: string[][] = [
    ["Lead Discovery"],
    ["Website Audit"],
    ["Opportunity Scoring"],
    ["CRM Storage", "Outreach Generation"],
  ];
  const groupDone = (names: string[]) => names.every(n => getAgentStatus(n)?.status === "done");

  return (
    <div className="h-screen flex flex-col bg-canvas text-ink font-sans overflow-hidden min-w-[1200px] selection:bg-moss/20">
      {/* Header */}
      <header className="h-14 shrink-0 border-b border-line flex items-center gap-10 px-7 z-40 bg-canvas">
        <div className="flex items-center gap-2.5">
          <svg viewBox="0 0 26 26" className="w-[26px] h-[26px]">
            <circle cx="13" cy="13" r="13" fill="#2F6B4B" />
            <circle cx="8" cy="13" r="2.3" fill="#F6F8F3" />
            <circle cx="18" cy="8" r="2.3" fill="#F6F8F3" />
            <circle cx="18" cy="18" r="2.3" fill="#F6F8F3" />
            <path d="M8 13l10-5M8 13l10 5" stroke="#F6F8F3" strokeWidth="1.4" />
          </svg>
          <h1 className="font-display font-bold text-[17px] tracking-[-0.02em]">Agentic Growth OS</h1>
        </div>
        <nav className="hidden md:flex gap-1 h-full">
          {NAV.map(item => {
            const isDash = item === "Dashboard";
            const isReports = item === "Reports";
            const active = (isDash && activeTab === "run") || (isReports && activeTab === "history");
            return (
              <button
                key={item}
                onClick={() => isDash ? setActiveTab("run") : isReports ? setActiveTab("history") : undefined}
                className={`flex items-center px-3.5 font-medium border-b-2 -mb-px transition-colors ${active ? "text-ink border-moss" : "text-muted border-transparent hover:text-ink"}`}
              >
                {item}
              </button>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-4.5">
          <div className={`flex items-center gap-2 font-medium ${backendStatus === "online" ? "text-moss" : "text-amber"}`}>
            <i className={`w-2 h-2 rounded-full ${backendStatus === "online" ? "bg-moss" : "bg-amber"}`} />
            Backend {backendStatus === "online" ? "online" : "offline"}
          </div>
          <button
            onClick={() => setActiveTab("history")}
            className="border border-line rounded-lg px-3 py-1.5 font-medium hover:bg-sunk transition-colors"
          >
            History ({history.length})
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 min-h-0 grid grid-cols-[290px_minmax(0,1fr)_260px] gap-7 px-7 py-[22px] relative">
        {/* History overlay */}
        {activeTab === "history" && (
          <div className="absolute inset-0 z-30 bg-canvas/95 backdrop-blur-sm flex items-start justify-center pt-8 overflow-y-auto">
            <div className="w-full max-w-4xl mx-6">
              <div className="bg-panel border border-line rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display font-bold text-[15px] tracking-[-0.01em] flex items-center gap-2">
                    <History className="w-4 h-4 text-moss" /> Session history
                  </h2>
                  <button onClick={() => setActiveTab("run")} className="text-muted hover:text-ink">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {history.length === 0 ? (
                  <p className="text-[13px] text-muted py-8 text-center font-mono">No runs yet. Start your first search on the dashboard.</p>
                ) : (
                  <div className="grid gap-3">
                    {history.map(sess => (
                      <div
                        key={sess.id}
                        onClick={() => loadSessionDetails(sess.id)}
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between border border-line hover:border-moss/40 p-4 rounded-xl bg-panel hover:bg-sunk/50 transition-colors cursor-pointer group"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-moss font-semibold text-[13px]">{sess.niche}</span>
                            <span className="text-muted text-xs">in</span>
                            <span className="text-ink font-semibold text-[13px]">{sess.location}</span>
                          </div>
                          <div className="text-[10px] text-muted font-mono mt-1">ID: {sess.id} | {new Date(sess.created_at).toLocaleString()}</div>
                        </div>
                        <div className="flex items-center gap-3 mt-2 sm:mt-0">
                          <span className="text-xs bg-sunk px-2.5 py-1 rounded-md border border-line text-muted">{sess.total_leads} leads</span>
                          <span className="text-xs bg-berry-soft px-2.5 py-1 rounded-md border border-berry/30 text-berry font-mono">{sess.hot_leads_count} HOT</span>
                          <ChevronRight className="w-5 h-5 text-muted group-hover:text-moss transition-colors" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Left sidebar */}
        <aside className="flex flex-col gap-6 min-h-0 overflow-y-auto">
          <section>
            <h2 className="font-display font-bold text-[15px] tracking-[-0.01em] mb-3.5">New run</h2>
            <label className="block mb-3.5">
              <span className="block text-[12.5px] text-muted mb-1.5">Business niche</span>
              <input
                type="text" value={niche} disabled={running} onChange={e => setNiche(e.target.value)}
                placeholder="e.g. Hair salons"
                className="w-full bg-panel border border-line rounded-[10px] px-3 py-2 outline-none focus:border-moss transition-colors disabled:opacity-60"
              />
            </label>
            <label className="block mb-3.5">
              <span className="block text-[12.5px] text-muted mb-1.5">Target location</span>
              <input
                type="text" value={location} disabled={running} onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Austin, Texas"
                className="w-full bg-panel border border-line rounded-[10px] px-3 py-2 outline-none focus:border-moss transition-colors disabled:opacity-60"
              />
            </label>
            <div className="block">
              <span className="block text-[12.5px] text-muted mb-1.5">Max leads</span>
              <div className="grid grid-cols-5 gap-[3px] p-[3px] bg-sunk rounded-[10px]">
                {[10, 20, 30, 50, 999].map(n => (
                  <button
                    key={n}
                    onClick={() => setMaxLeads(n)}
                    disabled={running}
                    aria-pressed={maxLeads === n}
                    className={`py-1.5 rounded-lg font-semibold text-[13px] transition-colors ${maxLeads === n ? "bg-moss text-white" : "text-muted hover:text-ink"}`}
                  >
                    {n === 999 ? "All" : n}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={startPipeline}
              disabled={running || backendStatus !== "online"}
              className="w-full mt-[18px] py-3 rounded-[10px] bg-moss text-white font-semibold flex items-center justify-center gap-2 hover:bg-moss-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {running ? <><RefreshCw className="w-4 h-4 animate-spin" /> Running…</> : "Discover and audit leads"}
            </button>
          </section>

          <section>
            <h2 className="font-display font-bold text-[15px] tracking-[-0.01em] mb-3.5">Progress</h2>
            <p className="text-[13px] text-muted mb-3">
              {running ? `Running ${niche} in ${location}. Auditing websites and scoring opportunities.` : "System ready. Initiate to start autonomous lead discovery and audit."}
            </p>
            <div className="flex justify-between mb-1.5 font-medium">
              <span>Agents complete</span>
              <span className="text-muted tabular-nums">{doneCount} of {agents.length}</span>
            </div>
            <div className="h-1.5 bg-sunk rounded-full overflow-hidden">
              <div className="h-full bg-moss rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </section>
        </aside>

        {/* Center */}
        <section className="bg-panel border border-line rounded-[18px] px-6 pt-4 pb-3 flex flex-col min-h-0">
          <div className="flex justify-between items-center shrink-0">
            <h2 className="font-display font-bold text-[15px] tracking-[-0.01em]">
              {showLeadPanel && leads.length ? `Leads (${leads.length})` : "Pipeline"}
            </h2>
            {showLeadPanel && leads.length ? (
              sessionId && (
                <a href={`${API_BASE}/api/export/${sessionId}`} className="text-[12.5px] bg-moss hover:bg-moss-dark text-white font-medium px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors">
                  <Download className="w-3.5 h-3.5" /> CSV
                </a>
              )
            ) : (
              <div className="flex gap-4 text-[12.5px] text-muted">
                <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-moss" /> Done</span>
                <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-berry" /> Running</span>
                <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-wait" /> Waiting</span>
              </div>
            )}
          </div>

          {!(showLeadPanel && leads.length) ? (
            <div className="flex-1 min-h-0 flex flex-col justify-center items-center gap-2 py-4 overflow-y-auto">
              {flowGroups.map((group, gi) => (
                <React.Fragment key={gi}>
                  {gi > 0 && (
                    <div className={`w-px h-[clamp(8px,1.6vh,14px)] ${groupDone(flowGroups[gi - 1]) ? "bg-moss" : "bg-line"}`} />
                  )}
                  <div className="grid grid-flow-col auto-cols-[minmax(0,214px)] gap-3 justify-center">
                    {group.map(name => {
                      const agent = getAgentStatus(name)!;
                      return <AgentNode key={name} agent={{ ...agent, name }} num={AGENT_ORDER.indexOf(name) + 1} />;
                    })}
                  </div>
                </React.Fragment>
              ))}
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex gap-4 overflow-hidden mt-3">
              {/* Lead list */}
              <div className="w-60 shrink-0 space-y-2 overflow-y-auto pr-1">
                {leads.map(lead => {
                  const isSelected = selectedLead?.id === lead.id;
                  return (
                    <div
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      className={`p-3 rounded-xl border transition-colors cursor-pointer ${isSelected ? "bg-moss/5 border-moss" : "bg-panel border-line hover:bg-sunk/50"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-[13px] font-semibold text-ink truncate">{lead.business_name}</h3>
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${priorityBadge(lead.priority_tier)}`}>{lead.priority_tier}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted font-mono">
                        <span className="flex items-center gap-0.5 text-amber"><Star className="w-3 h-3 fill-current" />{lead.rating || "N/A"}</span>
                        <span>•</span>
                        <span className={lead.has_website ? "text-moss" : "text-muted"}>{lead.has_website ? "Has web" : "No web"}</span>
                        <span>•</span>
                        <span className="font-semibold text-ink">S:{lead.opportunity_score}</span>
                      </div>
                      {lead.human_approved && (
                        <div className="mt-1 text-[9px] font-mono text-moss border border-moss/30 bg-moss/5 rounded px-1 py-0.5 inline-flex items-center gap-1">
                          <ThumbsUp className="w-3 h-3" /> Approved
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Lead detail */}
              <div className="flex-1 overflow-y-auto pr-1">
                {selectedLead ? (
                  <div className="bg-panel border border-line rounded-2xl p-5 space-y-5">
                    <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-line pb-4">
                      <div>
                        <div className="text-[10px] text-moss font-mono uppercase tracking-wider mb-1">{selectedLead.category || "Lead profile"}</div>
                        <h2 className="font-display font-bold text-lg">{selectedLead.business_name}</h2>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted pt-1">
                          {selectedLead.address && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{selectedLead.address}</span>}
                          {selectedLead.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{selectedLead.phone}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 bg-sunk/60 border border-line p-3 rounded-xl">
                        <div className="text-center">
                          <div className="text-2xl font-bold font-mono text-moss">{selectedLead.opportunity_score}</div>
                          <div className="text-[9px] font-mono text-muted uppercase tracking-wider">Score</div>
                        </div>
                        <div className="border-l border-line pl-3.5">
                          <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded border ${priorityBadge(selectedLead.priority_tier)}`}>{selectedLead.priority_tier}</span>
                        </div>
                      </div>
                    </div>

                    {selectedLead.priority_tier !== "COLD" && !selectedLead.human_approved && (
                      <div className="border border-moss/30 bg-moss/5 p-4 rounded-xl space-y-3">
                        <div className="flex items-center gap-2"><ThumbsUp className="w-5 h-5 text-moss" /><h3 className="font-display font-bold text-[15px]">Approve for build pipeline</h3></div>
                        <p className="text-xs text-muted leading-relaxed">Review this lead. Click below to trigger the build pipeline (PRD → Frontend → Backend → GitHub → Vercel).</p>
                        <button
                          onClick={() => handleApprove(selectedLead.id)}
                          disabled={approvingId !== null}
                          className="px-5 py-2.5 rounded-xl bg-moss hover:bg-moss-dark text-white font-semibold text-xs flex items-center gap-2 transition-colors disabled:opacity-50"
                        >
                          {approvingId === selectedLead.id ? <><RefreshCw className="w-4 h-4 animate-spin" /><span>Starting build…</span></>
                            : <><ThumbsUp className="w-4 h-4" /><span>Approve &amp; build website</span></>}
                        </button>
                      </div>
                    )}

                    {selectedLead.human_approved && (
                      <div className="border border-moss/20 bg-moss/5 p-4 rounded-xl space-y-4">
                        <h3 className="font-display font-bold text-[15px] flex items-center gap-2"><Rocket className="w-4 h-4 text-moss" />Build results</h3>
                        {selectedLead.preview_url && (
                          <div className="flex items-center justify-between bg-panel p-3 rounded-lg border border-line">
                            <span className="text-xs text-muted font-mono">Preview</span>
                            <a href={selectedLead.preview_url} target="_blank" rel="noreferrer" className="text-xs text-moss hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3" />{selectedLead.preview_url}</a>
                          </div>
                        )}
                        {selectedLead.github_repo_url && (
                          <div className="flex items-center justify-between bg-panel p-3 rounded-lg border border-line">
                            <span className="text-xs text-muted font-mono">GitHub</span>
                            <a href={selectedLead.github_repo_url} target="_blank" rel="noreferrer" className="text-xs text-moss hover:underline flex items-center gap-1"><GitBranch className="w-3 h-3" />{selectedLead.github_repo_url.split("/").slice(-2).join("/")}</a>
                          </div>
                        )}
                        {selectedLead.prd_markdown && (
                          <div className="space-y-1">
                            <span className="text-xs text-muted font-mono">PRD</span>
                            <pre className="text-[10px] text-ink bg-panel p-3 rounded-lg border border-line whitespace-pre-wrap max-h-32 overflow-y-auto font-mono leading-relaxed">{selectedLead.prd_markdown}</pre>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="bg-sunk/50 border border-line p-4 rounded-xl space-y-2.5">
                      <h3 className="text-xs font-bold flex items-center gap-2"><Globe className="w-4 h-4 text-moss" />Website audit</h3>
                      <div className="grid grid-cols-3 gap-4 text-xs font-mono py-2 border-b border-line">
                        <div><span className="text-muted block">Quality:</span><span className={`capitalize font-semibold ${selectedLead.has_website ? "text-amber" : "text-berry"}`}>{selectedLead.website_quality.replace("_", " ")}</span></div>
                        <div><span className="text-muted block">SSL:</span><span className={`flex items-center gap-1 font-semibold ${selectedLead.is_ssl ? "text-moss" : "text-berry"}`}><Shield className="w-3.5 h-3.5" />{selectedLead.is_ssl ? "HTTPS" : "HTTP"}</span></div>
                        <div><span className="text-muted block">Source:</span>{selectedLead.google_maps_url ? <a href={selectedLead.google_maps_url} target="_blank" rel="noreferrer" className="text-moss hover:underline flex items-center gap-1">Google Maps <ExternalLink className="w-3 h-3" /></a> : <span className="text-muted">Places API</span>}</div>
                      </div>
                      <div className="pt-2 text-xs"><span className="text-muted font-mono block mb-1">Notes:</span><p className="text-ink leading-relaxed bg-panel p-2.5 rounded border border-line font-mono">{selectedLead.audit_notes || "No audit notes."}</p></div>
                    </div>

                    {selectedLead.priority_tier !== "COLD" && (
                      <div className="space-y-3">
                        <h3 className="text-xs font-bold flex items-center gap-2"><FileText className="w-4 h-4 text-moss" />Outreach templates</h3>
                        <div className="flex border-b border-line text-xs">
                          {(["whatsapp", "email", "linkedin", "facebook"] as const).map(ch => {
                            const contacted = (selectedLead.contacted_channels || []).includes(ch);
                            return (
                              <button
                                key={ch}
                                onClick={() => setOutreachTab(ch)}
                                className={`px-4 py-2 font-mono capitalize border-b-2 transition-colors ${outreachTab === ch ? "border-moss text-moss font-semibold" : "border-transparent text-muted hover:text-ink"}`}
                              >
                                <span className="flex items-center gap-1.5">{ch}{contacted && <Check className="w-3 h-3 text-moss" />}</span>
                              </button>
                            );
                          })}
                        </div>
                        <div className="bg-sunk/50 border border-line p-4 rounded-xl space-y-3">
                          {selectedLead.outreach_messages.find(m => m.channel === outreachTab) ? (
                            <>
                              <pre className="font-mono text-xs text-ink whitespace-pre-wrap leading-relaxed select-text min-h-[100px] max-h-[200px] overflow-y-auto">{selectedLead.outreach_messages.find(m => m.channel === outreachTab)?.message_text}</pre>
                              <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
                                <button
                                  onClick={() => handleMarkContacted(selectedLead.id, outreachTab)}
                                  disabled={contactingChannel !== null || (selectedLead.contacted_channels || []).includes(outreachTab)}
                                  className="px-3 py-1.5 rounded-lg border border-line hover:border-moss/40 text-xs font-semibold flex items-center gap-1.5 text-muted disabled:opacity-50 transition-colors"
                                >
                                  {(selectedLead.contacted_channels || []).includes(outreachTab) ? <><Check className="w-3.5 h-3.5 text-moss" /><span>Marked</span></> : <><CheckCircle2 className="w-3.5 h-3.5" /><span>Mark contacted</span></>}
                                </button>
                                {outreachTab === "whatsapp" && (
                                  <a href={`https://wa.me/?text=${encodeURIComponent(selectedLead.outreach_messages.find(m => m.channel === outreachTab)?.message_text || "")}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-[#25D366] text-white font-semibold text-xs flex items-center gap-1.5 hover:brightness-95 transition-all"><MessageCircle className="w-3.5 h-3.5" />Open WhatsApp</a>
                                )}
                                <button
                                  onClick={() => handleCopyOutreach(selectedLead.outreach_messages.find(m => m.channel === outreachTab)?.message_text || "", outreachTab)}
                                  className="px-3 py-1.5 rounded-lg bg-moss hover:bg-moss-dark text-white font-semibold text-xs flex items-center gap-1.5 transition-colors"
                                >
                                  {copiedChannel === outreachTab ? <><Check className="w-3.5 h-3.5" /><span>Copied!</span></> : <><Clipboard className="w-3.5 h-3.5" /><span>Copy</span></>}
                                </button>
                              </div>
                            </>
                          ) : (
                            <p className="text-xs text-muted italic p-4 font-mono text-center">No template generated for this channel.</p>
                          )}
                        </div>
                      </div>
                    )}
                    {selectedLead.priority_tier === "COLD" && (
                      <div className="bg-sunk/50 border border-line p-5 rounded-xl flex flex-col items-center text-center">
                        <AlertTriangle className="w-6 h-6 text-muted mb-2" />
                        <p className="text-xs text-muted font-mono">Cold leads do not get auto-generated outreach.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-panel border border-line rounded-2xl p-12 flex flex-col items-center justify-center text-center h-full">
                    <Eye className="w-8 h-8 text-muted mb-3" />
                    <p className="text-sm text-muted font-mono">Select a lead from the list to view its profile.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Right sidebar */}
        <aside className="flex flex-col gap-6 min-h-0 overflow-y-auto">
          <section>
            <h2 className="font-display font-bold text-[15px] tracking-[-0.01em] mb-3.5">Run details</h2>
            <dl className="text-[13px]">
              <div className="flex justify-between gap-3 py-2.5 border-b border-line">
                <dt className="text-muted">Active agent</dt>
                <dd className="font-medium text-right">{activeAgentName ? (AGENT_LABEL[activeAgentName] || activeAgentName) : "None"}</dd>
              </div>
              <div className="flex justify-between gap-3 py-2.5 border-b border-line">
                <dt className="text-muted">Confidence</dt>
                <dd className="font-medium">96%</dd>
              </div>
              <div className="py-2.5 border-b border-line">
                <div className="flex justify-between mb-1.5">
                  <span className="text-muted">Memory usage</span>
                  <span className="font-medium">72%</span>
                </div>
                <div className="h-1.5 bg-sunk rounded-full overflow-hidden">
                  <div className="h-full bg-moss rounded-full" style={{ width: "72%" }} />
                </div>
              </div>
              <div className="flex justify-between gap-3 py-2.5 border-b border-line"><dt className="text-muted">Context size</dt><dd className="font-medium font-mono">12,400 tokens</dd></div>
              <div className="flex justify-between gap-3 py-2.5 border-b border-line"><dt className="text-muted">Reasoning depth</dt><dd className="font-medium font-mono">17 layers</dd></div>
              <div className="flex justify-between gap-3 py-2.5 border-b border-line"><dt className="text-muted">API calls</dt><dd className="font-medium font-mono">39</dd></div>
              <div className="flex justify-between gap-3 py-2.5 border-b border-line"><dt className="text-muted">Avg latency</dt><dd className="font-medium font-mono">1.4 s</dd></div>
              <div className="flex justify-between gap-3 py-2.5"><dt className="text-muted">GPU</dt><dd className="font-medium font-mono">RTX 6000</dd></div>
            </dl>
          </section>
        </aside>
      </main>

      {/* Footer log */}
      <footer className="h-[clamp(130px,19vh,190px)] shrink-0 bg-sunk border-t border-line px-7 pt-2.5 pb-2 flex flex-col min-h-0">
        <div className="flex justify-between items-center mb-1.5">
          <h2 className="font-display font-bold text-[15px] tracking-[-0.01em]">Reasoner log</h2>
          <button onClick={() => setLogs([])} className="border border-line rounded-lg px-2.5 py-1 text-[12.5px] hover:bg-panel transition-colors">Clear</button>
        </div>
        <div className="flex-1 overflow-auto font-mono text-[12.5px] leading-[1.7]">
          {logs.length === 0 ? (
            <div className="text-muted">Console idle. Trigger a lead audit to start logging events…</div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className="flex gap-[18px]">
                <time className="text-muted flex-none">{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
                <span>{renderLog(log)}</span>
              </div>
            ))
          )}
          <div ref={terminalEndRef} />
        </div>
      </footer>
    </div>
  );
}
