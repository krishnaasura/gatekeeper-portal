"use client";

import { useEffect, useRef, useState } from "react";
import { LAUGH_BEATS, scheduleSkullAudio } from "./skull-audio";

const STATIC_END = 700;
const LOG_END = 3400;
const SKULL_START = 3750;
const DURATION = 6950;
const tasks = [
  "mounting gatekeeper shell", "reading display configuration", "allocating glyph buffer",
  "mapping character atlas", "compiling terminal surface", "initializing pointer field",
  "resolving route manifest", "binding keyboard shortcuts", "preparing service directory",
  "registering viewport observer", "sampling font geometry", "composing interface layers",
  "loading local preferences", "calibrating pixel grid", "building interaction lattice",
  "restoring console state", "attaching event listeners", "drawing phosphor surface",
];
const transcript = Array.from({ length: 110 }, (_, index) => {
  const hex = ((index * 2654435761) >>> 0).toString(16).padStart(8, "0");
  return { stamp: (index * .02719).toFixed(5).padStart(8, "0"), hex, task: tasks[index % tasks.length], dump: index % 6 === 3 };
});

// A tiny, original pixel sprite. The eye sockets and teeth are cut out, not raster images.
const headPixels: React.ReactNode[] = [];
const jawPixels: React.ReactNode[] = [];
for (let y = 0; y <= 30; y++) {
  const halfWidth = y < 5 ? [5, 8, 10, 12, 13][y] : y < 17 ? 14 : y < 25 ? 13 : y < 29 ? 11 : 9;
  for (let x = 16 - halfWidth; x < 16 + halfWidth; x++) {
    const mirror = Math.min(x, 31 - x);
    const eye = mirror >= 5 && mirror <= 13 && y >= 16 + (mirror - 5) * .43 && y <= 23 - (13 - mirror) * .08;
    const nose = y >= 25 && y <= 28 && Math.abs(x - 15.5) <= (y - 24) * .55;
    const tooth = y >= 29 && [10, 14, 17, 21].includes(x);
    if (eye || nose || tooth) continue;
    headPixels.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={(x + y * 3) % 11 === 0 ? "#aee0ba" : "currentColor"}/>);
  }
}
for (let y = 32; y <= 37; y++) {
  const halfWidth = [11, 11, 10, 9, 7, 4][y - 32];
  for (let x = 16 - halfWidth; x < 16 + halfWidth; x++) {
    if (y < 34 && [10, 14, 17, 21].includes(x)) continue;
    jawPixels.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1"/>);
  }
}
function PixelSkull({ jaw }: { jaw: number }) {
  return <svg viewBox="0 0 32 43" className="pixel-skull" shapeRendering="crispEdges" aria-hidden="true"><g>{headPixels}</g><g fill="currentColor" transform={`translate(0 ${jaw.toFixed(2)})`}>{jawPixels}</g></svg>;
}

