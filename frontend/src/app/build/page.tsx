"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileText, Code, Database, GitBranch, Rocket, Bell,
  Check, ExternalLink, ArrowLeft
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://agentic-growth-os-backend.onrender.com";

interface AgentState {
  name: string;
  status: "idle" | "running" | "done" | "failed";
  progress: string;
  message: string;
}

interface BuildResult {
  preview_url?: string;
  github_repo_url?: string;
}

const BUILD_AGENTS = [
  { name: "PRD Generation", icon: <FileText className="w-5 h-5" />, num: 1 },
  { name: "Frontend Generation", icon: <Code className="w-5 h-5" />, num: 2 },
  { name: "Backend Schema", icon: <Database className="w-5 h-5" />, num: 3 },
  { name: "Build", icon: <GitBranch className="w-5 h-5" />, num: 4 },
  { name: "Deploy", icon: <Rocket className="w-5 h-5" />, num: 5 },
  { name: "Notify", icon: <Bell className="w-5 h-5" />, num: 6 },
];

const AGENT_ORDER = BUILD_AGENTS.map(a => a.name);

const BUILD_LABEL: Record<string, string> = {
  "PRD Generation": "PRD Generator",
  "Frontend Generation": "Frontend Builder",
  "Backend Schema": "Backend Builder",
  "Build": "Build Agent",
  "Deploy": "Deployment Agent",
  "Notify": "Notification Agent",
};

