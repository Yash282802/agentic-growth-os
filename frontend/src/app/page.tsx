"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search, Globe, TrendingUp, FileText, Database,
  Terminal as TermIcon, Download, Clipboard, Check, RefreshCw,
  ExternalLink, Phone, MapPin, Star, AlertTriangle,
  Shield, CheckCircle2, History, ChevronRight, MessageCircle,
  Code, GitBranch, Rocket, Bell, ThumbsUp, Eye, Zap, X, Activity,
  BarChart3, Cpu, Clock, Wifi, Layers, Target, Zap as ZapIcon,
  Radio, LineChart
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

const API_BASE = "https://backend-production-9c52.up.railway.app";

const AGENT_CONFIGS: { name: string; icon: React.ReactNode; description: string; row: number; side?: "left" | "center" | "right" }[] = [
  { name: "Lead Discovery", icon: <Search className="w-5 h-5" />, description: "Discovers businesses via Google Places", row: 1, side: "center" },
  { name: "Website Audit", icon: <Globe className="w-5 h-5" />, description: "Checks website accessibility & quality", row: 2, side: "center" },
  { name: "Opportunity Scoring", icon: <TrendingUp className="w-5 h-5" />, description: "Multi-factor rubric out of 100", row: 3, side: "center" },
  { name: "Outreach Generation", icon: <FileText className="w-5 h-5" />, description: "Personalized copy for 4 channels", row: 3, side: "right" },
  { name: "CRM Storage", icon: <Database className="w-5 h-5" />, description: "E5 embeddings + DB deduplication", row: 3, side: "left" },
  { name: "PRD Generation", icon: <FileText className="w-5 h-5" />, description: "Writes PRD for approved leads", row: 4, side: "center" },
  { name: "Frontend Generation", icon: <Code className="w-5 h-5" />, description: "Generates Next.js UI from PRD", row: 5, side: "left" },
  { name: "Backend Schema", icon: <Database className="w-5 h-5" />, description: "FastAPI backend schema", row: 5, side: "center" },
  { name: "Build", icon: <GitBranch className="w-5 h-5" />, description: "Scaffolds repo from templates", row: 5, side: "right" },
  { name: "Deploy", icon: <Rocket className="w-5 h-5" />, description: "GitHub + Vercel preview", row: 6, side: "center" },
  { name: "Notify", icon: <Bell className="w-5 h-5" />, description: "Summarizes done & outstanding", row: 7, side: "center" },
];

const AGENT_ORDER = AGENT_CONFIGS.map(a => a.name);

const NODE_GLOW: Record<string, string> = {
  "Lead Discovery": "shadow-[0_0_15px_rgba(184,245,90,0.3)] border-neon-green",
  "Website Audit": "shadow-[0_0_15px_rgba(59,130,246,0.3)] border-neon-blue",
  "Opportunity Scoring": "shadow-[0_0_15px_rgba(168,85,247,0.3)] border-neon-purple",
  "Outreach Generation": "shadow-[0_0_15px_rgba(249,115,22,0.3)] border-neon-orange",
  "CRM Storage": "shadow-[0_0_15px_rgba(249,115,22,0.3)] border-neon-orange",
  "PRD Generation": "shadow-[0_0_15px_rgba(59,130,246,0.3)] border-neon-blue/20",
  "Frontend Generation": "shadow-[0_0_15px_rgba(59,130,246,0.3)] border-neon-blue/20",
  "Backend Schema": "shadow-[0_0_15px_rgba(59,130,246,0.3)] border-neon-blue/20",
  "Build": "shadow-[0_0_15px_rgba(59,130,246,0.3)] border-neon-blue/20",
  "Deploy": "shadow-[0_0_15px_rgba(59,130,246,0.3)] border-neon-blue/20",
  "Notify": "shadow-[0_0_15px_rgba(168,85,247,0.3)] border-neon-purple/20",
};

const NODE_ICON_COLOR: Record<string, string> = {
  "Lead Discovery": "text-neon-green",
  "Website Audit": "text-neon-blue",
  "Opportunity Scoring": "text-neon-purple",
  "Outreach Generation": "text-neon-orange",
  "CRM Storage": "text-neon-orange",
  "PRD Generation": "text-neon-blue/40",
  "Frontend Generation": "text-neon-blue/40",
  "Backend Schema": "text-neon-blue/40",
  "Build": "text-neon-blue/40",
  "Deploy": "text-neon-blue/40",
  "Notify": "text-neon-purple/40",
};

const NODE_GLOW_BG: Record<string, string> = {
  "Lead Discovery": "#B8F55A",
  "Website Audit": "#3B82F6",
  "Opportunity Scoring": "#A855F7",
  "Outreach Generation": "#F97316",
  "CRM Storage": "#F97316",
};