/** Corruption -> slower terminal stream -> three synchronized jaw/voice beats -> shell. */
export default function TerminalBoot({ onFinish }: { onFinish: () => void }) {
  const [start] = useState(() => performance.now());
  const [elapsed, setElapsed] = useState(0);
  const [sound, setSound] = useState(false);
  const [audioFailed, setAudioFailed] = useState(false);
  const skip = useRef<HTMLButtonElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const audio = useRef<AudioContext | null>(null);
  const stopSound = useRef<(() => void) | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    skip.current?.focus();
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      alive.current = false;
      document.documentElement.style.overflow = previous;
      stopSound.current?.();
      void audio.current?.close().catch(() => {});
      audio.current = null;
    };
  }, []);
  useEffect(() => {
    skip.current?.focus();
    const timer = window.setInterval(() => {
      const delta = performance.now() - start;
      setElapsed(delta);
      if (delta >= DURATION) onFinish();
    }, 45);
    // A boot sequence should not continue laughing after the visitor leaves the tab.
    const hidden = () => { if (document.hidden) onFinish(); };
    document.addEventListener("visibilitychange", hidden);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", hidden); };
  }, [start, onFinish]);

  useEffect(() => {
    let disposed = false;
    let scheduled = false;
    let context: AudioContext;
    try {
      context = new AudioContext({ sampleRate: 32000 });
      audio.current = context;
    } catch { return; }
    const play = () => {
      if (disposed || scheduled || context.state !== "running") return;
      scheduled = true;
      stopSound.current = scheduleSkullAudio(context, Math.max(0, (SKULL_START - (performance.now() - start)) / 1000));
      setSound(true);
    };
    const unlock = () => {
      if (disposed || context.state === "closed") return;
      void context.resume().then(play).catch(() => { if (!disposed) setAudioFailed(true); });
    };
    context.addEventListener("statechange", play);
    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);
    // Autoplay begins immediately; an interaction unlocks audio if the browser suspends it.
    const kickoff = requestAnimationFrame(unlock);
    return () => {
      disposed = true;
      cancelAnimationFrame(kickoff);
      context.removeEventListener("statechange", play);
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, [start]);
  function mute() {
    stopSound.current?.(); stopSound.current = null;
    void audio.current?.close().catch(() => {}); audio.current = null;
    setSound(false);
  }

  const count = Math.min(transcript.length, Math.max(1, Math.floor((elapsed - STATIC_END) / (LOG_END - STATIC_END) * transcript.length)));
  const phase = elapsed < STATIC_END ? "static" : elapsed < LOG_END ? "logs" : elapsed < SKULL_START ? "corrupt" : elapsed < DURATION - 420 ? "skull" : "exit";
  const skullTime = (elapsed - SKULL_START) / 1000;
  let jaw = 0;
  for (const beat of LAUGH_BEATS) {
    const age = skullTime - beat;
    if (age >= 0 && age < .65) jaw = Math.pow(Math.sin(age / .65 * Math.PI), .7) * 3.1;
  }
  const progress = Math.min(100, Math.floor(elapsed / DURATION * 100));

  return <div ref={container} className={`terminal-boot sequence-${phase}`} data-boot-stage={phase} role="dialog" aria-modal="true" aria-label="Gatekeeper terminal startup" onKeyDown={event => {
    if (event.key === "Escape") { event.stopPropagation(); onFinish(); }
    if (event.key !== "Tab") return;
    const buttons = container.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
    if (!buttons?.length) return;
    if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus(); }
    else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus(); }
  }}>
    <header className="boot-bar"><span><b>F/</b> gatekeeper<span className="dim"> / boot</span></span><span className="dim">{sound ? "AUDIO ACTIVE" : audioFailed ? "AUDIO UNAVAILABLE" : "AUDIO STANDBY"}</span></header>
    <>
      <div className="boot-interference" aria-hidden="true"><span/><span/><span/></div>
      <div className="boot-stream" aria-hidden="true"><div className="boot-log">{transcript.slice(Math.max(0, count - 36), count).map(line => <div key={line.hex} className={line.dump ? "log-dump" : ""}><span className="log-stamp">[{line.stamp}]</span><span className="log-ok">{line.dump ? "  ::  " : "  OK  "}</span><span>{line.dump ? `0x${line.hex}  ${line.hex.slice(2)} 00 ff ${line.hex.slice(0, 4)}  .......#..` : line.task}<span className="log-address"> {line.hex}</span></span></div>)}</div><aside className="boot-diagnostics"><span>MEMORY MAP</span><pre>{Array.from({ length: 15 }, (_, i) => `${(count * 16 + i * 64).toString(16).padStart(6, "0")}  ${transcript[(count + i) % transcript.length].hex}  ${transcript[(count + i + 8) % transcript.length].hex}`).join("\n")}</pre><div className="boot-blocks">{Array.from({ length: 80 }, (_, i) => <i key={i} className={(i + count) % 7 < 3 ? "lit" : ""}/>)}</div><span>BUFFER / {String(count * 24).padStart(5, "0")}</span></aside></div>
      {(phase === "skull" || phase === "exit") && <div className="skull-stage" aria-hidden="true"><div className="skull-frame"><PixelSkull jaw={jaw}/><div className="skull-scan"/></div><span className="skull-address">0x464F4548 / GATEKEEPER</span><div className="laugh-beats">{LAUGH_BEATS.map((beat, i) => <i key={i} className={skullTime >= beat && skullTime < beat + .65 ? "active" : ""}/>)}</div></div>}
    </>
    <footer className="boot-bottom-bar"><div><span className="status-dot"/><span>{phase === "static" ? "signal interference" : phase === "logs" ? "loading interface" : phase === "corrupt" ? "signal acquired" : "opening gatekeeper"}</span>{<><span className="boot-load"><i style={{ transform: `scaleX(${progress / 100})` }}/></span><span className="dim">{String(progress).padStart(3, "0")}%</span></>}</div><div className="boot-controls">{sound && <button className="boot-mute" onClick={mute}>Mute</button>}<button ref={skip} onClick={onFinish}>Skip boot <kbd>ESC</kbd></button></div></footer>
  </div>;
}
