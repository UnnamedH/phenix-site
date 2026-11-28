// Pixel-art painter for the kingdom background and the throne.
// Everything is drawn at low resolution on a <canvas> and scaled up with
// `image-rendering: pixelated`, so it stays crisp at any size.
(function () {
  "use strict";

  // Small seeded random generator so the landscape looks the same on every visit.
  function rng(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function tools(ctx) {
    function rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
    function px(x, y, c) { rect(x, y, 1, 1, c); }
    function disc(cx, cy, r, c) {
      for (var y = -r; y <= r; y++) {
        var half = Math.floor(Math.sqrt(r * r - y * y + r * 0.6));
        rect(cx - half, cy + y, half * 2 + 1, 1, c);
      }
    }
    // Shaded box: light on top/left, dark on bottom/right, outlined.
    function box(x, y, w, h, base, light, dark, outline) {
      if (outline) rect(x - 1, y - 1, w + 2, h + 2, outline);
      rect(x, y, w, h, base);
      rect(x, y, w, 1, light); rect(x, y, 1, h, light);
      rect(x, y + h - 1, w, 1, dark); rect(x + w - 1, y, 1, h, dark);
    }
    return { rect: rect, px: px, disc: disc, box: box };
  }

  // ── Landscape ────────────────────────────────────────────────
  function layer(w, h) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }

  function paintKingdom(canvas, flagColors) {
    if (canvas._phenixStop) canvas._phenixStop();

    // The scene is drawn on a 400×225 stage; SKY extra rows of sky sit above it
    // so the page title never covers the castle. It is painted in separate layers
    // (sky, sun, clouds, castle & land) so the sky and flags can move.
    var W = 400, H = 225, SKY = 34, FULL = H + SKY;
    canvas.width = W; canvas.height = FULL;
    var out = canvas.getContext("2d");
    var skyL = layer(W, FULL), sunL = layer(W, FULL), sceneL = layer(W, FULL);
    var skyCtx = skyL.getContext("2d"), sunCtx = sunL.getContext("2d"), sceneCtx = sceneL.getContext("2d");
    skyCtx.fillStyle = "#4a8fdc";
    skyCtx.fillRect(0, 0, W, SKY);
    [skyCtx, sunCtx, sceneCtx].forEach(function (g) { g.translate(0, SKY); });

    var rect, px, disc;
    function use(g) { var T = tools(g); rect = T.rect; px = T.px; disc = T.disc; }
    use(skyCtx);
    var rand = rng(7);
    var x, y;
    var flags = [];
    var clouds = [];
    flagColors = (flagColors || []).map(function (c) { return Array.isArray(c) ? c : [c, "#ffd24a"]; });

    // Sky: colour bands with checkerboard dithering between them.
    var sky = ["#4a8fdc", "#5a9be1", "#6ba8e6", "#7db5ea", "#90c2ee", "#a5cff1", "#bbdbf3", "#d2e7f4"];
    var band = 17;
    for (var i = 0; i < sky.length; i++) {
      rect(0, i * band, W, band, sky[i]);
      if (i > 0) for (x = 0; x < W; x++) {
        if (x % 2 === 0) px(x, i * band, sky[i - 1]);
        if (x % 2 === 1) px(x, i * band + 1, sky[i - 1]);
      }
    }
    rect(0, sky.length * band, W, H, sky[sky.length - 1]);

    // Sun (drawn once; its glow and rays are animated on top)
    use(sunCtx);
    disc(338, 34, 15, "#ffe9a8");
    disc(338, 34, 12, "#fff3c4");
    disc(338, 34, 9, "#fffbe6");

    // Clouds: each is its own small sprite that drifts across the sky.
    function cloud(cx, cy, s, speed) {
      var cw = Math.ceil(40 * s) + 4, ch = Math.ceil(18 * s) + 6;
      var ox = Math.ceil(cw / 2), oy = Math.ceil(9 * s) + 3;
      var c = layer(cw, ch), t = tools(c.getContext("2d"));
      var puffs = [[0, 0, 7], [-8, 2, 5], [8, 2, 6], [-14, 4, 3], [14, 4, 4], [3, -4, 5]];
      puffs.forEach(function (p) { t.disc(ox + p[0] * s, oy + p[1] * s, Math.round(p[2] * s), "#ffffff"); });
      for (var xx = -16 * s; xx <= 16 * s; xx++) t.rect(ox + xx, oy + 5 * s, 1, 2, "#dbe7f2");
      clouds.push({ c: c, w: cw, x: cx - ox, y: Math.round(cy - oy) + SKY, v: speed });
    }
    cloud(62, 30, 1, 2.6); cloud(170, 18, 0.8, 1.7); cloud(268, 44, 1.1, 3.2); cloud(390, 70, 0.7, 2.1);

    use(sceneCtx);

    // Far mountains: overlapping triangular peaks, lit from the left, with snowcaps.
    var peaks = [[10, 70], [62, 58], [110, 76], [150, 62], [196, 74], [250, 60], [300, 72], [345, 56], [395, 68]];
    function ridge(xx) {
      var best = 140, side = 0;
      peaks.forEach(function (pk) {
        var yy = pk[1] + Math.abs(xx - pk[0]) * 0.85;
        if (yy < best) { best = yy; side = xx < pk[0] ? -1 : 1; }
      });
      return [best, side];
    }
    for (x = 0; x < W; x++) {
      var r0 = ridge(x), top = Math.round(r0[0]);
      var lit = r0[1] < 0;
      rect(x, top, 1, 140 - top, lit ? "#9ab0d0" : "#7f96bb");
      var snowLine = 74 + Math.round(3 * Math.sin(x * 0.9));
      if (top < snowLine) rect(x, top, 1, snowLine - top, lit ? "#f4f7fb" : "#cfdaea");
      // soft fade towards the valley
      for (y = 108; y < 140; y += 2) if ((x + y) % 4 === 0) px(x, y, "#a9bdd9");
    }

    // Rolling hills (mid)
    var b1 = rand() * 6, b2 = rand() * 6;
    function hill(xx) { return 128 + 7 * Math.sin(xx * 0.021 + b1) + 4 * Math.sin(xx * 0.057 + b2); }
    for (x = 0; x < W; x++) {
      var hTop = Math.round(hill(x));
      rect(x, hTop, 1, H - hTop, "#78b257");
      px(x, hTop, "#9bcd6c");
      if (x % 2) px(x, hTop + 1, "#9bcd6c");
    }

    // Castle hill
    function castleHill(xx) { return 150 - 34 * Math.exp(-Math.pow((xx - 200) / 78, 2)); }
    for (x = 0; x < W; x++) {
      var cTop = Math.round(castleHill(x));
      rect(x, cTop, 1, H - cTop, "#69a84d");
      px(x, cTop, "#8ac362");
      for (y = cTop + 3; y < cTop + 9; y += 2) if ((x + y) % 4 === 0) px(x, y, "#79b757");
    }

    // ── Castle ──
    var stone = "#d2cbbd", stoneLight = "#e6e0d3", stoneDark = "#a9a092", mortar = "#b7ae9f", outline = "#5d554b";

    function bricks(x0, y0, w, h) {
      rect(x0 - 1, y0, w + 2, h, outline);
      rect(x0, y0, w, h, stone);
      for (var yy = y0 + 3; yy < y0 + h; yy += 4) rect(x0, yy, w, 1, mortar);
      for (yy = y0; yy < y0 + h; yy += 4) {
        var off = ((yy - y0) / 4) % 2 ? 3 : 0;
        for (var xx = x0 + off; xx < x0 + w; xx += 6) rect(xx, yy, 1, 3, mortar);
      }
      rect(x0, y0, 1, h, stoneLight);
      rect(x0 + Math.round(w * 0.68), y0, Math.round(w * 0.32), h, "rgba(80,70,60,0.18)");
    }
    function crenels(x0, y0, w) {
      for (var xx = x0; xx < x0 + w - 1; xx += 4) {
        rect(xx - 1, y0 - 4, 4, 4, outline);
        rect(xx, y0 - 3, 2, 3, stone);
        px(xx, y0 - 3, stoneLight);
      }
    }
    function windowArch(x0, y0, h) {
      rect(x0 - 1, y0, 5, h + 1, outline);
      rect(x0, y0 + 1, 3, h - 1, "#2f2b45");
      px(x0 - 1, y0, "rgba(0,0,0,0)");
      px(x0 + 1, y0 + 1, "#47406a");
    }
    function roof(cx, baseY, w, color, light, dark, flag) {
      var h = Math.round(w * 1.35);
      for (var r = 0; r < h; r++) {
        var half = Math.max(0, Math.round((w / 2 + 1) * (r / h)));
        var yy = baseY - h + r;
        rect(cx - half - 1, yy, half * 2 + 3, 1, outline);
        rect(cx - half, yy, half + 1, 1, light);
        rect(cx + 1, yy, half, 1, dark);
        if (r % 3 === 2) rect(cx - half, yy, half * 2 + 1, 1, color);
      }
      // flag
      var fy = baseY - h - 9;
      rect(cx, fy, 1, 9, "#5d4a36");
      if (flag) {
        var pair = Array.isArray(flag) ? flag : [flag, flag];
        flags.push({ x: cx + 1, y: fy + SKY, c: pair[0], c2: pair[1] });
      }
    }
    function tower(cx, topY, baseY, w, roofCol, flag) {
      bricks(cx - Math.floor(w / 2), topY, w, baseY - topY);
      windowArch(cx - 1, topY + 6, 5);
      roof(cx, topY, w + 2, roofCol[0], roofCol[1], roofCol[2], flag);
    }

    var blueRoof = ["#3f63b5", "#5a80d0", "#2d4a8c"];
    var redRoof = ["#b4483a", "#d0604f", "#86332a"];

    // back towers of the keep
    tower(178, 70, 112, 11, blueRoof, flagColors[1]);
    tower(222, 70, 112, 11, blueRoof, flagColors[2]);
    // keep
    bricks(184, 82, 33, 40);
    crenels(184, 82, 33);
    windowArch(191, 90, 7); windowArch(199, 88, 9); windowArch(207, 90, 7);
    roof(200, 70, 12, redRoof[0], redRoof[1], redRoof[2], "#ffd24a");
    bricks(195, 70, 11, 12);
    // outer wall
    bricks(150, 106, 101, 24);
    crenels(150, 106, 101);
    // outer towers
    tower(148, 96, 132, 15, redRoof, flagColors[0]);
    tower(252, 96, 132, 15, redRoof, flagColors[3]);
    // gate
    rect(192, 113, 17, 18, outline);
    rect(193, 116, 15, 15, "#6e4a2c");
    rect(194, 114, 13, 2, "#6e4a2c");
    for (x = 196; x < 207; x += 3) rect(x, 115, 1, 16, "#4f3420");
    rect(193, 121, 15, 1, "#3a2a1c");
    px(205, 123, "#e0b552");
    // little banners on the wall
    [[165, flagColors[0]], [178, flagColors[1]], [222, flagColors[2]], [235, flagColors[3]]].forEach(function (b) {
      rect(b[0] - 1, 110, 6, 1, "#5d4a36");
      rect(b[0], 111, 4, 8, b[1][0]);
      rect(b[0] + 1, 113, 2, 2, b[1][1]);
    });

    // ── Path from the gate ──
    for (y = 131; y < H; y++) {
      var t = (y - 131) / (H - 131);
      var cx = 200 + Math.sin(t * 3.2) * 26 * t;
      var half = 6 + t * 26;
      rect(cx - half, y, half * 2, 1, "#dcc38b");
      px(cx - half, y, "#b99d64"); px(cx + half - 1, y, "#b99d64");
      if (rand() < 0.35) px(cx - half + rand() * half * 2, y, "#c7ad74");
    }

    // ── Village houses ──
    function house(x0, baseY, w, h, roofC) {
      var wall = "#efdcb5", timber = "#7a5236";
      rect(x0 - 1, baseY - h - 1, w + 2, h + 2, "#4a3322");
      rect(x0, baseY - h, w, h, wall);
      rect(x0, baseY - h, w, 1, timber);
      rect(x0, baseY - 1, w, 1, timber);
      rect(x0 + Math.floor(w / 2), baseY - h, 1, h, timber);
      // door + window
      rect(x0 + 2, baseY - 6, 4, 6, "#7a4f2c"); px(x0 + 5, baseY - 3, "#e0b552");
      rect(x0 + w - 7, baseY - h + 3, 4, 4, "#4a3322");
      rect(x0 + w - 6, baseY - h + 4, 2, 2, "#8fc1e8");
      // roof
      var rh = Math.round(w * 0.55);
      for (var r = 0; r < rh; r++) {
        var inset = Math.round((rh - r) * (w / 2 + 2) / rh);
        var yy = baseY - h - rh + r;
        rect(x0 - 2 + inset, yy, w + 4 - inset * 2, 1, r % 2 ? roofC[0] : roofC[1]);
        px(x0 - 2 + inset, yy, "#4a3322"); px(x0 + w + 1 - inset, yy, "#4a3322");
      }
      rect(x0 - 2, baseY - h - 1, w + 4, 1, roofC[2]);
      // chimney
      rect(x0 + w - 6, baseY - h - rh + 1, 3, 4, "#8a5a3a");
      // shadow on the right half
      rect(x0 + Math.floor(w / 2) + 1, baseY - h + 1, Math.floor(w / 2) - 1, h - 2, "rgba(90,60,30,0.12)");
    }
    var roofA = ["#c0543f", "#a8432f", "#7f3122"], roofB = ["#8a6a4a", "#76583b", "#5a422b"], roofC = ["#4f78b8", "#3f66a3", "#2e4d80"];
    house(52, 176, 20, 12, roofA); house(86, 184, 18, 11, roofB); house(28, 196, 22, 13, roofC);
    house(300, 178, 20, 12, roofB); house(332, 188, 22, 13, roofA); house(270, 196, 18, 11, roofC);

    // ── Trees ──
    function tree(cx, baseY, r) {
      rect(cx - 1, baseY - r, 3, r + 1, "#5b3e26");
      px(cx + 1, baseY - r, "#7a5236");
      var cy = baseY - r - Math.round(r * 0.6);
      disc(cx, cy, r, "#2f6a33");
      disc(cx - 1, cy - 1, r - 1, "#3e8a3d");
      disc(cx - Math.round(r / 3), cy - Math.round(r / 3), Math.max(1, Math.round(r / 2)), "#5aa84b");
      px(cx - Math.round(r / 2), cy - Math.round(r / 2), "#86c766");
      rect(cx - r + 1, baseY, r * 2 - 1, 1, "rgba(30,60,20,0.25)");
    }
    var trees = [[14, 150, 6], [34, 148, 5], [118, 150, 6], [132, 146, 4], [268, 150, 5], [286, 146, 6], [372, 150, 6], [390, 146, 5],
      [8, 214, 9], [112, 206, 7], [128, 222, 9], [282, 222, 9], [362, 210, 8], [392, 222, 10], [240, 206, 6], [160, 204, 6]];
    trees.sort(function (p, q) { return p[1] - q[1]; }).forEach(function (t) { tree(t[0], t[1], t[2]); });

    // ── Grass tufts & flowers ──
    var flowers = ["#ff7a7a", "#ffe066", "#ffffff", "#c69cff"];
    for (i = 0; i < 260; i++) {
      x = Math.floor(rand() * W);
      y = Math.floor(150 + rand() * (H - 150));
      var ground = Math.round(castleHill(x));
      if (y < ground + 4) continue;
      if (rand() < 0.75) {
        px(x, y, "#4f8f3c"); px(x - 1, y + 1, "#4f8f3c"); px(x + 1, y + 1, "#4f8f3c");
      } else {
        px(x, y, flowers[Math.floor(rand() * flowers.length)]);
        px(x, y + 1, "#3f7a30");
      }
    }

    // ── Animation ──
    var halo = tools(out);
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

    function draw(t) {
      out.drawImage(skyL, 0, 0);

      // sun: breathing glow + twinkling rays
      var pulse = 0.5 + 0.5 * Math.sin(t * 1.3);
      halo.disc(338, 34 + SKY, 24, "rgba(255,244,190," + (0.05 + 0.07 * pulse).toFixed(3) + ")");
      halo.disc(338, 34 + SKY, 19, "rgba(255,244,190," + (0.10 + 0.14 * pulse).toFixed(3) + ")");
      out.drawImage(sunL, 0, 0);
      for (var k = 0; k < 8; k++) {
        if ((Math.floor(t * 1.2) + k) % 2) continue;
        var ang = k * Math.PI / 4 + Math.PI / 8;
        halo.rect(338 + Math.cos(ang) * 20 - 1, 34 + SKY + Math.sin(ang) * 20 - 1, 2, 2, "rgba(255,248,205,0.9)");
      }

      // clouds drift to the right and wrap around
      clouds.forEach(function (c) {
        var span = W + c.w;
        var px0 = ((c.x + c.w + c.v * t) % span + span) % span - c.w;
        out.drawImage(c.c, Math.round(px0), c.y);
      });

      out.drawImage(sceneL, 0, 0);

      // flags ripple in the wind
      flags.forEach(function (f, n) {
        var dy = 0;
        for (var i = 0; i < 6; i++) {
          // sag: the free end hangs ~2px lower than the pole, with the wind ripple on top
          dy = Math.round((i / 5) * 2 + Math.sin(t * 5 + i * 0.9 + n * 1.7) * 1.1 * (i / 5));
          out.fillStyle = f.c; out.fillRect(f.x + i, f.y + dy, 1, 2);
          out.fillStyle = f.c2; out.fillRect(f.x + i, f.y + dy + 2, 1, 2);
          out.fillStyle = "rgba(0,0,0,0.25)"; out.fillRect(f.x + i, f.y + dy + 3, 1, 1);
        }
        out.fillStyle = f.c; out.fillRect(f.x + 6, f.y + dy + 1, 1, 1);
        out.fillStyle = f.c2; out.fillRect(f.x + 6, f.y + dy + 2, 1, 1);
      });
    }

    draw(0);
    if (reduce) return;

    var start = null, last = 0, raf = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (start === null) start = now;
      if (now - last < 80) return; // ~12 frames per second is plenty for pixel art
      last = now;
      draw((now - start) / 1000);
    }
    raf = requestAnimationFrame(frame);
    canvas._phenixStop = function () { cancelAnimationFrame(raf); canvas._phenixStop = null; };
  }

  // ── Throne (48×64) ───────────────────────────────────────────
  function paintThrone(canvas, crestColor, accent) {
    var W = 48, H = 64;
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext("2d");
    var T = tools(ctx), rect = T.rect, px = T.px, box = T.box;
    var O = "#3b2414";
    var gold = ["#e0a526", "#ffd86b", "#a8741a"];
    var red = ["#b83a2b", "#d8584a", "#7e2219"];

    // ground shadow
    for (var x = 6; x < 42; x++) if (x % 2 === 0) px(x, 62, "rgba(0,0,0,0.35)");
    rect(9, 61, 30, 1, "rgba(0,0,0,0.25)");

    // legs
    box(9, 49, 4, 12, gold[0], gold[1], gold[2], O);
    box(35, 49, 4, 12, gold[0], gold[1], gold[2], O);
    rect(8, 59, 6, 2, gold[2]); rect(34, 59, 6, 2, gold[2]);
    // apron between the legs
    box(13, 49, 22, 4, gold[0], gold[1], gold[2], O);
    rect(23, 50, 2, 2, red[0]);

    // backrest frame + velvet
    box(11, 7, 26, 34, gold[0], gold[1], gold[2], O);
    rect(14, 10, 20, 29, O);
    rect(15, 11, 18, 27, red[0]);
    rect(15, 11, 2, 27, red[1]);
    rect(31, 11, 2, 27, red[2]);
    // tufting
    for (var yy = 14; yy < 37; yy += 5) for (var xx = 18 + ((yy / 5) % 2 ? 2 : 0); xx < 31; xx += 4) {
      px(xx, yy, red[2]); px(xx - 1, yy - 1, red[1]);
    }
    // crest on the backrest (only when someone holds the throne)
    if (crestColor) {
      var shield = ["kkkkkkkk", "kccccccd", "kccggccd", "kcggggcd", "kccggccd", ".kccccd.", "..kccd..", "...kk..."];
      shield.forEach(function (row, j) {
        for (var i = 0; i < row.length; i++) {
          var ch = row[i]; if (ch === ".") continue;
          px(20 + i, 18 + j, ch === "k" ? O : ch === "g" ? (accent || gold[1]) : ch === "d" ? "rgba(0,0,0,0.35)" : crestColor);
        }
      });
    }

    // top ornament: arch + crown
    box(15, 3, 18, 4, gold[0], gold[1], gold[2], O);
    rect(19, 0, 10, 3, O);
    rect(20, 1, 8, 2, gold[0]);
    px(20, 0, O); px(23, 0, gold[1]); px(24, 0, gold[1]); px(27, 0, O);
    rect(23, 4, 2, 2, red[0]); px(23, 4, "#ff8a7a");
    // finials
    box(8, 4, 4, 4, gold[0], gold[1], gold[2], O);
    box(36, 4, 4, 4, gold[0], gold[1], gold[2], O);

    // armrests
    box(4, 30, 7, 5, gold[0], gold[1], gold[2], O);
    box(37, 30, 7, 5, gold[0], gold[1], gold[2], O);
    box(5, 35, 4, 10, gold[0], gold[1], gold[2], O);
    box(39, 35, 4, 10, gold[0], gold[1], gold[2], O);
    px(5, 31, "#fff1b8"); px(38, 31, "#fff1b8");

    // seat cushion + front rail
    box(8, 41, 32, 5, red[0], red[1], red[2], O);
    rect(9, 42, 30, 1, red[1]);
    box(8, 46, 32, 3, gold[0], gold[1], gold[2], O);
    for (x = 11; x < 38; x += 4) px(x, 47, gold[2]);
  }

  // Small heraldic shield in a family colour (12×14).
  function paintCrest(canvas, color, accent) {
    var rows = [
      "kkkkkkkkkkkk",
      "kllllllllldk",
      "klcccccccddk",
      "klcccggccddk",
      "klccggggcddk",
      "klcccggccddk",
      "klcccccccddk",
      "klcccccccddk",
      ".klccccccdk.",
      ".klccccccdk.",
      "..klccccdk..",
      "...klccdk...",
      "....kddk....",
      ".....kk....."
    ];
    canvas.width = 12; canvas.height = 14;
    var ctx = canvas.getContext("2d");
    var pal = { k: "#2b1d14", l: "rgba(255,255,255,0.45)", c: color, d: "rgba(0,0,0,0.3)", g: accent || "#ffd86b" };
    rows.forEach(function (row, j) {
      for (var i = 0; i < row.length; i++) {
        var ch = row[i]; if (ch === ".") continue;
        if (ch === "l" || ch === "d") { ctx.fillStyle = color; ctx.fillRect(i, j, 1, 1); }
        ctx.fillStyle = pal[ch]; ctx.fillRect(i, j, 1, 1);
      }
    });
  }

  window.PhenixArt = { paintKingdom: paintKingdom, paintThrone: paintThrone, paintCrest: paintCrest };
})();
