/* An enquiry someone has sent, remembered in their own browser.
   There is no server-side state here: the status in index.json is baked into
   the image and nothing can write to it at runtime. So this mark is visible
   only to the person who sent the mail — a second visitor still sees the
   picture as available, and two people can both enquire. It is a reminder,
   not a reservation, which is why it expires on its own after the same 48
   hours the email asks for. */
(function () {
  'use strict';
  var KEY = 'art:enquired';
  var WINDOW_MS = 48 * 60 * 60 * 1000;

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (_) { return {}; }
  }
  function write(map) {
    try { localStorage.setItem(KEY, JSON.stringify(map)); } catch (_) {}
  }
  /* Drop anything past its window on every read, so the store cannot grow and
     a lapsed enquiry cannot linger. */
  function live() {
    var map = read(), now = Date.now(), changed = false;
    Object.keys(map).forEach(function (uid) {
      if (!(map[uid] > now)) { delete map[uid]; changed = true; }
    });
    if (changed) write(map);
    return map;
  }

  window.ArtPending = {
    mark: function (uid) {
      if (!uid) return;
      var map = live();
      map[uid] = Date.now() + WINDOW_MS;
      write(map);
    },
    isPending: function (uid) { return !!uid && !!live()[uid]; }
  };

  /* On a purchase page: remember the enquiry when it is sent, and say so if
     one is already outstanding. */
  function wire() {
    var link = document.querySelector('[data-enquire-uid]');
    if (!link) return;
    var uid = link.getAttribute('data-enquire-uid');
    var note = document.querySelector('.pending-note');
    if (note && window.ArtPending.isPending(uid)) note.hidden = false;
    link.addEventListener('click', function () {
      window.ArtPending.mark(uid);
      if (note) note.hidden = false;
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
