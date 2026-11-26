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
    return String(s).trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function toNumber(v) {
    var n = parseFloat(String(v).replace(",", "."));
    return isFinite(n) ? n : 0;
  }

  // Replace the JSON scores with the ones found in the published Google Sheet.
  function applySheet(data, csv) {
    var rows = parseCsv(csv);
    if (rows.length < 2) return data;
    var header = rows[0].map(norm);
    var colFor = {};
    data.criteria.forEach(function (c) {
      var idx = header.indexOf(norm(c.id));
      if (idx < 0) idx = header.indexOf(norm(c.label));
      if (idx > 0) colFor[c.id] = idx;
    });
    var patrols = rows.slice(1).map(function (r) {
      var scores = {};
      for (var id in colFor) scores[id] = toNumber(r[colFor[id]]);
      return { name: r[0].trim(), scores: scores };
    }).filter(function (p) { return p.name; });
    if (patrols.length) data.patrols = patrols;
    data.updated = null;
    return data;
  }

  function rank(data) {
    var active = data.criteria.filter(function (c) { return !c.locked; });
    var useAverage = data.ranking === "average";
    var list = data.patrols.map(function (p) {
      var sum = active.reduce(function (s, c) { return s + toNumber((p.scores || {})[c.id]); }, 0);
      return {
        name: p.name,
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
      card.appendChild(el("p", { "class": "throne-name" }, leaders.map(function (p) { return p.name; }).join(" & ")));
      card.appendChild(el("p", { "class": "throne-meta" }, "Égalité à " + nf.format(top.value) + " points. Le trône vacille."));
    } else {
      var gap = list[1] ? top.value - list[1].value : top.value;
      card.appendChild(el("p", { "class": "throne-name" }, top.name));
      card.appendChild(el("p", { "class": "throne-meta" },
        nf.format(top.value) + " points · " + nf.format(gap) + " d’avance sur " + (list[1] ? list[1].name : "personne")));
    }
    box.appendChild(card);
  }

  function renderTable(list, data) {
    var table = document.getElementById("board");
    var thead = table.tHead, tbody = table.tBodies[0];
    thead.textContent = ""; tbody.textContent = "";

    var hr = el("tr");
    hr.appendChild(el("th", { scope: "col" }, "#"));
    hr.appendChild(el("th", { scope: "col" }, "Famille"));
    data.criteria.forEach(function (c) {
      var th = el("th", { scope: "col" }, c.locked ? "🔒" : c.label);
      if (c.locked) { th.className = "locked"; th.setAttribute("aria-label", c.label + " (verrouillé)"); th.title = "Bientôt"; }
      hr.appendChild(th);
    });
    hr.appendChild(el("th", { scope: "col" }, data.ranking === "average" ? "Moyenne" : "Total"));
    thead.appendChild(hr);

    list.forEach(function (p) {
      var tr = el("tr", p.rank === 1 && p.value > 0 ? { "class": "leader" } : null);
      tr.appendChild(el("td", null, String(p.rank)));
      tr.appendChild(el("th", { scope: "row", translate: "no" }, p.name));
      data.criteria.forEach(function (c) {
        if (c.locked) {
          tr.appendChild(el("td", { "class": "locked", "aria-label": "verrouillé" }, "—"));
        } else {
          tr.appendChild(el("td", null, nf.format(toNumber(p.scores[c.id]))));
        }
      });
      tr.appendChild(el("td", { "class": "total" }, nf.format(p.value)));
      tbody.appendChild(tr);
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
      li.appendChild(el("span", null, c.locked ? "🔒 " + c.label : c.label));
      li.appendChild(el("span", null, c.locked ? "Révélé plus tard" : (c.hint || "")));
      ul.appendChild(li);
    });
  }

  function render(data) {
    var list = rank(data);
    renderThrone(list, data);
    renderTable(list, data);
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
