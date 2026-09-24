/* art.klaushofrichter.net — lobby and rooms.
   Nothing here is eased by CSS: the pointer light, the cover drift and the
   navigation are all springs stepped once per animation frame. A CSS
   transition on a value that pointer events already rewrite every frame is
   what makes this kind of interface feel choppy. */
(function () {
  'use strict';

  var manifestNode = document.getElementById('manifest');
  if (!manifestNode) return;
  var ROOMS = JSON.parse(manifestNode.textContent);
  if (!ROOMS.length) return;

  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CAME_IN_BARE = !location.hash && !location.search;
  var INITIAL_HASH = (function () {
    var raw = location.hash.replace(/^#/, '');
    try { return decodeURIComponent(raw); } catch (_) { return raw; }
  })();

  /* Tuning. Both springs are deliberately slow — the weight is the point.
     omega = sqrt(K); damping ratio = (1 - D) / (2 * sqrt(K)).
     Rail:  ~0.5s travel, barely any overshoot.
     Light: ~0.7s travel, a visible drift onwards after the pointer stops. */
  var RAIL_K = 0.045, RAIL_D = 0.70;
  var LIGHT_K = 0.022, LIGHT_D = 0.91;
  var FLING = 260;          /* how much of a throw's speed carries into the landing */
  var WHEEL_STEP = 48;      /* wheel delta needed to commit to a move */
  var WHEEL_LOCK = 520;     /* ms before the wheel may move again */

  /* The light on a phone. A touch screen has nothing hovering over the
     lobby, so the light and the cover drift used to sit still. There, the
     light on the panel in view wanders instead: a slow path that never quite
     repeats, kept inside a box clear of the edges, fed to the same springs a
     pointer would move. It eases in from wherever the light is, so it never
     jumps. Set AMBIENT to false to go back to a still light; nothing else
     depends on it. */
  var AMBIENT = true;
  var AMBIENT_MARGIN_X = 25;  /* % of the panel's width the light's centre stays clear of each side */
  var AMBIENT_MARGIN_Y = 30;  /* and of its height, top and bottom */
  var AMBIENT_PERIOD = 11;    /* seconds for the main sideways sweep; smaller is faster */
  var AMBIENT_EASE_IN = 2.5;  /* seconds to blend from where the light is into the path */
  var AMBIENT_FPS = 30;       /* the light is a gradient over the whole panel, repainted per write */
  var WANDER = AMBIENT && !REDUCE &&
    window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  /* Tools for an AI agent in the browser (WebMCP), registered at the bottom
     of this file. An experiment: only a browser that offers
     document.modelContext sees them — today that means Chrome with
     about:flags#enable-webmcp-testing turned on — and every other browser
     never notices. Set WEBMCP to false to drop them; nothing else depends
     on it. */
  var WEBMCP = true;

  function Spring(k, d) {
    return {
      x: 0, v: 0, t: 0,
      step: function () { this.v += (this.t - this.x) * k; this.v *= d; this.x += this.v; return this.x; },
      rest: function () { return Math.abs(this.v) < 1e-4 && Math.abs(this.t - this.x) < 1e-4; },
      snap: function (v) { this.x = this.t = v; this.v = 0; }
    };
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = String(text);
    return n;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  /* niceDate and money are kept in step by hand with formatDate and
     formatMoney in src/format.ts, the way webpName below is with its server
     counterpart: the server renders the same dates and prices into the
     purchase pages and the link previews, and the two must agree. */
  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  function niceDate(d) {
    if (!d) return '';
    var p = String(d).split('-');
    return p.length === 1 ? p[0] : MONTHS[+p[1] - 1] + ' ' + p[0];
  }
  function money(n, cur) {
    return (cur === 'USD' || !cur ? '$' : '') + n.toLocaleString('en-US') + (cur && cur !== 'USD' ? ' ' + cur : '');
  }
  /* Content is built as DOM nodes and text, never as an HTML string. The
     manifest reaches this file through the DOM, so anything concatenated into
     innerHTML would be text reinterpreted as markup — the exact shape of bug
     that escaping is only a patch for. There is no HTML sink here to escape
     against. */
  function markupNodes(source) {
    var f = document.createDocumentFragment();
    if (!source) return f;
    var text = String(source);
    var re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
    var last = 0, m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) f.append(document.createTextNode(text.slice(last, m.index)));
      f.append(el(m[1] ? 'strong' : 'em', null, m[1] || m[2]));
      last = re.lastIndex;
    }
    if (last < text.length) f.append(document.createTextNode(text.slice(last)));
    return f;
  }
  var STATUS = { available: '', sold: 'Sold', reserved: 'Reserved', nfs: 'Not for sale' };

  /* A permalink is the picture's own id, not its position or its title, so it
     survives renaming and reordering. */
  function permalink(uid) { return location.origin + '/?id=' + encodeURIComponent(uid); }
  /* The path data is literal, never content — nothing from the manifest is
     ever parsed as markup. */
  function svgIcon(paths) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.innerHTML = paths;
    return svg;
  }
  var FS_ENTER = '<path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/>';
  var FS_EXIT  = '<path d="M9 4v5H4"/><path d="M15 4v5h5"/><path d="M9 20v-5H4"/><path d="M15 20v-5h5"/>';

  function iconLink(cls, href, label, paths) {
    var svg = svgIcon(paths);
    var link = el('a', 'iconlink ' + cls + ' no-drag');
    link.href = href;
    link.title = label;
    link.setAttribute('aria-label', label);
    link.append(svg);
    return link;
  }
  function linkIcon(uid, label) {
    return iconLink('permalink', permalink(uid), label,
      '<path d="M10 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2"/>' +
      '<path d="M14 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2"/>');
  }
  /* The picture on screen, at the size it was shot. One picture, never a
     whole room — there is no bulk download. */
  function downloadIcon(roomId, w) {
    var ext = (w.file.match(/\.[A-Za-z0-9]+$/) || ['.jpg'])[0];
    var link = iconLink('download', pictureUrl(roomId, w),
      'Download ' + w.title + ' at full resolution',
      '<path d="M12 4v11"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M4.5 19.5h15"/>');
    link.setAttribute('download', w.slug + ext);
    return link;
  }

  /* Every URL the page uses is built from a literal prefix plus encoded
     identifiers. Nothing that arrives as content is ever assigned to a src
     or an href, so no index.json can put "javascript:" behind a link. */
  /* The rooms and pictures menus show a 62x44 thumbnail. Each one used to
     load the full-resolution original. */
  var THUMB_PX = 62;

  /* Works, views and room covers are all the same shape — a file, the widths
     that exist beside it, whether WebP covers them, and a version. Every URL
     helper takes one of those rather than a handful of loose arguments, so a
     caller cannot quietly leave the version off and pin a stale picture in
     everyone's cache for a year.

     The version token turns a picture that is replaced under the same
     filename into a new URL, which is what lets /assets be cached hard. It
     is a hex string this server computed from a stat — never anything the
     content chose — so it cannot carry anything into the query string. */
  function pictureUrl(roomId, pic) {
    return '/assets/' + encodeURIComponent(roomId) + '/' + encodeURIComponent(pic.file) +
      '?v=' + encodeURIComponent(pic.v);
  }
  /* Does this browser take WebP? Asked once. Every engine that matters has
     said yes for years, but the answer decides which files we ask for, so it
     is measured rather than assumed. */
  var WEBP = (function () {
    try {
      var c = document.createElement('canvas');
      c.width = c.height = 1;
      return c.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    } catch (_) { return false; }
  })();

  /* The WebP beside a resized copy keeps the basename. Still a literal
     prefix plus an encoded identifier — swapping the extension does not make
     this a URL from content. */
  function webpName(file) {
    return file.replace(/\.[A-Za-z0-9]+$/, '') + '.webp';
  }

  /* The same picture, shrunk to `w`. Built the same way — a literal prefix, a
     number, and encoded identifiers — so this is no more of a sink than the
     line above. `hasWebp` says a WebP exists at every width for this picture. */
  function sizedUrl(roomId, pic, w) {
    var name = (pic.webp && WEBP) ? webpName(pic.file) : pic.file;
    return '/assets/' + encodeURIComponent(roomId) + '/w' + Number(w) +
      '/' + encodeURIComponent(name) + '?v=' + encodeURIComponent(pic.v);
  }
  /* The smallest copy that covers `cssPx` at this screen's density — or the
     largest that exists, if the screen wants more than we made.
     
     The top of the ladder is deliberately the ceiling for anything shown on
     screen: past it the extra pixels are invisible on a photograph and cost
     half again as many bytes. The original is never displayed when a copy
     exists; it is what the download link serves, at full resolution. */
  function bestUrl(roomId, pic, cssPx) {
    var list = (pic && pic.widths) || [];
    if (!list.length) return pictureUrl(roomId, pic);
    var need = Math.round(cssPx * (window.devicePixelRatio || 1));
    for (var i = 0; i < list.length; i++) {
      if (list[i] >= need) return sizedUrl(roomId, pic, list[i]);
    }
    return sizedUrl(roomId, pic, list[list.length - 1]);
  }

  /* The smallest copy there is, whatever the screen. For a picture that is
     scaled up and blurred, density buys nothing. */
  function smallestUrl(roomId, pic) {
    return pic.widths && pic.widths.length
      ? sizedUrl(roomId, pic, pic.widths[0])
      : pictureUrl(roomId, pic);
  }
  /* Every copy that exists, for an <img> to choose from itself. The original
     is deliberately not among them — see bestUrl. */
  function srcsetFor(roomId, pic) {
    return (pic.widths || []).map(function (w) {
      return sizedUrl(roomId, pic, w) + ' ' + w + 'w';
    }).join(', ');
  }
  function buyUrl(roomId, slug) {
    return '/buy/' + encodeURIComponent(roomId) + '/' + encodeURIComponent(slug);
  }

  /* -----------------------------------------------------------------
     Rail — slides stacked in place and moved by transform on a spring.
     Wheel, keys and drag all write the same target; no native scrolling
     is involved, so nothing snaps or stutters.
     ----------------------------------------------------------------- */
  function Rail(host, onIndex) {
    var slides = Array.prototype.slice.call(host.children);
    var n = slides.length;
    var s = Spring(RAIL_K, RAIL_D);
    /* -Infinity, not 0: with 0, `performance.now() - lastDragEnd` is smaller
       than the guard below for the first quarter-second of the page's life,
       so a rail that had never been dragged claimed it had, and the first
       click after entering a room was swallowed. */
    var raf = 0, idx = 0, drag = null, lastDragEnd = -Infinity;

    function render() {
      for (var i = 0; i < n; i++) {
        var d = i - s.x, a = Math.abs(d), node = slides[i];
        if (a > 1.4) { node.style.visibility = 'hidden'; continue; }
        node.style.visibility = '';
        node.style.transform = 'translate3d(0,' + (d * 100) + '%,0) scale(' + (1 - Math.min(a, 1) * 0.045) + ')';
        node.style.opacity = String(1 - Math.min(a, 1) * 0.42);
      }
    }
    function tick() {
      s.step();
      if (s.rest()) { s.snap(s.t); render(); raf = 0; return; }
      render();
      raf = requestAnimationFrame(tick);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(tick); }
    function setTarget(i, quiet) {
      i = Math.max(0, Math.min(n - 1, i));
      var changed = i !== idx;
      idx = i; s.t = i;
      if (REDUCE) { s.snap(i); render(); } else kick();
      if (changed && !quiet && onIndex) onIndex(idx);
    }

    host.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.no-drag')) return;
      drag = { y: e.clientY, from: s.x, t: performance.now(), ly: e.clientY, v: 0, moved: 0 };
      try { host.setPointerCapture(e.pointerId); } catch (_) {}
      host.classList.add('grabbing');
    });
    host.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var h = host.clientHeight || 1;
      var dy = e.clientY - drag.y;
      drag.moved = Math.max(drag.moved, Math.abs(dy));
      var now = performance.now();
      drag.v = (e.clientY - drag.ly) / Math.max(1, now - drag.t);
      drag.ly = e.clientY; drag.t = now;
      var p = drag.from - dy / h;
      if (p < 0) p *= 0.32;                                   /* rubber band at the ends */
      if (p > n - 1) p = (n - 1) + (p - (n - 1)) * 0.32;
      s.x = p; s.v = 0; s.t = p;
      render();
    });
    function endDrag(e) {
      if (!drag) return;
      var h = host.clientHeight || 1;
      var proj = s.x - drag.v * FLING / h;
      if (drag.moved > 6) lastDragEnd = performance.now();
      try { if (e.pointerId != null && host.hasPointerCapture(e.pointerId)) host.releasePointerCapture(e.pointerId); } catch (_) {}
      host.classList.remove('grabbing');
      drag = null; s.v = 0;
      setTarget(Math.round(proj));
      kick();
    }
    host.addEventListener('pointerup', endDrag);
    host.addEventListener('pointercancel', endDrag);

    var acc = 0, lock = false, decay = 0;
    host.addEventListener('wheel', function (e) {
      var dir = e.deltaY > 0 ? 1 : -1;
      var next = idx + dir;
      if (next < 0 || next > n - 1) return;   /* at an end, let the page have it */
      e.preventDefault();
      acc += e.deltaY;
      clearTimeout(decay);
      decay = setTimeout(function () { acc = 0; }, 170);
      if (!lock && Math.abs(acc) > WHEEL_STEP) {
        lock = true; acc = 0;
        setTarget(idx + dir);
        setTimeout(function () { lock = false; }, WHEEL_LOCK);
      }
    }, { passive: false });

    render();
    return {
      go: setTarget,
      index: function () { return idx; },
      step: function (d) { setTarget(idx + d); },
      draggedRecently: function () { return performance.now() - lastDragEnd < 260; }
    };
  }

  /* the side menu — rooms in the lobby, this room's pictures in a room */
  function Menu(title, items, onPick, onTitle) {
    var veil = el('div', 'veil');
    var m = el('div', 'menu');
    var head = el('div', 'mhead');
    if (onTitle) {
      var home = el('button', 'mtitle no-drag', title);
      home.type = 'button';
      home.onclick = function (ev) { ev.stopPropagation(); api.close(); onTitle(); };
      head.append(home);
    } else {
      head.append(el('span', null, title));
    }
    var list = el('div', 'mlist');
    var foot = el('div', 'mfoot');
    var close = el('button', 'mclose', 'Close');
    close.type = 'button';
    foot.append(close);
    items.forEach(function (it, i) {
      var b = el('button', 'mitem no-drag');
      b.type = 'button';
      var th = el('img', it.src ? 'th' : 'th blank');
      if (it.src) { th.dataset.src = it.src; th.alt = ''; th.loading = 'lazy'; }
      var label = el('div');
      var meta = el('div', 'm', it.meta);
      if (it.badge) { meta.append(document.createTextNode(' \u00b7 '), el('span', 's', it.badge)); }
      label.append(el('div', 't', it.title), meta);
      b.append(th, label);
      b.style.setProperty('--enter-delay', (0.03 + i * 0.035) + 's');
      b.onclick = function (ev) { ev.stopPropagation(); api.close(); onPick(i); };
      list.append(b);
    });
    m.append(head, list, foot);
    var api = {
      veil: veil, menu: m,
      open: function () {
        /* thumbnails are only worth fetching once the drawer is asked for */
        Array.prototype.forEach.call(list.querySelectorAll('img[data-src]'), function (t) {
          t.src = t.dataset.src;
          t.removeAttribute('data-src');
        });
        veil.classList.add('on'); m.classList.add('on');
      },
      close: function () { veil.classList.remove('on'); m.classList.remove('on'); },
      toggle: function () { m.classList.contains('on') ? api.close() : api.open(); },
      isOpen: function () { return m.classList.contains('on'); },
      mark: function (i) {
        Array.prototype.forEach.call(list.children, function (n, j) { n.classList.toggle('on', j === i); });
      }
    };
    close.onclick = function (ev) { ev.stopPropagation(); api.close(); };
    veil.onclick = function (ev) { ev.stopPropagation(); api.close(); };
    return api;
  }

  /* The pointer light, and the drift of the cover under it. Both run on the
     slow spring, so the light keeps travelling for a moment after the pointer
     stops and settles back on its own. The lobby only — inside a room the
     pictures are simply shown. */
  function attachLight(host, bg, scale, drift) {
    var sx = Spring(LIGHT_K, LIGHT_D), sy = Spring(LIGHT_K, LIGHT_D), raf = 0;
    var wander = null, written = -Infinity;
    function write() {
      host.style.setProperty('--mx', (50 + sx.x * 58) + '%');
      host.style.setProperty('--my', (50 + sy.x * 58) + '%');
      if (bg) {
        bg.style.transform = 'scale(' + scale + ') translate3d(' +
          (-sx.x * drift) + '%,' + (-sy.x * drift) + '%,0)';
      }
    }
    function paint(now) {
      if (wander) wander(now);
      sx.step(); sy.step();
      /* A pointer light comes to rest and stops painting; a wandering one
         never does, so it would repaint the panel every frame for as long
         as the lobby is open. At this speed thirty writes a second look the
         same as sixty. The springs still step every frame. */
      if (!wander || now - written >= 1000 / AMBIENT_FPS - 2) { written = now; write(); }
      if (!wander && sx.rest() && sy.rest()) { raf = 0; return; }
      raf = requestAnimationFrame(paint);
    }
    function run() { if (!raf) raf = requestAnimationFrame(paint); }
    host.addEventListener('pointermove', function (e) {
      if (wander) return;
      var r = host.getBoundingClientRect();
      sx.t = (e.clientX - r.left) / r.width - 0.5;
      sy.t = (e.clientY - r.top) / r.height - 0.5;
      run();
    });
    host.addEventListener('pointerleave', function () {
      if (wander) return;
      sx.t = 0; sy.t = 0; run();
    });

    /* The path, in the springs' units, where ±0.5 would put the light's
       centre at 21% and 79% (see write). Two sines per axis at unrelated
       periods, weighted to sum to at most 1, so the box is a hard bound. */
    function Wander() {
      var x0 = sx.t, y0 = sy.t, t = 0, last = null;
      var ax = (50 - AMBIENT_MARGIN_X) / 58, ay = (50 - AMBIENT_MARGIN_Y) / 58;
      var w = 2 * Math.PI / AMBIENT_PERIOD;
      return function (now) {
        /* A clock that only runs while frames do, so a tab that comes back
           from the background carries on from where it was rather than
           leaping ahead along the path. */
        if (last !== null) t += Math.min(now - last, 100) / 1000;
        last = now;
        var px = ax * (0.7 * Math.sin(w * t) + 0.3 * Math.sin(w * t / 2.6 + 1.1));
        var py = ay * (0.7 * Math.sin(w * t / 1.37 + 0.6) + 0.3 * Math.sin(w * t / 3.1 + 2.3));
        var e = Math.min(1, t / AMBIENT_EASE_IN);
        e = e * e * (3 - 2 * e);
        sx.t = x0 + (px - x0) * e;
        sy.t = y0 + (py - y0) * e;
      };
    }
    return {
      wander: function (on) {
        if (on === !!wander) return;
        wander = on ? Wander() : null;
        run();
      }
    };
  }

  /* Only the panel in view wanders, and none while a room is open. */
  var lights = [];
  function wanderAt(i) {
    if (!WANDER) return;
    lights.forEach(function (l, j) { if (l) l.wander(j === i); });
  }

  /* When a picture's shape leaves a bar above and below it, that slack is
     free space — so spend it by dropping the picture clear of the navigation
     buttons instead of centring it under them. A picture that is taller than
     the window has no vertical slack and is left alone, and so is one in full
     screen, where the buttons are gone. */
  var NAV_CLEARANCE = 14;
  function alignArt(view, img) {
    if (!img) return;
    if (view.classList.contains('bare')) { img.style.objectPosition = ''; return; }
    var nw = img.naturalWidth, nh = img.naturalHeight;
    /* offsetWidth/Top rather than a bounding rect: the slides are moved by
       transform, so a rect would be measured from wherever the rail is. */
    var boxW = img.offsetWidth, boxH = img.offsetHeight;
    if (!nw || !nh || !boxW || !boxH) return;
    var slack = boxH - nh * Math.min(boxW / nw, boxH / nh);
    if (slack <= 1) { img.style.objectPosition = ''; return; }
    var nav = view.querySelector('.navstack');
    var wanted = (nav ? nav.getBoundingClientRect().bottom : 0) + NAV_CLEARANCE - img.offsetTop;
    var pct = Math.max(0, Math.min(100, (wanted / slack) * 100));
    img.style.objectPosition = '50% ' + pct + '%';
  }
  function alignAll(view) {
    if (!view) return;
    Array.prototype.forEach.call(view.querySelectorAll('.plate .art'), function (img) {
      alignArt(view, img);
    });
  }

  /* Load one picture at a time, nearest first. Everything starting at once is
     why the lobby was slow: the cover on screen shared the connection with
     three you could not see. The gallery is small by design (tens of
     pictures, not thousands), so a queue is enough — no windowing needed. */
  function loadOneByOne(order, show) {
    var k = 0;
    (function step() {
      while (k < order.length) {
        if (show(order[k++], step)) return;   /* started one; wait for it */
      }
    })();
  }
  function byDistance(count, from) {
    var out = [];
    for (var i = 0; i < count; i++) out.push(i);
    return out.sort(function (a, b) { return Math.abs(a - from) - Math.abs(b - from); });
  }

  function aboutBody(room) {
    var a = room.about || {};
    var body = el('div', 'abody');
    body.append(el('div', 'n', a.name || room.title), el('div', 'r', a.role || ''));
    (a.body || []).forEach(function (t) {
      var para = el('p');
      para.append(markupNodes(t));
      body.append(para);
    });
    if (a.contact && a.contact.email) {
      var mail = el('a', 'mail no-drag', a.contact.email);
      mail.href = 'mailto:' + a.contact.email;
      body.append(mail);
      if (a.contact.note) body.append(el('div', 'fine', a.contact.note));
    }
    /* which build you are looking at, and where it came from */
    var version = app.dataset.version, repo = app.dataset.repo;
    if (version && repo) {
      var ver = el('a', 'ver no-drag', 'Version ' + version);
      ver.href = repo;
      ver.target = '_blank';
      ver.rel = 'noopener noreferrer';
      body.append(ver);
    }
    /* the terms and the privacy policy, under the version line. These are
       ordinary pages on this site, so they navigate in the same tab. */
    var legal = el('div', 'legal');
    [['Terms of Service', '/terms'], ['Privacy Policy', '/privacy']].forEach(function (pair) {
      var a = el('a', 'no-drag', pair[0]);
      a.href = pair[1];
      legal.append(a);
    });
    body.append(legal);
    return body;
  }

  var app = document.getElementById('app');
  var keyHandler = null;

  /* ================= LOBBY ================= */
  var lobby = el('div', 'screen');
  var rail = el('div', 'rail');
  var coverUrls = [], covers = [];

  ROOMS.forEach(function (room) {
    var slide = el('div', 'slide');
    var coverUrl = room.cover ? bestUrl(room.id, room.cover, window.innerWidth) : null;
    var p = el('div', 'lpanel' + (room.type === 'about' ? ' about' : '') +
      (coverUrl ? '' : ' nocover'));
    var bg = el('div', 'bg');
    /* the picture itself is fetched by showCover(), nearest first */
    coverUrls.push(coverUrl);
    covers.push(bg);
    var scrim = el('div', 'scrim');
    p.append(bg, scrim);

    var cap = el('div', 'cap');
    var blurb = el('p', 'b');
    blurb.append(markupNodes(room.description));
    cap.append(
      /* the About room has no works to count */
      el('span', 's', room.type === 'about'
        ? room.subtitle
        : room.subtitle + ' \u00b7 ' + room.works.length + ' works'),
      el('div', 'n', room.title),
      blurb
    );
    var btn = el('button', 'enter no-drag', room.type === 'about' ? 'Read more →' : 'Enter the room →');
    btn.type = 'button';
    btn.onclick = function (ev) { ev.stopPropagation(); enterRoom(room); };
    cap.append(btn);
    p.append(cap);

    lights.push(REDUCE ? null : attachLight(p, coverUrl ? bg : null, 1.14, 1.3));
    slide.append(p);
    rail.append(slide);
  });
  lobby.append(rail);

  var lobbyRail;
  var roomsBtn = el('button', 'chrome fade-idle no-drag', 'Rooms');
  var lobbyNav = el('div', 'navstack');
  lobbyNav.append(roomsBtn);
  roomsBtn.type = 'button';
  var lobbyMenu = Menu('Lobby', ROOMS.map(function (r) {
    return {
      src: r.cover ? bestUrl(r.id, r.cover, THUMB_PX) : null,
      title: r.title,
      meta: r.type === 'about' ? 'Information' : r.works.length + ' works \u00b7 ' + r.subtitle
    };
  }), function (i) { enterRoom(ROOMS[i]); }, goHome);

  /* Back to the front door: out of any room, onto the first panel, with the
     URL and the greeting as they were on arrival. */
  function goHome() {
    if (liveRoom) {
      liveRoom.remove();
      liveRoom = null;
      here = null;
      lobby.hidden = false;
      keyHandler = lobbyKeys;
    }
    lobbyRail.go(0);
    syncLobby(0);
    history.replaceState(null, '', location.pathname);
    showWelcome();
  }
  var ldots = el('div', 'dots');
  ROOMS.forEach(function (r, i) {
    var d = el('i', 'no-drag');
    d.onclick = function (ev) { ev.stopPropagation(); lobbyRail.go(i); };
    ldots.append(d);
  });
  function syncLobby(i) {
    wanderAt(i);
    lobbyMenu.mark(i);
    Array.prototype.forEach.call(ldots.children, function (d, j) { d.classList.toggle('on', j === i); });
    var r = ROOMS[i];
    history.replaceState(null, '', r ? '#' + r.id : '#');
  }
  /* Fill the screen. The browser's own full screen, not the room's — it makes
     the gallery the whole window and stays on as you move through it. */
  var fsBtn = el('button', 'chrome c-tr icon fade-idle no-drag');
  fsBtn.type = 'button';
  function syncFs() {
    var on = !!document.fullscreenElement;
    var label = on ? 'Leave full screen' : 'Fill the screen';
    clear(fsBtn).append(svgIcon(on ? FS_EXIT : FS_ENTER));
    fsBtn.title = label;
    fsBtn.setAttribute('aria-label', label);
  }
  fsBtn.onclick = function (ev) {
    ev.stopPropagation();
    if (document.fullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen();
      return;
    }
    var root = document.documentElement;
    var request = root.requestFullscreen || root.webkitRequestFullscreen;
    if (!request) return;
    /* rejects if the gesture is not trusted, or the browser simply refuses */
    var p = request.call(root);
    if (p && p.catch) p.catch(function () {});
  };
  document.addEventListener('fullscreenchange', syncFs);
  syncFs();

  lobby.append(lobbyNav, ldots, lobbyMenu.veil, lobbyMenu.menu);
  /* only where the browser can actually do it */
  if (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen) {
    lobby.append(fsBtn);
  }
  roomsBtn.onclick = function (ev) { ev.stopPropagation(); lobbyMenu.toggle(); };
  lobby.tabIndex = -1;
  app.append(lobby);
  function showCover(i, done) {
    var bg = covers[i], url = coverUrls[i];
    if (!bg || !url || bg.dataset.on) return false;
    bg.dataset.on = '1';
    var probe = new Image();
    probe.onload = probe.onerror = function () {
      bg.style.backgroundImage = 'url("' + url + '")';
      bg.classList.add('in');
      if (done) done();
    };
    probe.src = url;
    return true;
  }

  lobbyRail = Rail(rail, function (i) { syncLobby(i); showCover(i); });
  syncLobby(0);

  function lobbyKeys(e) {
    if (e.key === 'Escape' && lobbyMenu.isOpen()) { lobbyMenu.close(); return true; }
    if (e.key === 'r' || e.key === 'R') { lobbyMenu.toggle(); return true; }
    if (e.key === 'ArrowDown' || e.key === 'PageDown') { lobbyRail.step(1); return true; }
    if (e.key === 'ArrowUp' || e.key === 'PageUp') { lobbyRail.step(-1); return true; }
    if (e.key === 'Enter') {
      if (lobbyMenu.isOpen()) return true;
      var r = ROOMS[lobbyRail.index()];
      if (r) enterRoom(r);
      return true;
    }
    return false;
  }
  keyHandler = lobbyKeys;

  /* Out of a room or the About room and back to the lobby, landing on the
     panel you came from. Both exits do exactly this, and did it in two
     identical copies before. */
  function returnToLobby(view, roomIndex) {
    view.remove();
    liveRoom = null;
    here = null;
    lobby.hidden = false;
    lobby.focus({ preventScroll: true });
    keyHandler = lobbyKeys;
    lobbyRail.go(roomIndex);
    syncLobby(roomIndex);
  }

  /* ================= ROOM ================= */
  var liveRoom = null;
  /* What is on screen, in terms the agent tools can ask about and drive:
     null in the lobby, the room for the About room, and for a picture room
     its rail and its views as well. Kept beside liveRoom and cleared with
     it. */
  var here = null;

  function enterRoom(room) {
    if (room.type === 'about') return enterAbout(room);
    lobbyMenu.close();
    if (liveRoom) liveRoom.remove();
    if (!room.works.length) return;
    lobby.hidden = true;
    wanderAt(-1);
    var roomIndex = ROOMS.indexOf(room);

    var view = el('div', 'screen room');
    var rrail = el('div', 'rail');
    var urls = [], plates = [];
    room.works.forEach(function (w) {
      var slide = el('div', 'slide');
      var plate = el('div', 'plate');
      var url = pictureUrl(room.id, w);
      var amb = el('div', 'ambient');
      var img = el('img', 'art');
      img.alt = w.title;
      img.draggable = false;
      /* The picture fills the screen, so let the browser pick the copy that
         suits this display rather than always sending the original. The
         download link still points at the original — see downloadIcon. */
      var set = srcsetFor(room.id, w);
      img.addEventListener('load', function () { alignArt(view, img); });
      /* src is set by show() below, so the picture on screen is not competing
         with every other picture in the room for the connection */
      urls.push(url);
      plates.push({ img: img, amb: amb, set: set,
                    small: smallestUrl(room.id, w) });
      plate.append(amb, img);
      slide.append(plate);
      rrail.append(slide);
    });
    view.append(rrail);

    var info = el('div', 'info');
    var sheet = el('div', 'sheet');
    info.append(sheet);
    var mini = el('div', 'mini');
    var dots = el('div', 'dots');
    room.works.forEach(function (w, i) {
      var d = el('i', 'no-drag');
      d.onclick = function (ev) { ev.stopPropagation(); roomRail.go(i); };
      dots.append(d);
    });
    var count = el('div', 'count');
    /* The second axis. A work is usually one photograph, but a painting can
       also have a shot of it framed on a wall and a close-up of the
       brushwork — things a buyer cannot get from the flat scan. Those live
       left and right of the picture, while up and down keep meaning the next
       work. The whole axis is absent for a work with nothing extra to show:
       no arrows, no caption, no hint that anything is missing. */
    var vprev = el('button', 'viewnav prev fade-idle no-drag', '\u2039');
    var vnext = el('button', 'viewnav next fade-idle no-drag', '\u203a');
    vprev.type = 'button'; vnext.type = 'button';
    vprev.title = 'Previous view'; vnext.title = 'Next view';
    /* Says what this photograph is and how many there are. Sonali's feedback
       was that three affordances already on the page went unnoticed, so an
       unlabelled gesture would be found by nobody — the caption is the part
       that makes the arrows worth having. */
    var vcap = el('div', 'viewcap');
    var backhint = el('div', 'backhint');
    backhint.append(
      el('span', 'by-key', 'Space for the title \u00b7 Return or Esc to go back'),
      el('span', 'by-touch', 'Tap to bring the room back')
    );
    var back = el('button', 'chrome fade-idle no-drag', '← Lobby');
    back.type = 'button';
    var picsBtn = el('button', 'chrome fade-idle no-drag', 'Content');
    var roomNav = el('div', 'navstack');
    roomNav.append(back, picsBtn);
    picsBtn.type = 'button';
    view.append(info, mini, dots, count, backhint, roomNav, vprev, vnext, vcap);

    /* strict tree: no way sideways to another room from in here */
    var picsMenu = Menu(room.title, room.works.map(function (w) {
      return {
        src: bestUrl(room.id, w, THUMB_PX),
        title: w.title,
        meta: niceDate(w.date),
        badge: w.status !== 'available' ? STATUS[w.status] : null
      };
    }), function (i) { roomRail.go(i); });
    view.append(picsMenu.veil, picsMenu.menu);

    var bare = false, miniOn = false;
    function setBare(v) {
      bare = v;
      view.classList.toggle('bare', v);
      if (!v) setMini(false);
      alignAll(view);
    }
    function setMini(v) { miniOn = v; mini.classList.toggle('on', v); }

    /* A second of warm colour as the arrows arrive, so a visitor finds out
       there is more of this picture without having to be told. Restarted by
       hand — re-adding a class the element already carries does not replay
       an animation, and reading offsetWidth between the two is what forces
       the style to be recomputed in between. */
    function announceNav() {
      [vprev, vnext].forEach(function (b) {
        b.classList.remove('arriving');
        void b.offsetWidth;
        b.classList.add('arriving');
        /* Taken off again once it has played. The animation is filled both
           ways, so left on it would pin these colours over the hover state
           for as long as the room is open. The timer is for the case where
           animationend never comes at all. */
        clearTimeout(b._attn);
        b._attn = setTimeout(function () { b.classList.remove('arriving'); }, 1600);
      });
    }

    /* The frames of one work: its own picture first, then any further
       photographs of it. A work with no views has exactly one frame, which
       is what keeps the axis invisible for almost everything in the room. */
    function framesOf(w) {
      return [{ file: w.file, widths: w.widths, webp: w.webp, caption: '' }]
        .concat(w.views || []);
    }
    var frame = 0;

    /* Swap the picture in place. The rail does not move, the plate does not
       change, and the ambient wash stays on the work's own picture so the
       room's colour does not jump between views of the same painting. */
    function showFrame(n) {
      var i = roomRail.index();
      var w = room.works[i];
      var frames = framesOf(w);
      if (frames.length < 2) return false;
      /* Wraps, because with three views a dead end at either side is only
         annoying — there is no order to lose your place in. */
      frame = (n + frames.length) % frames.length;
      var f = frames[frame];
      var slot = plates[i];
      var set = srcsetFor(room.id, f);
      if (set) { slot.img.sizes = '100vw'; slot.img.srcset = set; }
      else slot.img.removeAttribute('srcset');
      slot.img.src = pictureUrl(room.id, f);
      slot.img.alt = f.caption ? w.title + ' \u2014 ' + f.caption : w.title;
      /* showPicture() only ever loads a plate once, so without this a work
         left on a close-up would still be showing it when you came back. */
      slot.shifted = frame !== 0;
      paintFrame(w, frames);
      return true;
    }

    /* The caption and the arrows, for whichever work is in front. */
    var navWasUp = false;
    function paintFrame(w, frames) {
      var many = frames.length > 1;
      /* Only on the way up. Paging between two works that both have views
         never takes the arrows away, so lighting them each time would be a
         nag; going past a work with none puts them away and earns the next
         appearance its moment. */
      if (many && !navWasUp) announceNav();
      navWasUp = many;
      vprev.hidden = vnext.hidden = !many;
      vcap.hidden = !many;
      if (!many) return;
      var f = frames[frame];
      clear(vcap).append(
        el('b', null, String(frame + 1) + ' / ' + String(frames.length)),
        document.createTextNode(f.caption || 'The work')
      );
    }

    function paint(i) {
      var w = room.works[i];
      picsMenu.mark(i);
      Array.prototype.forEach.call(dots.children, function (d, j) { d.classList.toggle('on', j === i); });
      clear(count).append(
        el('b', null, String(i + 1).padStart(2, '0')),
        document.createTextNode(' / ' + String(room.works.length).padStart(2, '0'))
      );
      clear(mini).append(el('b', null, w.title), document.createTextNode(niceDate(w.date)));
      history.replaceState(null, '', '#' + room.id + '/' + w.slug);

      var byline = w.artist || '';
      if (w.date) byline += (byline ? ' \u00b7 ' : '') + niceDate(w.date);
      var desc = el('p', 'desc');
      desc.append(markupNodes(w.description));
      var left = el('div');
      left.append(el('h2', null, w.title), el('p', 'by', byline), desc);

      var right = el('div');
      var dl = el('dl');
      if (w.medium) dl.append(el('dt', null, 'Medium'), el('dd', null, w.medium));
      if (w.dimensions) dl.append(el('dt', null, 'Size'), el('dd', null, w.dimensions));
      /* An original and a print are different things to buy, and the medium
         line alone does not say which this is. */
      if (w.edition) dl.append(el('dt', null, 'Edition'), el('dd', null, w.edition));
      /* What a buyer gets that a visitor cannot just download. Only where the
         work can still be had — it reads as a promise, not a description. */
      if (w.includes && w.includes.length && (w.status === 'available' || w.status === 'reserved')) {
        var dd = el('dd', 'includes');
        w.includes.forEach(function (t, n) {
          if (n) dd.append(el('br'));
          dd.append(markupNodes(t));
        });
        dl.append(el('dt', null, 'Includes'), dd);
      }
      right.append(dl);
      var line = el('div', 'buyline');
      var pending = w.status === 'available' &&
        window.ArtPending && window.ArtPending.isPending(w.uid);
      /* Three of the four branches below open with the same price, and it has
         to be a fresh node each time — a node can only be in one place. */
      function price() { return el('div', 'price', money(w.price, w.currency)); }
      if (pending && w.price != null) {
        line.append(price());
        /* the status is also the way back to the page it was sent from */
        var back = el('a', 'status pending no-drag', 'Sale pending');
        back.href = buyUrl(room.id, w.slug);
        line.append(back);
      } else if (w.status === 'available' && w.price != null) {
        line.append(price());
        var a = el('a', 'buy no-drag', 'Buy this picture');
        a.href = buyUrl(room.id, w.slug);
        line.append(a);
      } else if (w.status === 'reserved' && w.price != null) {
        /* price still shown, but it cannot be bought */
        line.append(price(), el('span', 'status', 'Reserved'));
      } else {
        /* sold and not-for-sale never show a price */
        line.append(el('span', 'status sold', STATUS[w.status] || 'Not for sale'));
      }
      if (w.uid) line.append(linkIcon(w.uid, 'Permanent link to ' + w.title));
      line.append(downloadIcon(room.id, w));
      right.append(line);
      clear(sheet).append(left, right);

      /* A new work always opens on its own picture. Landing on the third
         close-up of something you have not seen whole would be nonsense. */
      frame = 0;
      var slot = plates[i];
      if (slot && slot.shifted) {
        if (slot.set) { slot.img.sizes = '100vw'; slot.img.srcset = slot.set; }
        slot.img.src = urls[i];
        slot.img.alt = w.title;
        slot.shifted = false;
      }
      paintFrame(w, framesOf(w));
    }

    function showPicture(i, done) {
      var slot = plates[i];
      if (!slot || slot.on) return false;
      slot.on = true;
      slot.img.addEventListener('load', function () { done && done(); }, { once: true });
      slot.img.addEventListener('error', function () { done && done(); }, { once: true });
      if (slot.set) { slot.img.sizes = '100vw'; slot.img.srcset = slot.set; }
      slot.img.src = urls[i];
      /* The ambient wash behind the picture is blurred out of recognition,
         so it never needs more than the smallest copy. */
      slot.amb.style.backgroundImage = 'url("' + slot.small + '")';
      return true;
    }

    var roomRail = Rail(rrail, function (i) {
      paint(i);
      /* jumping somewhere new: fetch that one now, and its neighbours next */
      showPicture(i);
      showPicture(i + 1);
      showPicture(i - 1);
    });
    paint(0);

    /* Sideways on a touch screen, for the same reason the arrow keys are:
       the rail reads clientY only, so a horizontal drag moves it nowhere and
       the gesture was going spare. The rail has the pointer captured by the
       time these fire, but capture retargets rather than stops the event, so
       it still reaches this element on the way up. */
    var swipe = null, lastSwipe = -Infinity;
    view.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.no-drag') || e.target.closest('.menu')) { swipe = null; return; }
      swipe = { x: e.clientX, y: e.clientY };
    });
    view.addEventListener('pointerup', function (e) {
      if (!swipe) return;
      var dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
      swipe = null;
      /* Committed to one axis: a long enough throw, and clearly more across
         than down, so a slightly untidy vertical page never lands here. */
      if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
      if (showFrame(frame + (dx < 0 ? 1 : -1))) lastSwipe = performance.now();
    });

    /* a click anywhere clears the text; another brings it back */
    view.addEventListener('click', function (e) {
      if (e.target.closest('.no-drag') || e.target.closest('.menu')) return;
      if (roomRail.draggedRecently()) return;
      /* A swipe that changed the view must not also strip the label off:
         the rail only counts vertical travel, so it does not know one
         happened. */
      if (performance.now() - lastSwipe < 400) return;
      setBare(!bare);
    });
    back.onclick = function (ev) { ev.stopPropagation(); leave(); };
    picsBtn.onclick = function (ev) { ev.stopPropagation(); picsMenu.toggle(); };
    vprev.onclick = function (ev) { ev.stopPropagation(); showFrame(frame - 1); };
    vnext.onclick = function (ev) { ev.stopPropagation(); showFrame(frame + 1); };
    [vprev, vnext].forEach(function (b) {
      b.addEventListener('animationend', function () { b.classList.remove('arriving'); });
    });

    function leave() { returnToLobby(view, roomIndex); }

    keyHandler = function (e) {
      if (e.key === 'Escape') {
        if (picsMenu.isOpen()) { picsMenu.close(); return true; }
        if (bare) { setBare(false); return true; }
        leave(); return true;
      }
      /* Space only means anything in full screen. With the full label up it
         would print the title on top of itself in the same corner. */
      if (e.key === ' ') { if (bare) setMini(!miniOn); return true; }
      if (e.key === 'Enter') { if (!picsMenu.isOpen()) setBare(!bare); return true; }
      if (e.key === 'ArrowDown' || e.key === 'PageDown') { roomRail.step(1); return true; }
      if (e.key === 'ArrowUp' || e.key === 'PageUp') { roomRail.step(-1); return true; }
      /* Left and right were never bound to anything: the rail is vertical on
         every input it takes, so the horizontal axis was free for this. */
      if (e.key === 'ArrowRight') return showFrame(frame + 1);
      if (e.key === 'ArrowLeft') return showFrame(frame - 1);
      if (e.key === 't' || e.key === 'T' || e.key === 'p' || e.key === 'P') { picsMenu.toggle(); return true; }
      return false;
    };

    app.append(view);
    view.tabIndex = -1;
    view.focus({ preventScroll: true });
    liveRoom = view;
    here = {
      room: room, rail: roomRail, leave: leave,
      frames: function () { return framesOf(room.works[roomRail.index()]); },
      frame: function () { return frame; },
      showFrame: showFrame
    };
    alignAll(view);
    showPicture(0, function () {
      loadOneByOne(byDistance(room.works.length, roomRail.index()), showPicture);
    });
    return roomRail;
  }

  function enterAbout(room) {
    lobbyMenu.close();
    if (liveRoom) liveRoom.remove();
    lobby.hidden = true;
    wanderAt(-1);
    var roomIndex = ROOMS.indexOf(room);
    var coverUrl = room.cover ? bestUrl(room.id, room.cover, window.innerWidth) : null;

    var view = el('div', 'screen room');
    var pane = el('div', 'aboutroom' + (coverUrl ? '' : ' nocover'));
    var bg = el('div', 'bg');
    if (coverUrl) bg.style.backgroundImage = 'url("' + coverUrl + '")';
    var scrim = el('div', 'scrim');
    pane.append(bg, scrim, aboutBody(room));
    view.append(pane);

    /* the same light as the lobby, so the room feels like the panel it came from */

    var back = el('button', 'chrome fade-idle no-drag', '← Lobby');
    back.type = 'button';
    var nav = el('div', 'navstack');
    nav.append(back);
    view.append(nav);

    function leave() { returnToLobby(view, roomIndex); }
    back.onclick = function (ev) { ev.stopPropagation(); leave(); };

    /* Nothing to page through and no full screen, so Escape and Return both
       mean the one thing there is to do here. */
    keyHandler = function (e) {
      if (e.key === 'Escape' || e.key === 'Enter') { leave(); return true; }
      return false;
    };

    history.replaceState(null, '', '#' + room.id);
    app.append(view);
    view.tabIndex = -1;
    view.focus({ preventScroll: true });
    liveRoom = view;
    here = { room: room, leave: leave };
    return null;
  }

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { alignAll(liveRoom); }, 120);
  });

  document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    /* A focused button or link keeps Enter and Space for itself, so the
       menus stay operable from the keyboard. */
    if ((e.key === 'Enter' || e.key === ' ') && (tag === 'BUTTON' || tag === 'A')) return;
    if (keyHandler && keyHandler(e)) e.preventDefault();
  });

  /* Deep links: #room, or #room/slug to land on a picture. */
  /* ?id=<uid> — a permalink to a room or one picture. An id that no longer
     exists just leaves you in the lobby; there is nothing useful to say
     about it and an error page would be worse than the gallery. */
  function openFromId() {
    var uid = new URLSearchParams(location.search).get('id');
    if (!uid) return false;
    history.replaceState(null, '', location.pathname + location.hash);
    for (var i = 0; i < ROOMS.length; i++) {
      var room = ROOMS[i];
      if (room.uid === uid) {
        lobbyRail.go(i, true); syncLobby(i);
        enterRoom(room);
        return true;
      }
      for (var j = 0; j < room.works.length; j++) {
        if (room.works[j].uid === uid) {
          lobbyRail.go(i, true); syncLobby(i);
          var rail = enterRoom(room);
          if (rail) rail.go(j);
          return true;
        }
      }
    }
    return false;   /* unknown id: stay in the lobby, say nothing */
  }

  (function openFromHash() {
    if (openFromId()) return;
    var h = INITIAL_HASH;
    if (!h) return;
    var parts = h.split('/');
    var idx = -1;
    for (var i = 0; i < ROOMS.length; i++) if (ROOMS[i].id === parts[0]) idx = i;
    if (idx < 0) return;
    lobbyRail.go(idx, true);
    syncLobby(idx);
    if (parts[1] && ROOMS[idx].type !== 'about') {
      var r = enterRoom(ROOMS[idx]);
      var w = ROOMS[idx].works.findIndex(function (x) { return x.slug === parts[1]; });
      if (r && w > -1) r.go(w);
    }
  })();

  /* A title card for someone arriving at the front door, and only then — a
     deep link or a permalink means they already know where they are going.
     It ignores the pointer, so it never stands between the visitor and the
     gallery; the dismissal is a capturing listener instead. */
  var greeting = null;
  function showWelcome() {
    if (greeting) greeting();          /* clear one already on screen */
    var card = el('div', 'welcome');
    card.append(el('div', 'w-from', 'Welcome to'), el('div', 'w-title', 'art.klaushofrichter.net'));
    app.append(card);
    app.classList.add('greeting');
    var events = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    var timer = setTimeout(dismiss, 4200);
    var done = false;
    /* Listening starts now, not a frame later: a card that is on screen has to
       answer the very next click. The guard against the gesture that asked for
       the card is its timestamp, not a delay — waiting a frame left a window
       where a quick click did nothing at all. */
    var shownAt = performance.now();
    events.forEach(function (t) { window.addEventListener(t, dismiss, true); });
    requestAnimationFrame(function () { card.classList.add('on'); });
    function dismiss(e) {
      if (e && typeof e.timeStamp === 'number' && e.timeStamp < shownAt) return;
      if (done) return;
      done = true;
      clearTimeout(timer);
      events.forEach(function (t) { window.removeEventListener(t, dismiss, true); });
      if (greeting === dismiss) greeting = null;
      app.classList.remove('greeting');
      card.classList.remove('on');
      setTimeout(function () { card.remove(); }, 1200);
    }
    greeting = dismiss;
  }
  if (CAME_IN_BARE) showWelcome();

  /* ================= AGENT TOOLS (WebMCP) =================
     An agent in the browser gets the same gallery a visitor does, as
     functions rather than a rail it would have to drag. Everything comes from
     the manifest already in the page — which never carried a sold price — and
     every move goes through the navigation the page already has, so what the
     agent does is on screen as it happens.

     Nothing here buys, sends or submits. The furthest a tool goes is opening
     a purchase page, where the enquiry is still the visitor's own email to
     write. Input from the agent is matched against the manifest and only the
     matched entry's own id and slug are ever used, so nothing typed into a
     tool call becomes part of a URL. */
  (function registerAgentTools() {
    var mc = document.modelContext;
    if (!WEBMCP || !mc || typeof mc.registerTool !== 'function') return;

    var STATUS_WORDS = { available: 'available', reserved: 'reserved', sold: 'sold', nfs: 'not for sale' };

    /* Loose on purpose: an agent passes on whatever the person said, so
       "Golden beets", "golden-beets" and "Golden Béets" are the same thing. */
    function norm(v) {
      return String(v == null ? '' : v).toLowerCase().normalize('NFD')
        .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    }
    function plain(text) { return String(text || '').replace(/\*\*|\*/g, ''); }
    function amount(v) {
      if (typeof v === 'number') return v;
      var m = /\d+(?:[.,]\d+)?/.exec(String(v == null ? '' : v).replace(/,(?=\d{3}\b)/g, ''));
      return m ? parseFloat(m[0].replace(',', '.')) : NaN;
    }
    function pending(w) {
      return w.status === 'available' && window.ArtPending && window.ArtPending.isPending(w.uid);
    }
    function statusOf(w) { return pending(w) ? 'sale pending' : STATUS_WORDS[w.status] || w.status; }

    /* Exact matches first, then a name that contains what was asked for.
       More than one partial match is ambiguous, and saying so lets the agent
       ask rather than guess. */
    function pick(list, query, keys) {
      var q = norm(query);
      if (!q) return { none: true };
      var exact = list.filter(function (x) { return keys(x).some(function (k) { return norm(k) === q; }); });
      if (exact.length === 1) return { one: exact[0] };
      var loose = exact.length ? exact : list.filter(function (x) {
        return keys(x).some(function (k) { return norm(k).indexOf(q) > -1; });
      });
      if (loose.length === 1) return { one: loose[0] };
      return loose.length ? { many: loose } : { none: true };
    }
    function findRoom(query) {
      return pick(ROOMS, query, function (r) { return [r.id, r.title]; });
    }
    function findWork(query, roomQuery) {
      var rooms = ROOMS;
      if (roomQuery) {
        var r = findRoom(roomQuery);
        if (!r.one) return { error: 'No single room matches "' + roomQuery + '". Rooms: ' + roomNames() + '.' };
        rooms = [r.one];
      }
      var all = [];
      rooms.forEach(function (room) {
        room.works.forEach(function (w, i) { all.push({ room: room, work: w, index: i }); });
      });
      var got = pick(all, query, function (e) { return [e.work.slug, e.work.title]; });
      if (got.one) return got.one;
      if (got.many) {
        return { error: 'More than one picture matches "' + query + '": ' +
          got.many.map(function (e) { return e.work.title + ' (' + e.room.title + ')'; }).join(', ') +
          '. Say which, or name the room.' };
      }
      return { error: 'No picture matches "' + query + '". find-works lists them.' };
    }
    function roomNames() { return ROOMS.map(function (r) { return r.title; }).join(', '); }

    /* One picture as the page describes it. The price is only there when the
       page would show one; the manifest has none for sold work to give. */
    function describe(room, w) {
      var out = {
        room: room.title, title: w.title, artist: w.artist || undefined,
        date: w.date ? niceDate(w.date) : undefined,
        medium: w.medium || undefined, size: w.dimensions || undefined,
        edition: w.edition || undefined,
        description: plain(w.description) || undefined,
        status: statusOf(w)
      };
      if (w.price != null) out.price = money(w.price, w.currency);
      if (w.includes && w.includes.length && (w.status === 'available' || w.status === 'reserved')) {
        out.includes = w.includes.map(plain);
      }
      if (w.views && w.views.length) {
        out.otherViews = w.views.map(function (v) { return v.caption || v.kind; });
      }
      if (w.uid) out.permalink = permalink(w.uid);
      return out;
    }

    function dismissGreeting() { if (greeting) greeting(); }

    /* Into a room, the way the menu does it: the lobby moves to that panel
       first so leaving comes back to it. */
    function goToRoom(room) {
      dismissGreeting();
      if (here && here.room === room) return here;
      var i = ROOMS.indexOf(room);
      lobbyRail.go(i, true);
      syncLobby(i);
      enterRoom(room);
      return here;
    }

    function whereAmI() {
      if (!here) {
        var r = ROOMS[lobbyRail.index()];
        return { place: 'lobby', panel: r ? r.title : undefined,
                 note: 'The lobby shows one room per panel; show-room goes in.' };
      }
      if (!here.rail) return { place: 'room', room: here.room.title, kind: 'about',
                               about: plain(here.room.description) || undefined };
      var i = here.rail.index(), w = here.room.works[i];
      var frames = here.frames(), f = here.frame();
      var out = { place: 'room', room: here.room.title,
                  position: (i + 1) + ' of ' + here.room.works.length,
                  picture: describe(here.room, w) };
      if (frames.length > 1) {
        out.view = { number: f + 1, of: frames.length,
                     showing: f === 0 ? 'the work itself' : frames[f].caption || frames[f].kind };
      }
      return out;
    }

    var TOOLS = [
      {
        name: 'list-rooms',
        title: 'List the rooms',
        description: 'Lists the rooms of this art gallery: each room\'s title, what kind of ' +
          'work it holds, a short description and how many pictures are in it. The About ' +
          'room describes the artist and has no pictures to browse.',
        inputSchema: { type: 'object', properties: {} },
        annotations: { readOnlyHint: true },
        execute: function () {
          return { rooms: ROOMS.map(function (r) {
            return r.type === 'about'
              ? { room: r.title, kind: 'about the artist', description: plain(r.description) || undefined }
              : { room: r.title, kind: r.subtitle, description: plain(r.description) || undefined,
                  pictures: r.works.length };
          }) };
        }
      },
      {
        name: 'find-works',
        title: 'Find pictures',
        description: 'Searches the pictures in the gallery and returns their details: title, ' +
          'room, date, medium, size, edition, description, whether it can be bought, the price ' +
          'when it has one, and what a buyer receives. Every filter is optional; with none it ' +
          'returns everything.',
        inputSchema: {
          type: 'object',
          properties: {
            room: { type: 'string', description: 'A room title, such as "Food". Optional.' },
            status: { type: 'string', enum: ['available', 'reserved', 'sold', 'not for sale'],
                      description: 'Only pictures in this state. Optional.' },
            maxPrice: { type: ['number', 'string'], description: 'Highest price, in US dollars, e.g. 70 or "$70". Optional.' },
            text: { type: 'string', description: 'Words to look for in the title, description or medium. Optional.' }
          }
        },
        annotations: { readOnlyHint: true },
        execute: function (input) {
          input = input || {};
          var rooms = ROOMS.filter(function (r) { return r.type !== 'about'; });
          if (input.room) {
            var r = findRoom(input.room);
            if (!r.one) return { error: 'No single room matches "' + input.room + '". Rooms: ' + roomNames() + '.' };
            rooms = [r.one];
          }
          var max = input.maxPrice == null || input.maxPrice === '' ? null : amount(input.maxPrice);
          if (max !== null && isNaN(max)) return { error: 'maxPrice should be a number of dollars, such as 70.' };
          var want = input.status ? norm(input.status) : null;
          var words = norm(input.text).split(' ').filter(Boolean);
          var found = [];
          rooms.forEach(function (room) {
            room.works.forEach(function (w) {
              if (want && norm(STATUS_WORDS[w.status]) !== want) return;
              /* Only pictures that have a price can be under one. */
              if (max !== null && (w.price == null || w.price > max)) return;
              var hay = norm([w.title, plain(w.description), w.medium].join(' '));
              if (words.some(function (x) { return hay.indexOf(x) < 0; })) return;
              found.push(describe(room, w));
            });
          });
          return { count: found.length, pictures: found };
        }
      },
      {
        name: 'describe-current-view',
        title: 'What is on screen',
        description: 'Says what the visitor is looking at right now: the lobby and which ' +
          'room\'s panel, or the room, the picture with its details, and which photograph of it ' +
          'is showing when it has several.',
        inputSchema: { type: 'object', properties: {} },
        annotations: { readOnlyHint: true },
        execute: function () { return whereAmI(); }
      },
      {
        name: 'show-room',
        title: 'Go to a room',
        description: 'Takes the visitor into a room of the gallery, showing its first picture, ' +
          'or back out to the lobby when the room is "lobby".',
        inputSchema: {
          type: 'object',
          properties: {
            room: { type: 'string', description: 'A room title, such as "Colors", or "lobby".' }
          },
          required: ['room']
        },
        execute: function (input) {
          var q = input && input.room;
          dismissGreeting();
          if (norm(q) === 'lobby') {
            if (here) here.leave();
            return whereAmI();
          }
          var r = findRoom(q);
          if (!r.one) return { error: 'No single room matches "' + q + '". Rooms: ' + roomNames() + ', or "lobby".' };
          if (r.one.type !== 'about' && !r.one.works.length) return { error: r.one.title + ' has no pictures yet.' };
          goToRoom(r.one);
          return whereAmI();
        }
      },
      {
        name: 'show-work',
        title: 'Show a picture',
        description: 'Brings one picture onto the screen, going into its room if need be. ' +
          'Optionally shows one of its other photographs instead of the work itself: a framed ' +
          'shot or a close-up detail, where the picture has them.',
        inputSchema: {
          type: 'object',
          properties: {
            work: { type: 'string', description: 'The picture\'s title, such as "Undertow".' },
            room: { type: 'string', description: 'The room, when the title alone is ambiguous. Optional.' },
            view: { type: 'string', description: 'Which photograph: "framed", "detail", words from ' +
                    'its caption, or its number. Optional; the work itself by default.' }
          },
          required: ['work']
        },
        execute: function (input) {
          input = input || {};
          var hit = findWork(input.work, input.room);
          if (hit.error) return hit;
          goToRoom(hit.room);
          here.rail.go(hit.index);
          if (input.view != null && input.view !== '') {
            var frames = here.frames();
            var n = amount(input.view), k = -1;
            if (!isNaN(n) && /^\s*\d+\s*$/.test(String(input.view))) k = n - 1;
            else {
              var q = norm(input.view);
              frames.forEach(function (f, j) {
                if (k < 0 && j > 0 && (norm(f.kind) === q || norm(f.caption).indexOf(q) > -1)) k = j;
              });
            }
            if (frames.length < 2) {
              return { note: hit.work.title + ' has only the one photograph.', now: whereAmI() };
            }
            if (k < 0 || k >= frames.length) {
              return { note: 'No photograph of ' + hit.work.title + ' matches "' + input.view + '". It has: ' +
                       frames.map(function (f, j) { return (j + 1) + ' ' + (j ? f.caption || f.kind : 'the work itself'); }).join(', ') + '.',
                       now: whereAmI() };
            }
            here.showFrame(k);
          }
          return whereAmI();
        }
      },
      {
        name: 'next-view',
        title: 'Next photograph of this picture',
        description: 'On a picture that has more than one photograph — framed, or a close-up — ' +
          'shows the next or previous one. Wraps around at the ends.',
        inputSchema: {
          type: 'object',
          properties: {
            direction: { type: 'string', enum: ['next', 'previous'], description: 'Defaults to next.' }
          }
        },
        execute: function (input) {
          if (!here || !here.rail) return { error: 'No picture is on screen. show-work opens one.' };
          if (here.frames().length < 2) {
            return { note: 'This picture has only the one photograph.', now: whereAmI() };
          }
          var step = input && norm(input.direction) === 'previous' ? -1 : 1;
          here.showFrame(here.frame() + step);
          return whereAmI();
        }
      },
      {
        name: 'open-purchase-page',
        title: 'Open the purchase page',
        description: 'Opens the page for buying one picture, which shows the price and what ' +
          'is included and lets the visitor send an enquiry themselves. It does not buy or ' +
          'reserve anything. Only for pictures that are available.',
        inputSchema: {
          type: 'object',
          properties: {
            work: { type: 'string', description: 'The picture\'s title.' },
            room: { type: 'string', description: 'The room, when the title alone is ambiguous. Optional.' }
          },
          required: ['work']
        },
        execute: function (input) {
          input = input || {};
          var hit = findWork(input.work, input.room);
          if (hit.error) return hit;
          var w = hit.work;
          if (w.status !== 'available' || w.price == null) {
            return { error: w.title + ' is ' + statusOf(w) + ', so there is nothing to buy.' };
          }
          /* The answer goes back before the page does: once the tab navigates,
             this document and anything it was about to return are gone. */
          var url = buyUrl(hit.room.id, w.slug);
          setTimeout(function () { location.assign(url); }, 150);
          return { opening: location.origin + url, picture: describe(hit.room, w),
                   next: 'The visitor sends the enquiry from that page themselves.' };
        }
      }
    ];

    TOOLS.forEach(function (tool) {
      try {
        var p = mc.registerTool(tool);
        /* Rejected when the page may not use it (a Permissions-Policy, a
           frame) — which for an experiment means nothing more than "no". */
        if (p && p.catch) p.catch(function () {});
      } catch (_) {}
    });
  })();

  /* The cover you land on downloads by itself; the others queue behind it. */
  (function loadCovers() {
    var start = lobbyRail.index();
    showCover(start, function () {
      loadOneByOne(byDistance(ROOMS.length, start), showCover);
    });
  })();
})();
