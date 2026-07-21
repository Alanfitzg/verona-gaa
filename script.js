// Language switching + form UX for Verona GAA.
(function () {
  const STORAGE_KEY = "verona-gaa-lang";
  const dict = window.I18N || {};

  function applyLang(lang) {
    const table = dict[lang];
    if (!table) return;

    document.documentElement.lang = lang;

    // Text content
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const attr = el.getAttribute("data-i18n-attr");
      if (table[key] == null) return;
      if (attr) {
        el.setAttribute(attr, table[key]);
      } else {
        el.textContent = table[key];
      }
    });

    // Toggle button state
    document.querySelectorAll(".lang-btn").forEach((btn) => {
      const active = btn.dataset.lang === lang;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });

    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
  }

  function initLang() {
    let lang = null;
    try { lang = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    if (!lang) {
      lang = (navigator.language || "en").toLowerCase().startsWith("it") ? "it" : "en";
    }
    applyLang(lang);

    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.addEventListener("click", () => applyLang(btn.dataset.lang));
    });
  }

  function initForm() {
    const form = document.querySelector(".join-form");
    if (!form) return;

    // Parent / under-18 toggle: reveal the player's details, and swap which
    // date-of-birth field is required (the child's, not the parent's).
    const isParent = form.querySelector("#is-parent");
    const u18Block = form.querySelector("#u18-block");
    const contactHint = form.querySelector("#contact-hint");
    const dobField = form.querySelector("#dob-field");
    const playerName = form.querySelector("#player_name");
    const playerDob = form.querySelector("#player_dob");
    const selfDob = form.querySelector("#dob");

    function syncParent() {
      const on = !!(isParent && isParent.checked);
      if (u18Block) u18Block.hidden = !on;
      if (contactHint) contactHint.hidden = !on;
      if (dobField) dobField.hidden = on; // parent's own DOB not needed
      if (playerName) playerName.required = on;
      if (playerDob) playerDob.required = on;
      if (selfDob) selfDob.required = !on;
    }
    if (isParent) {
      isParent.addEventListener("change", syncParent);
      syncParent();
    }

    form.addEventListener("submit", async (e) => {
      // Native validation first (shows the browser's field errors).
      if (!form.checkValidity()) return;
      e.preventDefault();

      // Silently drop spam bots that fill the hidden honeypot.
      const hp = form.querySelector('[name="bot-field"]');
      if (hp && hp.value.trim() !== "") { showSuccess(form); return; }

      const endpoint =
        (window.VERONA_FORM_ENDPOINT || form.dataset.endpoint || "").trim();

      // Demo mode: nothing wired up yet — don't lose the user, just thank them.
      if (!endpoint) { showSuccess(form); return; }

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      // "cors": endpoint returns CORS headers → we can confirm success/failure.
      // "no-cors": simplest Power Automate setup → fire-and-forget (opaque reply).
      const mode = window.VERONA_FORM_MODE === "no-cors" ? "no-cors" : "cors";
      const payload = JSON.stringify(collectData(form));

      try {
        if (mode === "no-cors") {
          await fetch(endpoint, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "text/plain;charset=UTF-8" },
            body: payload,
          });
          showSuccess(form); // opaque response — assume delivered
        } else {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
          });
          if (!res.ok) throw new Error("HTTP " + res.status);
          showSuccess(form);
        }
      } catch (err) {
        if (submitBtn) submitBtn.disabled = false;
        showError(form);
      }
    });
  }

  // Gather the form into a tidy JSON object for the backend / SharePoint list.
  function collectData(form) {
    const val = (n) => {
      const el = form.querySelector('[name="' + n + '"]:checked, [name="' + n + '"]');
      return el ? el.value.trim() : "";
    };
    const interests = Array.from(
      form.querySelectorAll('[name="interest"]:checked')
    ).map((el) => el.value);

    const isU18 = form.querySelector("#is-parent")?.checked || false;

    return {
      submitted_at: new Date().toISOString(),
      role: val("role"),
      registering_for_u18: isU18 ? "yes" : "no",
      player_name: isU18 ? val("player_name") : "",
      player_dob: isU18 ? val("player_dob") : "",
      contact_name: val("name"),
      email: val("email"),
      contact_number: val("phone"),
      date_of_birth: isU18 ? "" : val("dob"),
      sports_interested: interests,
      consent: form.querySelector('[name="consent"]')?.checked ? "yes" : "no",
      page_language: document.documentElement.lang || "en",
    };
  }

  function showError(form) {
    const lang = document.documentElement.lang || "en";
    const msg =
      (dict[lang] && dict[lang]["form.error"]) ||
      "Sorry, something went wrong. Please try again.";
    let box = form.querySelector(".form-error");
    if (!box) {
      box = document.createElement("p");
      box.className = "form-error";
      box.setAttribute("role", "alert");
      const btn = form.querySelector('button[type="submit"]');
      form.insertBefore(box, btn);
    }
    box.textContent = msg;
  }

  function showSuccess(form) {
    const lang = document.documentElement.lang || "en";
    const msg = (dict[lang] && dict[lang]["form.success"]) || "Thanks!";
    const note = document.createElement("div");
    note.className = "form-success";
    note.setAttribute("role", "status");
    note.textContent = msg;
    form.replaceChildren(note);
  }

  // Progressive-enhancement motion: scroll reveals + condensing header.
  function initMotion() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Condense the sticky header once the hero scrolls past.
    const header = document.querySelector(".site-header");
    if (header) {
      const onScroll = () => header.classList.toggle("is-stuck", window.scrollY > 24);
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }

    if (reduce || !("IntersectionObserver" in window)) return;

    // Tag the elements we want to fade up, with a light stagger per group.
    const groups = [
      ".festival-inner > *",
      ".affiliation-inner > *",
      ".section-inner > .eyebrow",
      ".section-inner > h2",
      ".section-inner > .lead",
      ".card",
      ".games-rail-wrap",
      ".join-form",
    ];
    document.body.classList.add("js-reveal");
    groups.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el, i) => {
        el.setAttribute("data-reveal", "");
        el.style.transitionDelay = Math.min(i * 80, 320) + "ms";
      });
    });

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
  }

  // Games scroller + lightbox. Each tile holds a hidden .tile-detail
  // (video + description); opening the modal moves that live node into the
  // dialog (so language switching keeps working) and returns it on close.
  function initGames() {
    const modal = document.getElementById("game-modal");
    const rail = document.getElementById("games-rail");
    if (!modal) return;

    const body = modal.querySelector(".game-modal-body");
    const titleEl = modal.querySelector(".game-modal-title");
    let sourceTile = null;
    let lastFocus = null;

    function openModal(tile) {
      const detail = tile.querySelector(".tile-detail");
      const title = tile.querySelector(".tile-title");
      if (!detail) return;
      titleEl.textContent = title ? title.textContent : "";
      detail.hidden = false;
      body.appendChild(detail);
      sourceTile = tile;
      lastFocus = document.activeElement;
      modal.hidden = false;
      document.body.style.overflow = "hidden";
      const close = modal.querySelector(".game-modal-close");
      if (close) close.focus();
    }

    function closeModal() {
      const detail = body.querySelector(".tile-detail");
      if (detail && sourceTile) {
        // Stop any playing media before tucking the node back into its tile.
        const f = detail.querySelector("iframe");
        if (f) f.src = f.src;
        const v = detail.querySelector("video");
        if (v && !v.paused) v.pause();
        detail.hidden = true;
        sourceTile.appendChild(detail);
      }
      modal.hidden = true;
      document.body.style.overflow = "";
      if (lastFocus) lastFocus.focus();
      sourceTile = null;
    }

    document.querySelectorAll(".tile-btn").forEach((btn) => {
      btn.addEventListener("click", () => openModal(btn.closest(".game-tile")));
    });
    modal.querySelectorAll("[data-close]").forEach((el) =>
      el.addEventListener("click", closeModal)
    );
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.hidden) closeModal();
    });

    // Prev / next arrows scroll the rail by roughly one card.
    if (rail) {
      const step = () => {
        const card = rail.querySelector(".game-tile");
        const w = card ? card.getBoundingClientRect().width + 21 : rail.clientWidth * 0.8;
        return w;
      };
      const prev = modal.closest("#games").querySelector(".rail-prev");
      const next = modal.closest("#games").querySelector(".rail-next");
      if (prev) prev.addEventListener("click", () => rail.scrollBy({ left: -step(), behavior: "smooth" }));
      if (next) next.addEventListener("click", () => rail.scrollBy({ left: step(), behavior: "smooth" }));
    }
  }

  // Mobile navigation: hamburger toggles the nav as a dropdown under the header.
  function initNav() {
    const header = document.querySelector(".site-header");
    const toggle = document.querySelector(".nav-toggle");
    const nav = document.getElementById("site-nav");
    if (!header || !toggle || !nav) return;

    function set(open) {
      header.classList.toggle("nav-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    }
    toggle.addEventListener("click", () => set(!header.classList.contains("nav-open")));
    nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => set(false)));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") set(false); });
    window.addEventListener("resize", () => { if (window.innerWidth > 720) set(false); });
  }

  // Hero CTA navigation. Hybrid: a short hop gets a duration-capped eased
  // scroll (you see the journey), a long hop gets the branded curtain wipe
  // (so the distance doesn't feel frantic). Reduced-motion → instant jump.
  function initTransition() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const links = document.querySelectorAll(".hero-cta a[href^='#']");
    if (!links.length) return;

    const header = document.querySelector(".site-header");
    const curtain = document.createElement("div");
    curtain.className = "page-curtain";
    curtain.setAttribute("aria-hidden", "true");
    if (!reduce) document.body.appendChild(curtain);

    // Target's scroll position, offset for the sticky header.
    function targetTop(el) {
      const h = header ? header.getBoundingClientRect().height : 0;
      return Math.max(0, el.getBoundingClientRect().top + window.scrollY - h - 8);
    }
    const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    function animateScroll(toY, duration) {
      const fromY = window.scrollY, delta = toY - fromY;
      let start = null;
      function frame(ts) {
        if (start === null) start = ts;
        const p = Math.min((ts - start) / duration, 1);
        window.scrollTo(0, fromY + delta * easeInOutCubic(p));
        if (p < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }

    let busy = false;
    links.forEach((a) => {
      a.addEventListener("click", (e) => {
        const id = a.getAttribute("href");
        const target = id && id.length > 1 && document.querySelector(id);
        if (!target || busy) return;
        if (reduce) return; // let the native instant jump happen
        e.preventDefault();
        const toY = targetTop(target);
        const distance = Math.abs(toY - window.scrollY);
        try { history.replaceState(null, "", id); } catch (_) {}

        if (distance > window.innerHeight * 1.6) {
          // Long jump — mask the travel with the curtain wipe.
          busy = true;
          curtain.classList.add("cover");
          setTimeout(() => {
            window.scrollTo(0, toY);
            curtain.classList.remove("cover");
            curtain.classList.add("reveal");
            setTimeout(() => { curtain.classList.remove("reveal"); busy = false; }, 520);
          }, 350);
        } else {
          // Short hop — capped eased scroll (fixed duration regardless of distance).
          animateScroll(toY, 650);
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initLang();
    initForm();
    initMotion();
    initGames();
    initNav();
    initTransition();
  });
})();
