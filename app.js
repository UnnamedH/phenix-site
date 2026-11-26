(function () {
  "use strict";

  var nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
  var df = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });
  var tf = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) for (var k in attrs) node.setAttribute(k, attrs[k]);
    if (text != null) node.textContent = text;
    return node;
  }

  // Decorative emoji are hidden from screen readers; the text next to them carries the meaning.
  function withIcon(icon, text, attrs) {
    var node = el("span", attrs || null);
    if (icon) node.appendChild(el("span", { "aria-hidden": "true" }, icon + " "));
    node.appendChild(document.createTextNode(text));
    return node;
  }

  // Minimal CSV parser (handles quoted fields, commas and newlines inside quotes).
  function parseCsv(text) {
    var rows = [], row = [], field = "", inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') inQuotes = false;
        else field += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); rows.push(row); row = []; field = "";
      } else field += c;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (v) { return v.trim() !== ""; }); });
  }

  function norm(s) {
    return String(s == null ? "" : s).trim().toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\s_-]+/g, "");
  }

  function toNumber(v) {
    var n = parseFloat(String(v).replace(",", "."));
    return isFinite(n) ? n : 0;
  }

  // Replace the JSON scores with the ones found in the published Google Sheet.
  // The sheet layout is forgiving: blank rows/columns are fine, the family column
  // is found by its names, the header row is the row just above the first family,
  // and a criterion column can be titled with its id, label or any of its "aliases".
  function applySheet(data, csv) {
    var rows = parseCsv(csv);
    var known = {};
    data.patrols.forEach(function (p) { known[norm(p.name)] = p; });

    // Family column: the one where the most cells are known family names.
    var width = rows.reduce(function (w, r) { return Math.max(w, r.length); }, 0);
    var nameCol = -1, best = 0;
    for (var c = 0; c < width; c++) {
      var hits = rows.filter(function (r) { return known[norm(r[c])]; }).length;
      if (hits > best) { best = hits; nameCol = c; }
    }
    if (nameCol < 0) return data;

    var first = rows.findIndex(function (r) { return known[norm(r[nameCol])]; });
    if (first < 1) return data;
    var header = rows[first - 1].map(norm);

    var colFor = {};
    data.criteria.forEach(function (crit) {
      var names = [crit.id, crit.label].concat(crit.aliases || []).map(norm);
      var idx = header.findIndex(function (h, i) { return i !== nameCol && h && names.indexOf(h) >= 0; });
      if (idx >= 0) colFor[crit.id] = idx;
    });

    var patrols = rows.slice(first).filter(function (r) { return norm(r[nameCol]); }).map(function (r) {
      var k = known[norm(r[nameCol])];
      var scores = {};
      for (var id in colFor) scores[id] = toNumber(r[colFor[id]]);
      return Object.assign({}, k || {}, { name: k ? k.name : String(r[nameCol]).trim(), scores: scores });
    });
    if (patrols.length) data.patrols = patrols;
    data.updated = null;
    return data;
  }

  function rank(data) {
    var active = data.criteria.filter(function (c) { return !c.locked; });
    var useAverage = data.ranking === "average";
    var list = (data.patrols || []).map(function (p, i) {
      return p ? Object.assign({ order: i }, p) : p;
    }).filter(function (p) {
      return p && String(p.name || "").trim();
    }).map(function (p) {
      var sum = active.reduce(function (s, c) { return s + toNumber((p.scores || {})[c.id]); }, 0);
      return {
        name: String(p.name).trim(),
        image: p.image,
        color: p.color,
        order: p.order,
        scores: p.scores || {},
        value: useAverage && active.length ? sum / active.length : sum
      };
    });
    list.sort(function (a, b) { return b.value - a.value || a.name.localeCompare(b.name, "fr"); });
    // Shared rank on ties (1, 1, 3, 4).
    list.forEach(function (p, i) {
      p.rank = i > 0 && p.value === list[i - 1].value ? list[i - 1].rank : i + 1;
    });
    return list;
  }

  var Art = window.PhenixArt;

  function colorOf(p) {
    return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(p.color || "") ? p.color : "#e0a526";
  }

  // ── Kingdom background ─────────────────────────────────────
  // Paint once with the default family colours (so the flags are there
  // immediately), then repaint with the colours from the data.
  function paintKingdom(patrols) {
    var canvas = document.getElementById("kingdom");
    var colors = ["#d83a2e", "#8e4ec6", "#2f7fe0", "#2fa84f"];
    (patrols || []).slice(0, 4).forEach(function (p, i) { if (p) colors[i] = colorOf(p); });
    if (Art && canvas) Art.paintKingdom(canvas, colors);
  }

  // ── Throne ─────────────────────────────────────────────────
  // The throne stays empty until data.throne names a family.
  function renderThrone(list, data) {
    var holderName = String(data.throne || "").trim();
    var holder = list.filter(function (p) { return norm(p.name) === norm(holderName); })[0];
    var art = document.getElementById("throne-art");
    if (Art) Art.paintThrone(art, holder ? colorOf(holder) : null);
    art.setAttribute("aria-label", holder ? "Le trône royal, aux couleurs de " + holder.name : "Le trône royal, vide");

    var state = document.getElementById("throne");
    state.textContent = "";
    if (holder) {
      state.appendChild(el("span", { translate: "no" }, holder.name));
      state.appendChild(document.createTextNode(" règne sur Phoenixia"));
    } else {
      state.textContent = "Le trône est vide";
    }
  }

  // ── Ranking ────────────────────────────────────────────────
  // Bar scale per criterion: its "max" from the data file if set, otherwise the
  // best score among the families (so the leader in that criterion fills the bar).
  function scaleFor(c, list) {
    if (c.max > 0) return c.max;
    return list.reduce(function (m, p) { return Math.max(m, toNumber(p.scores[c.id])); }, 0);
  }

  function crest(p, eager) {
    var canvas = el("canvas", { "class": "crest", "aria-hidden": "true" });
    if (Art) Art.paintCrest(canvas, colorOf(p));
    if (!p.image) return canvas;
    var img = el("img", { "class": "crest-img", src: p.image, alt: "", width: "48", height: "48", decoding: "async" });
    if (eager) img.setAttribute("fetchpriority", "high"); else img.setAttribute("loading", "lazy");
    img.hidden = true;
    img.addEventListener("load", function () { img.hidden = false; canvas.remove(); });
    img.addEventListener("error", function () { img.remove(); });
    var frag = document.createDocumentFragment();
    frag.appendChild(canvas);
    frag.appendChild(img);
    return frag;
  }

  function ordinal(n) { return n === 1 ? "1re place" : n + "e place"; }

  function renderRanks(list, data) {
    var ol = document.getElementById("ranks");
    ol.textContent = "";
    var scales = {};
    data.criteria.forEach(function (c) { if (!c.locked) scales[c.id] = scaleFor(c, list); });
    var unit = data.ranking === "average" ? "moyenne" : "points";
    var started = list[0] && list[0].value > 0;
    var fills = [];

    list.forEach(function (p, i) {
      var li = el("li", { "class": "rank" });
      li.style.setProperty("--c", colorOf(p));

      li.appendChild(el("p", { "class": "rank-num", "aria-hidden": "true" }, started ? String(p.rank) : "–"));
      li.appendChild(crest(p, i < 2));
      var name = el("div", { "class": "rank-name" });
      name.appendChild(el("h3", { translate: "no" }, p.name));
      var tied = list.filter(function (q) { return q.rank === p.rank; }).length > 1;
      name.appendChild(el("p", null, !started ? "En attente" : ordinal(p.rank) + (tied ? " (ex æquo)" : "")));
      li.appendChild(name);
      var total = el("p", { "class": "rank-total" }, nf.format(p.value));
      total.appendChild(el("small", null, unit));
      li.appendChild(total);

      var ul = el("ul", { "class": "stats" });
      data.criteria.forEach(function (c) {
        var item = el("li", { "class": "stat" + (c.locked ? " locked" : "") });
        var row = el("div", { "class": "stat-row" });
        var label = withIcon(c.locked ? "🔒" : "", c.locked ? "???" : c.label);
        if (c.locked) label.appendChild(el("span", { "class": "sr-only" }, " (critère verrouillé)"));
        row.appendChild(label);
        var v = toNumber(p.scores[c.id]);
        var max = scales[c.id];
        row.appendChild(el("span", null, c.locked ? "Bientôt" : nf.format(v) + (c.max > 0 ? " / " + nf.format(c.max) : "")));
        item.appendChild(row);
        var bar = el("div", { "class": "bar" });
        if (c.locked) {
          bar.setAttribute("aria-hidden", "true");
        } else {
          bar.setAttribute("role", "meter");
          bar.setAttribute("aria-label", c.label + " — " + p.name);
          bar.setAttribute("aria-valuemin", "0");
          bar.setAttribute("aria-valuemax", String(max || 1));
          bar.setAttribute("aria-valuenow", String(v));
          var fill = el("div", { "class": "bar-fill" });
          bar.appendChild(fill);
          fills.push([fill, max > 0 ? Math.min(1, Math.max(0, v / max)) : 0]);
        }
        item.appendChild(bar);
        ul.appendChild(item);
      });
      li.appendChild(ul);
      ol.appendChild(li);
    });

    // Fill the bars after the first paint.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        fills.forEach(function (f) { f[0].style.setProperty("--p", f[1]); });
      });
    });

    var updated = document.getElementById("updated");
    updated.textContent = data.updated
      ? "Mis à jour le " + df.format(new Date(data.updated + "T12:00:00"))
      : "En direct depuis la feuille de calcul · " + tf.format(new Date());
  }

  function renderCriteria(data) {
    var ul = document.getElementById("criteria");
    ul.textContent = "";
    data.criteria.forEach(function (c) {
      var li = el("li", { "class": "quest" + (c.locked ? " locked" : "") });
      var name = el("span", { "class": "quest-name" });
      name.appendChild(withIcon(c.locked ? "🔒" : "", c.locked ? "???" : c.label));
      if (c.locked) name.appendChild(el("span", { "class": "sr-only" }, " (critère verrouillé)"));
      li.appendChild(name);
      li.appendChild(el("span", { "class": "quest-hint" }, c.locked ? "Révélé plus tard" : (c.hint || "")));
      ul.appendChild(li);
    });
  }

  function render(data) {
    var list = rank(data);
    paintKingdom(data.patrols);
    renderThrone(list, data);
    renderRanks(list, data);
    renderCriteria(data);
  }

  function showError() {
    document.getElementById("throne").textContent = "Le trône est vide";
    var ol = document.getElementById("ranks");
    ol.textContent = "";
    ol.appendChild(el("li", { "class": "quest" },
      "Impossible de charger le classement. Vérifiez votre connexion puis rechargez la page."));
  }

  // Fade the background a little more as the page scrolls.
  (function () {
    var root = document.documentElement, ticking = false;
    function update() {
      ticking = false;
      var f = Math.min(1, Math.max(0, window.scrollY / 500));
      root.style.setProperty("--fade", f.toFixed(3));
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  })();

  paintKingdom();
  if (Art) Art.paintThrone(document.getElementById("throne-art"), null);

  var cfg = window.PHENIX_CONFIG || {};
  fetch("data/patrols.json", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      if (!cfg.SHEET_CSV_URL) return data;
      return fetch(cfg.SHEET_CSV_URL, { cache: "no-cache" })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(function (csv) { return applySheet(data, csv); })
        .catch(function () { return data; }); // fall back to the JSON scores
    })
    .then(render)
    .catch(showError);
})();
