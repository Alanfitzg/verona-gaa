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

  document.addEventListener("DOMContentLoaded", () => {
    initLang();
    initForm();
  });
})();
