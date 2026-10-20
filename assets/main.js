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
  el.textContent = (open ? "Jetzt geöffnet · " : "Gerade geschlossen · ") + "Mo–Fr 9:30–18:00 · Sa 9:00–16:00";
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

// Absenden (alle Formulare)
$$(".js-form").forEach(form => form.addEventListener("submit", async ev => {
  ev.preventDefault();
  const status = $(".form__status", form);
  const scope = $(".fstep.is-active", form) || form;
  if (!validate(scope)) { status.textContent = "Bitte füllen Sie alle Pflichtfelder (*) aus."; return; }
  const data = new FormData(form);
  data.append("formular", form.dataset.name || "Anfrage");
  if (CFG.formspree) {
    status.textContent = "Wird gesendet …";
    try {
      const r = await fetch(`https://formspree.io/f/${CFG.formspree}`, { method: "POST", body: data, headers: { Accept: "application/json" } });
      if (!r.ok) throw 0;
      form.reset(); status.textContent = "Danke! Ihre Anfrage ist angekommen – wir melden uns.";
    } catch { status.textContent = `Senden fehlgeschlagen – bitte rufen Sie an: ${CFG.phone}`; }
    return;
  }
  if (CFG.email) {
    const zust = data.getAll("zustand").join(", ");
    const lines = [...data.entries()].filter(([k, v]) => !["datenschutz", "zustand"].includes(k) && typeof v === "string" && v).map(([k, v]) => `${k}: ${v}`);
    if (zust) lines.push(`zustand: ${zust}`);
    location.href = `mailto:${CFG.email}?subject=${encodeURIComponent(form.dataset.name || "Anfrage")}&body=${encodeURIComponent(lines.join("\n"))}`;
    status.textContent = "Ihr E-Mail-Programm öffnet sich … (Fotos bitte dort anhängen)";
    return;
  }
  status.textContent = `Vorschau: Versand noch nicht eingerichtet. Bitte rufen Sie an: ${CFG.phone}`;
}));

$$(".js-year").forEach(el => el.textContent = new Date().getFullYear());
