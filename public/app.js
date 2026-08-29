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
  function iconLink(cls, href, label, paths) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.innerHTML = paths;
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
    var link = iconLink('download', pictureUrl(roomId, w.file),
      'Download ' + w.title + ' at full resolution',
      '<path d="M12 4v11"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M4.5 19.5h15"/>');
    link.setAttribute('download', w.slug + ext);
    return link;
  }

  /* Every URL the page uses is built from a literal prefix plus encoded
     identifiers. Nothing that arrives as content is ever assigned to a src
     or an href, so no index.json can put "javascript:" behind a link. */
  function pictureUrl(roomId, file) {
    return '/assets/' + encodeURIComponent(roomId) + '/' + encodeURIComponent(file);
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
    var raf = 0, idx = 0, drag = null, lastDragEnd = 0;

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
  function Menu(title, items, onPick) {
    var veil = el('div', 'veil');
    var m = el('div', 'menu');
    var head = el('div', 'mhead');
    head.append(el('span', null, title));
    var close = el('button', null, 'Close');
    head.append(close);
    var list = el('div', 'mlist');
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
    m.append(head, list);
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

  /* The pointer light, and the drift of the picture under it. Both run on the
     slow spring, so the light keeps travelling for a moment after the pointer
     stops and settles back on its own. Used by the lobby panels and by the
     About room, so they feel like the same place. */
  function attachLight(host, bg, opts) {
    opts = opts || {};
    var sx = Spring(LIGHT_K, LIGHT_D), sy = Spring(LIGHT_K, LIGHT_D), raf = 0;
    function clamp(v) { return v < 0 ? 0 : v > 100 ? 100 : v; }
    function paint() {
      sx.step(); sy.step();
      host.style.setProperty('--mx', (50 + sx.x * 58) + '%');
      host.style.setProperty('--my', (50 + sy.x * 58) + '%');
      if (bg && opts.pan) {
        /* With background-size:cover the extremes of background-position land
           exactly on the picture's own corners, so the pointer can reach the
           top right of the picture and never past its edge. Clamped because
           the spring overshoots by design. */
        bg.style.backgroundPosition =
          clamp(50 + sx.x * 100) + '% ' + clamp(50 + sy.x * 100) + '%';
      } else if (bg) {
        bg.style.transform = 'scale(' + opts.scale + ') translate3d(' +
          (-sx.x * opts.drift) + '%,' + (-sy.x * opts.drift) + '%,0)';
      }
      if (sx.rest() && sy.rest()) { raf = 0; return; }
      raf = requestAnimationFrame(paint);
    }
    function run() { if (!raf) raf = requestAnimationFrame(paint); }
    host.addEventListener('pointermove', function (e) {
      var r = host.getBoundingClientRect();
      sx.t = (e.clientX - r.left) / r.width - 0.5;
      sy.t = (e.clientY - r.top) / r.height - 0.5;
      run();
    });
    host.addEventListener('pointerleave', function () { sx.t = 0; sy.t = 0; run(); });
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
    var coverUrl = room.coverFile ? pictureUrl(room.id, room.coverFile) : null;
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

    if (!REDUCE) attachLight(p, coverUrl ? bg : null, { scale: 1.14, drift: 1.3 });
    slide.append(p);
    rail.append(slide);
  });
  lobby.append(rail);

  var lobbyRail;
  var roomsBtn = el('button', 'chrome fade-idle no-drag', 'Rooms');
  var lobbyNav = el('div', 'navstack');
  lobbyNav.append(roomsBtn);
  roomsBtn.type = 'button';
  var lobbyMenu = Menu('The Gallery', ROOMS.map(function (r) {
    return {
      src: r.coverFile ? pictureUrl(r.id, r.coverFile) : null,
      title: r.title,
      meta: r.type === 'about' ? 'Information' : r.works.length + ' works \u00b7 ' + r.subtitle
    };
  }), function (i) { enterRoom(ROOMS[i]); });
  var ldots = el('div', 'dots');
  ROOMS.forEach(function (r, i) {
    var d = el('i', 'no-drag');
    d.onclick = function (ev) { ev.stopPropagation(); lobbyRail.go(i); };
    ldots.append(d);
  });
  function syncLobby(i) {
    lobbyMenu.mark(i);
    Array.prototype.forEach.call(ldots.children, function (d, j) { d.classList.toggle('on', j === i); });
    var r = ROOMS[i];
    history.replaceState(null, '', r ? '#' + r.id : '#');
  }
  lobby.append(lobbyNav, ldots, lobbyMenu.veil, lobbyMenu.menu);
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

  /* ================= ROOM ================= */
  var liveRoom = null;

  function enterRoom(room) {
    if (room.type === 'about') return enterAbout(room);
    lobbyMenu.close();
    if (liveRoom) liveRoom.remove();
    if (!room.works.length) return;
    lobby.hidden = true;
    var roomIndex = ROOMS.indexOf(room);

    var view = el('div', 'screen room');
    var rrail = el('div', 'rail');
    var urls = [], plates = [];
    room.works.forEach(function (w) {
      var slide = el('div', 'slide');
      var plate = el('div', 'plate');
      var url = pictureUrl(room.id, w.file);
      var amb = el('div', 'ambient');
      var img = el('img', 'art');
      img.alt = w.title;
      img.draggable = false;
      img.addEventListener('load', function () { alignArt(view, img); });
      /* src is set by show() below, so the picture on screen is not competing
         with every other picture in the room for the connection */
      urls.push(url); plates.push({ img: img, amb: amb });
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
    var backhint = el('div', 'backhint', 'Space for the title \u00b7 Return or Esc to go back');
    var back = el('button', 'chrome fade-idle no-drag', '← Lobby');
    back.type = 'button';
    var picsBtn = el('button', 'chrome fade-idle no-drag', 'Pictures');
    var roomNav = el('div', 'navstack');
    roomNav.append(back, picsBtn);
    picsBtn.type = 'button';
    view.append(info, mini, dots, count, backhint, roomNav);

    /* strict tree: no way sideways to another room from in here */
    var picsMenu = Menu(room.title, room.works.map(function (w) {
      return {
        src: pictureUrl(room.id, w.file),
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
      if (w.status === 'available' && w.price != null) {
        line.append(el('div', 'price', money(w.price, w.currency)));
        var a = el('a', 'buy no-drag', 'Buy this picture');
        a.href = buyUrl(room.id, w.slug);
        line.append(a);
      } else if (w.status === 'reserved' && w.price != null) {
        /* price still shown, but it cannot be bought */
        line.append(el('div', 'price', money(w.price, w.currency)), el('span', 'status', 'Reserved'));
      } else {
        /* sold and not-for-sale never show a price */
        line.append(el('span', 'status sold', STATUS[w.status] || 'Not for sale'));
      }
      if (w.uid) line.append(linkIcon(w.uid, 'Permanent link to ' + w.title));
      line.append(downloadIcon(room.id, w));
      right.append(line);
      clear(sheet).append(left, right);
    }

    function showPicture(i, done) {
      var slot = plates[i];
      if (!slot || slot.on) return false;
      slot.on = true;
      slot.img.addEventListener('load', function () { done && done(); }, { once: true });
      slot.img.addEventListener('error', function () { done && done(); }, { once: true });
      slot.img.src = urls[i];
      slot.amb.style.backgroundImage = 'url("' + urls[i] + '")';
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

    /* a click anywhere clears the text; another brings it back */
    view.addEventListener('click', function (e) {
      if (e.target.closest('.no-drag') || e.target.closest('.menu')) return;
      if (roomRail.draggedRecently()) return;
      setBare(!bare);
    });
    back.onclick = function (ev) { ev.stopPropagation(); leave(); };
    picsBtn.onclick = function (ev) { ev.stopPropagation(); picsMenu.toggle(); };

    function leave() {
      view.remove();
      liveRoom = null;
      lobby.hidden = false;
      lobby.focus({ preventScroll: true });
      keyHandler = lobbyKeys;
      lobbyRail.go(roomIndex);
      syncLobby(roomIndex);
    }

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
      if (e.key === 't' || e.key === 'T' || e.key === 'p' || e.key === 'P') { picsMenu.toggle(); return true; }
      return false;
    };

    app.append(view);
    view.tabIndex = -1;
    view.focus({ preventScroll: true });
    liveRoom = view;
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
    var roomIndex = ROOMS.indexOf(room);
    var coverUrl = room.coverFile ? pictureUrl(room.id, room.coverFile) : null;

    var view = el('div', 'screen room');
    var pane = el('div', 'aboutroom' + (coverUrl ? '' : ' nocover'));
    var bg = el('div', 'bg');
    if (coverUrl) bg.style.backgroundImage = 'url("' + coverUrl + '")';
    var scrim = el('div', 'scrim');
    pane.append(bg, scrim, aboutBody(room));
    view.append(pane);

    /* the same light as the lobby, so the room feels like the panel it came from */
    if (!REDUCE && coverUrl) attachLight(pane, bg, { pan: true });

    var back = el('button', 'chrome fade-idle no-drag', '← Lobby');
    back.type = 'button';
    var nav = el('div', 'navstack');
    nav.append(back);
    view.append(nav);

    function leave() {
      view.remove();
      liveRoom = null;
      lobby.hidden = false;
      lobby.focus({ preventScroll: true });
      keyHandler = lobbyKeys;
      lobbyRail.go(roomIndex);
      syncLobby(roomIndex);
    }
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

  /* The cover you land on downloads by itself; the others queue behind it. */
  (function loadCovers() {
    var start = lobbyRail.index();
    showCover(start, function () {
      loadOneByOne(byDistance(ROOMS.length, start), showCover);
    });
  })();
})();
