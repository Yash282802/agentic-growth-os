"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileText, Code, Database, GitBranch, Rocket, Bell,
  Check, RefreshCw, ExternalLink, Zap, ArrowLeft, X
} from "lucide-react";

const API_BASE = "https://agentic-growth-os-backend.onrender.com";

interface AgentState {
  name: string;
  status: "idle" | "running" | "done" | "failed";
  progress: string;
  message: string;
}

const BUILD_AGENTS = [
  { name: "PRD Generation", icon: <FileText className="w-6 h-6" />, color: "neon-blue", num: 1 },
  { name: "Frontend Generation", icon: <Code className="w-6 h-6" />, color: "neon-blue", num: 2 },
  { name: "Backend Schema", icon: <Database className="w-6 h-6" />, color: "neon-blue", num: 3 },
  { name: "Build", icon: <GitBranch className="w-6 h-6" />, color: "neon-blue", num: 4 },
  { name: "Deploy", icon: <Rocket className="w-6 h-6" />, color: "neon-blue", num: 5 },
  { name: "Notify", icon: <Bell className="w-6 h-6" />, color: "neon-purple", num: 6 },
];

const AGENT_ORDER = BUILD_AGENTS.map(a => a.name);

function BuildPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");
  const leadId = searchParams.get("lead");

  const [agents, setAgents] = useState<AgentState[]>(
    BUILD_AGENTS.map(a => ({ name: a.name, status: "idle", progress: "Waiting", message: "" }))
  );
  const [logs, setLogs] = useState<string[]>([]);
  const [started, setStarted] = useState(false);
  const [buildDone, setBuildDone] = useState(false);
  const [result, setResult] = useState<any>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    if (!sessionId || !leadId || started) return;
    setStarted(true);
    setLogs(["[System] Starting build pipeline..."]);
    startBuild();
  }, [sessionId, leadId]);

  const startBuild = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/build/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId }),
      });
      if (!res.ok) throw new Error("Failed to start build pipeline");
      connectSSE();
    } catch (err: any) {
      setLogs(prev => [...prev, `[System Error] ${err.message}`]);
    }
  };

  const connectSSE = () => {
    eventSourceRef.current?.close();
    const es = new EventSource(`${API_BASE}/api/stream/${sessionId}`);
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
      } else if (data.type === "build_complete") {
        setLogs(prev => [...prev, "[System] Build pipeline completed!"]);
        setBuildDone(true);
        es.close();
        fetchLeadDetails();
      } else if (data.type === "error") {
        setLogs(prev => [...prev, `[System Error] ${data.message}`]);
        es.close();
      }
    };
    es.onerror = () => setLogs(prev => [...prev, "[System] Reconnecting..."]);
  };

  const fetchLeadDetails = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/session/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        const lead = data.leads?.find((l: any) => l.id === leadId);
        if (lead) setResult(lead);
      }
    } catch (e) { console.error(e); }
  };

  const getAgent = (name: string) => agents.find(a => a.name === name);

  const agentLabel = (name: string) => {
    const a = getAgent(name);
    if (!a || a.status === "idle") return <span className="text-[9px] text-neon-orange">Waiting</span>;
    if (a.status === "running") return <span className="text-[9px] text-neon-green animate-pulse">Processing...</span>;
    if (a.status === "done") return <span className="text-[9px] text-neon-green">Completed</span>;
    return <span className="text-[9px] text-red-400">Failed</span>;
  };

  const agentOpacity = (name: string) => {
    const a = getAgent(name);
    if (!a || a.status === "idle") return "opacity-40";
    return "opacity-100";
  };

  const borderColor = (name: string) => {
    const a = getAgent(name);
    if (!a) return "border-neon-blue/20";
    if (a.status === "running") return "border-neon-blue glow-blue";
    if (a.status === "done") return "border-neon-green";
    return "border-neon-blue/20";
  };

  return (
    <div className="h-screen flex flex-col bg-os-black text-gray-300 font-sans overflow-hidden selection:bg-neon-blue/30 selection:text-black">
      <style>{`
        .glass-panel { backdrop-filter: blur(12px); background: rgba(15, 15, 15, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); }
        .glow-blue { box-shadow: 0 0 15px rgba(59, 130, 246, 0.3); }
        .terminal-scroll::-webkit-scrollbar { width: 4px; }
        .terminal-scroll::-webkit-scrollbar-track { background: transparent; }
        .terminal-scroll::-webkit-scrollbar-thumb { background: rgba(59, 130, 246, 0.2); border-radius: 2px; }
      `}</style>

      {/* Header */}
      <header className="h-16 border-b border-os-border flex items-center justify-between px-6 z-50 bg-os-black/80 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/")} className="p-2 hover:bg-white/5 rounded-lg transition-all">
            <ArrowLeft className="w-4 h-4 text-gray-400" />
          </button>
          <div className="w-8 h-8 bg-neon-blue rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.3)]">
            <Rocket className="w-5 h-5 text-black" />
          </div>
          <div>
            <h1 className="text-white font-bold tracking-tight text-lg leading-tight">Build Pipeline</h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">Website Generation Agents</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${buildDone ? "bg-neon-green/10 border-neon-green/20" : started ? "bg-neon-blue/10 border-neon-blue/20" : "bg-white/5 border-os-border"}`}>
            <span className={`w-2 h-2 rounded-full ${buildDone ? "bg-neon-green" : started ? "bg-neon-blue animate-pulse" : "bg-gray-600"}`} />
            <span className={`text-[10px] font-bold ${buildDone ? "text-neon-green" : started ? "text-neon-blue" : "text-gray-500"}`}>{buildDone ? "Complete" : started ? "Running" : "Idle"}</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left: Agent visualization */}
        <div className="flex-1 flex items-center justify-center p-6 relative">
          <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-neon-blue/5 blur-[120px] rounded-full pointer-events-none" />

          <div className="relative w-full max-w-lg flex flex-col items-center gap-6">
            {/* Row 1: PRD */}
            <div className={`flex flex-col items-center ${agentOpacity("PRD Generation")}`}>
              <div className={`w-20 h-20 rounded-full bg-black border-2 flex flex-col items-center justify-center relative transition-all ${borderColor("PRD Generation")}`}>
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-neon-blue rounded-full flex items-center justify-center text-[10px] text-white font-bold">1</span>
                <FileText className={`w-7 h-7 ${getAgent("PRD Generation")?.status !== "idle" ? "text-neon-blue" : "text-neon-blue/30"}`} />
              </div>
              <div className="mt-2 text-center">
                <p className="text-[10px] font-bold text-white uppercase tracking-wider">PRD Generator</p>
                {agentLabel("PRD Generation")}
              </div>
            </div>

            {/* Row 2: Frontend + Backend */}
            <div className="flex items-center gap-16">
              {["Frontend Generation", "Backend Schema"].map(name => (
                <div key={name} className={`flex flex-col items-center ${agentOpacity(name)}`}>
                  <div className={`w-18 h-18 rounded-full bg-black border-2 flex flex-col items-center justify-center relative transition-all ${borderColor(name)}`} style={{ width: 72, height: 72 }}>
                    <span className="absolute -top-2 -right-2 w-5 h-5 bg-neon-blue rounded-full flex items-center justify-center text-[10px] text-white font-bold">{BUILD_AGENTS.find(a => a.name === name)!.num}</span>
                    {name === "Frontend Generation" && <Code className={`w-6 h-6 ${getAgent(name)?.status !== "idle" ? "text-neon-blue" : "text-neon-blue/30"}`} />}
                    {name === "Backend Schema" && <Database className={`w-6 h-6 ${getAgent(name)?.status !== "idle" ? "text-neon-blue" : "text-neon-blue/30"}`} />}
                  </div>
                  <div className="mt-2 text-center">
                    <p className="text-[9px] font-bold text-white uppercase tracking-wider">{name === "Frontend Generation" ? "Frontend" : "Backend"}</p>
                    {agentLabel(name)}
                  </div>
                </div>
              ))}
            </div>

            {/* Row 3: Build */}
            <div className={`flex flex-col items-center ${agentOpacity("Build")}`}>
              <div className={`w-20 h-20 rounded-full bg-black border-2 flex flex-col items-center justify-center relative transition-all ${borderColor("Build")}`}>
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-neon-blue rounded-full flex items-center justify-center text-[10px] text-white font-bold">4</span>
                <GitBranch className={`w-7 h-7 ${getAgent("Build")?.status !== "idle" ? "text-neon-blue" : "text-neon-blue/30"}`} />
              </div>
              <div className="mt-2 text-center">
                <p className="text-[10px] font-bold text-white uppercase tracking-wider">Build Agent</p>
                {agentLabel("Build")}
              </div>
            </div>

            {/* Row 4: Deploy */}
            <div className={`flex flex-col items-center ${agentOpacity("Deploy")}`}>
              <div className={`w-20 h-20 rounded-full bg-black border-2 flex flex-col items-center justify-center relative transition-all ${borderColor("Deploy")}`}>
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-neon-blue rounded-full flex items-center justify-center text-[10px] text-white font-bold">5</span>
                <Rocket className={`w-7 h-7 ${getAgent("Deploy")?.status !== "idle" ? "text-neon-blue" : "text-neon-blue/30"}`} />
              </div>
              <div className="mt-2 text-center">
                <p className="text-[10px] font-bold text-white uppercase tracking-wider">Deploy Agent</p>
                {agentLabel("Deploy")}
              </div>
            </div>

            {/* Row 5: Notify */}
            <div className={`flex flex-col items-center ${agentOpacity("Notify")}`}>
              <div className={`w-20 h-20 rounded-full bg-black border-2 flex flex-col items-center justify-center relative transition-all ${borderColor("Notify")}`}>
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-neon-purple rounded-full flex items-center justify-center text-[10px] text-white font-bold">6</span>
                <Bell className={`w-7 h-7 ${getAgent("Notify")?.status !== "idle" ? "text-neon-purple" : "text-neon-purple/30"}`} />
              </div>
              <div className="mt-2 text-center">
                <p className="text-[10px] font-bold text-white uppercase tracking-wider">Notify Agent</p>
                {agentLabel("Notify")}
              </div>
            </div>

            {/* Build Results */}
            {buildDone && result && (
              <div className="glass-panel rounded-2xl p-5 w-full max-w-md space-y-3 mt-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2"><Check className="w-4 h-4 text-neon-green" />Build Complete</h3>
                {result.preview_url && (
                  <div className="flex items-center justify-between bg-black/40 p-3 rounded-lg border border-os-border">
                    <span className="text-xs text-gray-400 font-mono">Preview</span>
                    <a href={result.preview_url} target="_blank" rel="noreferrer" className="text-xs text-neon-green hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3" />Open</a>
                  </div>
                )}
                {result.github_repo_url && (
                  <div className="flex items-center justify-between bg-black/40 p-3 rounded-lg border border-os-border">
                    <span className="text-xs text-gray-400 font-mono">GitHub</span>
                    <a href={result.github_repo_url} target="_blank" rel="noreferrer" className="text-xs text-neon-green hover:underline flex items-center gap-1"><GitBranch className="w-3 h-3" />Repo</a>
                  </div>
                )}
                <button onClick={() => router.push("/")} className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-os-border rounded-xl text-xs font-bold text-gray-300 transition-all">
                  Back to Dashboard
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Logs */}
        <aside className="w-[380px] flex flex-col p-4 gap-4 z-10 shrink-0">
          <div className="glass-panel rounded-2xl p-5 flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-neon-blue" />
              <h2 className="text-xs font-bold tracking-widest text-white uppercase">Build Log</h2>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 terminal-scroll">
              {logs.length === 0 ? (
                <p className="text-xs text-gray-600 italic text-center py-8 font-mono">Waiting for build to start...</p>
              ) : (
                logs.map((log, idx) => {
                  const time = new Date().toLocaleTimeString();
                  return (
                    <div key={idx} className="flex items-start gap-2 group">
                      <span className="text-[10px] font-mono text-gray-700 shrink-0 mt-0.5">{time}</span>
                      <span className={`text-[11px] leading-relaxed ${log.includes("[System Error]") ? "text-red-400" : log.includes("[System]") ? "text-white font-semibold" : "text-gray-300"}`}>{log}</span>
                    </div>
                  );
                })
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

export default function BuildPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center bg-os-black text-gray-400 font-mono text-sm">Loading build pipeline...</div>}>
      <BuildPageInner />
    </Suspense>
  );
}
