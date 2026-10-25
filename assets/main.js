/* Auto + Hobby – gemeinsames Script. Einstellungen: assets/config.js (aus generate.py) */
const CFG = window.SITE_CONFIG || {};
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
document.documentElement.classList.add("js");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Mobile Menü
const toggle = $(".nav__toggle"), menu = $("#menu");
if (toggle && menu) {
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!open));
    toggle.setAttribute("aria-label", open ? "Menü öffnen" : "Menü schließen");
    menu.classList.toggle("open", !open);
  });
  $$("a", menu).forEach(a => a.addEventListener("click", () => { toggle.setAttribute("aria-expanded", "false"); menu.classList.remove("open"); }));
}

// Reveal
const items = $$(".reveal");
if ("IntersectionObserver" in window && !reduce) {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  items.forEach(el => io.observe(el));
} else items.forEach(el => el.classList.add("in"));

// Geöffnet-Anzeige (Europe/Berlin)
$$(".js-open").forEach(el => {
  const parts = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const get = t => parts.find(p => p.type === t)?.value;
  const day = get("weekday").replace(".", ""), mins = (+get("hour")) * 60 + (+get("minute"));
  const H = { Mo: [570, 1080], Di: [570, 1080], Mi: [570, 1080], Do: [570, 1080], Fr: [570, 1080], Sa: [540, 960] }[day];
  const open = H && mins >= H[0] && mins < H[1];
  el.classList.add(open ? "is-open" : "is-closed");
  const live = open ? "Jetzt geöffnet" : (el.dataset.open === "badge" ? "Jetzt geschlossen" : "Gerade geschlossen");
  el.textContent = el.dataset.open === "badge" ? live : `${live} · Mo–Fr 9:30–18:00 · Sa 9:00–16:00`;
});

// Karte erst nach Klick
$$(".js-loadmap").forEach(btn => btn.addEventListener("click", () => {
  const map = btn.closest(".map");
  map.innerHTML = `<iframe title="Karte: Im Liefeld 38, 40227 Düsseldorf" src="${CFG.mapsEmbed}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>`;
}));

// WhatsApp ohne hinterlegte Nummer
$$("[data-wa-missing]").forEach(a => a.addEventListener("click", ev => {
  ev.preventDefault();
  alert("Vorschau: Die WhatsApp-Nummer ist noch nicht hinterlegt ([WhatsApp-Nummer]).");
}));

// Validierung
function validate(scope) {
  let ok = true, first = null;
  $$("input,select,textarea", scope).forEach(f => {
    if (!f.willValidate) return;
    const bad = f.type === "checkbox" ? (f.required && !f.checked) : !f.checkValidity();
    f.setAttribute("aria-invalid", bad ? "true" : "false");
    if (bad) { ok = false; first = first || f; }
  });
  first?.focus();
  return ok;
}

// Mehrstufiges Formular + Vorbelegung (Template-Daten und ?marke=&modell=&zustand=)
$$(".js-steps").forEach(form => {
  const steps = $$(".fstep", form), prog = $$(".progress li", form);
  let i = 0;
  const show = n => {
    i = n;
    steps.forEach((s, k) => { s.hidden = k !== n; s.classList.toggle("is-active", k === n); });
    prog.forEach((p, k) => { p.classList.toggle("is-active", k <= n); if (k === n) p.setAttribute("aria-current", "step"); else p.removeAttribute("aria-current"); });
    $("input,select,button", steps[n])?.focus({ preventScroll: true });
  };
  $$(".js-next", form).forEach(b => b.addEventListener("click", () => { if (validate(steps[i])) show(i + 1); }));
  $$(".js-prev", form).forEach(b => b.addEventListener("click", () => show(i - 1)));

  const q = new URLSearchParams(location.search);
  const set = (name, val) => { const f = form.elements[name]; if (f && val && !f.length) f.value = val; };
  set("marke", q.get("marke") || form.dataset.prefillMarke);
  set("modell", q.get("modell"));
  set("baujahr", q.get("baujahr"));
  set("km", q.get("km"));
  const z = q.get("zustand");
  if (z) $$('input[name="zustand"]', form).forEach(c => { if (c.value.toLowerCase() === z.toLowerCase()) c.checked = true; });
  // UTM / Kampagne mitsenden
  ["utm_source", "utm_campaign", "utm_term", "gclid"].forEach(k => {
    if (q.get(k)) { const h = document.createElement("input"); h.type = "hidden"; h.name = k; h.value = q.get(k); form.appendChild(h); }
  });
  const src = document.createElement("input"); src.type = "hidden"; src.name = "seite"; src.value = location.pathname; form.appendChild(src);
});

