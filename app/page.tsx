"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { Connection, ServiceId } from "@/lib/connections";
import TerminalBoot from "./terminal-boot";
import TitleField from "./title-field";
import "./terminal.css";

type Service = { id: ServiceId; name: string; code: string; category: string; description: string; icon: string; group: "infrastructure" | "automation" | "applications"; route: string; href?: string };
const directory: Service[] = [
  { id: "argo", name: "Argo CD", code: "01", category: "DEPLOYMENT", description: "GitOps deployments, application sync and infrastructure state.", icon: "deploy", group: "infrastructure", route: "argocd" },
  { id: "headlamp", name: "Headlamp", code: "02", category: "OBSERVABILITY", description: "Kubernetes workloads, pod logs and cluster resources.", icon: "cluster", group: "infrastructure", route: "headlamp" },
  { id: "scout", name: "Price Scout", code: "03", category: "AUTOMATION", description: "Hardware watchlists, price tracking and availability alerts.", icon: "radar", group: "automation", route: "price-scout", href: "/price-scout" },
  { id: "launchpad", name: "Launchpad", code: "04", category: "CAREER", description: "Job discovery, tailored resumes and application tracking.", icon: "career", group: "applications", route: "launchpad" },
  { id: "amip", name: "AMIP", code: "05", category: "FINANCIAL RESEARCH", description: "SEC filings, company watchlists and evidence-backed financial comparisons.", icon: "research", group: "applications", route: "amip" },
  { id: "aris", name: "ARIS", code: "06", category: "ENERGY INTELLIGENCE", description: "ERCOT notices, regulatory developments and interconnection digests.", icon: "energy", group: "applications", route: "aris" },
  { id: "nutrisage", name: "NutriSage", code: "07", category: "NUTRITION", description: "Food journaling, macro tracking and a grounded local AI assistant.", icon: "nutrition", group: "applications", route: "nutrisage" },
];
const statusLabels: Record<Connection["status"], string> = {
  checking: "CHECKING", reachable: "REACHABLE", online: "ONLINE", unavailable: "UNREACHABLE", unconfigured: "PENDING", invalid: "CONFIG ERROR", "tls-error": "TLS ERROR",
};
function Icon({ name, size = 20 }: {
    name: string;
    size?: number;
}) {
    const paths: Record<string, React.ReactNode> = {
        grid: <><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/></>,
        deploy: <><path d="M12 3v12m-4-4 4 4 4-4M5 14v6h14v-6"/><path d="m5 7 7-4 7 4"/></>,
        cluster: <><path d="m12 2 9 5v10l-9 5-9-5V7Zm0 10 9-5M12 12 3 7m9 5v10"/><path d="m7.5 4.5 9 5v5"/></>,
        radar: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 7-7M12 2v2M2 12h2M12 20v2M20 12h2"/></>,
        career: <><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h5m8 0h5m-9 5v-6m-3 3 3-3 3 3"/></>,
        research: <><path d="M4 3v17h17M8 15v-3m5 3V9m5 6V6M7 8l5-3 4 1 4-4"/></>,
        energy: <><path d="M14 2H5v20h14V7Zm0 0v5h5"/><path d="m12 9-4 6h4l-1 5 5-7h-4l1-4"/></>,
        nutrition: <><path d="M3 13h18a9 9 0 0 1-18 0ZM8 22h8M12 11V8"/><path d="M12 8c0-4 3-6 7-6 0 4-2 7-7 6ZM12 9C8 9 5 7 5 3c4 0 7 2 7 6Z"/></>,
        arrow: <><path d="M5 12h14m-5-5 5 5-5 5"/></>,
        external: <><path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/></>,
        terminal: <><path d="m4 6 5 6-5 6m9 0h7"/></>,
        settings: <><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/></>,
        search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></>,
        replay: <><path d="M3 10a9 9 0 1 1 2 8M3 3v7h7"/></>,
        shield: <><path d="m12 2 8 3v7c0 5-8 10-8 10S4 17 4 12V5Z"/><path d="m8 11 3 3 5-5"/></>,
        close: <path d="m5 5 14 14M5 19 19 5"/>,
        github: <><path d="M9 21v-4c-4 1-4-2-6-2m12 6v-4c0-1-.4-2-1-2 4-.5 6-2 6-6 0-1-.5-3-2-4 0-1 0-2-.5-3-2 0-3 1-4 1h-3C9 2 8 2 6 2c-.5 1-.5 2-.5 3C4 6 4 8 4 9c0 4 2 5.5 6 6-.6 0-1 1-1 2"/></>,
    };
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.grid}</svg>;
}