export default function Home() {
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
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
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
      setSelectedSessionId(id);
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
    } catch (err: any) {
      setLogs(prev => [...prev, `[System Error] ${err.message || "Could not start workflow."}`]);
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
      } else if (data.type === "build_complete") {
        setLogs(prev => [...prev, "[System] Build pipeline completed! Refreshing lead details..."]);
        fetchSessionDetails(sId);
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
        setLogs(prev => [...prev, `[System] Build pipeline started for lead ${leadId.slice(0, 8)}...`]);
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, human_approved: true } : l));
        setSelectedLead(prev => prev?.id === leadId ? { ...prev, human_approved: true } : prev);
        if (sessionId) connectSSE(sessionId);
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

  const logColor = (log: string) => {
    if (log.includes("[Lead Discovery]")) return "text-neon-green/90";
    if (log.includes("[Website Audit]")) return "text-neon-blue/90";
    if (log.includes("[Opportunity Scoring]")) return "text-neon-purple/90";
    if (log.includes("[Outreach Generation]")) return "text-neon-orange/90";
    if (log.includes("[CRM Storage]")) return "text-neon-orange/90";
    if (log.includes("[PRD Generation]")) return "text-neon-blue/90";
    if (log.includes("[Frontend Generation]")) return "text-neon-blue/90";
    if (log.includes("[Backend Schema]")) return "text-neon-blue/90";
    if (log.includes("[Build]")) return "text-neon-blue/90";
    if (log.includes("[Deploy]")) return "text-neon-blue/90";
    if (log.includes("[Notify]")) return "text-neon-purple/90";
    if (log.includes("[System Error]")) return "text-red-400 font-bold";
    if (log.includes("[System]")) return "text-white font-semibold";
    return "text-gray-400";
  };

  const getAgentStatus = (name: string) => {
    return agents.find(a => a.name === name);
  };

  const statusDot = (name: string) => {
    const a = getAgentStatus(name);
    if (!a || a.status === "idle") return <span className="w-2 h-2 rounded-full bg-neon-orange" />;
    if (a.status === "running") return <span className="w-2 h-2 rounded-full bg-neon-green dot-pulse" />;
    if (a.status === "done") return <span className="w-2 h-2 rounded-full bg-neon-green" />;
    return <span className="w-2 h-2 rounded-full bg-red-500" />;
  };

  const agentLabel = (name: string) => {
    const a = getAgentStatus(name);
    if (!a || a.status === "idle") return <span className="text-[8px] text-neon-orange">Waiting</span>;
    if (a.status === "running") return <span className="text-[8px] text-neon-green animate-pulse">Processing...</span>;
    if (a.status === "done") return <span className="text-[8px] text-neon-green">Completed</span>;
    return <span className="text-[8px] text-red-400">Failed</span>;
  };

  const priorityBadge = (tier: string) => {
    if (tier === "HOT") return "bg-red-500/10 border-red-500/30 text-red-400";
    if (tier === "WARM") return "bg-amber-500/10 border-amber-500/30 text-amber-400";
    return "bg-zinc-500/10 border-zinc-500/20 text-zinc-400";
  };

  const agentOpacity = (name: string) => {
    const a = getAgentStatus(name);
    if (!a || a.status === "idle") return "opacity-50";
    return "opacity-100";
  };

  const rows = [1, 2, 3, 4, 5, 6, 7];

  return (
    <div className="h-screen flex flex-col bg-os-black text-gray-300 font-sans overflow-hidden selection:bg-neon-green/30 selection:text-black">
      <style>{`
        @keyframes pulse-soft { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }
        .animate-pulse-soft { animation: pulse-soft 3s infinite ease-in-out; }
        @keyframes flow { from { stroke-dashoffset: 100; } to { stroke-dashoffset: 0; } }
        .path-flow { stroke-dasharray: 4, 12; animation: flow 20s linear infinite; }
        .glass-panel { backdrop-filter: blur(12px); background: rgba(15, 15, 15, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); }
        .glow-green { box-shadow: 0 0 15px rgba(184, 245, 90, 0.3); }
        .glow-blue { box-shadow: 0 0 15px rgba(59, 130, 246, 0.3); }
        .glow-purple { box-shadow: 0 0 15px rgba(168, 85, 247, 0.3); }
        .glow-orange { box-shadow: 0 0 15px rgba(249, 115, 22, 0.3); }
        .dot-pulse { animation: dot-pulse 2s infinite; }
        @keyframes dot-pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(184, 245, 90, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(184, 245, 90, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(184, 245, 90, 0); } }
        .terminal-scroll::-webkit-scrollbar { width: 4px; }
        .terminal-scroll::-webkit-scrollbar-track { background: transparent; }
        .terminal-scroll::-webkit-scrollbar-thumb { background: rgba(184, 245, 90, 0.2); border-radius: 2px; }
        .bg-grid { background-image: linear-gradient(rgba(184,245,90,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(184,245,90,0.03) 1px, transparent 1px); background-size: 40px 40px; }
        .neural-node { transition: all 0.3s ease; }
        .neural-node:hover { transform: scale(1.1); }
      `}</style>

      {/* Header */}
      <header className="h-16 border-b border-os-border flex items-center justify-between px-6 z-50 bg-os-black/80 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-neon-green rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(184,245,90,0.3)]">
            <ZapIcon className="w-5 h-5 text-black" />
          </div>
          <div>
            <h1 className="text-white font-bold tracking-tight text-lg leading-tight">Agentic Growth OS</h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">Autonomous Intelligence Pipeline</p>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-1 bg-black/40 p-1 rounded-full border border-os-border">
          <button onClick={() => setActiveTab("run")} className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${activeTab === "run" ? "text-neon-green bg-neon-green/10 border border-neon-green/20" : "text-gray-400 hover:text-white"}`}>Dashboard</button>
          <button className="px-4 py-1.5 rounded-full text-xs font-medium text-gray-400 hover:text-white transition-all">Leads</button>
          <button className="px-4 py-1.5 rounded-full text-xs font-medium text-gray-400 hover:text-white transition-all">Agents</button>
          <button onClick={() => setActiveTab("history")} className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${activeTab === "history" ? "text-neon-green bg-neon-green/10 border border-neon-green/20" : "text-gray-400 hover:text-white"}`}>Reports</button>
        </nav>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${backendStatus === "online" ? "bg-neon-green/10 border-neon-green/20" : "bg-red-500/10 border-red-500/20"}`}>
            <span className={`w-2 h-2 rounded-full ${backendStatus === "online" ? "bg-neon-green animate-pulse" : "bg-red-500 animate-pulse"}`} />
            <span className={`text-[10px] font-bold ${backendStatus === "online" ? "text-neon-green" : "text-red-500"}`}>Backend: {backendStatus === "online" ? "Online" : "Offline"}</span>
          </div>
          <button onClick={() => setActiveTab("history")} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-os-border rounded-lg text-xs transition-all">
            <History className="w-4 h-4" />
            History ({history.length})
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden relative">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-blue/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-purple/5 blur-[120px] rounded-full pointer-events-none" />

        {/* History Tab Full Overlay */}
        {activeTab === "history" && (
          <div className="absolute inset-0 z-20 bg-os-black/95 backdrop-blur-sm flex items-start justify-center pt-8 overflow-y-auto">
            <div className="w-full max-w-4xl mx-6">
              <div className="glass-panel rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-sm font-bold text-white flex items-center gap-2"><History className="w-4 h-4 text-neon-green" />Session Execution Logs</h2>
                  <button onClick={() => setActiveTab("run")} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                {history.length === 0 ? (
                  <p className="text-sm text-gray-500 py-8 text-center font-mono">No execution runs found. Start your first search on the Dashboard tab.</p>
                ) : (
                  <div className="grid gap-3">
                    {history.map(sess => (
                      <div key={sess.id} onClick={() => loadSessionDetails(sess.id)} className="flex flex-col sm:flex-row items-start sm:items-center justify-between border border-os-border hover:border-neon-green/30 p-4 rounded-lg bg-black/40 hover:bg-white/[0.04] transition-all cursor-pointer group">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-neon-green font-semibold text-sm">{sess.niche}</span>
                            <span className="text-gray-500 text-xs">in</span>
                            <span className="text-gray-300 font-semibold text-sm">{sess.location}</span>
                          </div>
                          <div className="text-[10px] text-gray-600 font-mono mt-1">ID: {sess.id} | {new Date(sess.created_at).toLocaleString()}</div>
                        </div>
                        <div className="flex items-center gap-4 mt-2 sm:mt-0">
                          <span className="text-xs bg-white/5 px-2.5 py-1 rounded-md border border-os-border text-gray-400">{sess.total_leads} Leads</span>
                          <span className="text-xs bg-red-500/5 px-2.5 py-1 rounded-md border border-red-500/20 text-red-400 font-mono">{sess.hot_leads_count} HOT</span>
                          <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-neon-green transition-colors" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Left Sidebar */}
        <aside className="w-[300px] flex flex-col p-4 gap-4 z-10 shrink-0 overflow-y-auto">
          <div className="glass-panel rounded-2xl p-5 flex flex-col gap-6">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-neon-green glow-green" />
                <h2 className="text-xs font-bold tracking-widest text-white uppercase">Start Pipeline</h2>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Business Niche</label>
                  <input type="text" value={niche} disabled={running} onChange={e => setNiche(e.target.value)} placeholder="e.g. Hair Salons"
                    className="block w-full px-4 py-2.5 bg-black/40 border border-os-border rounded-xl text-sm text-white focus:ring-neon-green/30 focus:border-neon-green outline-none transition-all disabled:opacity-50 placeholder:text-gray-600" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Target Location</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <input type="text" value={location} disabled={running} onChange={e => setLocation(e.target.value)} placeholder="e.g. Austin, Texas"
                      className="block w-full pl-10 pr-10 py-2.5 bg-black/40 border border-os-border rounded-xl text-sm text-white focus:ring-neon-green/30 focus:border-neon-green outline-none transition-all disabled:opacity-50 placeholder:text-gray-600" />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-neon-green/60">
                      <Radio className="w-4 h-4" />
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Max Leads</label>
                  <div className="grid grid-cols-5 gap-1 p-1 bg-black/40 rounded-xl border border-os-border">
                    {[10, 20, 30, 50, 999].map(n => (
                      <button key={n} onClick={() => setMaxLeads(n)} disabled={running}
                        className={`py-1 text-[10px] font-bold rounded-lg transition-all ${maxLeads === n ? "bg-neon-green text-black" : "text-gray-400 hover:text-white"}`}>
                        {n === 999 ? "All" : n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={startPipeline} disabled={running || backendStatus !== "online"}
                className="w-full mt-6 py-4 bg-neon-green hover:brightness-110 rounded-2xl text-black font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-neon-green/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]">
                {running ? <><RefreshCw className="w-5 h-5 animate-spin" /><span>Pipeline Active...</span></>
                  : <><Zap className="w-5 h-5" /><span>Discover & Audit Leads</span><ChevronRight className="w-4 h-4" /></>}
              </button>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-5 flex flex-col flex-1 min-h-[200px]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-neon-green" />
                <h2 className="text-xs font-bold tracking-widest text-white uppercase">Pipeline Status</h2>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${running ? "bg-neon-green dot-pulse" : "bg-neon-orange"}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wider ${running ? "text-neon-green" : "text-neon-orange"}`}>{running ? "Live" : "Idle"}</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed mb-6">{running ? "Pipeline is executing. Monitor agent activity below." : "System is ready. Initiate to start autonomous lead discovery and audit."}</p>
            <div className="flex-1 flex flex-col justify-end">
              <div className="h-24 w-full relative overflow-hidden">
                <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 40">
                  <path className="animate-pulse-soft" d="M0 20 Q 5 10, 10 20 T 20 20 T 30 20 T 40 20 T 50 15 T 60 25 T 70 20 T 80 20 T 90 20 T 100 20" fill="none" stroke="#B8F55A" strokeWidth="0.5" />
                  <path d="M0 25 Q 10 35, 20 25 T 40 25 T 60 30 T 80 25 T 100 25" fill="none" opacity="0.3" stroke="#B8F55A" strokeWidth="0.2" />
                </svg>
              </div>
            </div>
          </div>
        </aside>

        {/* Center: Neural Network / Lead Panel */}
        <div className="flex-1 relative flex flex-col">
          {/* Legend */}
          <div className="absolute top-4 right-4 glass-panel p-3 rounded-xl border border-os-border/50 text-[10px] space-y-2 z-10">
            <div className="flex items-center gap-2 text-gray-400"><span className="w-2 h-2 rounded-full bg-neon-green"></span> Thinking</div>
            <div className="flex items-center gap-2 text-gray-400"><span className="w-2 h-2 rounded-full bg-neon-blue"></span> Processing</div>
            <div className="flex items-center gap-2 text-gray-400"><span className="w-2 h-2 rounded-full bg-neon-purple"></span> Data Transfer</div>
            <div className="flex items-center gap-2 text-gray-400"><span className="w-2 h-2 rounded-full bg-neon-orange"></span> Waiting</div>
            <div className="flex items-center gap-2 text-gray-400"><span className="w-2 h-2 rounded-full bg-neon-green"><Check className="w-2 h-2 text-black" /></span> Completed</div>
          </div>

          {!showLeadPanel || leads.length === 0 ? (
            /* Neural Network Visualization */
            <div className="flex-1 flex items-center justify-center p-6 relative">
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.3 }}>
                <defs>
                  <linearGradient id="grad-green" x1="0%" x2="100%" y1="0%" y2="0%">
                    <stop offset="0%" stopColor="#B8F55A" stopOpacity="0.1" />
                    <stop offset="50%" stopColor="#B8F55A" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#B8F55A" stopOpacity="0.1" />
                  </linearGradient>
                </defs>
                <path className="path-flow" d="M 50% 120 L 50% 240 L 50% 360 L 50% 480" fill="none" stroke="url(#grad-green)" strokeWidth="1.5" />
                <path d="M 50% 120 C 35% 150, 30% 350, 30% 380" fill="none" stroke="rgba(249, 115, 22, 0.2)" strokeWidth="1" />
                <path d="M 50% 120 C 65% 150, 70% 350, 70% 380" fill="none" stroke="rgba(249, 115, 22, 0.2)" strokeWidth="1" />
                <path d="M 50% 360 L 50% 480" fill="none" stroke="rgba(59, 130, 246, 0.1)" strokeWidth="1" />
                <path d="M 50% 480 L 40% 600" fill="none" stroke="rgba(59, 130, 246, 0.1)" strokeWidth="1" />
                <path d="M 50% 480 L 50% 600" fill="none" stroke="rgba(59, 130, 246, 0.1)" strokeWidth="1" />
                <path d="M 50% 480 L 60% 600" fill="none" stroke="rgba(59, 130, 246, 0.1)" strokeWidth="1" />
              </svg>

              <div className="relative w-full h-full flex flex-col items-center justify-between py-4 max-w-2xl">
                {/* Row 1: Lead Discovery */}
                <div className="relative z-10 flex flex-col items-center neural-node">
                  <div className={`w-16 h-16 rounded-full bg-black border-2 flex flex-col items-center justify-center relative ${agents.find(a => a.name === "Lead Discovery")?.status === "running" ? "border-neon-green glow-green" : agents.find(a => a.name === "Lead Discovery")?.status === "done" ? "border-neon-green" : "border-neon-green/30"} ${agentOpacity("Lead Discovery")}`}>
                    <span className="absolute -top-2 -right-2 w-5 h-5 bg-neon-green rounded-full flex items-center justify-center text-[10px] text-black font-bold">1</span>
                    <Search className={`w-6 h-6 mb-1 ${agents.find(a => a.name === "Lead Discovery")?.status === "running" || agents.find(a => a.name === "Lead Discovery")?.status === "done" ? "text-neon-green" : "text-neon-green/40"}`} />
                  </div>
                  <div className="mt-2 text-center">
                    <p className="text-[10px] font-bold text-white uppercase tracking-tighter">Lead Discovery</p>
                    {agentLabel("Lead Discovery")}
                  </div>
                </div>

                {/* Row 2: Website Audit */}
                <div className="relative z-10 flex flex-col items-center -mt-6 neural-node">
                  <div className={`w-16 h-16 rounded-full bg-black border-2 flex flex-col items-center justify-center relative ${agents.find(a => a.name === "Website Audit")?.status === "running" ? "border-neon-blue glow-blue" : agents.find(a => a.name === "Website Audit")?.status === "done" ? "border-neon-blue" : "border-neon-blue/30"} ${agentOpacity("Website Audit")}`}>
                    <span className="absolute -top-2 -right-2 w-5 h-5 bg-neon-blue rounded-full flex items-center justify-center text-[10px] text-white font-bold">2</span>
                    <Globe className={`w-6 h-6 mb-1 ${agents.find(a => a.name === "Website Audit")?.status === "running" || agents.find(a => a.name === "Website Audit")?.status === "done" ? "text-neon-blue" : "text-neon-blue/40"}`} />
                  </div>
                  <div className="mt-2 text-center">
                    <p className="text-[10px] font-bold text-white uppercase tracking-tighter">Website Auditor</p>
                    {agentLabel("Website Audit")}
                  </div>
                </div>

                {/* Row 3: CRM + Scorer + Outreach */}
                <div className="w-full flex justify-center items-center gap-16 relative -mt-4">
                  <div className="flex flex-col items-center neural-node">
                    <div className={`w-20 h-20 rounded-full bg-black border-2 flex flex-col items-center justify-center relative ${agents.find(a => a.name === "CRM Storage")?.status === "running" ? "border-neon-orange glow-orange" : agents.find(a => a.name === "CRM Storage")?.status === "done" ? "border-neon-orange" : "border-neon-orange/30"} ${agentOpacity("CRM Storage")}`}>
                      <span className="absolute -top-2 -right-2 w-5 h-5 bg-neon-orange rounded-full flex items-center justify-center text-[10px] text-white font-bold">4</span>
                      <Database className={`w-8 h-8 mb-1 ${agents.find(a => a.name === "CRM Storage")?.status === "running" || agents.find(a => a.name === "CRM Storage")?.status === "done" ? "text-neon-orange" : "text-neon-orange/40"}`} />
                    </div>
                    <div className="mt-2 text-center">
                      <p className="text-[10px] font-bold text-white uppercase tracking-tighter">CRM Enricher</p>
                      {agentLabel("CRM Storage")}
                    </div>
                  </div>

                  <div className="flex flex-col items-center neural-node">
                    <div className={`w-16 h-16 rounded-full bg-black border-2 flex flex-col items-center justify-center relative ${agents.find(a => a.name === "Opportunity Scoring")?.status === "running" ? "border-neon-purple glow-purple" : agents.find(a => a.name === "Opportunity Scoring")?.status === "done" ? "border-neon-purple" : "border-neon-purple/30"} ${agentOpacity("Opportunity Scoring")}`}>
                      <span className="absolute -top-2 -right-2 w-5 h-5 bg-neon-purple rounded-full flex items-center justify-center text-[10px] text-white font-bold">3</span>
                      <TrendingUp className={`w-6 h-6 mb-1 ${agents.find(a => a.name === "Opportunity Scoring")?.status === "running" || agents.find(a => a.name === "Opportunity Scoring")?.status === "done" ? "text-neon-purple" : "text-neon-purple/40"}`} />
                    </div>
                    <div className="mt-2 text-center">
                      <p className="text-[10px] font-bold text-white uppercase tracking-tighter">Opportunity Scorer</p>
                      {agentLabel("Opportunity Scoring")}
                    </div>
                  </div>

                  <div className="flex flex-col items-center neural-node">
                    <div className={`w-20 h-20 rounded-full bg-black border-2 flex flex-col items-center justify-center relative ${agents.find(a => a.name === "Outreach Generation")?.status === "running" ? "border-neon-orange glow-orange" : agents.find(a => a.name === "Outreach Generation")?.status === "done" ? "border-neon-orange" : "border-neon-orange/30"} ${agentOpacity("Outreach Generation")}`}>
                      <span className="absolute -top-2 -right-2 w-5 h-5 bg-neon-orange rounded-full flex items-center justify-center text-[10px] text-white font-bold">5</span>
                      <FileText className={`w-8 h-8 mb-1 ${agents.find(a => a.name === "Outreach Generation")?.status === "running" || agents.find(a => a.name === "Outreach Generation")?.status === "done" ? "text-neon-orange" : "text-neon-orange/40"}`} />
                    </div>
                    <div className="mt-2 text-center">
                      <p className="text-[10px] font-bold text-white uppercase tracking-tighter">Outreach Agent</p>
                      {agentLabel("Outreach Generation")}
                    </div>
                  </div>
                </div>

                {/* Row 4: PRD Generator */}
                <div className="relative z-10 flex flex-col items-center -mt-4 neural-node">
                  <div className={`w-16 h-16 rounded-full bg-black border-2 flex flex-col items-center justify-center relative ${agents.find(a => a.name === "PRD Generation")?.status === "running" ? "border-neon-blue/50" : agents.find(a => a.name === "PRD Generation")?.status === "done" ? "border-neon-blue/50" : "border-neon-blue/10"} ${agentOpacity("PRD Generation")}`}>
                    <span className="absolute -top-2 -right-2 w-5 h-5 bg-os-dark-gray border border-os-border rounded-full flex items-center justify-center text-[10px] text-gray-400 font-bold">6</span>
                    <FileText className="w-6 h-6 text-neon-blue/40 mb-1" />
                  </div>
                  <div className="mt-2 text-center">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">PRD Generator</p>
                    {agentLabel("PRD Generation")}
                  </div>
                </div>

                {/* Row 5: Frontend + Backend + Build */}
                <div className="w-full flex justify-center items-center gap-12 relative -mt-4">
                  {["Frontend Generation", "Backend Schema", "Build"].map((name, idx) => {
                    const nums = [7, 8, 9];
                    return (
                      <div key={name} className={`flex flex-col items-center neural-node ${agentOpacity(name)}`}>
                        <div className="w-14 h-14 rounded-full bg-black border-2 border-neon-blue/10 flex flex-col items-center justify-center relative">
                          <span className="absolute -top-2 -right-2 w-4 h-4 bg-os-dark-gray border border-os-border rounded-full flex items-center justify-center text-[9px] text-gray-400 font-bold">{nums[idx]}</span>
                          {name === "Frontend Generation" && <Code className="w-5 h-5 text-neon-blue/40 mb-1" />}
                          {name === "Backend Schema" && <Database className="w-5 h-5 text-neon-blue/40 mb-1" />}
                          {name === "Build" && <GitBranch className="w-5 h-5 text-neon-blue/40 mb-1" />}
                        </div>
                        <div className="mt-1 text-center">
                          <p className="text-[9px] font-bold text-gray-500 uppercase">{name === "Frontend Generation" ? "Frontend Builder" : name === "Backend Schema" ? "Backend Builder" : "Build Agent"}</p>
                          {agentLabel(name)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Row 6: Deploy */}
                <div className="relative z-10 flex flex-col items-center -mt-4 neural-node">
                  <div className={`w-16 h-16 rounded-full bg-black border-2 flex flex-col items-center justify-center relative ${agents.find(a => a.name === "Deploy")?.status === "running" || agents.find(a => a.name === "Deploy")?.status === "done" ? "border-neon-blue/50" : "border-neon-blue/10"} ${agentOpacity("Deploy")}`}>
                    <span className="absolute -top-2 -right-2 w-5 h-5 bg-os-dark-gray border border-os-border rounded-full flex items-center justify-center text-[10px] text-gray-400 font-bold">10</span>
                    <Rocket className="w-6 h-6 text-neon-blue/40 mb-1" />
                  </div>
                  <div className="mt-2 text-center">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Deployment Agent</p>
                    {agentLabel("Deploy")}
                  </div>
                </div>

                {/* Row 7: Notify */}
                <div className="relative z-10 flex flex-col items-center -mt-4 neural-node">
                  <div className={`w-16 h-16 rounded-full bg-black border-2 flex flex-col items-center justify-center relative ${agents.find(a => a.name === "Notify")?.status === "running" || agents.find(a => a.name === "Notify")?.status === "done" ? "border-neon-purple/50" : "border-neon-purple/10"} ${agentOpacity("Notify")}`}>
                    <span className="absolute -top-2 -right-2 w-5 h-5 bg-os-dark-gray border border-os-border rounded-full flex items-center justify-center text-[10px] text-gray-400 font-bold">11</span>
                    <Bell className="w-6 h-6 text-neon-purple/40 mb-1" />
                  </div>
                  <div className="mt-2 text-center">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Notification Agent</p>
                    {agentLabel("Notify")}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Lead Panel */
            <div className="flex-1 flex p-4 gap-4 overflow-hidden">
              <div className="w-72 shrink-0 space-y-2 overflow-y-auto pr-1 terminal-scroll">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Leads ({leads.length})</h2>
                  {sessionId && (
                    <a href={`${API_BASE}/api/export/${sessionId}`} className="text-[10px] text-black bg-neon-green hover:brightness-110 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all">
                      <Download className="w-3 h-3" />CSV
                    </a>
                  )}
                </div>
                {leads.map(lead => {
                  const isSelected = selectedLead?.id === lead.id;
                  return (
                    <div key={lead.id} onClick={() => setSelectedLead(lead)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${isSelected ? "bg-white/5 border-neon-green/40" : "bg-black/40 border-os-border hover:bg-white/[0.04]"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-xs font-bold text-white/80 line-clamp-1">{lead.business_name}</h3>
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${priorityBadge(lead.priority_tier)}`}>{lead.priority_tier}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-500 font-mono">
                        <span className="flex items-center gap-0.5 text-amber-400"><Star className="w-3 h-3 fill-current" />{lead.rating || "N/A"}</span>
                        <span>•</span>
                        <span className={lead.has_website ? "text-neon-green" : "text-gray-600"}>{lead.has_website ? "Has Web" : "No Web"}</span>
                        <span>•</span>
                        <span className="font-semibold text-gray-300">S:{lead.opportunity_score}</span>
                      </div>
                      {lead.human_approved && <div className="mt-1 text-[9px] font-mono text-neon-green border border-neon-green/30 bg-neon-green/5 rounded px-1 py-0.5 inline-flex items-center gap-1"><ThumbsUp className="w-3 h-3" />Approved</div>}
                    </div>
                  );
                })}
              </div>

              <div className="flex-1 overflow-y-auto pr-1 terminal-scroll">
                {selectedLead ? (
                  <div className="glass-panel rounded-2xl p-5 space-y-5">
                    <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-os-border pb-4">
                      <div>
                        <div className="text-[10px] text-neon-green font-mono uppercase tracking-wider mb-1">{selectedLead.category || "Lead Profile"}</div>
                        <h2 className="text-lg font-bold text-white">{selectedLead.business_name}</h2>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400 pt-1">
                          {selectedLead.address && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-gray-500" />{selectedLead.address}</span>}
                          {selectedLead.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-gray-500" />{selectedLead.phone}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 bg-black/40 border border-os-border p-3 rounded-xl">
                        <div className="text-center">
                          <div className="text-2xl font-bold font-mono text-neon-green">{selectedLead.opportunity_score}</div>
                          <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">Score</div>
                        </div>
                        <div className="border-l border-os-border pl-3.5">
                          <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded border ${priorityBadge(selectedLead.priority_tier)}`}>{selectedLead.priority_tier}</span>
                        </div>
                      </div>
                    </div>

                    {selectedLead.priority_tier !== "COLD" && !selectedLead.human_approved && (
                      <div className="glass-panel border border-neon-green/30 p-4 rounded-xl space-y-3">
                        <div className="flex items-center gap-2"><ThumbsUp className="w-5 h-5 text-neon-green" /><h3 className="text-sm font-bold text-white">Approve for Build Pipeline</h3></div>
                        <p className="text-xs text-gray-400 leading-relaxed">Review this lead. Click below to trigger the build pipeline (PRD → Frontend → Backend → GitHub → Vercel).</p>
                        <button onClick={() => handleApprove(selectedLead.id)} disabled={approvingId !== null}
                          className="px-5 py-2.5 rounded-xl bg-neon-green hover:brightness-110 text-black font-bold text-xs flex items-center gap-2 shadow-lg shadow-neon-green/20 disabled:opacity-50 transition-all active:scale-[0.98]">
                          {approvingId === selectedLead.id ? <><RefreshCw className="w-4 h-4 animate-spin" /><span>Starting Build...</span></>
                            : <><ThumbsUp className="w-4 h-4" /><span>Approve & Build Website</span></>}
                        </button>
                      </div>
                    )}

                    {selectedLead.human_approved && (
                      <div className="glass-panel border border-neon-green/20 p-4 rounded-xl space-y-4">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2"><Rocket className="w-4 h-4 text-neon-green" />Build Results</h3>
                        {selectedLead.preview_url && (
                          <div className="flex items-center justify-between bg-black/40 p-3 rounded-lg border border-os-border">
                            <span className="text-xs text-gray-400 font-mono">Preview</span>
                            <a href={selectedLead.preview_url} target="_blank" rel="noreferrer" className="text-xs text-neon-green hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3" />{selectedLead.preview_url}</a>
                          </div>
                        )}
                        {selectedLead.github_repo_url && (
                          <div className="flex items-center justify-between bg-black/40 p-3 rounded-lg border border-os-border">
                            <span className="text-xs text-gray-400 font-mono">GitHub</span>
                            <a href={selectedLead.github_repo_url} target="_blank" rel="noreferrer" className="text-xs text-neon-green hover:underline flex items-center gap-1"><GitBranch className="w-3 h-3" />{selectedLead.github_repo_url.split("/").slice(-2).join("/")}</a>
                          </div>
                        )}
                        {selectedLead.prd_markdown && (
                          <div className="space-y-1">
                            <span className="text-xs text-gray-400 font-mono">PRD</span>
                            <pre className="text-[10px] text-gray-300 bg-black/40 p-3 rounded-lg border border-os-border whitespace-pre-wrap max-h-32 overflow-y-auto font-mono leading-relaxed">{selectedLead.prd_markdown}</pre>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="bg-black/20 border border-os-border p-4 rounded-xl space-y-2.5">
                      <h3 className="text-xs font-bold text-gray-300 flex items-center gap-2"><Globe className="w-4 h-4 text-neon-green" />Website Audit</h3>
                      <div className="grid grid-cols-3 gap-4 text-xs font-mono py-2 border-b border-os-border">
                        <div><span className="text-gray-600 block">Quality:</span><span className={`capitalize font-semibold ${selectedLead.has_website ? "text-amber-400" : "text-red-400"}`}>{selectedLead.website_quality.replace("_", " ")}</span></div>
                        <div><span className="text-gray-600 block">SSL:</span><span className={`flex items-center gap-1 font-semibold ${selectedLead.is_ssl ? "text-neon-green" : "text-red-400"}`}><Shield className="w-3.5 h-3.5" />{selectedLead.is_ssl ? "HTTPS" : "HTTP"}</span></div>
                        <div><span className="text-gray-600 block">Source:</span>{selectedLead.google_maps_url ? <a href={selectedLead.google_maps_url} target="_blank" rel="noreferrer" className="text-neon-green hover:underline flex items-center gap-1">Google Maps <ExternalLink className="w-3 h-3" /></a> : <span className="text-gray-500">Places API</span>}</div>
                      </div>
                      <div className="pt-2 text-xs"><span className="text-gray-600 font-mono block mb-1">Notes:</span><p className="text-gray-400 leading-relaxed bg-black/40 p-2.5 rounded border border-os-border font-mono">{selectedLead.audit_notes || "No audit notes."}</p></div>
                    </div>

                    {selectedLead.priority_tier !== "COLD" && (
                      <div className="space-y-3">
                        <h3 className="text-xs font-bold text-gray-300 flex items-center gap-2"><FileText className="w-4 h-4 text-neon-green" />Outreach Templates</h3>
                        <div className="flex border-b border-os-border text-xs">
                          {(["whatsapp", "email", "linkedin", "facebook"] as const).map(ch => {
                            const contacted = (selectedLead.contacted_channels || []).includes(ch);
                            return (
                              <button key={ch} onClick={() => setOutreachTab(ch)}
                                className={`px-4 py-2 font-mono capitalize border-b-2 transition-all ${outreachTab === ch ? "border-neon-green text-neon-green font-bold" : "border-transparent text-gray-500 hover:text-gray-300"}`}>
                                <span className="flex items-center gap-1.5">{ch}{contacted && <Check className="w-3 h-3 text-neon-green" />}</span>
                              </button>
                            );
                          })}
                        </div>
                        <div className="bg-black/40 border border-os-border p-4 rounded-xl space-y-3">
                          {selectedLead.outreach_messages.find(m => m.channel === outreachTab) ? (
                            <>
                              <pre className="font-mono text-xs text-gray-300 whitespace-pre-wrap leading-relaxed select-text min-h-[100px] max-h-[200px] overflow-y-auto">{selectedLead.outreach_messages.find(m => m.channel === outreachTab)?.message_text}</pre>
                              <div className="flex items-center justify-end gap-3 pt-3 border-t border-os-border">
                                <button onClick={() => handleMarkContacted(selectedLead.id, outreachTab)} disabled={contactingChannel !== null || (selectedLead.contacted_channels || []).includes(outreachTab)} className="px-3 py-1.5 rounded-lg border border-os-border hover:border-white/20 text-xs font-semibold flex items-center gap-1.5 text-gray-400 disabled:opacity-50 transition-all">
                                  {(selectedLead.contacted_channels || []).includes(outreachTab) ? <><Check className="w-3.5 h-3.5 text-neon-green" /><span>Marked</span></> : <><CheckCircle2 className="w-3.5 h-3.5" /><span>Mark Contacted</span></>}
                                </button>
                                {outreachTab === "whatsapp" && (
                                  <a href={`https://wa.me/?text=${encodeURIComponent(selectedLead.outreach_messages.find(m => m.channel === outreachTab)?.message_text || "")}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-[#25D366] text-white font-semibold text-xs flex items-center gap-1.5 hover:bg-[#20bd5a] transition-colors"><MessageCircle className="w-3.5 h-3.5" />Open WhatsApp</a>
                                )}
                                <button onClick={() => handleCopyOutreach(selectedLead.outreach_messages.find(m => m.channel === outreachTab)?.message_text || "", outreachTab)} className="px-3 py-1.5 rounded-lg bg-neon-green text-black font-bold text-xs flex items-center gap-1.5 shadow-[0_0_10px_rgba(184,245,90,0.15)] hover:brightness-110 transition-all">
                                  {copiedChannel === outreachTab ? <><Check className="w-3.5 h-3.5" /><span>Copied!</span></> : <><Clipboard className="w-3.5 h-3.5" /><span>Copy</span></>}
                                </button>
                              </div>
                            </>
                          ) : (
                            <p className="text-xs text-gray-500 italic p-4 font-mono text-center">No template generated for this channel.</p>
                          )}
                        </div>
                      </div>
                    )}
                    {selectedLead.priority_tier === "COLD" && (
                      <div className="bg-black/20 border border-os-border p-5 rounded-xl flex flex-col items-center text-center">
                        <AlertTriangle className="w-6 h-6 text-gray-500 mb-2" />
                        <p className="text-xs text-gray-500 font-mono">Cold leads are not auto-generated outreach.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="glass-panel rounded-2xl p-12 flex flex-col items-center justify-center text-center h-full">
                    <Eye className="w-8 h-8 text-gray-600 mb-3" />
                    <p className="text-sm text-gray-500 font-mono">Select a lead from the list to view its profile.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <aside className="w-[340px] flex flex-col p-4 gap-4 z-10 shrink-0 overflow-y-auto">
          <div className="glass-panel rounded-2xl p-5 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="w-5 h-5 text-neon-green" />
              <h2 className="text-xs font-bold tracking-widest text-white uppercase">System Overview</h2>
            </div>
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1">
                <div className="flex justify-between items-end mb-1">
                  <span className="text-[10px] text-gray-500 font-bold uppercase">Memory Usage</span>
                  <span className="text-[10px] text-neon-green font-bold">72%</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-neon-green glow-green" style={{ width: "72%" }} />
                </div>
              </div>
              <div className="w-20 h-20 relative flex items-center justify-center">
                <div className="absolute inset-0 bg-neon-green/10 rounded-full blur-xl" />
                <Cpu className="w-12 h-12 text-neon-green relative z-10" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-[11px]"><span className="text-gray-500">Context Size</span><span className="text-white font-mono">12,400 tokens</span></div>
              <div className="flex justify-between items-center text-[11px]"><span className="text-gray-500">Reasoning Depth</span><span className="text-white font-mono">17 layers</span></div>
              <div className="pt-3 border-t border-os-border flex justify-between items-center text-[11px]">
                <span className="text-gray-500">Active Agent</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-neon-green" />
                  <span className="text-white font-bold">{agents.find(a => a.status === "running")?.name || "None"}</span>
                </div>
              </div>
              <div className="flex justify-between items-center text-[11px]"><span className="text-gray-500">Confidence Score</span><span className="text-neon-green font-bold">96%</span></div>
              <div className="flex justify-between items-center text-[11px]"><span className="text-gray-500">API Calls</span><span className="text-white font-mono">39</span></div>
              <div className="flex justify-between items-center text-[11px]"><span className="text-gray-500">Avg Latency</span><span className="text-white font-mono">1.4 sec</span></div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-gray-500">GPU Status</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-neon-green" />
                  <span className="text-white font-mono">NVIDIA RTX 6000</span>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-5 flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-neon-green" />
                <h2 className="text-xs font-bold tracking-widest text-white uppercase">Execution Timeline</h2>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${running ? "bg-neon-green animate-pulse" : "bg-gray-600"}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wider ${running ? "text-neon-green" : "text-gray-500"}`}>{running ? "Live" : "Idle"}</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 terminal-scroll">
              {logs.length === 0 ? (
                <p className="text-xs text-gray-600 italic text-center py-8 font-mono">No events yet. Start a pipeline.</p>
              ) : (
                logs.slice(-20).map((log, idx) => {
                  const time = new Date().toLocaleTimeString();
                  return (
                    <div key={idx} className="flex items-start gap-2 group">
                      <span className="text-[10px] font-mono text-gray-700 shrink-0 mt-0.5">{time}</span>
                      <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${log.includes("[System Error]") ? "bg-red-500" : log.includes("[System]") ? "bg-neon-green" : "bg-neon-blue"}`} />
                      <span className={`text-[11px] leading-relaxed ${log.includes("[System Error]") ? "text-red-400" : "text-gray-300"}`}>{log}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>
      </main>

      {/* Bottom Terminal */}
      <footer className="h-[200px] shrink-0 border-t border-os-border bg-os-dark-gray/50 backdrop-blur-md p-4 flex flex-col gap-3 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(rgba(184, 245, 90, 0.1) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <TermIcon className="w-4 h-4 text-neon-green" />
            <h2 className="text-xs font-bold tracking-widest text-white uppercase">Pipeline Reasoner Stream</h2>
          </div>
          <button onClick={() => setLogs([])} className="px-4 py-1 bg-white/5 hover:bg-white/10 border border-os-border rounded-lg text-[10px] font-bold text-gray-400 transition-all">Clear</button>
        </div>
        <div className="flex-1 font-mono text-[11px] leading-relaxed overflow-y-auto terminal-scroll relative z-10 space-y-1">
          {logs.length === 0 ? (
            <div className="flex gap-4"><span className="text-gray-700">Console idle. Trigger a lead audit to start logging events...</span></div>
          ) : (
            logs.map((log, idx) => {
              const time = new Date().toLocaleTimeString();
              const color = logColor(log);
              return (
                <div key={idx} className="flex gap-4">
                  <span className="text-gray-700 shrink-0">{time}</span>
                  <span className={color}>&gt; {log}</span>
                </div>
              );
            })
          )}
          <div ref={terminalEndRef} />
        </div>
      </footer>
    </div>
  );
}
