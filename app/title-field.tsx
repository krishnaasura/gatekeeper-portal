"use client";

import { useEffect, useRef } from "react";

type Ripple = { x: number; y: number; born: number };
const ALPHABET = "01abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ#$%&*+<>/[]{}:;?";

/** Dense glyphs breathe in place; only nearby cursor currents displace their grid. The title is ordinary, static HTML. */
export default function TitleField({ paused }: { paused: boolean }) {
  const button = useRef<HTMLButtonElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const refreshRef = useRef<(() => void) | null>(null);
  const pulseRef = useRef<((x?: number, y?: number) => void) | null>(null);

  useEffect(() => { pausedRef.current = paused; refreshRef.current?.(); }, [paused]);

  useEffect(() => {
    const surface = button.current;
    const element = canvas.current;
    if (!surface || !element) return;
    const ctx = element.getContext("2d");
    const atlas = document.createElement("canvas");
    const glyphContext = atlas.getContext("2d");
    if (!ctx || !glyphContext) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 1, height = 1, ratio = 1, frame = 0, last = 0, time = 0;
    let pointerX = 0, pointerY = 0, hover = 0, targetHover = 0;
    let visible = true, disposed = false;
    let ripples: Ripple[] = [];
    const cellWidth = 4, cellHeight = 6, atlasWidth = 6, atlasHeight = 8;
    const hash = (x: number, y: number) => ((Math.imul(x + 79, 374761393) ^ Math.imul(y + 31, 668265263)) >>> 0);

    function makeAtlas() {
      atlas.width = ALPHABET.length * atlasWidth * ratio;
      atlas.height = atlasHeight * 3 * ratio;
      glyphContext!.setTransform(ratio, 0, 0, ratio, 0, 0);
      glyphContext!.font = "5px monospace";
      glyphContext!.textBaseline = "top";
      ["#d9d9d9", "#7cff9b", "#ffffff"].forEach((color, row) => {
        glyphContext!.fillStyle = color;
        for (let index = 0; index < ALPHABET.length; index++) glyphContext!.fillText(ALPHABET[index], index * atlasWidth, row * atlasHeight);
      });
    }

    function draw(now: number) {
      if (disposed) return;
      const moving = !pausedRef.current && !reduced.matches;
      ctx!.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx!.clearRect(0, 0, width, height);
      hover += ((moving ? targetHover : 0) - hover) * .14;
      const t = moving ? time : 0;
      const cursorRadius = Math.min(165, Math.max(110, width * .23));
      ripples = moving ? ripples.filter(ripple => now - ripple.born < 2800) : [];
      const cols = Math.ceil(width / cellWidth) + 8;
      const rows = Math.ceil(height / cellHeight) + 8;
      for (let row = -4; row < rows; row++) {
        for (let col = -4; col < cols; col++) {
          const seed = hash(col, row);
          const u = (col * cellWidth - width / 2) / (width * .52);
          const v = (row * cellHeight - height / 2) / (height * .65);
          const radius = Math.hypot(u * .82, v * .72);
          const depth = Math.sin(u * 3.1 + v * 2.5 + t * .22);
          const edge = Math.min(1, Math.max(0, (1.14 - Math.abs(u)) * 4), Math.max(0, (1.07 - Math.abs(v)) * 4));
          const silhouette = Math.max(0, 1 - Math.pow(Math.abs(u * .75 + Math.sin(v * 1.7 + t * .12) * .27), 3));
          const pulse = .84 + Math.sin(t * .8 - radius * 3) * .16;
          // Domain-warp the light mask, not the resting character grid. Intersecting
          // currents make shadow contours drift, stretch, split and merge.
          const flowX = u + Math.sin(v * 3.2 + t * .9) * .34 + Math.cos(u * 2.1 - t * .61) * .18;
          const flowY = v + Math.cos(u * 3.8 - t * .76) * .31 + Math.sin(v * 2.4 + t * .53) * .2;
          const field = (Math.sin(flowX * 4.3 + t * .82)
            + Math.sin(flowY * 4.7 - t * .73)
            + Math.cos(flowX * 3.1 + flowY * 3.6 + t * 1.05)) / 3;
          const contour = Math.min(1, Math.max(0, (field + .34) / .78));
          const opening = contour * contour * (3 - 2 * contour);
          const shadowVeil = .045 + opening * .955;
          const dx = col * cellWidth - pointerX, dy = row * cellHeight - pointerY;
          const cursorDistance = Math.hypot(dx, dy);
          const proximity = Math.max(0, 1 - cursorDistance / cursorRadius);
          const local = proximity * proximity * hover;
          const revealedShadow = shadowVeil + (1 - shadowVeil) * local * .85;
          const grain = .85 + (seed % 101) / 100 * .15;
          let opacity = (.2 + Math.max(0, depth) * .105) * revealedShadow * edge * silhouette * pulse * grain;
          // Crossed currents let nearby glyphs swim along soft, changing paths.
          // Their influence fades to zero outside the cursor's small neighborhood.
          const current = Math.sin((dx + dy) * .018 - t * 1.1) * 2;
          const swimX = (Math.cos(dy * .032 + t * 1.55) * 5 + current) * local;
          const swimY = (Math.sin(dx * .03 - t * 1.35) * 4 - current) * local;
          let x = col * cellWidth + swimX;
          let y = row * cellHeight + swimY;
          let wave = 0;
          for (const ripple of ripples) {
            const age = (now - ripple.born) / 1000;
            const distance = Math.hypot(x - ripple.x, y - ripple.y);
            const strength = Math.exp(-Math.pow((distance - age * 440) / (40 + age * 6), 2)) * Math.exp(-age * .55);
            wave = Math.max(wave, strength);
            const direction = Math.atan2(y - ripple.y, x - ripple.x);
            x += Math.cos(direction) * strength * 13;
            y += Math.sin(direction) * strength * 13;
          }
          const mutation = Math.floor(t * (.45 + seed % 5 * .12) + seed % 23);
          const index = (seed + mutation * 13) % ALPHABET.length;
          const tint = wave > .6 ? 2 : wave > .08 || seed % 29 === 0 ? 1 : 0;
          opacity = Math.min(.94, opacity + wave * .65);
          // Shadows hide idle glyphs, but never remove them from interaction.
          if (opacity < .025) continue;
          ctx!.globalAlpha = opacity;
          ctx!.drawImage(atlas, index * atlasWidth * ratio, tint * atlasHeight * ratio, atlasWidth * ratio, atlasHeight * ratio, x, y, atlasWidth, atlasHeight);
        }
      }
      ctx!.globalAlpha = 1;
    }

    function active() { return !disposed && !pausedRef.current && !reduced.matches && visible && !document.hidden; }
    function tick(now: number) {
      frame = 0;
      if (!active()) return;
      if (!last || now - last >= 32) { time += last ? Math.min((now - last) / 1000, .1) : 0; last = now; draw(now); }
      frame = requestAnimationFrame(tick);
    }
    function refresh() {
      cancelAnimationFrame(frame); last = 0;
      draw(performance.now());
      if (active()) frame = requestAnimationFrame(tick);
    }
    function resize() {
      const bounds = surface!.getBoundingClientRect();
      width = bounds.width; height = bounds.height;
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      element!.width = Math.round(width * ratio); element!.height = Math.round(height * ratio);
      makeAtlas(); refresh();
    }
    function pointer(event: PointerEvent) {
      if (!active() || event.pointerType === "touch") return;
      const bounds = surface!.getBoundingClientRect();
      pointerX = event.clientX - bounds.left;
      pointerY = event.clientY - bounds.top;
      targetHover = 1;
    }
    function leave() { targetHover = 0; }
    pulseRef.current = (clientX, clientY) => {
      if (!active()) return;
      const bounds = surface!.getBoundingClientRect();
      ripples = [...ripples.slice(-3), { x: clientX === undefined ? width / 2 : clientX - bounds.left, y: clientY === undefined ? height / 2 : clientY - bounds.top, born: performance.now() }];
    };
    refreshRef.current = refresh;
    const size = new ResizeObserver(resize); size.observe(surface);
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; refresh(); }); intersection.observe(surface);
    surface.addEventListener("pointermove", pointer, { passive: true }); surface.addEventListener("pointerleave", leave);
    document.addEventListener("visibilitychange", refresh); reduced.addEventListener("change", refresh);
    resize();
    return () => {
      disposed = true; cancelAnimationFrame(frame); size.disconnect(); intersection.disconnect();
      surface.removeEventListener("pointermove", pointer); surface.removeEventListener("pointerleave", leave);
      document.removeEventListener("visibilitychange", refresh); reduced.removeEventListener("change", refresh);
      pulseRef.current = null; refreshRef.current = null;
    };
  }, []);

  return <section className="title-field ascii-banner" aria-labelledby="foehammer-title">
    <button ref={button} className="field-surface" disabled={paused} aria-label="Send a color wave through the character background" aria-describedby="field-hint" onClick={event => pulseRef.current?.(...(event.detail === 0 ? [] : [event.clientX, event.clientY] as [number, number]))}><canvas ref={canvas} aria-hidden="true"/></button>
    <div className="field-meta"><span><span className="status-dot"/> GATEKEEPER / PORTAL</span><span>FH—004 <span className="dim">[ TERMINAL ]</span></span></div>
    <div className="static-title"><span aria-hidden="true" className="title-prefix">./</span><h1 id="foehammer-title">FOEHAMMER</h1><span className="title-caret" aria-hidden="true">_</span></div>
    <div className="field-baseline"><span><b>root</b><span className="dim">@foehammer:~$</span> <i className="text-cursor"/></span><span id="field-hint" className="field-hint">{paused ? "MOTION PAUSED" : <><span className="hint-desktop">INTERACTIVE ASCII <span>/</span> CLICK TO PULSE</span><span className="hint-touch">TAP TO PULSE</span><span>↗</span></>}</span></div>
    <span className="field-cross cross-tl" aria-hidden="true">+</span><span className="field-cross cross-br" aria-hidden="true">+</span>
  </section>;
}
