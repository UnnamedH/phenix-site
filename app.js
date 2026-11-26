(function () {
  "use strict";

  var nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
  var df = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

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

  // Family names are brand names: keep them out of automatic translation.
  function nameSpan(name) {
    return el("span", { translate: "no" }, name);
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
      return { name: k ? k.name : String(r[nameCol]).trim(), image: k && k.image, scores: scores };
    });
    if (patrols.length) data.patrols = patrols;
    data.updated = null;
    return data;
  }

  function rank(data) {
    var active = data.criteria.filter(function (c) { return !c.locked; });
    var useAverage = data.ranking === "average";
    var list = (data.patrols || []).filter(function (p) {
      return p && String(p.name || "").trim();
    }).map(function (p) {
      var sum = active.reduce(function (s, c) { return s + toNumber((p.scores || {})[c.id]); }, 0);
      return {
        name: String(p.name).trim(),
        image: p.image,
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

  function renderThrone(list, data) {
    var box = document.getElementById("throne");
    box.textContent = "";
    var card = el("div", { "class": "throne-card" });
    var top = list[0];
    var leaders = list.filter(function (p) { return p.rank === 1; });

    if (!top || top.value === 0) {
      card.appendChild(el("p", { "class": "throne-name" }, "Le trône est vacant"));
      card.appendChild(el("p", { "class": "throne-meta" }, "Aucun point n’a encore été attribué. Que la compétition commence."));
    } else if (leaders.length > 1) {
      var names = el("p", { "class": "throne-name" });
      leaders.forEach(function (p, i) {
        if (i) names.appendChild(document.createTextNode(" & "));
        names.appendChild(nameSpan(p.name));
      });
      card.appendChild(names);
      card.appendChild(el("p", { "class": "throne-meta" }, "Égalité à " + nf.format(top.value) + " points. Le trône vacille."));
    } else {
      var gap = list[1] ? top.value - list[1].value : top.value;
      card.appendChild(el("p", { "class": "throne-name", translate: "no" }, top.name));
      var meta = el("p", { "class": "throne-meta" },
        nf.format(top.value) + " points · " + nf.format(gap) + " d’avance sur ");
      meta.appendChild(list[1] ? nameSpan(list[1].name) : document.createTextNode("personne"));
      card.appendChild(meta);
    }
    box.appendChild(card);
  }

  // Bar scale per criterion: its "max" from the data file if set, otherwise the
  // best score among the families (so the leader in that criterion fills the bar).
  function scaleFor(c, list) {
    if (c.max > 0) return c.max;
    return list.reduce(function (m, p) { return Math.max(m, toNumber(p.scores[c.id])); }, 0);
  }

  function media(p, aboveFold) {
    var box = el("div", { "class": "card-media" });
    var mono = el("span", { "class": "monogram", "aria-hidden": "true" }, p.name.charAt(0).toUpperCase());
    box.appendChild(mono);
    if (p.image) {
      var img = el("img", { src: p.image, alt: "Emblème de la famille " + p.name, width: "640", height: "400", decoding: "async" });
      if (aboveFold) img.setAttribute("fetchpriority", "high");
      else img.setAttribute("loading", "lazy");
      img.addEventListener("error", function () { img.remove(); });
      box.appendChild(img);
    }
    return box;
  }

  function renderCards(list, data) {
    var ol = document.getElementById("cards");
    ol.textContent = "";
    var scales = {};
    data.criteria.forEach(function (c) { if (!c.locked) scales[c.id] = scaleFor(c, list); });
    var unit = data.ranking === "average" ? "moy." : "pts";
    var fills = [];

    list.forEach(function (p, i) {
      var isLeader = p.rank === 1 && p.value > 0;
      var li = el("li", { "class": "card" + (isLeader ? " leader" : "") });

      var m = media(p, i < 2);
      var badge = el("span", { "class": "rank" });
      badge.appendChild(el("span", { "aria-hidden": "true" }, (isLeader ? "👑 " : "#") + p.rank));
      badge.appendChild(el("span", { "class": "sr-only" }, "Rang " + p.rank + (isLeader ? ", sur le trône" : "")));
      m.appendChild(badge);
      li.appendChild(m);

      var body = el("div", { "class": "card-body" });
      var head = el("div", { "class": "card-head" });
      head.appendChild(el("h3", { "class": "card-name", translate: "no" }, p.name));
      var total = el("p", { "class": "card-total" }, nf.format(p.value) + " ");
      total.appendChild(el("span", null, unit));
      head.appendChild(total);
      body.appendChild(head);

      var stats = el("ul", { "class": "stats" });
      data.criteria.forEach(function (c) {
        var item = el("li", { "class": "stat" + (c.locked ? " locked" : "") });
        var row = el("div", { "class": "stat-row" });
        var label = withIcon(c.locked ? "🔒" : "", c.label);
        if (c.locked) label.appendChild(el("span", { "class": "sr-only" }, " (verrouillé)"));
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
        stats.appendChild(item);
      });
      body.appendChild(stats);
      li.appendChild(body);
      ol.appendChild(li);
    });

    // Grow the bars after the first paint.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        fills.forEach(function (f) { f[0].style.setProperty("--p", f[1]); });
      });
    });

    var updated = document.getElementById("updated");
    if (data.updated) {
      updated.textContent = "Mis à jour le " + df.format(new Date(data.updated + "T12:00:00"));
    } else {
      updated.textContent = "Données en direct depuis la feuille de calcul.";
    }
  }

  function renderCriteria(data) {
    var ul = document.getElementById("criteria");
    ul.textContent = "";
    data.criteria.forEach(function (c) {
      var li = el("li", c.locked ? { "class": "locked" } : null);
      li.appendChild(withIcon(c.locked ? "🔒" : "", c.label));
      li.appendChild(el("span", null, c.locked ? "Révélé plus tard" : (c.hint || "")));
      ul.appendChild(li);
    });
  }

  function render(data) {
    var list = rank(data);
    renderThrone(list, data);
    renderCards(list, data);
    renderCriteria(data);
  }

  function showError() {
    var box = document.getElementById("throne");
    box.textContent = "";
    box.appendChild(el("p", { "class": "muted" },
      "Impossible de charger le classement. Vérifiez votre connexion puis rechargez la page."));
  }

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
