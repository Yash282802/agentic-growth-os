"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Search, Globe, TrendingUp, FileText, Database, 
  Terminal, Download, Clipboard, Check, RefreshCw, 
  ExternalLink, Phone, MapPin, Star, AlertTriangle, 
  Shield, CheckCircle2, History, ChevronRight, MessageCircle,
  Code, GitBranch, Rocket, Bell, ThumbsUp, Eye
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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Home() {
  const [niche, setNiche] = useState("Hair Salons");
  const [location, setLocation] = useState("Austin, Texas");
  const [maxLeads, setMaxLeads] = useState(10);
  
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"run" | "history">("run");
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  
  const [logs, setLogs] = useState<string[]>([]);
  const [agents, setAgents] = useState<AgentState[]>([
    { name: "Lead Discovery", status: "idle", progress: "Waiting", message: "Discovers businesses using Google Places" },
    { name: "Website Audit", status: "idle", progress: "Waiting", message: "Checks website accessibility and layout quality" },
    { name: "Opportunity Scoring", status: "idle", progress: "Waiting", message: "Applies multi-factor rubric out of 100 points" },
    { name: "Outreach Generation", status: "idle", progress: "Waiting", message: "Drafts personalized copy for 4 channels via LLaMA" },
    { name: "CRM Storage", status: "idle", progress: "Waiting", message: "Runs E5 embeddings for deduplication and saves in DB" },
    { name: "PRD Generation", status: "idle", progress: "Waiting", message: "Writes PRD for approved leads" },
    { name: "Frontend Generation", status: "idle", progress: "Waiting", message: "Generates Stitch UI prompt from PRD" },
    { name: "Backend Schema", status: "idle", progress: "Waiting", message: "Designs backend schema for lead's site" },
    { name: "Build", status: "idle", progress: "Waiting", message: "Scaffolds repo from Stitch export" },
    { name: "Deploy", status: "idle", progress: "Waiting", message: "Pushes to GitHub + Vercel preview" },
    { name: "Notify", status: "idle", progress: "Waiting", message: "Summarizes done and outstanding items" },
  ]);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [outreachTab, setOutreachTab] = useState<"whatsapp" | "email" | "linkedin" | "facebook">("whatsapp");
  const [copiedChannel, setCopiedChannel] = useState<string | null>(null);
  const [contactingChannel, setContactingChannel] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  
  const [history, setHistory] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    checkBackendHealth();
    fetchHistory();
  }, []);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const checkBackendHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/sessions`);
      if (res.ok) {
        setBackendStatus("online");
      } else {
        setBackendStatus("offline");
      }
    } catch {
      setBackendStatus("offline");
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/sessions`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (e) {
      console.error("Failed to fetch history", e);
    }
  };

  const loadSessionDetails = async (id: string) => {
    try {
      setSelectedSessionId(id);
      const res = await fetch(`${API_BASE}/api/session/${id}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
        if (data.leads && data.leads.length > 0) {
          setSelectedLead(data.leads[0]);
        } else {
          setSelectedLead(null);
        }
        
        setAgents(prev => prev.map(a => ({
          ...a,
          status: "done",
          progress: "Completed",
          message: "Loaded from history."
        })));
        
        setLogs([
          `[System] Loaded history for Session ${id}`,
          `[System] Found ${data.leads?.length || 0} leads (Hot: ${data.hot_leads_count || 0})`
        ]);
        
        setActiveTab("run");
      }
    } catch (e) {
      console.error("Failed to load session details", e);
    }
  };

  const startPipeline = async () => {
    if (running) return;
    
    setRunning(true);
    setLeads([]);
    setSelectedLead(null);
    setLogs(["[System] Initializing Agentic Growth OS workflow...", `[System] Target: ${niche} in ${location}`]);
    setAgents([
      { name: "Lead Discovery", status: "idle", progress: "Waiting", message: "Discovers businesses using Google Places" },
      { name: "Website Audit", status: "idle", progress: "Waiting", message: "Checks website accessibility and layout quality" },
      { name: "Opportunity Scoring", status: "idle", progress: "Waiting", message: "Applies multi-factor rubric out of 100 points" },
      { name: "Outreach Generation", status: "idle", progress: "Waiting", message: "Drafts personalized copy for 4 channels via LLaMA" },
      { name: "CRM Storage", status: "idle", progress: "Waiting", message: "Runs E5 embeddings for deduplication and saves in DB" },
      { name: "PRD Generation", status: "idle", progress: "Waiting", message: "Writes PRD for approved leads" },
      { name: "Frontend Generation", status: "idle", progress: "Waiting", message: "Generates Stitch UI prompt from PRD" },
      { name: "Backend Schema", status: "idle", progress: "Waiting", message: "Designs backend schema for lead's site" },
      { name: "Build", status: "idle", progress: "Waiting", message: "Scaffolds repo from Stitch export" },
      { name: "Deploy", status: "idle", progress: "Waiting", message: "Pushes to GitHub + Vercel preview" },
      { name: "Notify", status: "idle", progress: "Waiting", message: "Summarizes done and outstanding items" },
    ]);

    try {
      const response = await fetch(`${API_BASE}/api/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, location, max_leads: maxLeads })
      });

      if (!response.ok) {
        throw new Error("Failed to start pipeline backend server error");
      }

      const data = await response.json();
      const sId = data.session_id;
      setSessionId(sId);
      connectSSE(sId);

    } catch (err: any) {
      setLogs(prev => [...prev, `[System Error] ${err.message || "Could not start workflow."}`]);
      setRunning(false);
      setAgents(prev => prev.map(a => ({ ...a, status: "failed", progress: "Error" })));
    }
  };

  const connectSSE = (sId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`${API_BASE}/api/stream/${sId}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "log") {
        setLogs(prev => [...prev, data.message]);
      } 
      
      else if (data.type === "status") {
        setAgents(prev => prev.map(agent => {
          if (agent.name === data.agent) {
            return {
              ...agent,
              status: data.status,
              progress: data.status === "running" ? "Processing" : data.status === "done" ? "Completed" : "Failed",
              message: data.message
            };
          }
          const agentOrder = [
            "Lead Discovery", "Website Audit", "Opportunity Scoring", "Outreach Generation", "CRM Storage",
            "PRD Generation", "Frontend Generation", "Backend Schema", "Build", "Deploy", "Notify"
          ];
          const thisIdx = agentOrder.indexOf(data.agent);
          const currentAgentIdx = agentOrder.indexOf(agent.name);
          if (currentAgentIdx < thisIdx && agent.status !== "done") {
            return { ...agent, status: "done", progress: "Completed" };
          }
          return agent;
        }));
      } 
      
      else if (data.type === "complete") {
        setLogs(prev => [...prev, "[System] Pipeline completed successfully! Fetching lead CRM profiles..."]);
        fetchSessionDetails(sId);
        es.close();
        setRunning(false);
        fetchHistory();
      } 
      
      else if (data.type === "build_complete") {
        setLogs(prev => [...prev, "[System] Build pipeline completed! Refreshing lead details..."]);
        fetchSessionDetails(sId);
      }
      
      else if (data.type === "error") {
        setLogs(prev => [...prev, `[System Error] Pipeline stopped: ${data.message}`]);
        es.close();
        setRunning(false);
      }
    };

    es.onerror = () => {
      setLogs(prev => [...prev, "[System Warning] Lost connection to EventSource stream. Attempting reconnect..."]);
    };
  };

  const fetchSessionDetails = async (sId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/session/${sId}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
        if (data.leads && data.leads.length > 0) {
          setSelectedLead(data.leads[0]);
        }
      }
    } catch (e) {
      setLogs(prev => [...prev, `[System Error] Failed to fetch CRM records: ${e}`]);
    }
  };

  const handleApprove = async (leadId: string) => {
    setApprovingId(leadId);
    try {
      const res = await fetch(`${API_BASE}/api/leads/${leadId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (res.ok) {
        setLogs(prev => [...prev, `[System] Build pipeline started for lead ${leadId.slice(0, 8)}...`]);
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, human_approved: true } : l));
        setSelectedLead(prev => prev?.id === leadId ? { ...prev, human_approved: true } : prev);
        if (sessionId) connectSSE(sessionId);
      }
    } catch (e) {
      setLogs(prev => [...prev, `[System Error] Failed to approve lead: ${e}`]);
    } finally {
      setApprovingId(null);
    }
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
      const res = await fetch(`${API_BASE}/api/leads/${leadId}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel })
      });
      if (res.ok) {
        const updatedLeads = leads.map(l => {
          if (l.id === leadId) {
            const currentContacted = l.contacted_channels || [];
            return { ...l, contacted_channels: [...currentContacted, channel] };
          }
          return l;
        });
        setLeads(updatedLeads);
        setSelectedLead(updatedLeads.find(l => l.id === leadId) || null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setContactingChannel(null);
    }
  };

  const getAgentIcon = (name: string) => {
    switch (name) {
      case "Lead Discovery": return <Search className="w-5 h-5" />;
      case "Website Audit": return <Globe className="w-5 h-5" />;
      case "Opportunity Scoring": return <TrendingUp className="w-5 h-5" />;
      case "Outreach Generation": return <FileText className="w-5 h-5" />;
      case "CRM Storage": return <Database className="w-5 h-5" />;
      case "PRD Generation": return <FileText className="w-5 h-5" />;
      case "Frontend Generation": return <Code className="w-5 h-5" />;
      case "Backend Schema": return <Database className="w-5 h-5" />;
      case "Build": return <GitBranch className="w-5 h-5" />;
      case "Deploy": return <Rocket className="w-5 h-5" />;
      case "Notify": return <Bell className="w-5 h-5" />;
      default: return <Terminal className="w-5 h-5" />;
    }
  };

  const getAgentStatusColor = (status: string) => {
    switch (status) {
      case "running": return "border-[#76B900]/80 shadow-[0_0_15px_rgba(118,185,0,0.3)] bg-zinc-900/80";
      case "done": return "border-[#76B900]/40 bg-zinc-900/30 opacity-90";
      case "failed": return "border-red-500/50 bg-red-950/10";
      default: return "border-zinc-800/80 bg-zinc-950/50 opacity-60";
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-[#76B900]/30 selection:text-white pb-12">
      
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#76B900] flex items-center justify-center shadow-[0_0_20px_rgba(118,185,0,0.4)]">
              <Database className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-100 to-[#76B900] bg-clip-text text-transparent">
                Agentic Growth OS
              </h1>
              <p className="text-xs text-zinc-400 font-medium">B2B Lead Generation & Automated Outreach Pipeline</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs bg-zinc-900/80 px-3 py-1.5 rounded-full border border-zinc-800">
              <span className={`w-2.5 h-2.5 rounded-full ${backendStatus === "online" ? "bg-[#76B900] animate-pulse" : backendStatus === "offline" ? "bg-red-500" : "bg-yellow-500"}`}></span>
              <span className="capitalize font-mono text-zinc-300">Backend: {backendStatus}</span>
            </div>
            
            <div className="flex bg-zinc-900/60 p-0.5 rounded-lg border border-zinc-800 text-xs">
              <button 
                onClick={() => setActiveTab("run")}
                className={`px-3 py-1 rounded-md transition-all font-medium ${activeTab === "run" ? "bg-[#76B900] text-black" : "text-zinc-400 hover:text-zinc-200"}`}
              >
                Dashboard
              </button>
              <button 
                onClick={() => setActiveTab("history")}
                className={`px-3 py-1 rounded-md transition-all font-medium ${activeTab === "history" ? "bg-[#76B900] text-black" : "text-zinc-400 hover:text-zinc-200"}`}
              >
                <div className="flex items-center gap-1">
                  <History className="w-3 h-3" />
                  <span>History ({history.length})</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 mt-8">

        {activeTab === "history" && (
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 backdrop-blur">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-[#76B900]" />
              <span>Session Execution Logs</span>
            </h2>
            {history.length === 0 ? (
              <p className="text-sm text-zinc-400 py-8 text-center font-mono">No execution runs found. Start your first search on the Dashboard tab.</p>
            ) : (
              <div className="grid gap-3">
                {history.map((sess) => (
                  <div 
                    key={sess.id} 
                    onClick={() => loadSessionDetails(sess.id)}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between border border-zinc-800/80 hover:border-[#76B900]/40 p-4 rounded-lg bg-zinc-950/40 hover:bg-zinc-900/30 transition-all cursor-pointer group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[#76B900] font-semibold text-sm">{sess.niche}</span>
                        <span className="text-zinc-400 text-xs">in</span>
                        <span className="text-zinc-300 font-semibold text-sm">{sess.location}</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono mt-1">
                        ID: {sess.id} | {new Date(sess.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 sm:mt-0">
                      <div className="text-right">
                        <span className="text-xs bg-zinc-900 px-2.5 py-1 rounded-md border border-zinc-800 text-zinc-300">
                          {sess.total_leads} Leads found
                        </span>
                        <span className="text-xs bg-red-950/20 px-2.5 py-1 rounded-md border border-red-900/40 text-red-400 ml-2 font-mono">
                          {sess.hot_leads_count} HOT
                        </span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-[#76B900] transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "run" && (
          <div className="space-y-8">
            
            <div className="bg-zinc-900/30 border border-zinc-900 rounded-2xl p-6 shadow-xl backdrop-blur relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-[#76B900]/5 rounded-full blur-[100px] pointer-events-none"></div>
              
              <div className="flex flex-col lg:flex-row items-end gap-4">
                <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-400 tracking-wider uppercase">Business Niche</label>
                    <input 
                      type="text" 
                      value={niche}
                      disabled={running}
                      onChange={(e) => setNiche(e.target.value)}
                      placeholder="e.g. Restaurants, Hair Salons, Clinics"
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-[#76B900]/80 rounded-xl px-4 py-3 text-sm focus:outline-none transition-all disabled:opacity-60 text-zinc-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-400 tracking-wider uppercase">Target Location</label>
                    <input 
                      type="text" 
                      value={location}
                      disabled={running}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Austin, Texas"
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-[#76B900]/80 rounded-xl px-4 py-3 text-sm focus:outline-none transition-all disabled:opacity-60 text-zinc-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-400 tracking-wider uppercase">Max Leads</label>
                    <div className="flex gap-1.5 bg-zinc-950 border border-zinc-800 rounded-xl p-1">
                      {[10, 20, 30, 50].map((n) => (
                        <button
                          key={n}
                          onClick={() => setMaxLeads(n)}
                          disabled={running}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            maxLeads === n
                              ? "bg-[#76B900] text-black shadow-[0_0_10px_rgba(118,185,0,0.3)]"
                              : "text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                      <button
                        onClick={() => setMaxLeads(999)}
                        disabled={running}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          maxLeads === 999
                            ? "bg-[#76B900] text-black shadow-[0_0_10px_rgba(118,185,0,0.3)]"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        All
                      </button>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={startPipeline}
                  disabled={running || backendStatus !== "online"}
                  className="w-full lg:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-[#76B900] to-[#598c00] hover:from-[#85cf00] hover:to-[#65a000] text-black font-semibold shadow-[0_0_25px_rgba(118,185,0,0.3)] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {running ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Pipeline Active...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      <span>Discover & Audit Leads</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-zinc-400 tracking-wider uppercase px-1">Visual Agent Execution DAG</h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11 gap-3">
                {agents.map((agent, index) => {
                  const isBuildAgent = index >= 5;
                  return (
                    <div 
                      key={agent.name}
                      className={`border rounded-xl p-3 transition-all relative ${getAgentStatusColor(agent.status)} ${isBuildAgent && agent.status === "idle" ? "border-dashed border-zinc-800/50" : ""}`}
                    >
                      <div className="absolute top-3 right-3">
                        {agent.status === "running" && (
                          <div className="flex items-center gap-1 text-[10px] text-[#76B900] bg-[#76B900]/10 px-2 py-0.5 rounded border border-[#76B900]/30 font-mono">
                            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                            <span>ACTIVE</span>
                          </div>
                        )}
                        {agent.status === "done" && (
                          <div className="text-[#76B900]">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        )}
                        {agent.status === "failed" && (
                          <div className="text-red-500">
                            <AlertTriangle className="w-4 h-4 animate-bounce" />
                          </div>
                        )}
                        {agent.status === "idle" && (
                          <span className="text-[9px] font-mono text-zinc-500 border border-zinc-800 bg-zinc-900/30 px-1.5 py-0.5 rounded">
                            {isBuildAgent ? "AWAIT" : "PENDING"}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center border text-[11px] ${
                          agent.status === "running" ? "bg-[#76B900]/10 text-[#76B900] border-[#76B900]/30" : 
                          agent.status === "done" ? "bg-[#76B900]/5 text-[#76B900] border-[#76B900]/20" : 
                          "bg-zinc-900 text-zinc-400 border-zinc-800"
                        }`}>
                          {getAgentIcon(agent.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[9px] text-zinc-500 font-mono">{isBuildAgent ? "Build" : "Agent"} {isBuildAgent ? index - 4 : index + 1}</div>
                          <h3 className="text-[11px] font-bold text-zinc-200 truncate">{agent.name}</h3>
                        </div>
                      </div>

                      <p className="text-[10px] text-zinc-400 leading-normal mb-2 min-h-[28px] line-clamp-2">{agent.message}</p>
                      
                      <div className="border-t border-zinc-900 pt-2 flex items-center justify-between text-[9px] font-mono text-zinc-500">
                        <span>Status:</span>
                        <span className={agent.status === "running" ? "text-[#76B900]" : agent.status === "done" ? "text-zinc-400" : ""}>
                          {agent.progress}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-64">
              <div className="bg-zinc-900/60 border-b border-zinc-900 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                  <Terminal className="w-4 h-4 text-[#76B900]" />
                  <span>NVIDIA AgentIQ Pipeline Reasoning Stream</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setLogs([])}
                    className="text-[10px] font-mono bg-zinc-950 border border-zinc-800 hover:border-zinc-700 px-2 py-1 rounded text-zinc-400 hover:text-zinc-200"
                  >
                    Clear Console
                  </button>
                </div>
              </div>
              
              <div className="p-4 font-mono text-xs overflow-y-auto flex-1 space-y-1.5 scrollbar-thin bg-black/60">
                {logs.length === 0 ? (
                  <div className="text-zinc-600 italic">Console idle. Trigger a lead audit search to start logging events...</div>
                ) : (
                  logs.map((log, idx) => {
                    let color = "text-zinc-400";
                    if (log.includes("[Lead Discovery]")) color = "text-[#76B900]/90";
                    else if (log.includes("[Website Audit]")) color = "text-cyan-400/90";
                    else if (log.includes("[Opportunity Scoring]")) color = "text-amber-400/90";
                    else if (log.includes("[Outreach Generation]")) color = "text-fuchsia-400/90";
                    else if (log.includes("[CRM Storage]")) color = "text-sky-400/90";
                    else if (log.includes("[PRD Generation]")) color = "text-emerald-400/90";
                    else if (log.includes("[Frontend Generation]")) color = "text-violet-400/90";
                    else if (log.includes("[Backend Schema]")) color = "text-orange-400/90";
                    else if (log.includes("[Build]")) color = "text-yellow-400/90";
                    else if (log.includes("[Deploy]")) color = "text-pink-400/90";
                    else if (log.includes("[Notify]")) color = "text-teal-400/90";
                    else if (log.includes("[System]")) color = "text-white font-semibold";
                    else if (log.includes("[System Error]")) color = "text-red-500 font-bold";

                    return (
                      <div key={idx} className={`${color} leading-relaxed`}>
                        {log}
                      </div>
                    );
                  })
                )}
                <div ref={terminalEndRef}></div>
              </div>
            </div>

            {leads.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 border-t border-zinc-900 pt-8">
                
                <div className="lg:col-span-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-zinc-400 tracking-wider uppercase">Discovered CRM Leads ({leads.length})</h2>
                    {sessionId && (
                      <a 
                        href={`${API_BASE}/api/export/${sessionId}`}
                        className="text-xs text-black bg-[#76B900] hover:bg-[#85cf00] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-[0_0_15px_rgba(118,185,0,0.2)]"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export CSV</span>
                      </a>
                    )}
                  </div>
                  
                  <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                    {leads.map((lead) => {
                      const isSelected = selectedLead?.id === lead.id;
                      
                      let badgeColor = "bg-zinc-900 border-zinc-800 text-zinc-400";
                      if (lead.priority_tier === "HOT") badgeColor = "bg-red-950/20 border-red-900/40 text-red-400";
                      else if (lead.priority_tier === "WARM") badgeColor = "bg-amber-950/20 border-amber-900/40 text-amber-400";
                      else if (lead.priority_tier === "COLD") badgeColor = "bg-blue-950/20 border-blue-900/40 text-blue-400";

                      return (
                        <div
                          key={lead.id}
                          onClick={() => setSelectedLead(lead)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                            isSelected ? "bg-zinc-900 border-[#76B900]/50 shadow-[0_0_10px_rgba(118,185,0,0.1)]" : "bg-zinc-900/40 border-zinc-900 hover:bg-zinc-900/20"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-xs font-bold text-zinc-200 line-clamp-1">{lead.business_name}</h3>
                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${badgeColor}`}>
                              {lead.priority_tier}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2 mt-2 text-[10px] text-zinc-400 font-mono">
                            <span className="flex items-center gap-0.5 text-amber-400">
                              <Star className="w-3 h-3 fill-current" />
                              {lead.rating || "N/A"}
                            </span>
                            <span>•</span>
                            <span className={lead.has_website ? "text-[#76B900]" : "text-zinc-500"}>
                              {lead.has_website ? "Has Web" : "No Web"}
                            </span>
                            <span>•</span>
                            <span className="font-semibold text-zinc-300">Score: {lead.opportunity_score}</span>
                          </div>
                          
                          {lead.human_approved && (
                            <div className="mt-1.5 text-[9px] font-mono text-[#76B900] border border-[#76B900]/30 bg-[#76B900]/5 rounded px-1.5 py-0.5 inline-flex items-center gap-1">
                              <ThumbsUp className="w-3 h-3" />
                              <span>Approved for Build</span>
                            </div>
                          )}
                          
                          {lead.is_duplicate && (
                            <div className="mt-1.5 text-[9px] font-mono text-zinc-500 border border-zinc-800/80 bg-zinc-950/40 rounded px-1.5 py-0.5 inline-block">
                              Duplicate Lead (Skipped Storage)
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="lg:col-span-8 space-y-6">
                  {selectedLead ? (
                    <div className="bg-zinc-900/30 border border-zinc-900 rounded-2xl p-6 space-y-6">
                      
                      <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-zinc-900 pb-5">
                        <div className="space-y-1">
                          <div className="text-xs text-[#76B900] font-mono uppercase tracking-wider">{selectedLead.category || "Lead Profile"}</div>
                          <h2 className="text-lg font-bold text-zinc-100">{selectedLead.business_name}</h2>
                          
                          <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-zinc-400 pt-1.5">
                            {selectedLead.address && (
                              <span className="flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                                {selectedLead.address}
                              </span>
                            )}
                            {selectedLead.phone && (
                              <span className="flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-zinc-500" />
                                {selectedLead.phone}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 bg-zinc-950/60 border border-zinc-800 p-3 rounded-xl min-w-[150px] justify-center">
                          <div className="text-center">
                            <div className="text-2xl font-bold font-mono text-[#76B900]">
                              {selectedLead.opportunity_score}
                            </div>
                            <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">Opportunity Score</div>
                          </div>
                          <div className="border-l border-zinc-800 pl-3.5">
                            <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded border inline-block ${
                              selectedLead.priority_tier === "HOT" ? "bg-red-950/20 border-red-900/40 text-red-400" :
                              selectedLead.priority_tier === "WARM" ? "bg-amber-950/20 border-amber-900/40 text-amber-400" :
                              "bg-zinc-900 border-zinc-800 text-zinc-400"
                            }`}>
                              {selectedLead.priority_tier}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Human Approval Section */}
                      {(selectedLead.priority_tier === "HOT" || selectedLead.priority_tier === "WARM") && !selectedLead.human_approved && (
                        <div className="bg-zinc-950/60 border border-[#76B900]/30 p-5 rounded-xl space-y-3">
                          <div className="flex items-center gap-2">
                            <ThumbsUp className="w-5 h-5 text-[#76B900]" />
                            <h3 className="text-sm font-bold text-zinc-200">Human Gate: Approve for Build Pipeline</h3>
                          </div>
                          <p className="text-xs text-zinc-400 leading-relaxed">
                            Review this lead's profile above. If you want to build a website for this business, click below to trigger the Scalix-style build pipeline (PRD → Stitch → Schema → Build → Deploy → Notify).
                          </p>
                          <button
                            onClick={() => handleApprove(selectedLead.id)}
                            disabled={approvingId !== null}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#76B900] to-[#598c00] hover:from-[#85cf00] hover:to-[#65a000] text-black font-bold text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(118,185,0,0.2)] disabled:opacity-50"
                          >
                            {approvingId === selectedLead.id ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Starting Build...</span>
                              </>
                            ) : (
                              <>
                                <ThumbsUp className="w-4 h-4" />
                                <span>Approve & Build Website</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {/* Build Results Section */}
                      {selectedLead.human_approved && (
                        <div className="bg-zinc-950/60 border border-[#76B900]/20 p-5 rounded-xl space-y-4">
                          <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                            <Rocket className="w-4 h-4 text-[#76B900]" />
                            <span>Build Pipeline Results</span>
                          </h3>
                          
                          {selectedLead.preview_url && (
                            <div className="flex items-center justify-between bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/50">
                              <span className="text-xs text-zinc-400 font-mono">Preview URL</span>
                              <a href={selectedLead.preview_url} target="_blank" rel="noreferrer" className="text-xs text-[#76B900] hover:underline flex items-center gap-1">
                                <ExternalLink className="w-3 h-3" />
                                {selectedLead.preview_url}
                              </a>
                            </div>
                          )}
                          
                          {selectedLead.github_repo_url && (
                            <div className="flex items-center justify-between bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/50">
                              <span className="text-xs text-zinc-400 font-mono">GitHub Repo</span>
                              <a href={selectedLead.github_repo_url} target="_blank" rel="noreferrer" className="text-xs text-[#76B900] hover:underline flex items-center gap-1">
                                <GitBranch className="w-3 h-3" />
                                {selectedLead.github_repo_url}
                              </a>
                            </div>
                          )}
                          
                          {selectedLead.prd_markdown && (
                            <div className="space-y-1.5">
                              <span className="text-xs text-zinc-400 font-mono block">PRD Document</span>
                              <pre className="text-[10px] text-zinc-300 bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/50 whitespace-pre-wrap max-h-40 overflow-y-auto font-mono leading-relaxed">
                                {selectedLead.prd_markdown}
                              </pre>
                            </div>
                          )}
                          
                          {selectedLead.repo_structure && (
                            <div className="space-y-1.5">
                              <span className="text-xs text-zinc-400 font-mono block">Repo Structure</span>
                              <pre className="text-[10px] text-zinc-300 bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/50 whitespace-pre-wrap max-h-32 overflow-y-auto font-mono leading-relaxed">
                                {selectedLead.repo_structure}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="space-y-2.5 bg-zinc-950/60 border border-zinc-900 p-4 rounded-xl">
                        <h3 className="text-xs font-bold text-zinc-300 flex items-center gap-2">
                          <Globe className="w-4 h-4 text-[#76B900]" />
                          <span>Website Audit Results</span>
                        </h3>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs font-mono py-2 border-b border-zinc-900">
                          <div>
                            <span className="text-zinc-500 block">Website Quality:</span>
                            <span className={`capitalize font-semibold ${selectedLead.has_website ? "text-amber-400" : "text-red-400"}`}>
                              {selectedLead.website_quality.replace("_", " ")}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block">SSL secured:</span>
                            <span className={`flex items-center gap-1 font-semibold ${selectedLead.is_ssl ? "text-[#76B900]" : "text-red-400"}`}>
                              <Shield className="w-3.5 h-3.5" />
                              {selectedLead.is_ssl ? "HTTPS Active" : "HTTP Insecure / None"}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block">Lead Source:</span>
                            {selectedLead.google_maps_url ? (
                              <a 
                                href={selectedLead.google_maps_url} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-[#76B900] hover:underline flex items-center gap-1.5"
                              >
                                <span>Google Maps</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-zinc-400">Google Places API</span>
                            )}
                          </div>
                        </div>

                        <div className="pt-2 text-xs">
                          <span className="text-zinc-500 font-mono block mb-1">Audit Report Notes:</span>
                          <p className="text-zinc-300 leading-relaxed bg-zinc-900/30 p-2.5 rounded border border-zinc-900 font-mono">
                            {selectedLead.audit_notes}
                          </p>
                        </div>
                      </div>

                      {(selectedLead.priority_tier === "HOT" || selectedLead.priority_tier === "WARM") ? (
                        <div className="space-y-4">
                          <h3 className="text-xs font-bold text-zinc-300 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#76B900]" />
                            <span>Outreach Campaign Messaging Templates</span>
                          </h3>

                          <div className="flex border-b border-zinc-900 text-xs">
                            {(["whatsapp", "email", "linkedin", "facebook"] as const).map((ch) => {
                              const isContacted = (selectedLead.contacted_channels || []).includes(ch);
                              return (
                                <button
                                  key={ch}
                                  onClick={() => setOutreachTab(ch)}
                                  className={`px-4 py-2.5 font-mono capitalize border-b-2 transition-all ${
                                    outreachTab === ch ? "border-[#76B900] text-[#76B900] font-bold" : "border-transparent text-zinc-400 hover:text-zinc-200"
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span>{ch}</span>
                                    {isContacted && <Check className="w-3.5 h-3.5 text-[#76B900]" />}
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl space-y-4 relative">
                            {selectedLead.outreach_messages.find(m => m.channel === outreachTab) ? (
                              <>
                                <pre className="font-mono text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed select-text min-h-[120px] max-h-[250px] overflow-y-auto pr-1">
                                  {selectedLead.outreach_messages.find(m => m.channel === outreachTab)?.message_text}
                                </pre>
                                
                                <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-900">
                                  <button
                                    onClick={() => handleMarkContacted(selectedLead.id, outreachTab)}
                                    disabled={contactingChannel !== null || (selectedLead.contacted_channels || []).includes(outreachTab)}
                                    className="px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 text-xs font-semibold flex items-center gap-1.5 text-zinc-300 disabled:opacity-50"
                                  >
                                    {(selectedLead.contacted_channels || []).includes(outreachTab) ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-[#76B900]" />
                                        <span>Marked Contacted</span>
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle2 className="w-3.5 h-3.5 text-zinc-500" />
                                        <span>Mark Contacted</span>
                                      </>
                                    )}
                                  </button>
                                  
                                  {outreachTab === "whatsapp" && (
                                    <a
                                      href={`https://wa.me/?text=${encodeURIComponent(selectedLead.outreach_messages.find(m => m.channel === outreachTab)?.message_text || "")}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3.5 py-1.5 rounded-lg bg-[#25D366] text-white font-semibold text-xs flex items-center gap-1.5 hover:bg-[#20bd5a] transition-colors"
                                    >
                                      <MessageCircle className="w-3.5 h-3.5" />
                                      <span>Open in WhatsApp</span>
                                    </a>
                                  )}
                                  <button
                                    onClick={() => handleCopyOutreach(
                                      selectedLead.outreach_messages.find(m => m.channel === outreachTab)?.message_text || "",
                                      outreachTab
                                    )}
                                    className="px-3.5 py-1.5 rounded-lg bg-[#76B900] text-black font-semibold text-xs flex items-center gap-1.5 shadow-[0_0_10px_rgba(118,185,0,0.15)]"
                                  >
                                    {copiedChannel === outreachTab ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-black" />
                                        <span>Copied!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Clipboard className="w-3.5 h-3.5" />
                                        <span>Copy Message</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </>
                            ) : (
                              <p className="text-xs text-zinc-500 italic p-4 font-mono text-center">No template copy was generated for this channel.</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-zinc-950/30 border border-zinc-900 p-6 rounded-xl flex flex-col items-center justify-center text-center">
                          <AlertTriangle className="w-6 h-6 text-zinc-600 mb-2" />
                          <h4 className="text-xs font-bold text-zinc-400">Outreach skipped for cold/skip tiers</h4>
                          <p className="text-[10px] text-zinc-500 font-mono mt-1">
                            This lead scored {selectedLead.opportunity_score} pts. Copy campaigns are only compiled for HOT and WARM targets.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full border border-zinc-900 border-dashed rounded-2xl flex flex-col items-center justify-center text-center p-8 bg-zinc-900/10">
                      <Search className="w-8 h-8 text-zinc-800 mb-2" />
                      <h3 className="text-xs font-bold text-zinc-400">Select a lead to examine profile</h3>
                      <p className="text-[10px] text-zinc-500 font-mono mt-1">Lead lists will display above once the 5-agent pipeline finishes executing.</p>
                    </div>
                  )}
                </div>

              </div>
            )}

          </div>
        )}

      </div>
    </main>
  );
}
