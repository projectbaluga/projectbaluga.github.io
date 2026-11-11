// ============================================================
//  ProjectBaluga — site behaviour
// ============================================================
(function () {
  "use strict";

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const root = document.documentElement;

  // ----------------------------------------------------------
  //  Generative topography — interactive, restrained canvas background
  // ----------------------------------------------------------
  (function initTopography() {
    const canvas = document.getElementById("topographyCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarsePointer = window.matchMedia("(pointer: coarse)");
    let width = 0, height = 0, dpr = 1, frame = 0;
    let phase = 0, lastTime = 0, running = false;
    let pointerX = -1000, pointerY = -1000, pointerStrength = 0;
    let targetX = -1000, targetY = -1000, targetStrength = 0;
    let scrollAmount = 0, targetSectionStrength = 1;
    let sectionStrength = 1;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      const isLight = root.getAttribute("data-theme") === "light";
      const mobile = width < 700;
      const lineCount = mobile ? 13 : 24;
      const step = mobile ? 22 : 16;
      const baseGap = Math.max(24, height / (lineCount + 2));
      const ink = isLight ? "72, 86, 111" : "151, 166, 193";
      const accent = isLight ? "91, 77, 238" : "139, 125, 255";
      const intensity = sectionStrength * (mobile ? 0.76 : 1);
      const scrollDrift = Math.min(scrollAmount, 1) * 20;

      ctx.lineWidth = mobile ? 0.75 : 0.9;
      for (let line = 0; line < lineCount; line++) {
        const centerY = height * 0.10 + line * baseGap;
        const strength = 0.32 + (Math.sin(line * 0.71) + 1) * 0.18;
        ctx.beginPath();

        for (let x = -step; x <= width + step; x += step) {
          const nx = x / Math.max(width, 1);
          const broad = Math.sin(nx * 5.1 + line * 0.19 + phase) * 18;
          const fine = Math.sin(nx * 11.4 - line * 0.31 + phase * 0.62) * 6;
          const bend = Math.cos(nx * 2.7 + phase * 0.38) * 13;
          const dx = x - pointerX;
          const dy = centerY - pointerY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const influence = pointerStrength * Math.exp(-(distance * distance) / (width * width * 0.035));
          const cursorBend = Math.sin((nx * 7) + phase) * influence * 15;
          const y = centerY + broad + fine + bend + cursorBend + scrollDrift * (0.25 + line / lineCount);
          if (x === -step) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        const isAccentLine = line % 8 === 3;
        const alpha = (isAccentLine ? (isLight ? 0.115 : 0.14) : (isLight ? 0.075 : 0.095)) * intensity;
        ctx.strokeStyle = isAccentLine
          ? `rgba(${accent}, ${strength * alpha})`
          : `rgba(${ink}, ${strength * alpha})`;
        ctx.stroke();
      }

      const glowX = pointerStrength > 0.025 ? pointerX : width * 0.78;
      const glowY = pointerStrength > 0.025 ? pointerY : height * 0.28;
      const glowRadius = Math.max(width, height) * (pointerStrength > 0.025 ? 0.24 : 0.42);
      const glow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, glowRadius);
      const glowAlpha = (pointerStrength > 0.025 ? 0.052 : 0.032) * intensity;
      glow.addColorStop(0, isLight
        ? `rgba(91, 77, 238, ${glowAlpha})`
        : `rgba(139, 125, 255, ${glowAlpha})`);
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
    }

    function animate(time) {
      if (!running) return;
      if (!lastTime || time - lastTime > 32) {
        pointerX += (targetX - pointerX) * 0.075;
        pointerY += (targetY - pointerY) * 0.075;
        pointerStrength += (targetStrength - pointerStrength) * 0.055;
        sectionStrength += (targetSectionStrength - sectionStrength) * 0.035;
        scrollAmount += ((window.scrollY / Math.max(document.documentElement.scrollHeight - height, 1)) - scrollAmount) * 0.045;
        phase += 0.0017 + scrollAmount * 0.00045;
        draw();
        lastTime = time;
      }
      frame = window.requestAnimationFrame(animate);
    }

    function start() {
      if (running || document.hidden || reduceMotion.matches) return;
      running = true;
      lastTime = 0;
      frame = window.requestAnimationFrame(animate);
    }

    function stop() {
      running = false;
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    }

    if (!coarsePointer.matches && !reduceMotion.matches) {
      window.addEventListener("pointermove", (event) => {
        targetX = event.clientX;
        targetY = event.clientY;
        targetStrength = 1;
      }, { passive: true });
      window.addEventListener("pointerleave", () => { targetStrength = 0; }, { passive: true });
      window.addEventListener("blur", () => { targetStrength = 0; }, { passive: true });
    }

    const sections = document.querySelectorAll("main > section");
    if ("IntersectionObserver" in window && sections.length) {
      const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          targetSectionStrength = id === "top" ? 1 : (id === "contact" ? 0.48 : 0.68);
          root.dataset.backgroundSection = id || "content";
        });
      }, { threshold: 0.18 });
      sections.forEach((section) => sectionObserver.observe(section));
    }

    resize();
    if (!reduceMotion.matches) start();
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop();
      else start();
    });
    reduceMotion.addEventListener?.("change", () => {
      if (reduceMotion.matches) {
        stop();
        targetStrength = 0;
        pointerStrength = 0;
        draw();
      } else {
        start();
      }
    });

    const themeObserver = new MutationObserver(draw);
    themeObserver.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  })();

  // ----------------------------------------------------------
  //  Theme toggle — with circular reveal via View Transitions
  // ----------------------------------------------------------
  const themeToggle = document.getElementById("themeToggle");

  function applyTheme(next) {
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (e) { /* private mode */ }
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";

      if (document.startViewTransition && !prefersReduced) {
        const rect = themeToggle.getBoundingClientRect();
        root.style.setProperty("--vt-x", rect.left + rect.width / 2 + "px");
        root.style.setProperty("--vt-y", rect.top + rect.height / 2 + "px");
        document.startViewTransition(() => applyTheme(next));
      } else {
        applyTheme(next);
      }
    });
  }

  // ----------------------------------------------------------
  //  Navigation — scrolled state, mobile menu, scrollspy
  // ----------------------------------------------------------
  const nav = document.getElementById("siteNav");
  const navToggle = document.getElementById("navToggle");
  const navLinks = document.getElementById("navLinks");
  const navBackdrop = document.getElementById("navBackdrop");

  function syncNavState() {
    nav.classList.toggle("nav--scrolled", window.scrollY > 10);
  }
  window.addEventListener("scroll", syncNavState, { passive: true });
  syncNavState();

  function closeMenu() {
    navLinks.classList.remove("is-open");
    document.body.classList.remove("nav-open");
    navToggle.setAttribute("aria-expanded", "false");
  }

  navToggle.addEventListener("click", () => {
    const open = navLinks.classList.toggle("is-open");
    document.body.classList.toggle("nav-open", open);
    navToggle.setAttribute("aria-expanded", String(open));
  });

  navBackdrop.addEventListener("click", closeMenu);
  navLinks.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  // Scrollspy — highlight the section currently in view
  const spyLinks = document.querySelectorAll("[data-spy]");
  if ("IntersectionObserver" in window && spyLinks.length) {
    const spyMap = {};
    spyLinks.forEach((l) => { spyMap[l.dataset.spy] = l; });

    const spyObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          spyLinks.forEach((l) => l.classList.remove("is-active"));
          const link = spyMap[entry.target.id];
          if (link) link.classList.add("is-active");
        });
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );

    Object.keys(spyMap).forEach((id) => {
      const section = document.getElementById(id);
      if (section) spyObserver.observe(section);
    });
  }

  // ----------------------------------------------------------
  //  Scroll progress bar
  // ----------------------------------------------------------
  const progressBar = document.getElementById("scrollProgress");
  if (progressBar) {
    let ticking = false;
    const update = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      progressBar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + "%";
      ticking = false;
    };
    window.addEventListener("scroll", () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });
    update();
  }

  // ----------------------------------------------------------
  //  Custom cursor (fine pointers, motion allowed)
  // ----------------------------------------------------------
  if (finePointer && !prefersReduced) {
    const dot = document.getElementById("cursorDot");
    const ring = document.getElementById("cursorRing");

    if (dot && ring) {
      root.classList.add("has-cursor");

      let mx = innerWidth / 2, my = innerHeight / 2;
      let rx = mx, ry = my;

      window.addEventListener("pointermove", (e) => {
        mx = e.clientX;
        my = e.clientY;
        dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
      }, { passive: true });

      (function follow() {
        rx += (mx - rx) * 0.16;
        ry += (my - ry) * 0.16;
        ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
        requestAnimationFrame(follow);
      })();

      const interactive = "a, button, [data-zoom], input, textarea";
      document.addEventListener("pointerover", (e) => {
        if (e.target.closest(interactive)) ring.classList.add("is-active");
      });
      document.addEventListener("pointerout", (e) => {
        if (e.target.closest(interactive)) ring.classList.remove("is-active");
      });
    }
  }

  // ----------------------------------------------------------
  //  Magnetic buttons (subtle pull toward the cursor)
  // ----------------------------------------------------------
  if (finePointer && !prefersReduced) {
    document.querySelectorAll("[data-magnetic]").forEach((el) => {
      const strength = 0.25;
      el.addEventListener("pointermove", (e) => {
        const rect = el.getBoundingClientRect();
        const x = (e.clientX - rect.left - rect.width / 2) * strength;
        const y = (e.clientY - rect.top - rect.height / 2) * strength;
        el.style.transform = `translate(${x}px, ${y}px)`;
      });
      el.addEventListener("pointerleave", () => {
        el.style.transform = "";
      });
    });
  }

  // ----------------------------------------------------------
  //  Spotlight cards — radial glow tracks the cursor
  // ----------------------------------------------------------
  if (finePointer) {
    document.querySelectorAll("[data-spot]").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--mx", e.clientX - rect.left + "px");
        card.style.setProperty("--my", e.clientY - rect.top + "px");
      });
    });
  }

  // ----------------------------------------------------------
  //  Scroll reveal animations (directional + staggered)
  // ----------------------------------------------------------
  (function () {
    const tag = (el, variant) => el.classList.add("reveal", "reveal--" + variant);

    document.querySelectorAll(".section-head").forEach((el) => tag(el, "blur"));
    document.querySelectorAll(".hero__inner").forEach((el) => tag(el, "up"));
    document.querySelectorAll(".about__text").forEach((el) => tag(el, "left"));
    document.querySelectorAll(".about__photo").forEach((el) => tag(el, "right"));
    document.querySelectorAll(".case, .more-card, .carousel").forEach((el) => tag(el, "scale"));
    document.querySelectorAll(".contact__title, .contact__lead, .contact__cta, .tags").forEach((el) => tag(el, "up"));

    // Staggered groups
    [".principles", ".bento", ".case__grid", ".metrics", ".steps", ".contact__cards", ".hero__stats"].forEach((sel) => {
      document.querySelectorAll(sel).forEach((group) => {
        Array.from(group.children).forEach((child, i) => {
          tag(child, "pop");
          child.style.setProperty("--reveal-delay", (i % 8) * 70 + "ms");
        });
      });
    });

    const targets = document.querySelectorAll(".reveal");

    if (prefersReduced || !("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    targets.forEach((el) => observer.observe(el));
  })();

  // ----------------------------------------------------------
  //  Hero parallax (aurora drifts as you scroll)
  // ----------------------------------------------------------
  if (!prefersReduced) {
    const layers = document.querySelectorAll(".hero__bg .aurora");
    const grid = document.querySelector(".hero__bg .grid-overlay");
    if (layers.length) {
      let ticking = false;
      const update = () => {
        const y = window.scrollY;
        layers.forEach((el, i) => {
          el.style.translate = `0 ${y * (i + 1) * 0.05}px`;
        });
        if (grid) grid.style.translate = `0 ${y * 0.03}px`;
        ticking = false;
      };
      window.addEventListener("scroll", () => {
        if (!ticking) {
          requestAnimationFrame(update);
          ticking = true;
        }
      }, { passive: true });
    }
  }

  // ----------------------------------------------------------
  //  Rotating role text (type / delete loop)
  // ----------------------------------------------------------
  const rotator = document.getElementById("rotator");
  if (rotator && !prefersReduced) {
    const roles = [
      "Software Developer",
      "Full-Stack Development",
      "Systems & Integration",
    ];
    let roleIndex = 0;
    let charIndex = roles[0].length;
    let deleting = false;

    (function typeLoop() {
      const word = roles[roleIndex];
      rotator.textContent = word.slice(0, charIndex);

      if (!deleting && charIndex < word.length) {
        charIndex++;
        setTimeout(typeLoop, 85);
      } else if (!deleting && charIndex === word.length) {
        deleting = true;
        setTimeout(typeLoop, 1700);
      } else if (deleting && charIndex > 0) {
        charIndex--;
        setTimeout(typeLoop, 42);
      } else {
        deleting = false;
        roleIndex = (roleIndex + 1) % roles.length;
        setTimeout(typeLoop, 320);
      }
    })();
  }

  // ----------------------------------------------------------
  //  Animated count-up numbers (hero stats + case metrics)
  // ----------------------------------------------------------
  const counters = document.querySelectorAll("[data-count]");
  if (counters.length) {
    const animate = (el) => {
      const target = parseInt(el.dataset.count, 10);
      const suffix = el.dataset.suffix || "";
      if (prefersReduced) {
        el.textContent = target + suffix;
        return;
      }
      const duration = 1400;
      const start = performance.now();
      (function tick(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(eased * target) + suffix;
        if (progress < 1) requestAnimationFrame(tick);
      })(start);
    };

    if ("IntersectionObserver" in window) {
      const counterObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            animate(entry.target);
            counterObserver.unobserve(entry.target);
          });
        },
        { threshold: 0.5 }
      );
      counters.forEach((el) => counterObserver.observe(el));
    } else {
      counters.forEach(animate);
    }
  }

  // ----------------------------------------------------------
  //  Screenshot carousel + fullscreen lightbox
  // ----------------------------------------------------------
  (function () {
    const carousel = document.querySelector("[data-carousel]");
    if (!carousel) return;

    const track = carousel.querySelector("[data-track]");
    const slides = Array.from(track.children);
    const dotsWrap = carousel.querySelector("[data-dots]");
    const counter = carousel.querySelector("[data-counter]");
    const prevBtn = carousel.querySelector("[data-prev]");
    const nextBtn = carousel.querySelector("[data-next]");
    let index = 0;

    const items = slides.map((s) => {
      const img = s.querySelector("img");
      const cap = s.querySelector("figcaption");
      return {
        src: img.getAttribute("src"),
        alt: img.getAttribute("alt"),
        caption: cap ? cap.textContent : "",
      };
    });

    slides.forEach((_, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", "Go to screenshot " + (i + 1));
      b.addEventListener("click", () => goTo(i));
      dotsWrap.appendChild(b);
    });
    const dots = Array.from(dotsWrap.children);

    function goTo(i) {
      index = (i + slides.length) % slides.length;
      track.style.transform = `translateX(-${index * 100}%)`;
      dots.forEach((d, di) => d.classList.toggle("is-active", di === index));
      if (counter) counter.textContent = (index + 1) + " / " + slides.length;
    }

    prevBtn.addEventListener("click", () => goTo(index - 1));
    nextBtn.addEventListener("click", () => goTo(index + 1));
    goTo(0);

    // Swipe support
    let startX = null;
    track.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; }, { passive: true });
    track.addEventListener("touchend", (e) => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 45) goTo(index + (dx < 0 ? 1 : -1));
      startX = null;
    });

    // ---- Lightbox ----
    const lb = document.getElementById("lightbox");
    const lbImg = document.getElementById("lightboxImg");
    const lbCap = document.getElementById("lightboxCaption");
    let lbIndex = 0;

    function openLb(i) {
      lbIndex = (i + items.length) % items.length;
      lbImg.src = items[lbIndex].src;
      lbImg.alt = items[lbIndex].alt;
      lbCap.textContent = items[lbIndex].caption;
      lb.hidden = false;
      document.body.style.overflow = "hidden";
    }
    function closeLb() {
      lb.hidden = true;
      document.body.style.overflow = "";
    }
    function lbStep(d) { openLb(lbIndex + d); }

    slides.forEach((s, i) => {
      const frame = s.querySelector("[data-zoom]");
      if (frame) frame.addEventListener("click", () => { goTo(i); openLb(i); });
    });

    lb.querySelector("[data-lb-close]").addEventListener("click", closeLb);
    lb.querySelector("[data-lb-prev]").addEventListener("click", () => lbStep(-1));
    lb.querySelector("[data-lb-next]").addEventListener("click", () => lbStep(1));
    lb.addEventListener("click", (e) => { if (e.target === lb) closeLb(); });

    document.addEventListener("keydown", (e) => {
      if (lb.hidden) return;
      if (e.key === "Escape") closeLb();
      else if (e.key === "ArrowLeft") lbStep(-1);
      else if (e.key === "ArrowRight") lbStep(1);
    });
  })();

  // ----------------------------------------------------------
  //  Copy email to clipboard + toast
  // ----------------------------------------------------------
  const toast = document.getElementById("toast");
  let toastTimer = null;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2400);
  }

  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const value = btn.dataset.copy;
      try {
        await navigator.clipboard.writeText(value);
        showToast("Copied — " + value);
      } catch (e) {
        // Fallback for older browsers
        const input = document.createElement("textarea");
        input.value = value;
        document.body.appendChild(input);
        input.select();
        try {
          document.execCommand("copy");
          showToast("Copied — " + value);
        } catch (err) {
          showToast(value);
        }
        document.body.removeChild(input);
      }
    });
  });

  // ----------------------------------------------------------
  //  Project inquiry modal — FormSubmit AJAX delivery
  // ----------------------------------------------------------
  (function () {
    const modal = document.getElementById("inquiryModal");
    const form = document.getElementById("inquiryForm");
    if (!modal || !form) return;
    const dialog = modal.querySelector(".inquiry-dialog");
    const closeButtons = modal.querySelectorAll("[data-inquiry-close]");
    const submitButton = document.getElementById("inquirySubmit");
    const status = document.getElementById("inquiryStatus");
    let previousFocus = null;

    function openInquiry(event) {
      if (event) event.preventDefault();
      previousFocus = document.activeElement;
      modal.hidden = false;
      document.body.classList.add("inquiry-open");
      dialog.focus();
      const firstField = form.querySelector("input");
      if (firstField) firstField.focus({ preventScroll: true });
    }

    function closeInquiry() {
      modal.hidden = true;
      document.body.classList.remove("inquiry-open");
      if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
    }

    function showStatus(message, type) {
      status.textContent = message;
      status.className = "inquiry-status " + (type || "");
      status.hidden = false;
    }

    document.querySelectorAll("[data-inquiry-open]").forEach((trigger) => {
      trigger.addEventListener("click", openInquiry);
    });
    closeButtons.forEach((button) => button.addEventListener("click", closeInquiry));
    modal.addEventListener("click", (event) => {
      if (event.target === modal.querySelector(".inquiry-modal__backdrop")) closeInquiry();
    });

    document.addEventListener("keydown", (event) => {
      if (modal.hidden) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeInquiry();
      } else if (event.key === "Tab") {
        const focusable = Array.from(dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'))
          .filter((element) => element.offsetParent !== null);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;

      const originalLabel = submitButton.innerHTML;
      submitButton.disabled = true;
      submitButton.textContent = "Sending…";
      status.hidden = true;

      const payload = new FormData(form);
      payload.set("_subject", "New ProjectBaluga inquiry");
      payload.set("_replyto", String(payload.get("email") || ""));
      payload.set("_url", window.location.href);
      payload.set("_honey", "");

      try {
        const response = await fetch("https://formsubmit.co/ajax/projectbaluga@gmail.com", {
          method: "POST",
          headers: { "Accept": "application/json" },
          body: payload
        });
        const result = await response.json();

        // FormSubmit can return HTTP 200 even when the submission was rejected.
        if (String(result.success) !== "true") {
          throw new Error(result.message || "The email service could not accept the inquiry.");
        }

        showStatus("Thank you! Your inquiry has been sent to ProjectBaluga. We’ll get back to you using the email address you provided.", "is-success");
        form.reset();
      } catch (error) {
        showStatus(
          error.message && error.message.toLowerCase().includes("activation")
            ? "One-time setup is needed: check projectbaluga@gmail.com for FormSubmit’s activation email, then click its activation link. After that, submissions can be delivered automatically."
            : "We couldn’t send your inquiry right now. Please try again in a moment or email projectbaluga@gmail.com directly.",
          "is-error"
        );
      } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalLabel;
      }
    });
  })();


  //  ProjectBaluga AI assistant — session-only conversation
  // ----------------------------------------------------------
  (function () {
    const rootEl = document.getElementById("pbAssistant");
    if (!rootEl) return;
    const launcher = document.getElementById("pbAssistantLauncher");
    const panel = document.getElementById("pbAssistantPanel");
    const close = document.getElementById("pbAssistantClose");
    const reset = document.getElementById("pbAssistantReset");
    const form = document.getElementById("pbAssistantForm");
    const input = document.getElementById("pbAssistantInput");
    const send = document.getElementById("pbAssistantSend");
    const messagesEl = document.getElementById("pbAssistantMessages");
    const suggestions = document.getElementById("pbAssistantSuggestions");
    const status = document.getElementById("pbAssistantStatus");
    const avatar = document.getElementById("pbAssistantAvatar");
    const characterStatus = document.getElementById("pbAssistantCharacterStatus");
    const history = [];
    const maxHistory = 8;
    const welcomeText = "Hello! I’m ProjectBaluga’s AI assistant. Tell me a little about your business or the technology challenge you’re working through.";
    let previousFocus = null;
    let busy = false;

    function setCharacterState(state, label) {
      if (avatar) avatar.dataset.state = state;
      if (characterStatus) characterStatus.textContent = label;
      if (launcher) launcher.dataset.state = state;
    }
    function setStatus(message) { status.textContent = message || ""; }
    function openPanel() {
      previousFocus = document.activeElement;
      panel.hidden = false;
      launcher.setAttribute("aria-expanded", "true");
      document.body.classList.add("pb-assistant-open");
      setCharacterState("idle", "Ready to help");
      input.focus();
    }
    function closePanel() {
      panel.hidden = true;
      launcher.setAttribute("aria-expanded", "false");
      document.body.classList.remove("pb-assistant-open");
      setCharacterState("idle", "Ready to help");
      if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
    }
    function addCopyAction(bubble, content) {
      const copy = document.createElement("button");
      copy.type = "button";
      copy.className = "pb-assistant__copy";
      copy.textContent = "Copy";
      copy.setAttribute("aria-label", "Copy assistant response");
      copy.addEventListener("click", async () => {
        try {
          if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error("Copy is unavailable in this browser.");
          await navigator.clipboard.writeText(content);
          copy.textContent = "Copied";
          setStatus("Response copied.");
          window.setTimeout(() => { copy.textContent = "Copy"; }, 1600);
        } catch {
          setStatus("Unable to copy automatically. You can select the response text instead.");
        }
      });
      bubble.appendChild(copy);
    }
    function addMessage(content, kind, options = {}) {
      const bubble = document.createElement("div");
      bubble.className = "pb-assistant__message pb-assistant__message--" + kind;
      const text = document.createElement("span");
      text.className = "pb-assistant__message-text";
      text.textContent = content;
      bubble.appendChild(text);
      if (options.copy) addCopyAction(bubble, content);
      if (options.pending) {
        bubble.classList.add("pb-assistant__message--pending");
        bubble.setAttribute("aria-label", "Assistant is thinking");
      }
      messagesEl.appendChild(bubble);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return bubble;
    }
    function renderWelcome() {
      messagesEl.replaceChildren();
      addMessage(welcomeText, "assistant");
      const group = document.createElement("div");
      group.className = "pb-assistant__suggestions";
      group.id = "pbAssistantSuggestions";
      group.setAttribute("aria-label", "Suggested questions");
      const intro = document.createElement("p");
      intro.textContent = "Not sure where to start? Try one of these:";
      group.appendChild(intro);
      [
        ["Inventory or sales system", "I need an inventory or sales system for my business."],
        ["Network & IT support", "I need help with my office network, Wi-Fi, or IT setup."],
        ["Business automation", "I want to automate repetitive tasks in my business."],
        ["Server & infrastructure", "I need advice about servers, shared files, or backups."]
      ].forEach(([label, prompt]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.pbSuggestion = prompt;
        button.textContent = label;
        group.appendChild(button);
      });
      messagesEl.appendChild(group);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    async function sendMessage(rawMessage) {
      const message = String(rawMessage || "").trim();
      if (!message || busy) return;
      const endpoint = (rootEl.dataset.apiUrl || "").trim();
      if (!endpoint) {
        setStatus("The assistant is not connected yet. Please contact ProjectBaluga.");
        return;
      }
      if (!/^https:\/\//i.test(endpoint)) {
        setStatus("Assistant configuration is invalid. Please contact ProjectBaluga.");
        return;
      }

      if (suggestions && suggestions.isConnected) suggestions.remove();
      addMessage(message, "user");
      history.push({ role: "user", content: message });
      input.value = "";
      busy = true;
      send.disabled = true;
      if (reset) reset.disabled = true;
      setStatus("Thinking…");
      setCharacterState("thinking", "Thinking through your question…");
      const pending = addMessage("Thinking", "assistant", { pending: true });

      try {
        const response = await fetch(endpoint.replace(/\/$/, "") + "/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history.slice(-maxHistory) })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (response.status === 429) throw new Error("You’ve reached the short-term usage limit. Please wait a minute and try again.");
          throw new Error(payload.error || "The assistant is temporarily unavailable. Please try again later.");
        }
        const answer = typeof payload.reply === "string" ? payload.reply.trim() : "";
        if (!answer) throw new Error("The assistant returned an empty response. Please try again.");
        pending.classList.remove("pb-assistant__message--pending");
        pending.removeAttribute("aria-label");
        pending.querySelector(".pb-assistant__message-text").textContent = answer;
        addCopyAction(pending, answer);
        history.push({ role: "assistant", content: answer });
        if (history.length > maxHistory) history.splice(0, history.length - maxHistory);
        setStatus("");
        setCharacterState("ready", "Here to help");
      } catch (error) {
        pending.classList.remove("pb-assistant__message--pending");
        pending.classList.add("pb-assistant__message--error");
        pending.querySelector(".pb-assistant__message-text").textContent = error.message || "Unable to reach the assistant.";
        history.pop();
        setCharacterState("error", "Let's try that again");
        setStatus("Your conversation stays in this page session only.");
      } finally {
        busy = false;
        send.disabled = false;
        if (reset) reset.disabled = false;
        input.focus();
      }
    }

    launcher.addEventListener("click", openPanel);
    close.addEventListener("click", closePanel);
    if (reset) reset.addEventListener("click", () => {
      if (busy) return;
      history.length = 0;
      input.value = "";
      setStatus("Started a new conversation.");
      setCharacterState("idle", "Ready to help");
      renderWelcome();
      input.focus();
    });
    messagesEl.addEventListener("click", (event) => {
      const button = event.target.closest("[data-pb-suggestion]");
      if (button) sendMessage(button.dataset.pbSuggestion);
    });
    document.addEventListener("keydown", (event) => {
      if (panel.hidden) return;
      if (event.key === "Escape") closePanel();
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      sendMessage(input.value);
    });
  })();

  // ----------------------------------------------------------
 — explainable hybrid-ready engine
  // ----------------------------------------------------------
  (function () {
    const modal = document.getElementById("recommendModal");
    if (!modal) return;
    const dialog = modal.querySelector(".recommend-dialog");
    const content = document.getElementById("recommendStepContent");
    const results = document.getElementById("recommendResults");
    const back = document.getElementById("recommendBack");
    const next = document.getElementById("recommendNext");
    const progress = document.getElementById("recommendProgressBar");
    const stepLabel = document.getElementById("recommendStepLabel");
    const percent = document.getElementById("recommendPercent");
    const services = {
      systems: { name:"Custom Business Systems", inquiry:"Custom Business Systems", description:"A tailored application may help centralize records, sales, inventory, reporting, or day-to-day business workflows." },
      network: { name:"Network & IT Solutions", inquiry:"Network & IT Solutions", description:"A network review or IT improvement may help address connectivity, Wi-Fi coverage, device access, and network reliability." },
      automation: { name:"Software & Automation", inquiry:"Software & Automation", description:"Software integration or workflow automation may reduce repetitive tasks and connect the tools your team already uses." },
      infrastructure: { name:"Server / Infrastructure Setup", inquiry:"Server / Infrastructure Setup", description:"An infrastructure assessment may help plan reliable hosting, shared resources, backups, and access controls." },
      consultation: { name:"Technology Consultation", inquiry:"Consultation / Not sure yet", description:"A discovery conversation is the best next step when requirements are broad, mixed, or not yet clear." }
    };
    const steps = [
      { title:"Tell us about your business", hint:"This helps us understand the environment your solution needs to support.", fields:[
        {name:"industry",label:"What type of business do you operate?",type:"select",required:true,options:["Retail / Store","Food / Restaurant","Online Business","Office / Professional Services","Internet Service Provider / Connectivity","Hospitality / Resort","Manufacturing","Other"]},
        {name:"team",label:"How many people will use or be affected by the solution?",type:"select",required:true,options:["Just me","2–5 people","6–15 people","16–50 people","More than 50 people"]}
      ]},
      { title:"What technology do you use today?", hint:"Select all that apply. It is okay if you are not sure.", fields:[
        {name:"current",type:"checks",options:["Paper records or manual processes","Spreadsheets (Excel / Google Sheets)","Existing business software","Cloud apps and online tools","Office Wi-Fi or wired network","Servers or shared storage","No formal setup yet","Not sure"]}
      ]},
      { title:"What challenges are you experiencing?", hint:"Choose the issues that take time, cause errors, or interrupt your work.", fields:[
        {name:"challenges",type:"checks",required:true,options:["Manual records are difficult to manage","Inventory, sales, billing, or customer data are scattered","Repetitive data entry or admin tasks","Different apps do not work well together","Slow internet, weak Wi-Fi, or network interruptions","Too many devices or users to manage","Need secure shared files, backups, or hosting","Limited visibility through reports or dashboards","Not sure what technology would help"]}
      ]},
      { title:"What would you like to improve?", hint:"Select the outcomes that matter most to your business.", fields:[
        {name:"goals",type:"checks",required:true,options:["Centralize business records and operations","Improve inventory, sales, billing, or customer tracking","Reduce repetitive work and human error","Connect software, apps, or business processes","Improve internet, Wi-Fi, or network reliability","Manage devices, access, and connectivity","Set up shared files, servers, or backups","Get advice before choosing a solution"]}
      ]},
      { title:"A few project details", hint:"These answers help us understand the likely size and urgency. They are not a quotation.", fields:[
        {name:"scope",label:"What best describes the work?",type:"select",options:["New solution from scratch","Improve or replace an existing setup","Fix a current issue","Explore options / Need guidance"]},
        {name:"budget",label:"Estimated budget",type:"select",options:["Not sure yet","Below ₱10,000","₱10,000–₱25,000","₱25,000–₱50,000","₱50,000–₱100,000","Above ₱100,000"]},
        {name:"timeline",label:"When would you like to start?",type:"select",options:["Flexible / Just exploring","As soon as practical","Within 1 month","Within 1–3 months","More than 3 months"]},
        {name:"notes",label:"Anything else we should know? (optional)",type:"textarea"}
      ]}
    ];
    const state = { step:0, answers:{} };
    let previousFocus = null;
    const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
    function renderStep() {
      const step = steps[state.step];
      results.hidden = true;
      content.hidden = false;
      content.innerHTML = "<h3>" + step.title + "</h3><p class='recommend-step-hint'>" + step.hint + "</p>" +
        step.fields.map((field) => {
          if (field.type === "checks") {
            const selected = state.answers[field.name] || [];
            return "<div class='recommend-options' data-field='" + field.name + "'>" + field.options.map((option) =>
              "<label class='recommend-option'><input type='checkbox' name='" + field.name + "' value='" + esc(option) + "'" + (selected.includes(option) ? " checked" : "") + "><span>" + esc(option) + "</span></label>"
            ).join("") + "</div>";
          }
          const value = state.answers[field.name] || "";
          if (field.type === "textarea") return "<label class='recommend-field'>" + field.label + "<textarea name='" + field.name + "' rows='3' maxlength='1200' placeholder='Optional details'>" + esc(value) + "</textarea></label>";
          return "<label class='recommend-field'>" + field.label + (field.required ? " *" : "") + "<select name='" + field.name + "'" + (field.required ? " required" : "") + "><option value=''>Select an option</option>" + field.options.map((option) => "<option" + (value === option ? " selected" : "") + ">" + esc(option) + "</option>").join("") + "</select></label>";
        }).join("");
      const totalSteps = steps.length;
      const progressValue = Math.round(((state.step + 1) / totalSteps) * 100);
      stepLabel.textContent = "Step " + (state.step + 1) + " of " + totalSteps;
      percent.textContent = progressValue + "% complete";
      progress.style.width = progressValue + "%";
      back.disabled = state.step === 0;
      next.textContent = state.step === totalSteps - 1 ? "See recommendations →" : "Continue →";
      content.querySelector("select, input, textarea")?.focus({ preventScroll:true });
    }
    function collectStep() {
      const step = steps[state.step];
      for (const field of step.fields) {
        if (field.type === "checks") {
          const selected = Array.from(content.querySelectorAll('input[name="' + field.name + '"]:checked')).map((input) => input.value);
          if (field.required && !selected.length) {
            content.querySelector("[data-field='" + field.name + "']")?.scrollIntoView({block:"nearest"});
            content.querySelector("[data-field='" + field.name + "'] input")?.focus();
            return false;
          }
          state.answers[field.name] = selected;
        } else {
          const input = content.querySelector('[name="' + field.name + '"]');
          const value = input ? input.value.trim() : "";
          if (field.required && !value) { input.focus(); input.reportValidity?.(); return false; }
          state.answers[field.name] = value;
        }
      }
      return true;
    }
    function calculate() {
      const scores = { systems:0, network:0, automation:0, infrastructure:0, consultation:0 };
      const reasons = { systems:[], network:[], automation:[], infrastructure:[], consultation:[] };
      const map = [
        ["Manual records are difficult to manage","systems",3,"You currently rely on manual records."],
        ["Inventory, sales, billing, or customer data are scattered","systems",4,"Business records are spread across different places."],
        ["Repetitive data entry or admin tasks","automation",4,"You want to reduce repetitive administrative work."],
        ["Different apps do not work well together","automation",4,"Your tools may need better integration."],
        ["Slow internet, weak Wi-Fi, or network interruptions","network",5,"Connectivity or Wi-Fi reliability is a concern."],
        ["Too many devices or users to manage","network",3,"Your environment may need more structured network management."],
        ["Need secure shared files, backups, or hosting","infrastructure",5,"You need to consider shared infrastructure, backups, or hosting."],
        ["Limited visibility through reports or dashboards","systems",3,"Better reporting and operational visibility are priorities."],
        ["Not sure what technology would help","consultation",4,"You would like guidance before selecting a solution."]
      ];
      (state.answers.challenges || []).forEach((answer) => { const row=map.find((item)=>item[0]===answer); if(row){scores[row[1]]+=row[2];reasons[row[1]].push(row[3]);} });
      const goals = [
        ["Centralize business records and operations","systems",4,"You want centralized business information."],
        ["Improve inventory, sales, billing, or customer tracking","systems",4,"You want clearer tracking of core business activities."],
        ["Reduce repetitive work and human error","automation",4,"You want to reduce manual effort and errors."],
        ["Connect software, apps, or business processes","automation",4,"You want disconnected tools to work together."],
        ["Improve internet, Wi-Fi, or network reliability","network",4,"Reliable connectivity is an important goal."],
        ["Manage devices, access, and connectivity","network",3,"You need more organized device and access management."],
        ["Set up shared files, servers, or backups","infrastructure",4,"Shared resources and data protection are priorities."],
        ["Get advice before choosing a solution","consultation",4,"You prefer a guided assessment before committing."]
      ];
      (state.answers.goals || []).forEach((answer)=>{const row=goals.find((item)=>item[0]===answer);if(row){scores[row[1]]+=row[2];reasons[row[1]].push(row[3]);}});
      const current = state.answers.current || [];
      if(current.includes("Paper records or manual processes")) scores.systems+=2, scores.automation+=1;
      if(current.includes("Spreadsheets (Excel / Google Sheets)")) scores.systems+=2, scores.automation+=1;
      if(current.includes("Office Wi-Fi or wired network")) scores.network+=1;
      if(current.includes("Servers or shared storage")) scores.infrastructure+=2;
      if(current.includes("No formal setup yet") || current.includes("Not sure")) scores.consultation+=2;
      if(state.answers.scope==="New solution from scratch") { scores.systems+=1; scores.infrastructure+=1; }
      if(state.answers.scope==="Fix a current issue") { scores.network+=1; scores.consultation+=1; }
      const ranked=Object.keys(scores).filter((key)=>key!=="consultation").map((key)=>({key,score:scores[key]})).sort((a,b)=>b.score-a.score);
      const total=ranked.reduce((sum,item)=>sum+item.score,0);
      const top=ranked[0];
      const second=ranked[1];
      const uncertain=(state.answers.challenges||[]).includes("Not sure what technology would help");
      const primaryKey=(!total || scores.consultation>=top.score || (top.score-second.score<=1 && uncertain)) ? "consultation" : top.key;
      const primaryScore=primaryKey==="consultation"?null:Math.round((top.score/Math.max(total,1))*100);
      const secondary=ranked.filter((item)=>item.key!==primaryKey && item.score>0).slice(0,2);
      const primaryReasons=(reasons[primaryKey]||[]).slice(0,3);
      return {primaryKey,primaryScore,primaryReasons,secondary,scores};
    }
    function renderResults() {
      if(!collectStep()) return;
      const result=calculate(), primary=services[result.primaryKey];
      content.hidden=true; results.hidden=false;
      stepLabel.textContent="Assessment complete"; percent.textContent="100% complete"; progress.style.width="100%";
      const primaryEl=document.getElementById("recommendPrimary");
      primaryEl.innerHTML="<span class='recommend-match'>" + (result.primaryScore===null?"Discovery recommended": "Top weighted match · "+result.primaryScore+"% of scored signals") + "</span><h4>"+esc(primary.name)+"</h4><p>"+esc(primary.description)+"</p><ul class='recommend-reasons'>"+(result.primaryReasons.length?result.primaryReasons.map((reason)=>"<li>"+esc(reason)+"</li>").join(""):"<li>Your answers suggest that a short discovery conversation would be useful.</li>")+"</ul>";
      document.getElementById("recommendSecondary").innerHTML=result.secondary.length?result.secondary.map((item)=>"<article><h4>"+esc(services[item.key].name)+"</h4><p>"+esc(services[item.key].description)+"</p></article>").join(""):"";
      next.textContent="Continue to project inquiry →";
      next.dataset.action="inquiry";
      back.disabled=false;
      state.result={...result,primary};
    }
    function open() {
      previousFocus=document.activeElement;
      state.step=0;
      state.answers={};
      delete state.result;
      modal.hidden=false;
      document.body.classList.add("recommend-open");
      next.dataset.action="";
      renderStep();
      dialog.focus({ preventScroll: true });
    }
    function close() {
      modal.hidden=true;
      document.body.classList.remove("recommend-open");
      if(previousFocus?.focus) previousFocus.focus();
    }
    function transferToInquiry() {
      const inquiry=document.getElementById("inquiryModal");
      const form=document.getElementById("inquiryForm");
      if(!inquiry||!form) return;
      const service=form.querySelector('[name="service"]');
      const details=form.querySelector('[name="details"]');
      const budget=form.querySelector('[name="budget"]');
      const timeline=form.querySelector('[name="timeline"]');
      const answer=state.answers;
      service.value=state.result.primary.inquiry;
      details.value=[
        "Smart Service Recommender assessment",
        "Business type: "+(answer.industry||"Not provided"),
        "Team size: "+(answer.team||"Not provided"),
        "Current setup: "+((answer.current||[]).join(", ")||"Not provided"),
        "Challenges: "+((answer.challenges||[]).join("; ")||"Not provided"),
        "Desired outcomes: "+((answer.goals||[]).join("; ")||"Not provided"),
        "Project scope: "+(answer.scope||"Not provided"),
        "Additional notes: "+(answer.notes||"None"),
        "Recommended service: "+state.result.primary.name
      ].join("\n").slice(0, 2000);
      if(budget) budget.value=answer.budget||"";
      const timelineMap = {
        "As soon as practical": "As soon as possible",
        "Within 1 month": "Within 1 month",
        "Within 1–3 months": "Within 1–3 months",
        "More than 3 months": "More than 3 months"
      };
      if(timeline) timeline.value=timelineMap[answer.timeline]||"";
      close();
      const trigger=document.querySelector("[data-inquiry-open]");
      if(trigger) trigger.click();
      else { inquiry.hidden=false; document.body.classList.add("inquiry-open"); }
    }
    document.querySelectorAll("[data-recommend-open]").forEach((button)=>button.addEventListener("click",open));
    modal.querySelectorAll("[data-recommend-close]").forEach((button)=>button.addEventListener("click",close));
    modal.addEventListener("click",(event)=>{if(event.target===modal.querySelector(".recommend-modal__backdrop"))close();});
    back.addEventListener("click",()=>{
      if(state.result){delete state.result;next.dataset.action="";renderStep();return;}
      if(state.step>0){state.step--;renderStep();}
    });
    next.addEventListener("click",()=>{
      if(next.dataset.action==="inquiry"){transferToInquiry();return;}
      if(!collectStep()) return;
      if(state.step<4){state.step++;renderStep();}
      else renderResults();
    });
    document.addEventListener("keydown",(event)=>{
      if(modal.hidden)return;
      if(event.key==="Escape"){
        event.preventDefault();
        close();
        return;
      }
      if(event.key==="Tab"){
        const focusable=Array.from(dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])'))
          .filter((el)=>el.offsetParent!==null);
        if(!focusable.length){
          event.preventDefault();
          dialog.focus();
          return;
        }
        const first=focusable[0];
        const last=focusable[focusable.length-1];
        if(event.shiftKey&&document.activeElement===first){
          event.preventDefault();
          last.focus();
        } else if(!event.shiftKey&&document.activeElement===last){
          event.preventDefault();
          first.focus();
        }
      }
    });
  })();

  // ----------------------------------------------------------
  //  Footer — local time (Asia/Manila) + year + back to top
  // ----------------------------------------------------------
  const timeEl = document.getElementById("localTime");
  if (timeEl) {
    const fmt = new Intl.DateTimeFormat("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Asia/Manila",
    });
    const tickClock = () => { timeEl.textContent = fmt.format(new Date()); };
    tickClock();
    setInterval(tickClock, 1000);
  }

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const backToTop = document.getElementById("backToTop");
  if (backToTop) {
    backToTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
    });
  }
})();
