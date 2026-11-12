/* ProjectBaluga smart mascot
 * Drives assets/mascot-expressions.svg with:
 *  - smooth expression crossfades (and instant swaps for blinking)
 *  - idle life: breathing (CSS), blinking, small head tilts, occasional expressions
 *  - cursor / touch awareness: leans toward the pointer or the feature being hovered
 *  - chat awareness: listens while you type, reacts to the tone of your message
 *  - page awareness: reacts to sections as you scroll, waves on the first visit
 *
 * script.js talks to this module through window.PBMascot (see bottom of the file).
 * Everything proactive is switched off when prefers-reduced-motion is set.
 */
(function (root) {
  "use strict";

  const SPRITE = "assets/mascot-expressions.svg#";
  const STATES = ["idle", "thinking", "responding", "success", "error", "offline"];

  // ------------------------------------------------------------------
  // Pure logic (no DOM) — covered by tests/mascot.test.js
  // ------------------------------------------------------------------
  const WORRIED = /\b(problem|problems|issue|issues|error|errors|broken|not working|doesn'?t work|won'?t work|down|slow|lag|laggy|stuck|failed|failing|urgent|hacked|virus|lost|crash(?:ed|ing)?|sira|sirang|problema|mabagal|nawala|naloko|ayaw|hindi gumagana|di gumagana|hindi na gumagana)\b/i;
  const HAPPY = /\b(thanks?|thank you|salamat|great|awesome|nice|love it|good job|galing|ayos)\b/i;
  const FRIENDLY = /^\s*(hi|hello|hey|good (morning|afternoon|evening)|kumusta|kamusta|musta|magandang (umaga|hapon|gabi))\b/i;

  function classifyMessage(text) {
    const value = String(text || "");
    if (WORRIED.test(value)) return "worried";
    if (HAPPY.test(value)) return "happy";
    if (FRIENDLY.test(value)) return "friendly";
    if (value.length > 220) return "attentive";
    return "neutral";
  }

  // Expression shown while a message of this tone is being typed.
  const TYPING_EXPRESSION = {
    worried: "error", happy: "success", friendly: "responding", attentive: "thinking", neutral: "idle"
  };
  // Brief reaction when a message of this tone is sent (before the "thinking" pose).
  const SEND_FLASH = { worried: "error", happy: "success", friendly: "responding" };

  function afterResponseState(mood) {
    // Stay calm and kind after a worried message; celebrate otherwise.
    return mood === "worried" ? "idle" : "success";
  }

  const SECTIONS = {
    about:      { expr: "thinking",   hint: "Curious how we work? Ask me anything." },
    technology: { expr: "thinking",   hint: "Want this explained in plain words? I can help." },
    services:   { expr: "responding", hint: "Not sure which service fits? Ask me." },
    process:    { expr: "idle",       hint: null },
    contact:    { expr: "success",    hint: "Ready when you are. Tell me what you need." }
  };
  function sectionReaction(id) {
    return Object.prototype.hasOwnProperty.call(SECTIONS, id) ? SECTIONS[id] : null;
  }

  function computeLean(cx, cy, tx, ty) {
    const dx = tx - cx, dy = ty - cy;
    const dist = Math.hypot(dx, dy);
    if (!dist) return { x: 0, y: 0 };
    const strength = Math.max(0.35, Math.min(1, dist / 220));
    return { x: (dx / dist) * strength, y: (dy / dist) * strength };
  }

  function nextBlinkDelay(random) { return 2600 + random() * 3800; }
  function nextFlairDelay(random) { return 9000 + random() * 8000; }
  function pickFlair(random, last) {
    const options = ["thinking", "responding"].filter((name) => name !== last);
    return options[Math.floor(random() * options.length)] || "thinking";
  }

  const logic = {
    classifyMessage, afterResponseState, sectionReaction, computeLean,
    nextBlinkDelay, nextFlairDelay, pickFlair,
    TYPING_EXPRESSION, SEND_FLASH, STATES
  };

  // ------------------------------------------------------------------
  // Expression layers: two stacked <use> elements for crossfading
  // ------------------------------------------------------------------
  const reduced = { matches: false };
  function layersOf(svg) {
    if (svg.__pbLayers) return svg.__pbLayers;
    const first = svg.querySelector("use");
    if (!first) return null;
    const second = first.cloneNode(false);
    first.classList.add("pb-mascot__layer", "is-on");
    second.classList.add("pb-mascot__layer");
    svg.appendChild(second);
    const match = (first.getAttribute("href") || "").match(/#(\w+)$/);
    svg.__pbLayers = { front: first, back: second, state: match ? match[1] : "idle" };
    return svg.__pbLayers;
  }

  function express(svg, state, instant) {
    if (!svg) return;
    const next = STATES.indexOf(state) >= 0 ? state : "idle";
    const layers = layersOf(svg);
    if (!layers || layers.state === next) return;
    layers.state = next;
    const snap = instant || reduced.matches;
    if (snap) svg.classList.add("is-instant");
    layers.back.setAttribute("href", SPRITE + next);
    layers.back.classList.add("is-on");
    layers.front.classList.remove("is-on");
    const swap = layers.front; layers.front = layers.back; layers.back = swap;
    if (snap && root.requestAnimationFrame) {
      root.requestAnimationFrame(() => root.requestAnimationFrame(() => svg.classList.remove("is-instant")));
    }
  }
  function currentState(svg) {
    const layers = svg && layersOf(svg);
    return layers ? layers.state : null;
  }

  let earlyState = "idle";
  const api = {
    logic,
    express,
    setChatState: function (state) { earlyState = state; },
    onUserMessage: function () { return "neutral"; },
    afterResponseState: function () { return "success"; }
  };
  root.PBMascot = api;

  if (typeof document === "undefined") return;

  // ------------------------------------------------------------------
  // Browser behaviour
  // ------------------------------------------------------------------
  function boot() {
    const rootEl = document.getElementById("pbAssistant");
    const launcher = document.getElementById("pbAssistantLauncher");
    if (!rootEl || !launcher) return;
    const avatarEl = launcher.querySelector(".pb-assistant__launcher-avatar");
    const launcherSvg = avatarEl ? avatarEl.querySelector("svg") : null;
    const input = document.getElementById("pbAssistantInput");
    const messagesEl = document.getElementById("pbAssistantMessages");
    const rm = root.matchMedia ? root.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
    reduced.matches = rm.matches;
    if (rm.addEventListener) rm.addEventListener("change", () => { reduced.matches = rm.matches; kick(); });

    const random = Math.random;
    const timers = {};
    function later(key, fn, ms) { clearTimeout(timers[key]); timers[key] = setTimeout(fn, ms); }
    function cancel(key) { clearTimeout(timers[key]); delete timers[key]; }

    let chatState = earlyState;
    let lastMood = "neutral";
    let panelOpen = document.body.classList.contains("pb-assistant-open");
    let launcherHover = false, hoverExpr = null, sectionExpr = null, flairExpr = null, lastFlair = null;
    let interacted = false;

    const proactive = () => !rm.matches && !document.hidden && !panelOpen && chatState === "idle";

    function refresh(instant) {
      if (chatState !== "idle" || !launcherSvg) return;
      const wanted = launcherHover ? "responding" : (hoverExpr || sectionExpr || flairExpr || "idle");
      express(launcherSvg, wanted, instant);
    }

    // ---- storage helpers (private mode / blocked storage must never break the page)
    function readStore(store, key) { try { return root[store].getItem(key); } catch (e) { return null; } }
    function writeStore(store, key, value) { try { root[store].setItem(key, value); return true; } catch (e) { return false; } }

    // ---- speech hint bubble --------------------------------------------------
    const hintEl = document.createElement("div");
    hintEl.className = "pb-mascot-hint";
    hintEl.setAttribute("aria-hidden", "true");
    hintEl.appendChild(document.createElement("span"));
    rootEl.appendChild(hintEl);
    let hintCount = parseInt(readStore("sessionStorage", "pbMascotHints") || "0", 10) || 0;
    const MAX_HINTS = 2;
    const hintVisible = () => hintEl.classList.contains("is-visible");
    function hideHint() { hintEl.classList.remove("is-visible"); cancel("hintEnd"); }
    function canHint() { return !interacted && hintCount < MAX_HINTS && !hintVisible() && proactive(); }
    function showHint(text) {
      hintEl.firstChild.textContent = text;
      hintEl.classList.add("is-visible");
      hintCount += 1;
      writeStore("sessionStorage", "pbMascotHints", String(hintCount));
      later("hintEnd", hideHint, 6500);
    }
    hintEl.addEventListener("click", () => { hideHint(); launcher.click(); });

    // ---- idle life: blinking + occasional expression and head tilt ----------
    function blinkLoop() {
      later("blink", () => {
        if (launcherSvg && proactive()) {
          const state = currentState(launcherSvg);
          if (state === "idle" || state === "responding" || state === "thinking") {
            express(launcherSvg, "offline", true);
            later("unblink", () => {
              if (chatState === "idle" && currentState(launcherSvg) === "offline") {
                refresh(true);
                if (random() < 0.18) later("blink2", () => {
                  if (proactive() && currentState(launcherSvg) !== "offline") {
                    const keep = currentState(launcherSvg);
                    express(launcherSvg, "offline", true);
                    later("unblink2", () => { if (currentState(launcherSvg) === "offline" && chatState === "idle") express(launcherSvg, keep, true); }, 120);
                  }
                }, 210);
              }
            }, 120 + random() * 50);
          }
        }
        blinkLoop();
      }, nextBlinkDelay(random));
    }
    function setTilt(value) { if (avatarEl) avatarEl.style.setProperty("--pb-tilt", String(value)); }
    function flairLoop() {
      later("flair", () => {
        if (proactive() && !launcherHover && !hoverExpr && !sectionExpr) {
          flairExpr = pickFlair(random, lastFlair);
          lastFlair = flairExpr;
          setTilt((random() * 6 - 3).toFixed(1));
          refresh();
          later("flairEnd", () => { flairExpr = null; setTilt(0); refresh(); }, 1600 + random() * 900);
        }
        flairLoop();
      }, nextFlairDelay(random));
    }

    // ---- leaning toward the pointer, a touch, or the hovered feature --------
    let pointer = null, hoverEl = null, raf = 0;
    const lean = { x: 0, y: 0 };
    function leaning() { return !rm.matches && !panelOpen && avatarEl && avatarEl.offsetParent !== null; }
    function targetPoint() {
      if (hoverEl && document.contains(hoverEl)) {
        const rect = hoverEl.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + Math.min(rect.height / 2, 120) };
      }
      return pointer;
    }
    function kick() { if (!raf && avatarEl && root.requestAnimationFrame) raf = root.requestAnimationFrame(tick); }
    function tick() {
      raf = 0;
      let target = { x: 0, y: 0 };
      if (leaning()) {
        const point = targetPoint();
        if (point) {
          const rect = avatarEl.getBoundingClientRect();
          target = computeLean(rect.left + rect.width / 2, rect.top + rect.height / 2, point.x, point.y);
        }
      }
      lean.x += (target.x - lean.x) * 0.14;
      lean.y += (target.y - lean.y) * 0.14;
      avatarEl.style.setProperty("--pb-lx", (lean.x * 3).toFixed(2) + "px");
      avatarEl.style.setProperty("--pb-ly", (lean.y * 2).toFixed(2) + "px");
      avatarEl.style.setProperty("--pb-lr", (lean.x * 7).toFixed(2) + "deg");
      const settled = Math.abs(target.x - lean.x) < 0.004 && Math.abs(target.y - lean.y) < 0.004;
      if (!settled) kick();
    }
    document.addEventListener("pointermove", (event) => {
      pointer = { x: event.clientX, y: event.clientY };
      if (event.pointerType === "touch") later("touchRelease", () => { pointer = null; kick(); }, 1400);
      kick();
    }, { passive: true });
    document.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch") return;
      pointer = { x: event.clientX, y: event.clientY };
      later("touchRelease", () => { pointer = null; kick(); }, 1400);
      kick();
    }, { passive: true });
    document.documentElement.addEventListener("mouseleave", () => { pointer = null; kick(); });
    root.addEventListener("scroll", () => { if (hoverEl) kick(); }, { passive: true });

    // ---- reacting to the feature under the mouse -----------------------------
    const HOVER_SELECTOR = ".feature, .pb-node, .contact-card";
    document.addEventListener("pointerover", (event) => {
      if (event.pointerType !== "mouse" || !event.target.closest) return;
      const el = event.target.closest(HOVER_SELECTOR);
      if (!el || el === hoverEl) return;
      hoverEl = el;
      cancel("hoverOff");
      later("hoverOn", () => {
        if (hoverEl !== el) return;
        hoverExpr = el.matches(".contact-card") ? "responding" : "thinking";
        refresh();
        kick();
      }, 280);
    });
    document.addEventListener("pointerout", (event) => {
      if (!hoverEl || !hoverEl.contains(event.target)) return;
      if (event.relatedTarget && hoverEl.contains(event.relatedTarget)) return;
      hoverEl = null;
      cancel("hoverOn");
      later("hoverOff", () => { if (!hoverEl) { hoverExpr = null; refresh(); } }, 350);
      kick();
    });

    // ---- launcher hover / focus ---------------------------------------------
    launcher.addEventListener("pointerenter", () => { launcherHover = true; refresh(); });
    launcher.addEventListener("pointerleave", () => { launcherHover = false; refresh(); });
    launcher.addEventListener("focus", () => { launcherHover = true; refresh(); });
    launcher.addEventListener("blur", () => { launcherHover = false; refresh(); });

    // ---- reacting to page sections ------------------------------------------
    const seenSections = {};
    let lastReaction = 0;
    function onSection(id) {
      const reaction = sectionReaction(id);
      if (!reaction || seenSections[id]) return;
      seenSections[id] = true;
      if (!proactive() || Date.now() - lastReaction < 5000) return;
      lastReaction = Date.now();
      sectionExpr = reaction.expr;
      refresh();
      later("sectionEnd", () => { sectionExpr = null; refresh(); }, 2400);
      if (reaction.hint && canHint()) showHint(reaction.hint);
    }
    if ("IntersectionObserver" in root) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => { if (entry.isIntersecting) onSection(entry.target.id); });
      }, { rootMargin: "-40% 0px -40% 0px", threshold: 0 });
      Object.keys(SECTIONS).forEach((id) => { const el = document.getElementById(id); if (el) observer.observe(el); });
    }

    // ---- first-visit wave ----------------------------------------------------
    const GREETED_KEY = "pbMascotGreeted";
    function wave() {
      if (!avatarEl) return;
      avatarEl.classList.remove("pb-wave");
      void avatarEl.offsetWidth;
      avatarEl.classList.add("pb-wave");
      later("waveEnd", () => avatarEl.classList.remove("pb-wave"), 1700);
      sectionExpr = "responding";
      refresh();
      later("sectionEnd", () => { sectionExpr = null; refresh(); }, 2200);
    }
    function greetFirstVisit() {
      if (readStore("localStorage", GREETED_KEY) !== null) return;            // already greeted before
      if (!writeStore("localStorage", "pbMascotProbe", "1")) return;          // cannot remember the visit: stay quiet
      let attempts = 0;
      later("greet", function tryGreet() {
        if (!proactive() || !canHint()) {
          if (++attempts < 5) later("greet", tryGreet, 4000);
          return;
        }
        writeStore("localStorage", GREETED_KEY, "1");
        wave();
        showHint("Hi! Ask me anything about your project.");
      }, 3200);
    }

    // ---- listening while the visitor types ----------------------------------
    function lastAvatar() {
      const list = messagesEl ? messagesEl.querySelectorAll(".pb-assistant__message-avatar") : [];
      return list.length ? list[list.length - 1] : null;
    }
    const typingOK = () => panelOpen && (chatState === "idle" || chatState === "success" || chatState === "error");
    let lastNod = 0;
    function typedMood() {
      if (!typingOK()) return;
      const avatar = lastAvatar();
      if (!avatar) return;
      const text = input ? input.value : "";
      const mood = text.trim() ? classifyMessage(text) : "neutral";
      express(avatar.querySelector("svg"), TYPING_EXPRESSION[mood]);
    }
    if (input) input.addEventListener("input", () => {
      if (!typingOK()) return;
      const avatar = lastAvatar();
      if (!avatar) return;
      if (!rm.matches) {
        const now = Date.now();
        if (now - lastNod > 380) {
          lastNod = now;
          avatar.classList.remove("pb-nod");
          void avatar.offsetWidth;
          avatar.classList.add("pb-nod");
        }
        avatar.classList.add("pb-listening");
        later("typingEnd", () => { const a = lastAvatar(); if (a) a.classList.remove("pb-listening"); }, 1800);
      }
      later("mood", typedMood, 550);
    });

    // ---- hooks used by script.js --------------------------------------------
    function chatSvgs() {
      const avatar = lastAvatar();
      return [launcherSvg, avatar ? avatar.querySelector("svg") : null].filter(Boolean);
    }
    api.setChatState = function (state) {
      chatState = state;
      cancel("mood");
      if (state !== "thinking") cancel("flash");
      if (state !== "idle") { flairExpr = null; sectionExpr = null; setTilt(0); }
      const avatar = lastAvatar();
      if (avatar && state !== "idle" && state !== "success" && state !== "error") avatar.classList.remove("pb-listening");
      if (state === "idle") refresh();
    };
    api.onUserMessage = function (text) {
      lastMood = classifyMessage(text);
      cancel("mood");
      const avatar = lastAvatar();
      if (avatar) avatar.classList.remove("pb-listening");
      const flash = SEND_FLASH[lastMood];
      if (flash) {
        chatSvgs().forEach((svg) => express(svg, flash));
        later("flash", () => {
          if (chatState === "thinking") chatSvgs().forEach((svg) => express(svg, "thinking"));
        }, 750);
      }
      return lastMood;
    };
    api.afterResponseState = function () { return afterResponseState(lastMood); };

    // ---- panel open / close ---------------------------------------------------
    new MutationObserver(() => {
      const open = document.body.classList.contains("pb-assistant-open");
      if (open === panelOpen) return;
      panelOpen = open;
      if (open) {
        interacted = true;
        launcherHover = false; hoverExpr = null; sectionExpr = null; flairExpr = null;
        hideHint();
      } else {
        refresh();
        kick();
      }
    }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    launcher.addEventListener("click", () => { interacted = true; hideHint(); });

    blinkLoop();
    flairLoop();
    greetFirstVisit();
  }

  // The assistant markup sits before the scripts, so we can start right away.
  if (document.getElementById("pbAssistant")) boot();
  else document.addEventListener("DOMContentLoaded", boot);
})(typeof window !== "undefined" ? window : globalThis);