function Clock() {
  const [time, setTime] = useState("--:--:--");
  useEffect(() => {
    const tick = () => setTime(new Date().toISOString().slice(11, 19));
    tick(); const interval = window.setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);
  return <time>{time}<span className="dim"> UTC</span></time>;
}

function trackCard(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const card = event.currentTarget;
  const bounds = card.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width;
  const y = (event.clientY - bounds.top) / bounds.height;
  card.style.setProperty("--spot-x", `${x * 100}%`);
  card.style.setProperty("--spot-y", `${y * 100}%`);
  card.style.setProperty("--tilt-x", `${(.5 - y) * 5}deg`);
  card.style.setProperty("--tilt-y", `${(x - .5) * 5}deg`);
}

export default function Gatekeeper() {
  const [intro, setIntro] = useState(true);
  const [motion, setMotion] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [settings, setSettings] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [lastCheck, setLastCheck] = useState("--:--:--");
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const main = useRef<HTMLDivElement>(null);
  const hasFinished = useRef(false);
  const finishIntro = useCallback(() => {
    hasFinished.current = true;
    setIntro(false);
    try { sessionStorage.setItem("foehammer-terminal-intro-v5-seen", "1"); } catch { /* Session storage is optional. */ }
  }, []);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const setup = window.setTimeout(() => {
      try { if (sessionStorage.getItem("foehammer-terminal-intro-v5-seen")) setIntro(false); } catch { /* Optional session preference. */ }
      if (preference.matches) { setMotion(false); setIntro(false); }
    }, 0);
    const onPreference = () => { if (preference.matches) { setMotion(false); finishIntro(); } };
    const shortcuts = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k" && !document.querySelector("dialog[open]")) { event.preventDefault(); search.current?.focus(); }
    };
    preference.addEventListener("change", onPreference);
    window.addEventListener("keydown", shortcuts);
    return () => { clearTimeout(setup); window.removeEventListener("keydown", shortcuts); preference.removeEventListener("change", onPreference); };
  }, [finishIntro]);

  useEffect(() => { if (!intro && hasFinished.current) main.current?.focus({ preventScroll: true }); }, [intro]);
  useEffect(() => { if (settings) dialog.current?.showModal(); else dialog.current?.close(); }, [settings]);
  useEffect(() => {
    let active = true;
    let current: AbortController | undefined;
    async function check() {
      current?.abort(); current = new AbortController();
      const timeout = window.setTimeout(() => current?.abort(), 7000);
      try {
        const response = await fetch("/api/connections", { cache: "no-store", signal: current.signal });
        const result = await response.json();
        if (!response.ok || !Array.isArray(result.connections)) throw new Error("Connection check failed");
        if (active) { setConnections(result.connections); setLastCheck(new Date().toISOString().slice(11, 19)); }
      } catch {
        if (active) setConnections(previous => directory.map(service => ({ id: service.id, href: previous.find(item => item.id === service.id)?.href ?? service.href, status: "unavailable", detail: "Connection check is unavailable. Try again shortly." })));
      } finally { window.clearTimeout(timeout); }
    }
    void check();
    const timer = window.setInterval(check, 30000);
    return () => { active = false; current?.abort(); window.clearInterval(timer); };
  }, []);

  const services = directory.map(service => {
    const connection = connections.find(item => item.id === service.id);
    return { ...service, href: connection?.href ?? service.href, status: connection?.status ?? "checking" as Connection["status"], detail: connection?.detail ?? "Checking service connection…" };
  });
  const configured = services.filter(service => service.status !== "unconfigured");
  const pending = services.length - configured.length;
  const responding = services.filter(service => ["online", "reachable"].includes(service.status)).length;
  const checking = services.some(service => service.status === "checking");
  const visible = services.filter(service => (filter === "all" || service.group === filter) && `${service.name} ${service.category} ${service.description}`.toLowerCase().includes(query.toLowerCase()));

  return <main className="terminal-portal">
    {intro && <TerminalBoot onFinish={finishIntro}/>}
    <div ref={main} tabIndex={-1} inert={intro} className={`terminal-shell ${intro ? "shell-standby" : "shell-entered"} ${motion ? "" : "motion-paused"}`}>
      <a className="skip-link" href="#services">Skip to services</a>
      <header className="site-bar">
        <a className="site-brand" href="#top" aria-label="Gatekeeper home"><span className="monogram">F/</span><span>gatekeeper<span className="dim">_</span></span></a>
        <nav aria-label="Primary navigation"><a href="#services">Services <span className="nav-number">{String(directory.length).padStart(2, "0")}</span></a><button onClick={() => setSettings(true)}>Connections<Icon name="external" size={11}/></button><a href="https://github.com/krishnaasura/gatekeeper-portal" target="_blank" rel="noreferrer">Source<Icon name="github" size={14}/></a></nav>
        <span className="bar-time"><Clock/></span>
      </header>
      <div className="page-content" id="top">
        <TitleField paused={!motion || intro}/>
        <section className="directory-section" id="services" aria-labelledby="directory-title">
          <div className="directory-heading"><div className="section-title"><span className="section-index">01 /</span><h2 id="directory-title">Service directory</h2><span className="count-label">[ {String(services.length).padStart(2, "0")} ]</span></div><label className="service-search"><Icon name="search" size={15}/><input ref={search} value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a service" aria-label="Find a service"/><kbd>⌘ K</kbd></label></div>
          <div className="directory-toolbar"><div className="filter-options" aria-label="Filter services">{[["all", "All"], ["infrastructure", "Infrastructure"], ["automation", "Automation"], ["applications", "Applications"]].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}{filter === value && <span>_</span>}</button>)}</div><span className="directory-total">{String(visible.length).padStart(2, "0")} ENTRIES <span className="dim">/ HTTP ROUTES</span></span></div>
          <div className="terminal-service-grid">{visible.map((service, index) => <article key={service.id} onPointerMove={motion ? trackCard : undefined} onPointerLeave={event => { event.currentTarget.style.setProperty("--tilt-x", "0deg"); event.currentTarget.style.setProperty("--tilt-y", "0deg"); }} style={{ "--card-index": index } as CSSProperties} className={`terminal-card card-${service.id}`}>
            <div className="card-header"><span className="card-number">[ {service.code} ]</span><span className={`service-state ${["online", "reachable"].includes(service.status) ? "state-up" : ""}`} title={service.detail}><span className={["online", "reachable"].includes(service.status) ? "status-dot" : "status-ring"}/>{statusLabels[service.status]}</span></div>
            <div className="card-main"><div className="terminal-service-icon"><span className="icon-orbit"/><Icon name={service.icon} size={25}/></div><span className="service-category">{service.category}</span><h3>{service.name}</h3><p>{service.description}</p></div>
            <div className="card-route"><span><span className="dim">route</span> /{service.route}</span>{service.href ? <a href={service.href} target={service.id === "scout" ? undefined : "_blank"} rel={service.id === "scout" ? undefined : "noreferrer"} aria-label={`Launch ${service.name}`}>Launch <Icon name="external" size={12}/></a> : <button disabled aria-label={`${service.name} launch unavailable: endpoint not configured`}>Launch <Icon name="external" size={12}/></button>}</div>
            <span className="card-corner" aria-hidden="true">+</span>
          </article>)}</div>
          {visible.length === 0 && <div className="empty-result"><span className="dim">grep: no matches</span><p>No services match this search.</p><button className="bracket-button" onClick={() => { setFilter("all"); setQuery(""); }}>Clear filters <span>↗</span></button></div>}
        </section>
        <section className="status-console" aria-label="Connection summary"><div className="console-title"><Icon name="terminal" size={14}/><span>connection.log</span><span className="console-meta">READ ONLY</span></div><div className="console-content"><span className="console-timestamp">[{lastCheck}]</span><span className="console-key">{checking ? "WAIT" : "INFO"}</span><p role="status">{checking ? "Checking service endpoints…" : `${responding} of ${configured.length} configured services responding.${pending ? ` ${pending} pending.` : ""}`}<span className="console-detail"> Probes refresh every 30s.</span></p><button onClick={() => setSettings(true)}>View details <span>↗</span></button></div></section>
        <footer className="site-footer"><span>FOEHAMMER <span>/</span> GATEKEEPER</span><div><button onClick={() => setIntro(true)}><Icon name="replay" size={12}/>Replay boot</button><button aria-pressed={motion} onClick={() => setMotion(!motion)}><span className={motion ? "status-dot" : "status-ring"}/>Motion {motion ? "on" : "off"}</button></div></footer>
      </div>
    </div>
    <dialog ref={dialog} className="connections-dialog" aria-labelledby="connections-title" onCancel={() => setSettings(false)} onClose={() => setSettings(false)}><div className="dialog-bar"><span>connections / status</span><button aria-label="Close connections" onClick={() => setSettings(false)}><Icon name="close" size={18}/></button></div><div className="dialog-content"><h2 id="connections-title">Your connections<span>_</span></h2><p>Argo CD and Headlamp open in a new tab with their own sign-in. These checks verify reachability; cluster health is separate.</p><div className="connections-list">{services.map(service => <div key={service.id}><span><b>{service.name}</b><small>{service.detail}</small></span><span className={`service-state ${["online", "reachable"].includes(service.status) ? "state-up" : ""}`}>{statusLabels[service.status]}</span></div>)}</div><button className="bracket-button" onClick={() => setSettings(false)}>Close <span>↗</span></button></div></dialog>
  </main>;
}