function BuildNode({ name, icon, num, status }: { name: string; icon: React.ReactNode; num: number; status: AgentState["status"] }) {
  const wrap =
    status === "running" ? "border-[1.5px] border-berry bg-berry-soft"
    : status === "failed" ? "border-red-400 bg-red-50"
    : "border-line bg-panel";
  const badge =
    status === "running" ? "bg-berry border-berry text-white"
    : status === "done" ? "bg-moss border-moss text-white"
    : status === "failed" ? "bg-red-500 border-red-500 text-white"
    : "border-wait text-muted";
  const labelCls =
    status === "running" ? "text-berry font-medium"
    : status === "done" ? "text-moss"
    : status === "failed" ? "text-red-600"
    : "text-muted";
  const titleCls = status === "idle" ? "text-muted" : "text-ink";
  const text = status === "running" ? "Processing…" : status === "done" ? "Done" : status === "failed" ? "Failed" : "Waiting";

  return (
    <div className={`flex items-center gap-2.5 h-node px-3 border rounded-xl ${wrap}`}>
      <span className={`flex-none w-6 h-6 rounded-full grid place-items-center text-xs font-semibold border ${badge}`}>
        {status === "done" ? <Check className="w-3 h-3" /> : num}
      </span>
      <span className={`flex-none ${titleCls}`}>{icon}</span>
      <span className="min-w-0 leading-tight">
        <strong className={`block text-[13px] font-semibold truncate ${titleCls}`}>{BUILD_LABEL[name] || name}</strong>
        <small className={`text-xs flex items-center gap-1.5 ${labelCls}`}>
          {status === "running" && <i className="w-1.5 h-1.5 rounded-full bg-berry node-live-dot" />}
          {text}
        </small>
      </span>
    </div>
  );
}

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
  const [result, setResult] = useState<BuildResult | null>(null);
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
    } catch (err) {
      setLogs(prev => [...prev, `[System Error] ${err instanceof Error ? err.message : String(err)}`]);
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
        const lead = data.leads?.find((l: { id: string }) => l.id === leadId);
        if (lead) setResult(lead);
      }
    } catch (e) { console.error(e); }
  };

  const getAgent = (name: string) => agents.find(a => a.name === name);

  const groupDone = (names: string[]) => names.every(n => getAgent(n)?.status === "done");

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

  const renderNodes = (names: string[]) => (
    <>
      {names.map(name => {
        const c = BUILD_AGENTS.find(a => a.name === name)!;
        return <BuildNode key={name} name={name} icon={c.icon} num={c.num} status={getAgent(name)?.status || "idle"} />;
      })}
    </>
  );

  const groups: { names: string[]; nodes: React.ReactNode }[] = [
    { names: ["PRD Generation"], nodes: renderNodes(["PRD Generation"]) },
    { names: ["Frontend Generation", "Backend Schema"], nodes: renderNodes(["Frontend Generation", "Backend Schema"]) },
    { names: ["Build"], nodes: renderNodes(["Build"]) },
    { names: ["Deploy"], nodes: renderNodes(["Deploy"]) },
    { names: ["Notify"], nodes: renderNodes(["Notify"]) },
  ];

  return (
    <div className="h-screen flex flex-col bg-canvas text-ink font-sans overflow-hidden min-w-[900px] selection:bg-moss/20">
      {/* Header */}
      <header className="h-14 shrink-0 border-b border-line flex items-center gap-4 px-7 z-40 bg-canvas">
        <button onClick={() => router.push("/")} className="p-1.5 rounded-lg hover:bg-sunk transition-colors">
          <ArrowLeft className="w-4 h-4 text-muted" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-moss rounded-full grid place-items-center">
            <Rocket className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-display font-bold text-[17px] tracking-[-0.02em] leading-tight">Build pipeline</h1>
            <p className="text-[10px] text-muted uppercase tracking-widest">Website generation agents</p>
          </div>
        </div>
        <div className="ml-auto">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${buildDone ? "bg-moss/10 border-moss/30 text-moss" : started ? "bg-berry-soft border-berry/30 text-berry" : "bg-sunk border-line text-muted"}`}>
            <span className={`w-2 h-2 rounded-full ${buildDone ? "bg-moss" : started ? "bg-berry node-live-dot" : "bg-wait"}`} />
            <span className="text-[10px] font-bold">{buildDone ? "Complete" : started ? "Running" : "Idle"}</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 min-h-0 flex overflow-hidden">
        {/* Center pipeline */}
        <section className="flex-1 min-h-0 p-7 flex flex-col">
          <div className="bg-panel border border-line rounded-[18px] px-6 pt-4 pb-3 flex flex-col min-h-0 flex-1">
            <div className="flex justify-between items-center shrink-0">
              <h2 className="font-display font-bold text-[15px] tracking-[-0.01em]">Pipeline</h2>
              <div className="flex gap-4 text-[12.5px] text-muted">
                <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-moss" /> Done</span>
                <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-berry" /> Running</span>
                <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-wait" /> Waiting</span>
              </div>
            </div>
            <div className="flex-1 min-h-0 flex flex-col justify-center items-center gap-2 py-4 overflow-y-auto">
              {groups.map((g, gi) => (
                <React.Fragment key={gi}>
                  {gi > 0 && (
                    <div className={`w-px h-[clamp(8px,1.6vh,14px)] ${groupDone(groups[gi - 1].names) ? "bg-moss" : "bg-line"}`} />
                  )}
                  <div className="grid grid-flow-col auto-cols-[minmax(0,214px)] gap-3 justify-center">
                    {g.nodes}
                  </div>
                </React.Fragment>
              ))}
            </div>

            {buildDone && result && (
              <div className="bg-panel border border-line rounded-2xl p-4 space-y-3 mt-3 shrink-0">
                <h3 className="font-display font-bold text-[15px] flex items-center gap-2"><Check className="w-4 h-4 text-moss" />Build complete</h3>
                {result.preview_url && (
                  <div className="flex items-center justify-between bg-sunk/50 p-3 rounded-lg border border-line">
                    <span className="text-xs text-muted font-mono">Preview</span>
                    <a href={result.preview_url} target="_blank" rel="noreferrer" className="text-xs text-moss hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3" />Open</a>
                  </div>
                )}
                {result.github_repo_url && (
                  <div className="flex items-center justify-between bg-sunk/50 p-3 rounded-lg border border-line">
                    <span className="text-xs text-muted font-mono">GitHub</span>
                    <a href={result.github_repo_url} target="_blank" rel="noreferrer" className="text-xs text-moss hover:underline flex items-center gap-1"><GitBranch className="w-3 h-3" />Repo</a>
                  </div>
                )}
                <button onClick={() => router.push("/")} className="w-full py-2.5 border border-line hover:bg-sunk rounded-xl text-xs font-semibold text-muted transition-colors">
                  Back to dashboard
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Right: logs */}
        <aside className="w-[380px] shrink-0 p-7 pl-0 flex flex-col min-h-0">
          <div className="bg-panel border border-line rounded-[18px] p-5 flex-1 flex flex-col min-h-0">
            <h2 className="font-display font-bold text-[15px] tracking-[-0.01em] mb-4">Build log</h2>
            <div className="flex-1 overflow-y-auto font-mono text-[12.5px] leading-[1.8]">
              {logs.length === 0 ? (
                <p className="text-muted italic text-center py-8">Waiting for build to start…</p>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="flex gap-[14px]">
                    <time className="text-muted flex-none">{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
                    <span>{renderLog(log)}</span>
                  </div>
                ))
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
    <Suspense fallback={<div className="h-screen flex items-center justify-center bg-canvas text-muted font-mono text-sm">Loading build pipeline…</div>}>
      <BuildPageInner />
    </Suspense>
  );
}
