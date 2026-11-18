// Poesía of the Gemlit Chimes — content script for aistudio.google.com
(() => {
  if (window.__gemlitChimes) return;
  window.__gemlitChimes = true;

  const Chime = globalThis.GemlitChime;
  const root = document.documentElement;
  let S = { ...Chime.DEFAULTS };
  root.classList.add("gemlit-on"); // paint immediately; corrected once settings load

  // ---------------------------------------------------------------- settings
  chrome.storage.sync.get(Chime.DEFAULTS, (v) => { S = { ...Chime.DEFAULTS, ...v }; apply(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const k in changes) S[k] = changes[k].newValue;
    apply();
  });

  function apply() {
    root.classList.toggle("gemlit-on", !!S.enabled);
    root.classList.toggle("gemlit-still", !S.motion);
    root.style.setProperty("--g-glass", String(Math.max(0.2, Math.min(0.9, S.glass / 100))));
    if (S.enabled) whenBody(() => { Ambient.mount(); Ambient.setRunning(!!S.motion); clearShell(); welcome(); });
    else { Ambient.setRunning(false); resetTurns(); }
  }

  function whenBody(fn) {
    if (document.body) fn();
    else document.addEventListener("DOMContentLoaded", fn, { once: true });
  }

  // ---------------------------------------------------------------- ambient
  const Ambient = (() => {
    let host, canvas, ctx, blobEls = [], raf = 0, running = false;
    let W = innerWidth, H = innerHeight;
    const blobs = [];
    const ripples = [];
    let stars = [];
    const ringCols = ["255,170,205", "245,205,120", "150,200,245"];
    const colors = ["255,255,255", "255,200,225", "255,235,170", "190,225,255"];
    let t = 0, last = 0, ci = 0, px = -1, py = -1;

    function makeStars() {
      const count = Math.round(Math.min(300, Math.max(120, (W * H) / 6000)));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        r: Math.random() * 2.2 + 1, vy: -(Math.random() * 0.5 + 0.12),
        vx: (Math.random() - 0.5) * 0.3, t: Math.random() * Math.PI * 2,
        col: colors[Math.floor(Math.random() * colors.length)],
      }));
    }

    function resize() {
      W = innerWidth; H = innerHeight;
      if (canvas) { canvas.width = W; canvas.height = H; }
      makeStars();
    }

    function onMove(e) {
      if (!running) return;
      const now = performance.now();
      const moved = px < 0 || Math.hypot(e.clientX - px, e.clientY - py) > 40;
      if (now - last < 140 || !moved) return;
      last = now; px = e.clientX; py = e.clientY;
      ripples.push({ x: e.clientX, y: e.clientY, r: 4, life: 1, col: ringCols[ci++ % 3] });
      if (ripples.length > 18) ripples.shift();
      for (const b of blobs) {
        const dx = b.x - e.clientX, dy = b.y - e.clientY;
        const d = Math.hypot(dx, dy) || 1;
        const f = Math.max(0, 1 - d / (Math.max(W, H) * 0.6)) * 0.9;
        b.vx += (dx / d) * f; b.vy += (dy / d) * f;
      }
    }

    function placeBlobs() {
      blobs.forEach((b, i) => {
        const el = blobEls[i];
        if (el) el.style.transform = `translate(${b.x}px, ${b.y}px) translate(-50%, -50%)`;
      });
    }

    function frame() {
      t += 0.004;
      const minD = Math.min(W, H) * 0.75;
      for (let i = 0; i < blobs.length; i++) {
        const b = blobs[i];
        b.vx += Math.cos(t * 0.9 + b.seed) * 0.012;
        b.vy += Math.sin(t * 0.7 + b.seed * 1.3) * 0.012;
        // colour fields keep their distance so they never pile up into mud
        for (let j = 0; j < blobs.length; j++) {
          if (i === j) continue;
          const o = blobs[j];
          const dx = b.x - o.x, dy = b.y - o.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < minD) { const f = (1 - d / minD) * 0.08; b.vx += (dx / d) * f; b.vy += (dy / d) * f; }
        }
        const m = 0.08;
        if (b.x < W * m) b.vx += 0.03; if (b.x > W * (1 - m)) b.vx -= 0.03;
        if (b.y < H * m) b.vy += 0.03; if (b.y > H * (1 - m)) b.vy -= 0.03;
        b.vx *= 0.97; b.vy *= 0.97;
        b.x += b.vx; b.y += b.vy;
      }
      placeBlobs();

      ctx.clearRect(0, 0, W, H);
      ctx.shadowBlur = 0;
      for (let k = ripples.length - 1; k >= 0; k--) {
        const r = ripples[k];
        r.r += 2.2; r.life -= 0.012;
        if (r.life <= 0) { ripples.splice(k, 1); continue; }
        for (let n = 0; n < 3; n++) {
          const rr = r.r - n * 18;
          if (rr <= 0) continue;
          ctx.strokeStyle = `rgba(${r.col},${r.life * (0.45 - n * 0.12)})`;
          ctx.lineWidth = 2.2 - n * 0.5;
          ctx.beginPath(); ctx.arc(r.x, r.y, rr, 0, Math.PI * 2); ctx.stroke();
        }
      }
      for (const p of stars) {
        p.x += p.vx + Math.sin(p.t * 0.5) * 0.15; p.y += p.vy; p.t += 0.035;
        if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
        const a = 0.7 + Math.sin(p.t) * 0.3;
        ctx.shadowBlur = 10; ctx.shadowColor = `rgba(${p.col},1)`;
        ctx.fillStyle = `rgba(${p.col},${a})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }

    function mount() {
      if (host && host.isConnected) return;
      host = document.createElement("div");
      host.id = "gemlit-ambient";
      host.setAttribute("aria-hidden", "true");
      blobEls = ["rose", "gold", "sky"].map((c) => {
        const s = document.createElement("span");
        s.className = `gemlit-blob ${c}`;
        host.appendChild(s);
        return s;
      });
      canvas = document.createElement("canvas");
      host.appendChild(canvas);
      ctx = canvas.getContext("2d");
      // Live outside <body> so the page's own framework never removes it.
      root.insertBefore(host, document.body);
      blobs.length = 0;
      blobs.push(
        { x: W * 0.2, y: H * 0.25, vx: 0, vy: 0, seed: 0 },
        { x: W * 0.5, y: H * 0.75, vx: 0, vy: 0, seed: 2.1 },
        { x: W * 0.8, y: H * 0.3, vx: 0, vy: 0, seed: 4.2 },
      );
      resize();
      placeBlobs();
      addEventListener("resize", resize);
      addEventListener("mousemove", onMove, { passive: true });
      document.addEventListener("visibilitychange", () => setRunning(running, true));
    }

    function setRunning(on, fromVisibility) {
      if (!fromVisibility) running = on;
      cancelAnimationFrame(raf);
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (running && !reduce && !document.hidden && ctx) raf = requestAnimationFrame(frame);
    }

    return { mount, setRunning };
  })();

  // Find large opaque wrappers AI Studio paints over the whole window and make them see-through.
  function clearShell() {
    if (!S.enabled || !document.body) return;
    const vw = innerWidth, vh = innerHeight, area = vw * vh;
    const points = [[0.5, 0.5], [0.3, 0.4], [0.7, 0.6], [0.5, 0.85], [0.5, 0.15]];
    const glass = "ms-navbar, mat-sidenav, mat-drawer, ms-run-settings, ms-right-side-panel, ms-chat-turn, ms-prompt-input-wrapper, ms-prompt-box, .cdk-overlay-container, #gemlit-ambient, pre, ms-code-block";
    for (const [fx, fy] of points) {
      for (const el of document.elementsFromPoint(vw * fx, vh * fy)) {
        if (el === document.documentElement || el.closest(glass)) continue;
        const r = el.getBoundingClientRect();
        if (r.width * r.height < area * 0.35) continue;
        const bg = getComputedStyle(el).backgroundColor;
        const m = bg.match(/rgba?\(([^)]+)\)/);
        const alpha = m ? (m[1].split(",")[3] ?? "1") : "0";
        if (parseFloat(alpha) > 0.05) el.classList.add("gemlit-clear");
      }
    }
    alignTurns();
  }

  // Line every framed chat turn up with the prompt box: same left and right edge.
  const TURN_SEL = 'ms-chat-turn .chat-turn-container, ms-chat-turn [class*="chat-turn-container"]';
  const PROMPT_SEL = "ms-prompt-input-wrapper .prompt-input-wrapper, ms-prompt-box, .prompt-input-wrapper, .prompt-box-container";
  const innermost = (sel) => [...document.querySelectorAll(sel)].filter((el) => !el.querySelector(sel));
  function resetTurns() {
    for (const el of document.querySelectorAll("[data-gemlit-aligned]")) {
      el.style.removeProperty("margin-left");
      el.style.removeProperty("margin-right");
      el.style.removeProperty("width");
      el.style.removeProperty("box-sizing");
      el.removeAttribute("data-gemlit-aligned");
    }
  }
  function alignTurns() {
    resetTurns();
    if (!S.enabled) return;
    const prompt = innermost(PROMPT_SEL).map((el) => el.getBoundingClientRect()).find((r) => r.width > 200);
    if (!prompt) return;
    const turns = innermost(TURN_SEL);
    const rects = turns.map((el) => el.getBoundingClientRect()); // read everything first, then write
    turns.forEach((el, i) => {
      const r = rects[i];
      if (r.width < 100 || r.right < prompt.left || r.left > prompt.right) return;
      const ml = prompt.left - r.left;   // + moves the left edge in, − nudges it out
      const mr = r.right - prompt.right;
      if (Math.abs(ml) < 0.5 && Math.abs(mr) < 0.5) return;
      if (Math.abs(ml) > 120 || Math.abs(mr) > 120) return; // a different column — leave it alone
      const cs = getComputedStyle(el);
      el.style.setProperty("box-sizing", "border-box", "important");
      el.style.setProperty("width", `${r.width - ml - mr}px`, "important");
      el.style.setProperty("margin-left", `${parseFloat(cs.marginLeft) + ml}px`, "important");
      el.style.setProperty("margin-right", `${parseFloat(cs.marginRight)}px`, "important");
      el.setAttribute("data-gemlit-aligned", "");
    });
  }
  let clearTimer = 0;
  const scheduleClear = () => { clearTimeout(clearTimer); clearTimer = setTimeout(clearShell, 400); };
  whenBody(() => {
    new MutationObserver(scheduleClear).observe(document.body, { childList: true, subtree: true });
    addEventListener("resize", scheduleClear);
    [800, 2000, 4000, 8000].forEach((ms) => setTimeout(clearShell, ms));
  });

  // ---------------------------------------------------------------- welcome + toast
  function welcome() {
    try { if (sessionStorage.getItem("gemlit_welcome")) return; sessionStorage.setItem("gemlit_welcome", "1"); } catch (_) { return; }
    const w = document.createElement("div");
    w.id = "gemlit-welcome";
    w.innerHTML = '<svg viewBox="0 0 1000 200"><text x="500" y="130" text-anchor="middle">Poesía of the Gemlit Chimes</text></svg>';
    root.appendChild(w);
    setTimeout(() => w.classList.add("out"), 3200);
    setTimeout(() => w.remove(), 4200);
  }

  let toastEl, toastTimer = 0;
  function toast(msg) {
    if (!toastEl || !toastEl.isConnected) {
      toastEl = document.createElement("div");
      toastEl.id = "gemlit-toast";
      toastEl.setAttribute("role", "status");
      root.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    requestAnimationFrame(() => toastEl.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
  }

  // ---------------------------------------------------------------- sounds
  const ring = (len) => { if (S.enabled && S.sound) Chime.play(len, S.volume); };

  const RUN_RE = /^\s*(run|send|chạy|gửi)\b/i;
  function isRunButton(el) {
    if (el.closest("ms-run-button") || el.classList.contains("run-button")) return true;
    const label = el.getAttribute("aria-label") || el.textContent || "";
    return RUN_RE.test(label);
  }

  document.addEventListener("pointerdown", (e) => {
    const el = e.target instanceof Element
      ? e.target.closest('button, a[href], [role="button"], [role="tab"], [role="menuitem"], [role="option"], mat-option, .mat-mdc-chip')
      : null;
    if (!el || el.disabled || el.getAttribute("aria-disabled") === "true") return;
    ring(isRunButton(el) ? "long" : Chime.lengthFor(el));
  }, true);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && e.target instanceof HTMLTextAreaElement) ring("long");
  }, true);

  // ---------------------------------------------------------------- "answer finished" chime
  function isGenerating() {
    const btn = document.querySelector("ms-run-button button, button.run-button");
    if (!btn) return false;
    const label = `${btn.getAttribute("aria-label") || ""} ${btn.textContent || ""}`;
    return /\b(stop|dừng)\b/i.test(label) || btn.classList.contains("stoppable");
  }
  let wasGenerating = false;
  setInterval(() => {
    const now = isGenerating();
    if (wasGenerating && !now && S.enabled && S.doneChime) {
      if (S.sound) Chime.play("done", S.volume);
      toast("✦ Khúc nhạc đã ngân xong");
    }
    wasGenerating = now;
  }, 600);
})();
