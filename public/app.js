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
  var INITIAL_HASH = decodeURIComponent(location.hash.replace(/^#/, ''));

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
      if (it.src) { th.src = it.src; th.alt = ''; th.loading = 'lazy'; }
      var label = el('div');
      var meta = el('div', 'm', it.meta);
      if (it.badge) { meta.append(document.createTextNode(' \u00b7 '), el('span', 's', it.badge)); }
      label.append(el('div', 't', it.title), meta);
      b.append(th, label);
      b.style.transitionDelay = (0.03 + i * 0.035) + 's, ' + (0.03 + i * 0.035) + 's, 0s, 0s';
      b.onclick = function (ev) { ev.stopPropagation(); api.close(); onPick(i); };
      list.append(b);
    });
    m.append(head, list);
    var api = {
      veil: veil, menu: m,
      open: function () { veil.classList.add('on'); m.classList.add('on'); },
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

  var app = document.getElementById('app');
  var fallback = document.getElementById('fallback');
  if (fallback) fallback.remove();
  var keyHandler = null;

  /* ================= LOBBY ================= */
  var lobby = el('div', 'screen');
  var rail = el('div', 'rail');

  ROOMS.forEach(function (room) {
    var slide = el('div', 'slide');
    var p = el('div', 'lpanel' + (room.type === 'about' ? ' about' : ''));
    var bg = el('div', 'bg');
    if (room.cover) bg.style.backgroundImage = 'url("' + room.cover + '")';
    var scrim = el('div', 'scrim');
    p.append(bg, scrim);

    if (room.type === 'about' && room.about) {
      var a = room.about;
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
      p.append(body);
    } else {
      var cap = el('div', 'cap');
      var blurb = el('p', 'b');
      blurb.append(markupNodes(room.description));
      cap.append(
        el('span', 's', room.subtitle + ' \u00b7 ' + room.works.length + ' works'),
        el('div', 'n', room.title),
        blurb
      );
      var btn = el('button', 'enter no-drag', 'Enter the room →');
      btn.type = 'button';
      btn.onclick = function (ev) { ev.stopPropagation(); enterRoom(room); };
      cap.append(btn);
      p.append(cap);
    }

    /* pointer light and cover drift, both on the slow spring */
    if (!REDUCE) {
      var sx = Spring(LIGHT_K, LIGHT_D), sy = Spring(LIGHT_K, LIGHT_D), raf = 0;
      var paint = function () {
        sx.step(); sy.step();
        p.style.setProperty('--mx', (50 + sx.x * 58) + '%');
        p.style.setProperty('--my', (50 + sy.x * 58) + '%');
        if (room.cover) {
          bg.style.transform = 'scale(1.14) translate3d(' + (-sx.x * 3.8) + '%,' + (-sy.x * 3.8) + '%,0)';
        }
        if (sx.rest() && sy.rest()) { raf = 0; return; }
        raf = requestAnimationFrame(paint);
      };
      var run = function () { if (!raf) raf = requestAnimationFrame(paint); };
      p.addEventListener('pointermove', function (e) {
        var r = p.getBoundingClientRect();
        sx.t = (e.clientX - r.left) / r.width - 0.5;
        sy.t = (e.clientY - r.top) / r.height - 0.5;
        run();
      });
      p.addEventListener('pointerleave', function () { sx.t = 0; sy.t = 0; run(); });
    }
    slide.append(p);
    rail.append(slide);
  });
  lobby.append(rail);

  var lobbyRail;
  var roomsBtn = el('button', 'chrome c-tl fade-idle no-drag', 'Rooms');
  roomsBtn.type = 'button';
  var lobbyMenu = Menu('The Gallery', ROOMS.map(function (r) {
    return {
      src: r.cover,
      title: r.title,
      meta: r.type === 'about' ? 'Information' : r.works.length + ' works \u00b7 ' + r.subtitle
    };
  }), function (i) {
    if (ROOMS[i].type === 'about') lobbyRail.go(i); else enterRoom(ROOMS[i]);
  });
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
  lobby.append(roomsBtn, ldots, lobbyMenu.veil, lobbyMenu.menu);
  roomsBtn.onclick = function (ev) { ev.stopPropagation(); lobbyMenu.toggle(); };
  app.append(lobby);
  lobbyRail = Rail(rail, syncLobby);
  syncLobby(0);

  function lobbyKeys(e) {
    if (e.key === 'Escape' && lobbyMenu.isOpen()) { lobbyMenu.close(); return true; }
    if (e.key === 'r' || e.key === 'R') { lobbyMenu.toggle(); return true; }
    if (e.key === 'ArrowDown' || e.key === 'PageDown') { lobbyRail.step(1); return true; }
    if (e.key === 'ArrowUp' || e.key === 'PageUp') { lobbyRail.step(-1); return true; }
    if (e.key === 'Enter') {
      var r = ROOMS[lobbyRail.index()];
      if (r && r.type !== 'about') enterRoom(r);
      return true;
    }
    return false;
  }
  keyHandler = lobbyKeys;

  /* ================= ROOM ================= */
  var liveRoom = null;

  function enterRoom(room) {
    lobbyMenu.close();
    if (liveRoom) liveRoom.remove();
    if (!room.works.length) return;
    lobby.hidden = true;
    var roomIndex = ROOMS.indexOf(room);

    var view = el('div', 'screen room');
    var rrail = el('div', 'rail');
    room.works.forEach(function (w) {
      var slide = el('div', 'slide');
      var plate = el('div', 'plate');
      var amb = el('div', 'ambient');
      amb.style.backgroundImage = 'url("' + w.src + '")';
      var img = el('img', 'art');
      img.src = w.src;
      img.alt = w.title;
      img.draggable = false;
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
    var backhint = el('div', 'backhint', 'Click or Esc to bring the room back');
    var back = el('button', 'chrome c-tl fade-idle no-drag', '← Lobby');
    back.type = 'button';
    var picsBtn = el('button', 'chrome c-tr fade-idle no-drag', 'Pictures');
    picsBtn.type = 'button';
    view.append(info, mini, dots, count, backhint, back, picsBtn);

    /* strict tree: no way sideways to another room from in here */
    var picsMenu = Menu(room.title, room.works.map(function (w) {
      return {
        src: w.src,
        title: w.title,
        meta: niceDate(w.date),
        badge: w.status !== 'available' ? STATUS[w.status] : null
      };
    }), function (i) { roomRail.go(i); });
    view.append(picsMenu.veil, picsMenu.menu);

    var bare = false, miniOn = false;
    function setBare(v) { bare = v; view.classList.toggle('bare', v); }
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
      right.append(dl);
      var line = el('div', 'buyline');
      if (w.status === 'available' && w.price != null) {
        line.append(el('div', 'price', money(w.price, w.currency)));
        var a = el('a', 'buy no-drag', 'Buy this picture');
        a.href = w.purchaseUrl;
        line.append(a);
      } else if (w.status === 'reserved' && w.price != null) {
        /* price still shown, but it cannot be bought */
        line.append(el('div', 'price', money(w.price, w.currency)), el('span', 'status', 'Reserved'));
      } else {
        /* sold and not-for-sale never show a price */
        line.append(el('span', 'status sold', STATUS[w.status] || 'Not for sale'));
      }
      right.append(line);
      clear(sheet).append(left, right);
    }

    var roomRail = Rail(rrail, paint);
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
      if (e.key === ' ') { setMini(!miniOn); return true; }
      if (e.key === 'ArrowDown' || e.key === 'PageDown') { roomRail.step(1); return true; }
      if (e.key === 'ArrowUp' || e.key === 'PageUp') { roomRail.step(-1); return true; }
      if (e.key === 't' || e.key === 'T' || e.key === 'p' || e.key === 'P') { picsMenu.toggle(); return true; }
      return false;
    };

    app.append(view);
    liveRoom = view;
    return roomRail;
  }

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (keyHandler && keyHandler(e)) e.preventDefault();
  });

  /* Deep links: #room, or #room/slug to land on a picture. */
  (function openFromHash() {
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
})();