// WhatsApp-Text aus den ausgefüllten Feldern
const WA_TITLES = {
  "Autoankauf-Anfrage": "Neue Autoankauf-Anfrage über die Website",
  "Mietwerkstatt-Anfrage": "Neue Mietwerkstatt-Anfrage über die Website",
  "Teileanfrage": "Neue Autoteile-Anfrage über die Website"
};
const WA_LABELS = {
  anliegen: "Anliegen",
  baujahr: "Baujahr",
  km: "Kilometerstand",
  zustand: "Zustand",
  kraftstoff: "Kraftstoff",
  getriebe: "Getriebe",
  preisvorstellung: "Preisvorstellung",
  name: "Name",
  telefon: "Telefon",
  plz: "PLZ",
  nachricht: "Nachricht"
};
function fieldText(data, key) {
  if (key === "zustand") return data.getAll("zustand").map(v => String(v).trim()).filter(Boolean).join(", ");
  const v = data.get(key);
  return typeof v === "string" ? v.trim() : "";
}
function whatsAppMessage(form, data) {
  const lines = [WA_TITLES[form.dataset.name] || "Neue Anfrage über die Website", ""];
  const fahrzeug = [fieldText(data, "marke"), fieldText(data, "modell")].filter(Boolean).join(" ");
  if (fahrzeug) lines.push(`Fahrzeug: ${fahrzeug}`);
  for (const key of ["anliegen", "baujahr", "km", "zustand", "kraftstoff", "getriebe", "preisvorstellung", "name", "telefon", "plz", "nachricht"]) {
    let val = fieldText(data, key);
    if (!val) continue;
    if (key === "km" && /^\d+$/.test(val)) val = Number(val).toLocaleString("de-DE");
    const label = key === "nachricht" && form.dataset.name === "Teileanfrage" ? "Fahrzeug und Teil" : WA_LABELS[key];
    lines.push(`${label}: ${val}`);
  }
  const seite = fieldText(data, "seite");
  if (seite) lines.push(`Seite: ${seite}`);
  return lines.join("\n");
}
function openWhatsApp(url) {
  const mobile = matchMedia("(max-width: 860px)").matches;
  if (mobile) location.assign(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}

// Absenden (alle Formulare): WhatsApp, und nur bei gesetztem Formspree zusätzlich per E-Mail
$$(".js-form").forEach(form => form.addEventListener("submit", ev => {
  ev.preventDefault();
  const status = $(".form__status", form);
  const scope = $(".fstep.is-active", form) || form;
  if (!validate(scope)) { status.textContent = "Bitte füllen Sie alle Pflichtfelder (*) aus."; return; }
  const data = new FormData(form);
  if (String(data.get("website") || "").trim()) return;
  const number = String(CFG.whatsapp || "491784444510").replace(/\D/g, "");
  const text = whatsAppMessage(form, data);
  openWhatsApp(`https://wa.me/${number}?text=${encodeURIComponent(text)}`);
  if (CFG.formspree) {
    data.append("formular", form.dataset.name || "Anfrage");
    fetch(`https://formspree.io/f/${CFG.formspree}`, { method: "POST", body: data, headers: { Accept: "application/json" } }).catch(() => {});
  }
  status.textContent = `WhatsApp öffnet sich – bitte dort nur noch auf Senden tippen. Kein WhatsApp? Ruf an: ${CFG.phone || "0178 4444510"}`;
}));

$$(".js-year").forEach(el => el.textContent = new Date().getFullYear());

// 3D tilt and hero parallax. Transform and opacity only, one frame at a time.
const touchOnly = matchMedia("(pointer: coarse)").matches || (navigator.maxTouchPoints > 0 && matchMedia("(hover: none)").matches);
if (!reduce && !touchOnly) {
  $$(".card, .price-card, .shot, .tile, .cat, .map, .tire-photo:not(.tire-photo--sm)").forEach(el => {
    el.classList.add("tilt");
    const glare = document.createElement("span");
    glare.className = "glare";
    glare.setAttribute("aria-hidden", "true");
    el.appendChild(glare);
    const max = el.classList.contains("map") ? 3.2 : 6;
    let raf = 0, px = 0, py = 0, active = false;
    const paint = () => {
      raf = 0;
      if (!active) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const rx = (0.5 - py / r.height) * max * 2;
      const ry = (px / r.width - 0.5) * max * 2;
      el.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translate3d(0,-4px,0)`;
      glare.style.setProperty("--gx", `${(px / r.width * 100).toFixed(1)}%`);
      glare.style.setProperty("--gy", `${(py / r.height * 100).toFixed(1)}%`);
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(paint); };
    el.addEventListener("pointerenter", e => {
      if (e.pointerType && e.pointerType !== "mouse") return;
      active = true;
      el.classList.add("is-tilting");
      el.style.willChange = "transform";
    });
    el.addEventListener("pointermove", e => {
      if (!active || (e.pointerType && e.pointerType !== "mouse")) return;
      const r = el.getBoundingClientRect();
      px = e.clientX - r.left;
      py = e.clientY - r.top;
      queue();
    });
    const rest = () => {
      active = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      el.classList.remove("is-tilting");
      el.style.transform = "";
      el.style.willChange = "";
    };
    el.addEventListener("pointerleave", rest);
    el.addEventListener("blur", rest, true);
  });
}

if (!reduce) {
  const heroes = $$(".hero--photo");
  if (heroes.length) {
    let raf = 0, mx = 0, my = 0;
    const paint = () => {
      raf = 0;
      heroes.forEach(hero => {
        const img = $(".hero__bg img", hero);
        if (!img) return;
        const passed = Math.max(0, -hero.getBoundingClientRect().top);
        const sy = Math.min(36, passed * 0.22);
        img.style.transform = `translate3d(${mx.toFixed(1)}px, ${(sy + my).toFixed(1)}px, 0) scale(1.2)`;
      });
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(paint); };
    addEventListener("scroll", queue, { passive: true });
    if (!touchOnly) {
      heroes.forEach(hero => {
        hero.addEventListener("pointermove", e => {
          if (e.pointerType && e.pointerType !== "mouse") return;
          const r = hero.getBoundingClientRect();
          mx = ((e.clientX - r.left) / r.width - 0.5) * -14;
          my = ((e.clientY - r.top) / r.height - 0.5) * -8;
          queue();
        });
        hero.addEventListener("pointerleave", () => { mx = 0; my = 0; queue(); });
      });
    }
    queue();
  }
}


// Kategorie-Wechsler: aktive Kategorie sichtbar halten, Reifenwechsel beim Scrollen hervorheben
$$(".catbar__pills").forEach(bar => {
  const center = () => {
    const a = $("[aria-current]", bar);
    if (a) bar.scrollLeft = a.offsetLeft - (bar.clientWidth - a.offsetWidth) / 2;
  };
  center();
  const m = $('[data-cat="mietwerkstatt"]', bar), r = $('[data-cat="reifen"]', bar), sec = $("#reifenwechsel");
  if (m && r && sec && m.hasAttribute("aria-current") && "IntersectionObserver" in window) {
    new IntersectionObserver(es => es.forEach(e => {
      const on = e.isIntersecting;
      (on ? r : m).setAttribute("aria-current", "page");
      (on ? m : r).removeAttribute("aria-current");
      center();
    }), { rootMargin: "-35% 0px -55% 0px" }).observe(sec);
  }
});
