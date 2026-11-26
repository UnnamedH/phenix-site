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

  // ── Pixel art ──────────────────────────────────────────────
  // Sprites are drawn from strings: one character per pixel, "." = transparent.
  var INK = "#2b1d14";

  var KNIGHT = [
    "....kkkk....",
    "...khhhhk...",
    "..khhhhhhk..",
    "..khkkkkhk..",
    "..khhhhhhk..",
    "..kkkkkkkk..",
    ".kcccccccck.",
    "khcccggccchk",
    "khccggggcchk",
    "khcccggccchk",
    "kkcccccccckk",
    ".kddddddddk.",
    "..kcccccck..",
    "..khhkkhhk..",
    "..khk..khk..",
    "..kkk..kkk.."
  ];

  var THRONE = [
    "...kk......kk...",
    "..kggk....kggk..",
    "..kgGkkkkkkGgk..",
    "..kgGrrrrrrGgk..",
    "..kgGrrrrrrGgk..",
    "..kgGrrrrrrGgk..",
    "..kgGrrrrrrGgk..",
    "..kgGrrrrrrGgk..",
    "..kgGrrrrrrGgk..",
    ".kkgkkkkkkkkgkk.",
    "kggggggggggggggk",
    "kGGGGGGGGGGGGGGk",
    ".kgGrrrrrrrrGgk.",
    ".kgGrrrrrrrrGgk.",
    ".kgkkkkkkkkkkgk.",
    ".kgk........kgk.",
    ".kgk........kgk.",
    ".kGk........kGk.",
    ".kkk........kkk."
  ];

  var CROWN = [
    "g..g..g",
    "gg.g.gg",
    "ggggggg",
    "grgggrg"
  ];

  var FLAME = [
    "..y..",
    ".yoy.",
    ".ooo.",
    "orroo",
    ".ooo."
  ];

  var DIGITS = {
    1: [".k.", "kk.", ".k.", ".k.", "kkk"],
    2: ["kk.", "..k", ".k.", "k..", "kkk"],
    3: ["kk.", "..k", ".k.", "..k", "kk."],
    4: ["k.k", "k.k", "kkk", "..k", "..k"]
  };

  function shade(hex, f) {
    var h = hex.replace("#", "");
    if (h.length === 3) h = h.replace(/./g, "$&$&");
    var n = parseInt(h.slice(0, 6), 16);
    var r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
    return "rgb(" + Math.min(255, r) + "," + Math.min(255, g) + "," + Math.min(255, b) + ")";
  }

  function rect(x, y, w, h, fill) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + fill + '"/>';
  }

  // Draw a sprite, merging horizontal runs of the same colour into one rect.
  function sprite(rows, pal, x, y) {
    var out = "";
    rows.forEach(function (row, j) {
      var i = 0;
      while (i < row.length) {
        var ch = row[i], k = i;
        while (k < row.length && row[k] === ch) k++;
        if (ch !== "." && pal[ch]) out += rect(x + i, y + j, k - i, 1, pal[ch]);
        i = k;
      }
    });
    return out;
  }

  function knightPal(color) {
    return { k: INK, h: "#c9ced6", c: color, d: shade(color, 0.6), g: "#ffd86b" };
  }

  function colorOf(p) {
    return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(p.color || "") ? p.color : "#e0a526";
  }

  function banner(x, y, w, h, color, withCrown) {
    var s = rect(x - 1, y, w + 2, 1, "#e0a526") + rect(x, y + 1, w, h - 3, color) +
      rect(x, y + 1, 1, h - 3, shade(color, 0.75));
    // pointed bottom
    for (var j = 0; j < 3; j++) {
      var inset = j + 1;
      s += rect(x, y + h - 2 + j - 1, Math.floor(w / 2) - inset + 1, 1, color);
      s += rect(x + Math.ceil(w / 2) + inset - 1, y + h - 2 + j - 1, Math.floor(w / 2) - inset + 1, 1, color);
    }
    if (withCrown) s += sprite(CROWN, { g: "#ffd86b", r: "#b83a2b" }, x + Math.floor((w - 7) / 2), y + 8);
    else s += rect(x + Math.floor(w / 2) - 1, y + 6, 2, 2, "#ffd86b");
    return s;
  }

  function block(x, y, w, h) {
    return rect(x, y, w, h, INK) + rect(x + 1, y + 1, w - 2, h - 1, "#9aa1ae") +
      rect(x + 1, y + 1, w - 2, 1, "#c8cdd6") + rect(x + 1, y + 4, w - 2, 1, "#7d8494");
  }

  // Spots where the families appear: [x, y of the sprite's top-left].
  var SPOT = {
    throne: [74, 33], podL: [28, 54], podR: [120, 60],
    floorR: [143, 76], floorL: [5, 76], floorA: [26, 74], floorB: [46, 74], floorC: [102, 74], floorD: [122, 74]
  };

  function buildScene(list) {
    var W = 160, H = 96;
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="scene-desc">' +
      '<desc id="scene-desc"></desc>' +
      '<defs>' +
      '<pattern id="brick" width="16" height="8" patternUnits="userSpaceOnUse">' +
        rect(0, 0, 16, 8, "#7d8494") + rect(0, 3, 16, 1, "#666c7a") + rect(0, 7, 16, 1, "#666c7a") +
        rect(7, 0, 1, 3, "#666c7a") + rect(15, 4, 1, 3, "#666c7a") + rect(0, 0, 7, 1, "#8b92a1") + rect(8, 4, 7, 1, "#8b92a1") +
      '</pattern>' +
      '<pattern id="tile" width="16" height="8" patternUnits="userSpaceOnUse">' +
        rect(0, 0, 8, 4, "#9b7b5a") + rect(8, 0, 8, 4, "#8a6b4c") + rect(0, 4, 8, 4, "#8a6b4c") + rect(8, 4, 8, 4, "#9b7b5a") +
      '</pattern>' +
      '</defs>';

    // room
    svg += rect(0, 0, W, 64, "url(#brick)") + rect(0, 64, W, H - 64, "url(#tile)");
    svg += rect(0, 0, W, 3, "#3a2a1e") + rect(0, 3, W, 1, INK) + rect(0, 63, W, 1, INK);
    // carpet
    svg += rect(70, 56, 20, 40, "#a3262a") + rect(70, 56, 1, 40, "#e0a526") + rect(89, 56, 1, 40, "#e0a526");

    var top = list[0];
    var holder = top && top.value > 0 && !(list[1] && list[1].value === top.value) ? top : null;

    // big banner behind the throne, in the ruler's colour
    svg += banner(68, 4, 24, 30, holder ? colorOf(holder) : "#6d6470", true);
    // the four family banners on the walls
    var walls = [8, 22, 130, 144];
    list.slice().sort(function (a, b) { return a.order - b.order; }).slice(0, 4).forEach(function (p, i) {
      svg += banner(walls[i], 4, 9, 20, colorOf(p), false);
    });
    // torches
    [54, 102].forEach(function (x) {
      svg += rect(x + 1, 30, 3, 6, "#5a3d26") + rect(x + 1, 30, 3, 1, INK) +
        sprite(FLAME, { y: "#fff3a8", o: "#ffa726", r: "#e5532d" }, x, 25);
    });

    // dais and podiums
    svg += block(54, 56, 52, 8) + block(60, 50, 40, 7);
    svg += sprite(THRONE, { k: INK, g: "#e0a526", G: "#a8741a", r: "#b83a2b" }, 72, 31);

    var spots;
    if (holder) spots = ["throne", "podL", "podR", "floorR"];
    else if (top && top.value > 0) spots = ["podL", "podR", "floorR", "floorL"];
    else spots = ["floorA", "floorB", "floorC", "floorD"];

    if (spots[0] !== "floorA") {
      svg += block(24, 70, 20, 26) + block(116, 76, 20, 20);
    }

    list.slice(0, spots.length).forEach(function (p, i) {
      var at = SPOT[spots[i]];
      svg += sprite(KNIGHT, knightPal(colorOf(p)), at[0], at[1]);
      if (spots[i] === "throne") svg += sprite(CROWN, { g: "#ffd86b", r: "#b83a2b" }, at[0] + 3, at[1] - 5);
      var d = DIGITS[p.rank];
      if (d && spots[i] === "podL") svg += sprite(d, { k: INK }, 33, 80);
      if (d && spots[i] === "podR") svg += sprite(d, { k: INK }, 125, 83);
      if (d && spots[i] === "throne") svg += sprite(d, { k: INK }, 79, 51);
    });

    return { svg: svg + "</svg>", holder: holder };
  }

  function sceneLabel(list, holder) {
    if (!list.length || list[0].value === 0) return "Salle du trône : le trône est vide, les quatre familles attendent.";
    return "Salle du trône : " + list.map(function (p, i) {
      return p.name + (holder && i === 0 ? " sur le trône" : " au rang " + p.rank);
    }).join(", ") + ".";
  }

  function renderThrone(list) {
    var scene = buildScene(list);
    var box = document.getElementById("scene");
    box.innerHTML = scene.svg;
    box.querySelector("desc").textContent = sceneLabel(list, scene.holder);

    var cap = document.getElementById("throne");
    cap.textContent = "";
    var top = list[0];
    if (!top || top.value === 0) {
      cap.textContent = "Le trône est vacant. Que la compétition commence !";
    } else if (!scene.holder) {
      var tied = list.filter(function (p) { return p.rank === 1; });
      cap.appendChild(document.createTextNode("Égalité ! "));
      tied.forEach(function (p, i) {
        if (i) cap.appendChild(document.createTextNode(" & "));
        cap.appendChild(el("strong", { translate: "no" }, p.name));
      });
      cap.appendChild(document.createTextNode(" se disputent le trône."));
    } else {
      cap.appendChild(withIcon("♛", ""));
      cap.appendChild(el("strong", { translate: "no" }, top.name));
      cap.appendChild(document.createTextNode(" règne sur Phoenixia"));
    }
  }

  // ── Family sheets ──────────────────────────────────────────
  // Bar scale per criterion: its "max" from the data file if set, otherwise the
  // best score among the families (so the leader in that criterion fills the bar).
  function scaleFor(c, list) {
    if (c.max > 0) return c.max;
    return list.reduce(function (m, p) { return Math.max(m, toNumber(p.scores[c.id])); }, 0);
  }

  function portrait(p, eager) {
    var box = el("div", { "class": "portrait" });
    box.innerHTML = '<svg viewBox="0 0 12 16" aria-hidden="true">' + sprite(KNIGHT, knightPal(colorOf(p)), 0, 0) + "</svg>";
    if (p.image) {
      var img = el("img", { src: p.image, alt: "Emblème de la famille " + p.name, width: "72", height: "72", decoding: "async" });
      if (eager) img.setAttribute("fetchpriority", "high"); else img.setAttribute("loading", "lazy");
      img.hidden = true;
      img.addEventListener("load", function () { box.textContent = ""; img.hidden = false; box.appendChild(img); });
      box.appendChild(img);
    }
    return box;
  }

  function ordinal(n) { return n === 1 ? "1er" : n + "e"; }

  function renderSheets(list, data, holder) {
    var ol = document.getElementById("sheets");
    ol.textContent = "";
    var scales = {};
    data.criteria.forEach(function (c) { if (!c.locked) scales[c.id] = scaleFor(c, list); });
    var unit = data.ranking === "average" ? "moyenne" : "points";
    var fills = [];

    list.forEach(function (p, i) {
      var onThrone = holder && p === holder;
      var li = el("li", { "class": "sheet px" + (onThrone ? " leader" : "") });
      li.style.setProperty("--c", colorOf(p));

      var head = el("div", { "class": "sheet-head" });
      head.appendChild(portrait(p, i < 2));
      var title = el("div", { "class": "sheet-title" });
      title.appendChild(el("h3", { "class": "sheet-name", translate: "no" }, p.name));
      var started = list[0] && list[0].value > 0;
      title.appendChild(el("p", { "class": "sheet-rank" },
        !started ? "En attente" : onThrone ? "♛ Sur le trône" : ordinal(p.rank) + " place"));
      head.appendChild(title);
      var total = el("p", { "class": "sheet-total" }, nf.format(p.value));
      total.appendChild(el("small", null, unit));
      head.appendChild(total);
      li.appendChild(head);

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
      var li = el("li", { "class": "quest px" + (c.locked ? " locked" : "") });
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
    var holder = list[0] && list[0].value > 0 && !(list[1] && list[1].value === list[0].value) ? list[0] : null;
    renderThrone(list);
    renderSheets(list, data, holder);
    renderCriteria(data);
  }

  function showError() {
    document.getElementById("throne").textContent =
      "Impossible de charger le classement. Vérifiez votre connexion puis rechargez la page.";
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
