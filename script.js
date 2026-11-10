// ============================================================
//  ProjectBaluga — site behaviour
// ============================================================
(function () {
  "use strict";

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const root = document.documentElement;

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
