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
      return Object.assign({}, k || {}, { name: k ? k.name : String(r[nameCol]).trim(), scores: scores });
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
        color: p.color,
        emblem: p.emblem,
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

  // Line-art emblems (64×64, stroked with the family colour).
  var EMBLEMS = {
    tower: '<path d="M18 56V26h28v30M14 26h36M18 26v-8h6v4h5v-4h6v4h5v-4h6v8"/><path d="M28 56V44a4 4 0 0 1 8 0v12M12 56h40"/><path d="M24 33h4M36 33h4"/>',
    crown: '<path d="M12 46 9 20l13 11 10-17 10 17 13-11-3 26Z"/><path d="M12 52h40"/><circle cx="32" cy="38" r="3"/><circle cx="9" cy="20" r="2"/><circle cx="32" cy="14" r="2"/><circle cx="55" cy="20" r="2"/>',
    sword: '<path d="M32 6v36M27 11l5-5 5 5v31h-10Z"/><path d="M18 42h28M32 42v8"/><circle cx="32" cy="54" r="4"/>',
    hourglass: '<path d="M18 8h28M18 56h28M21 8c0 14 22 14 22 24S21 42 21 56M43 8c0 14-22 14-22 24s22 10 22 24"/><path d="M27 50h10l-5-6Z"/>',
    shield: '<path d="M32 8 12 15v15c0 13 9 22 20 26 11-4 20-13 20-26V15Z"/><path d="M32 8v48M12 30h40"/>'
  };

  function emblem(p, opts) {
    var box = el("div", { "class": "emblem" });
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = EMBLEMS[p.emblem] || EMBLEMS.shield;
    box.appendChild(svg);
    if (p.image && opts && opts.image) {
      var img = el("img", { src: p.image, alt: "Emblème de la famille " + p.name, width: "400", height: "400", decoding: "async" });
      if (opts.eager) img.setAttribute("fetchpriority", "high"); else img.setAttribute("loading", "lazy");
      img.addEventListener("load", function () { svg.remove(); });
      img.addEventListener("error", function () { img.remove(); });
      box.insertBefore(img, svg);
      img.style.display = "none";
      img.addEventListener("load", function () { img.style.display = ""; });
    }
    return box;
  }

  function colorOf(p) {
    return /^#[0-9a-f]{3,8}$/i.test(p.color || "") ? p.color : "#e7c17a";
  }

  function renderThrone(list) {
    var pill = document.getElementById("throne");
    pill.textContent = "";
    var top = list[0];
    var leaders = list.filter(function (p) { return p.rank === 1; });
    if (!top || top.value === 0) {
      pill.textContent = "Le trône est vacant";
    } else if (leaders.length > 1) {
      pill.appendChild(document.createTextNode("Égalité au sommet · "));
      leaders.forEach(function (p, i) {
        if (i) pill.appendChild(document.createTextNode(" & "));
        pill.appendChild(nameSpan(p.name));
      });
    } else {
      pill.appendChild(withIcon("♛", "Sur le trône · "));
      pill.appendChild(nameSpan(top.name));
    }
  }

  function renderBanners(list, data) {
    var ul = document.getElementById("banners");
    ul.textContent = "";
    var unit = data.ranking === "average" ? "moy." : "pts";
    // Banners keep the families' fixed order so they don't jump around.
    var byName = {};
    list.forEach(function (p) { byName[p.name] = p; });
    data.patrols.forEach(function (raw, i) {
      var p = byName[String(raw && raw.name || "").trim()];
      if (!p) return;
      var lead = p.rank === 1 && p.value > 0;
      var li = el("li", { "class": "banner" + (lead ? " leader" : "") });
      li.style.setProperty("--c", colorOf(p));
      if (lead) li.appendChild(withIcon("♛", "", { "class": "banner-crown" })).appendChild(el("span", { "class": "sr-only" }, "Sur le trône"));
      li.appendChild(emblem(p, { image: true, eager: i < 4 }));
      li.appendChild(el("h3", { "class": "banner-name", translate: "no" }, p.name));
      li.appendChild(el("p", { "class": "banner-pts" }, nf.format(p.value) + " " + unit));
      ul.appendChild(li);
    });
  }

  // Bar scale per criterion: its "max" from the data file if set, otherwise the
  // best score among the families (so the leader in that criterion fills the bar).
  function scaleFor(c, list) {
    if (c.max > 0) return c.max;
    return list.reduce(function (m, p) { return Math.max(m, toNumber(p.scores[c.id])); }, 0);
  }

  var PLACES = ["Première place", "Deuxième place", "Troisième place", "Quatrième place", "Cinquième place"];

  function stats(p, data, scales, fills) {
    var ul = el("ul", { "class": "stats" });
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
      ul.appendChild(item);
    });
    return ul;
  }

  function stand(p, list, data, scales, fills, opts) {
    var box = el("div", { "class": "stand" });
    box.style.setProperty("--c", colorOf(p));
    var head = el("div", { "class": "stand-head" });
    head.appendChild(emblem(p, { image: true }));
    var text = el("div");
    text.appendChild(el("h3", { "class": "stand-name", translate: "no" }, p.name));
    text.appendChild(el("p", { "class": "stand-total" }, nf.format(p.value)));
    var gapTo = list[0] && p !== list[0] && list[0].value > p.value ? " · écart : " + nf.format(list[0].value - p.value) : "";
    text.appendChild(el("p", { "class": "stand-meta" }, (data.ranking === "average" ? "moyenne" : "points") + gapTo));
    head.appendChild(text);
    box.appendChild(head);
    box.appendChild(stats(p, data, scales, fills));
    return box;
  }

  function placeNum(p, lead) {
    var n = el("div", { "class": "place-num", "aria-hidden": "true" }, (lead ? "♛ " : "") + p.rank);
    return n;
  }

  function renderBoard(list, data) {
    var board = document.getElementById("board");
    board.textContent = "";
    var scales = {};
    data.criteria.forEach(function (c) { if (!c.locked) scales[c.id] = scaleFor(c, list); });
    var fills = [];
    var started = list.length && list[0].value > 0;

    if (!started) {
      board.appendChild(el("p", { "class": "empty-note" }, "Aucun point n’a encore été attribué. Que la compétition commence."));
    }

    var podiumCount = started ? Math.min(3, list.length) : 0;
    if (podiumCount) {
      var podium = el("ol", { "class": "podium" });
      list.slice(0, podiumCount).forEach(function (p, i) {
        var li = el("li", { "class": "p" + (i + 1) });
        li.appendChild(el("span", { "class": "sr-only" }, "Rang " + p.rank + (p.rank === 1 ? ", sur le trône" : "")));
        li.appendChild(placeNum(p, p.rank === 1));
        li.appendChild(stand(p, list, data, scales, fills));
        li.appendChild(el("div", { "class": "plinth", "aria-hidden": "true" }, PLACES[p.rank - 1] || "Rang " + p.rank));
        podium.appendChild(li);
      });
      board.appendChild(podium);
    }

    var rest = list.slice(podiumCount);
    if (rest.length) {
      var ol = el("ol", { "class": "rows", start: String(podiumCount + 1) });
      rest.forEach(function (p) {
        var li = el("li", { "class": "row" });
        li.appendChild(el("span", { "class": "sr-only" }, "Rang " + p.rank));
        li.appendChild(placeNum(p, false));
        li.appendChild(stand(p, list, data, scales, fills));
        ol.appendChild(li);
      });
      board.appendChild(ol);
    }

    // Grow the bars after the first paint.
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
      var li = el("li", { "class": "tile" + (c.locked ? " locked" : "") });
      var name = el("p", { "class": "tile-name" });
      name.appendChild(withIcon(c.locked ? "🔒" : "", c.locked ? "???" : c.label));
      if (c.locked) name.appendChild(el("span", { "class": "sr-only" }, " (critère verrouillé)"));
      li.appendChild(name);
      li.appendChild(el("p", { "class": "tile-hint" }, c.locked ? "Révélé plus tard" : (c.hint || "")));
      ul.appendChild(li);
    });
  }

  function render(data) {
    var list = rank(data);
    renderThrone(list);
    renderBanners(list, data);
    renderBoard(list, data);
    renderCriteria(data);
  }

  function showError() {
    document.getElementById("throne").textContent = "Classement indisponible";
    var board = document.getElementById("board");
    board.textContent = "";
    board.appendChild(el("p", { "class": "empty-note" },
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
