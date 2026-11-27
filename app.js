/* Name Swipe v1.2 */
(function () {
  'use strict';

  var KEY = 'nameswipe.v1';
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  var defaults = {
    profiles: [{ id: 'p1', name: 'Sachin' }, { id: 'p2', name: 'Menz' }],
    active: 'p1',
    gender: 'all',
    votes: { p1: {}, p2: {} },
    custom: [],
    shuffle: false,
    seed: 1,
    hidePassed: false
  };

  var state = load();
  var history = [];
  var pool = [];

  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || '{}');
      var s = Object.assign({}, defaults, raw);
      s.votes = Object.assign({ p1: {}, p2: {} }, raw.votes || {});
      s.profiles = raw.profiles && raw.profiles.length === 2 ? raw.profiles : defaults.profiles.slice();
      s.custom = raw.custom || [];
      s.seed = raw.seed || 1;
      return s;
    } catch (e) { return JSON.parse(JSON.stringify(defaults)); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  function allNames() { return (window.NAMES || []).concat(state.custom); }
  function other(id) { return id === 'p1' ? 'p2' : 'p1'; }
  function profileName(id) {
    var p = state.profiles.filter(function (x) { return x.id === id; })[0];
    return (p && p.name && p.name.trim()) || (id === 'p1' ? 'Profile 1' : 'Profile 2');
  }
  function byId(id) { return allNames().filter(function (n) { return n.id === id; })[0]; }
  function liked(v) { return v === 'like' || v === 'super'; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, 2000);
  }

  /* ---------- shared shuffle ----------
     Both phones hold the same seed, so sortKey gives both the same order.
     Hashing each id means new names slot in without reshuffling the rest. */
  function sortKey(id, seed) {
    var h = (2166136261 ^ seed) >>> 0;
    for (var i = 0; i < id.length; i++) {
      h ^= id.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  function orderedNames() {
    var all = allNames();
    if (!state.shuffle) return all;
    var seed = state.seed || 1;
    return all.slice().sort(function (a, b) {
      var ka = sortKey(a.id, seed), kb = sortKey(b.id, seed);
      return ka === kb ? (a.id < b.id ? -1 : 1) : ka - kb;
    });
  }

  /* ---------- deck ---------- */
  function buildPool() {
    var mine = state.votes[state.active] || {};
    var theirs = state.votes[other(state.active)] || {};
    pool = orderedNames().filter(function (n) {
      if (state.gender !== 'all' && n.gender !== state.gender) return false;
      if (mine[n.id]) return false;
      if (state.hidePassed && theirs[n.id] === 'pass') return false;
      return true;
    });
  }

  function tagLabel(n) {
    if (n.tag === 'shortlist') return 'On our list';
    if (n.tag === 'blend') return 'Family blend';
    if (n.tag === 'custom') return 'Added by us';
    return '';
  }

  function cardHtml(n) {
    var peer = (state.votes[other(state.active)] || {})[n.id];
    var who = profileName(other(state.active));
    var peerLine = peer === 'super' ? who + ' starred this one'
      : peer === 'like' ? who + ' liked this one'
      : peer === 'pass' ? who + ' passed on this one'
      : who + ' has not seen this yet';
    var tags = '<span class="tag">' + (n.gender === 'boy' ? 'Boy' : 'Girl') + '</span>';
    if (tagLabel(n)) tags += '<span class="tag ' + n.tag + '">' + esc(tagLabel(n)) + '</span>';
    return '<div class="stamp yes">LIKE</div><div class="stamp no">PASS</div>' +
      '<div class="tags">' + tags + '</div>' +
      '<h1 class="name">' + esc(n.name) + '</h1>' +
      '<p class="origin">' + esc(n.origin || '') + '</p>' +
      '<p class="meaning">' + esc(n.meaning || '') + '</p>' +
      '<p class="peer">' + esc(peerLine) + '</p>';
  }

  function renderDeck() {
    var deck = $('#deck');
    deck.innerHTML = '';
    var top = pool.slice(0, 3).reverse();
    top.forEach(function (n, i) {
      var el = document.createElement('div');
      el.className = 'card ' + n.gender;
      el.dataset.id = n.id;
      el.innerHTML = cardHtml(n);
      var depth = top.length - 1 - i;
      el.style.transform = 'translateY(' + depth * 8 + 'px) scale(' + (1 - depth * 0.03) + ')';
      el.style.zIndex = String(10 + i);
      deck.appendChild(el);
    });
    var topCard = deck.lastElementChild;
    if (topCard) attachDrag(topCard);
    $('#deckEmpty').hidden = pool.length > 0;
    $('#actions').style.visibility = pool.length ? 'visible' : 'hidden';
    var total = orderedNames().filter(function (n) {
      return state.gender === 'all' || n.gender === state.gender;
    }).length;
    $('#counter').textContent = pool.length ? pool.length + ' of ' + total + ' left' : '';
    $('#emptyMsg').textContent = 'Every name in this filter has been through. Change the filter, add one of your own, or go again.';
  }

  function attachDrag(card) {
    var startX = 0, startY = 0, dx = 0, dy = 0, dragging = false;
    var yes = card.querySelector('.stamp.yes'), no = card.querySelector('.stamp.no');
    card.addEventListener('pointerdown', function (e) {
      if (e.button != null && e.button !== 0) return;
      dragging = true; startX = e.clientX; startY = e.clientY;
      card.style.transition = 'none'; card.style.cursor = 'grabbing';
      if (card.setPointerCapture) card.setPointerCapture(e.pointerId);
    });
    card.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      dx = e.clientX - startX; dy = e.clientY - startY;
      card.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(' + (dx / 18) + 'deg)';
      var p = Math.min(Math.abs(dx) / 110, 1);
      yes.style.opacity = dx > 0 ? p : 0;
      no.style.opacity = dx < 0 ? p : 0;
    });
    function up() {
      if (!dragging) return;
      dragging = false; card.style.cursor = 'grab';
      card.style.transition = 'transform .28s ease, opacity .28s ease';
      if (Math.abs(dx) > 100) fly(card, dx > 0 ? 'like' : 'pass');
      else {
        card.style.transform = 'translate(0,0) rotate(0)';
        yes.style.opacity = 0; no.style.opacity = 0;
      }
      dx = dy = 0;
    }
    card.addEventListener('pointerup', up);
    card.addEventListener('pointercancel', up);
  }

  function fly(card, verdict) {
    var id = card.dataset.id;
    var dir = verdict === 'pass' ? -1 : 1;
    card.style.transition = 'transform .3s ease, opacity .3s ease';
    card.style.transform = verdict === 'super'
      ? 'translateY(-520px) rotate(6deg)'
      : 'translate(' + dir * 480 + 'px,40px) rotate(' + dir * 22 + 'deg)';
    card.style.opacity = '0';
    vote(id, verdict);
    setTimeout(function () { buildPool(); renderDeck(); }, 180);
  }

  function vote(id, verdict) {
    state.votes[state.active][id] = verdict;
    history.push({ profile: state.active, id: id });
    save();
    if (window.Sync) Sync.pushVote(state.active, id, verdict);
    renderMatches();
    if (liked(verdict) && liked((state.votes[other(state.active)] || {})[id])) {
      var n = byId(id);
      if (n) toast('It’s a match: ' + n.name);
    }
  }

  function swipeTop(verdict) {
    var card = $('#deck').lastElementChild;
    if (!card) return;
    if (verdict !== 'super') {
      var st = card.querySelector(verdict === 'like' ? '.stamp.yes' : '.stamp.no');
      if (st) st.style.opacity = '1';
    }
    fly(card, verdict);
  }

  function undo() {
    var last = history.pop();
    if (!last) { toast('Nothing to undo'); return; }
    delete state.votes[last.profile][last.id];
    save();
    if (window.Sync) Sync.clearVote(last.profile, last.id);
    buildPool(); renderDeck(); renderMatches();
    var n = byId(last.id);
    toast(n ? 'Brought back ' + n.name : 'Undone');
  }

  /* ---------- rows ---------- */
  function miniHtml(n, right, withStar) {
    var v1 = (state.votes.p1 || {})[n.id], v2 = (state.votes.p2 || {})[n.id];
    var dots = '<span class="verd">' +
      '<span class="dot ' + (liked(v1) ? 'y' : v1 === 'pass' ? 'n' : '') + '"></span>' +
      '<span class="dot ' + (liked(v2) ? 'y' : v2 === 'pass' ? 'n' : '') + '"></span></span>';
    var star = '';
    if (withStar) {
      var on = v1 === 'super' || v2 === 'super';
      star = '<button class="starbtn ' + (on ? '' : 'off') + '" data-star="' + n.id + '" type="button" ' +
        'aria-label="Star">' + (on ? '★' : '☆') + '</button>';
    }
    return '<div class="mini ' + n.gender + '"><span class="swatch"></span>' +
      '<div class="m-main"><div class="m-name">' + esc(n.name) + '</div>' +
      '<div class="m-meta">' + esc(n.origin || '') + (n.meaning ? ' &middot; ' + esc(n.meaning) : '') + '</div></div>' +
      '<div class="m-right">' + (right ? '<span class="m-tag">' + right + '</span>' : '') + dots + star + '</div></div>';
  }

  function starred(n) {
    return (state.votes.p1 || {})[n.id] === 'super' || (state.votes.p2 || {})[n.id] === 'super';
  }

  /* ---------- matches ---------- */
  var matchFilter = 'all';
  function renderMatches() {
    var v1 = state.votes.p1 || {}, v2 = state.votes.p2 || {};
    var matches = [], solo = [];
    allNames().forEach(function (n) {
      if (liked(v1[n.id]) && liked(v2[n.id])) matches.push(n);
      else if (liked(v1[n.id]) || liked(v2[n.id])) solo.push(n);
    });
    matches.sort(function (a, b) {
      var sa = starred(a) ? 0 : 1, sb = starred(b) ? 0 : 1;
      return sa - sb || (a.name < b.name ? -1 : 1);
    });
    var shown = matches.filter(function (n) {
      if (matchFilter === 'star') return starred(n);
      if (matchFilter === 'boy' || matchFilter === 'girl') return n.gender === matchFilter;
      return true;
    });
    $('#matchList').innerHTML = shown.length
      ? shown.map(function (n) { return miniHtml(n, '', true); }).join('')
      : '<p class="hint">' + (matches.length ? 'None in this filter.' : 'No matches yet. Keep swiping.') + '</p>';
    $('#soloList').innerHTML = solo.length
      ? solo.map(function (n) {
          var who = liked(v1[n.id]) ? profileName('p1') : profileName('p2');
          return miniHtml(n, esc(who), false);
        }).join('')
      : '<p class="hint">Nothing here yet.</p>';
    var stars = matches.filter(starred).length;
    $('#matchHead').textContent = matches.length ? matches.length + ' matches' : 'Matches';
    $('#matchSub').textContent = matches.length
      ? (stars ? stars + ' starred. Those are the shortlist.' : 'Star the ones worth keeping.')
      : 'Names you both swipe right on land here.';
    var b = $('#matchBadge');
    b.hidden = matches.length === 0;
    b.textContent = matches.length;
  }

  function toggleStar(id) {
    var mine = state.votes[state.active] || {};
    var next = mine[id] === 'super' ? 'like' : 'super';
    state.votes[state.active][id] = next;
    save();
    if (window.Sync) Sync.pushVote(state.active, id, next);
    renderMatches();
    var n = byId(id);
    if (n) toast(next === 'super' ? 'Starred ' + n.name : 'Unstarred ' + n.name);
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-star]');
    if (b) toggleStar(b.dataset.star);
  });

  /* ---------- list ---------- */
  var listFilter = 'all';
  function renderList() {
    var q = ($('#search').value || '').trim().toLowerCase();
    var rows = orderedNames().filter(function (n) {
      if (listFilter === 'boy' || listFilter === 'girl') { if (n.gender !== listFilter) return false; }
      else if (listFilter !== 'all') { if (n.tag !== listFilter) return false; }
      if (!q) return true;
      return (n.name + ' ' + (n.origin || '') + ' ' + (n.meaning || '')).toLowerCase().indexOf(q) > -1;
    });
    $('#fullList').innerHTML = rows.length
      ? rows.map(function (n) { return miniHtml(n, esc(tagLabel(n) || ''), false); }).join('')
      : '<p class="hint">Nothing matches that search.</p>';
  }

  /* ---------- settings ---------- */
  function renderProfiles() {
    var c = $('#profileCards');
    c.innerHTML = state.profiles.map(function (p) {
      var v = state.votes[p.id] || {};
      var likes = Object.keys(v).filter(function (k) { return liked(v[k]); }).length;
      return '<label class="pcard ' + (state.active === p.id ? 'is-active' : '') + '">' +
        '<input type="radio" name="profile" value="' + p.id + '" ' + (state.active === p.id ? 'checked' : '') + ' />' +
        '<input type="text" data-pid="' + p.id + '" value="' + esc(p.name) + '" placeholder="Name" />' +
        '<span class="pstat">' + likes + ' liked</span></label>';
    }).join('');
    c.querySelectorAll('input[type=radio]').forEach(function (r) {
      r.addEventListener('change', function () {
        state.active = r.value; save(); history = [];
        renderProfiles(); renderPill(); buildPool(); renderDeck(); renderMatches();
      });
    });
    c.querySelectorAll('input[type=text]').forEach(function (t) {
      t.addEventListener('input', function () {
        var p = state.profiles.filter(function (x) { return x.id === t.dataset.pid; })[0];
        if (!p) return;
        p.name = t.value; save(); renderPill(); renderMatches(); renderDeck();
        clearTimeout(t._sync);
        t._sync = setTimeout(function () { if (window.Sync) Sync.pushProfile(p.id, p.name); }, 600);
      });
    });
    $('#optShuffle').checked = !!state.shuffle;
    $('#optHidePassed').checked = !!state.hidePassed;
  }

  function renderPill() {
    var n = profileName(state.active);
    $('#profilePill').textContent = (n.trim()[0] || '?').toUpperCase();
    $('#profilePill').setAttribute('aria-label', 'Swiping as ' + n + '. Tap to switch.');
  }

  function csv() {
    var head = ['Name', 'Gender', 'Origin', 'Meaning', 'Tag', profileName('p1'), profileName('p2'), 'Match', 'Starred'];
    var lines = [head];
    allNames().forEach(function (n) {
      var a = (state.votes.p1 || {})[n.id] || '', b = (state.votes.p2 || {})[n.id] || '';
      lines.push([n.name, n.gender, n.origin || '', n.meaning || '', n.tag || '', a, b,
        (liked(a) && liked(b)) ? 'yes' : '', starred(n) ? 'yes' : '']);
    });
    return lines.map(function (r) {
      return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\n');
  }
  function download() {
    var blob = new Blob([csv()], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'name-swipe-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- views ---------- */
  function switchView(v) {
    $$('.view').forEach(function (s) { s.classList.toggle('is-active', s.id === 'view-' + v); });
    $$('.tab').forEach(function (t) { t.classList.toggle('is-active', t.dataset.view === v); });
    if (v === 'settings') renderProfiles();
    if (v === 'matches') renderMatches();
  }

  $$('.tab').forEach(function (t) {
    t.addEventListener('click', function () { switchView(t.dataset.view); });
  });
  $('#profilePill').addEventListener('click', function () { switchView('settings'); });

  $$('#genderSeg .seg-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      state.gender = b.dataset.g; save();
      $$('#genderSeg .seg-btn').forEach(function (x) { x.classList.toggle('is-active', x === b); });
      buildPool(); renderDeck();
    });
  });

  $('#btnLike').addEventListener('click', function () { swipeTop('like'); });
  $('#btnPass').addEventListener('click', function () { swipeTop('pass'); });
  $('#btnSuper').addEventListener('click', function () { swipeTop('super'); });
  $('#btnUndo').addEventListener('click', undo);
  document.addEventListener('keydown', function (e) {
    if (!$('#view-swipe').classList.contains('is-active')) return;
    if ($('#listPanel').hidden === false || $('#addSheet').hidden === false) return;
    if (/input|textarea/i.test(e.target.tagName || '')) return;
    if (e.key === 'ArrowRight') swipeTop('like');
    if (e.key === 'ArrowLeft') swipeTop('pass');
    if (e.key === 'ArrowUp') swipeTop('super');
    if (e.key === 'ArrowDown') undo();
  });

  $$('#matchChips .chip').forEach(function (c) {
    c.addEventListener('click', function () {
      matchFilter = c.dataset.m;
      $$('#matchChips .chip').forEach(function (x) { x.classList.toggle('is-active', x === c); });
      renderMatches();
    });
  });

  function resetActive() {
    state.votes[state.active] = {}; save(); history = [];
    if (window.Sync) Sync.resetProfile(state.active);
    buildPool(); renderDeck(); renderMatches(); renderProfiles();
  }
  $('#btnResetDeck').addEventListener('click', resetActive);
  $('#btnResetProfile').addEventListener('click', function () {
    if (!confirm('Clear every swipe for ' + profileName(state.active) + '?')) return;
    resetActive(); toast('Swipes cleared');
  });

  $('#optShuffle').addEventListener('change', function (e) {
    state.shuffle = e.target.checked;
    if (state.shuffle && (!state.seed || state.seed === 1)) state.seed = (Date.now() % 2147483647) || 7;
    save();
    if (window.Sync) Sync.pushSettings({ shuffle: state.shuffle ? '1' : '0', seed: String(state.seed) });
    buildPool(); renderDeck();
  });
  $('#btnReshuffle').addEventListener('click', function () {
    state.seed = (Date.now() % 2147483647) || 7;
    state.shuffle = true; save();
    if (window.Sync) Sync.pushSettings({ shuffle: '1', seed: String(state.seed) });
    renderProfiles(); buildPool(); renderDeck();
    toast('New order, same on both phones');
  });
  $('#optHidePassed').addEventListener('change', function (e) {
    state.hidePassed = e.target.checked; save(); buildPool(); renderDeck();
  });

  $('#btnSyncNow').addEventListener('click', function () {
    if (window.Sync && Sync.on) { Sync.refresh(); toast('Checking...'); }
    else toast('Sync is not set up yet');
  });
  $('#btnExport').addEventListener('click', download);
  $('#btnWipe').addEventListener('click', function () {
    if (!confirm('This clears both profiles, their swipes and any names you added, on this phone. Continue?')) return;
    localStorage.removeItem(KEY);
    state = JSON.parse(JSON.stringify(defaults));
    history = []; save(); boot(); toast('All data cleared');
  });

  $('#btnOpenList').addEventListener('click', function () {
    $('#listPanel').hidden = false; renderList();
  });
  $('#listBack').addEventListener('click', function () { $('#listPanel').hidden = true; });
  $('#search').addEventListener('input', renderList);
  $$('#chips .chip').forEach(function (c) {
    c.addEventListener('click', function () {
      listFilter = c.dataset.f;
      $$('#chips .chip').forEach(function (x) { x.classList.toggle('is-active', x === c); });
      renderList();
    });
  });

  var addGender = 'boy';
  $$('#addGender .seg-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      addGender = b.dataset.g;
      $$('#addGender .seg-btn').forEach(function (x) { x.classList.toggle('is-active', x === b); });
    });
  });
  $('#btnAddOpen').addEventListener('click', function () { $('#addSheet').hidden = false; $('#addName').focus(); });
  $('#addCancel').addEventListener('click', function () { $('#addSheet').hidden = true; });
  $('#addSheet').addEventListener('click', function (e) { if (e.target.id === 'addSheet') $('#addSheet').hidden = true; });
  $('#addSave').addEventListener('click', function () {
    var name = $('#addName').value.trim();
    if (!name) { toast('Give it a name first'); return; }
    var id = 'custom-' + name.toLowerCase().replace(/[^a-z0-9]/g, '') + '-' + addGender;
    if (byId(id)) { toast('That one is already in the deck'); return; }
    state.custom.push({
      id: id, name: name, gender: addGender,
      origin: $('#addOrigin').value.trim(), meaning: $('#addMeaning').value.trim(), tag: 'custom'
    });
    save();
    if (window.Sync) Sync.pushName(state.custom[state.custom.length - 1]);
    $('#addName').value = ''; $('#addOrigin').value = ''; $('#addMeaning').value = '';
    $('#addSheet').hidden = true;
    buildPool(); renderDeck(); renderMatches();
    if ($('#listPanel').hidden === false) renderList();
    toast(name + ' added to the deck');
  });

  /* ---------- sync ---------- */
  function matchIds() {
    var v1 = state.votes.p1 || {}, v2 = state.votes.p2 || {};
    return allNames().filter(function (n) { return liked(v1[n.id]) && liked(v2[n.id]); })
      .map(function (n) { return n.id; });
  }

  function applyRemote(d) {
    var before = matchIds();
    var topId = pool.length ? pool[0].id : null;

    state.votes = { p1: d.votes.p1 || {}, p2: d.votes.p2 || {} };
    state.custom = d.custom || [];
    if (d.profileNames) {
      state.profiles.forEach(function (p) {
        if (d.profileNames[p.id]) p.name = d.profileNames[p.id];
      });
    }
    if (d.settings) {
      if (d.settings.seed) state.seed = parseInt(d.settings.seed, 10) || state.seed;
      if (d.settings.shuffle != null) state.shuffle = d.settings.shuffle === '1';
    }
    save();

    buildPool();
    if (topId) {
      var i = pool.map(function (n) { return n.id; }).indexOf(topId);
      if (i > 0) pool.unshift(pool.splice(i, 1)[0]);
    }
    renderDeck();
    renderMatches();
    if ($('#listPanel').hidden === false) renderList();
    var active = document.activeElement;
    if (!(active && active.closest && active.closest('.pcard'))) renderProfiles();
    renderPill();

    var fresh = matchIds().filter(function (id) { return before.indexOf(id) === -1; });
    if (fresh.length) {
      var n = byId(fresh[0]);
      if (n) toast(profileName(other(state.active)) + ' likes ' + n.name + ' too');
    }
  }

  var STATUS_TEXT = {
    off: 'Not syncing. Add your Supabase details in config.js.',
    connecting: 'Connecting...',
    live: 'Synced. Both phones are up to date.',
    pending: 'Saved here. Will sync when the connection is back.',
    offline: 'Offline. Your swipes are saved and will sync later.',
    error: 'Sync problem'
  };
  function onStatus(s, msg) {
    var el = $('#syncStatus');
    if (!el) return;
    el.dataset.s = s;
    el.textContent = (STATUS_TEXT[s] || s) + (s === 'error' && msg ? ': ' + msg : '');
  }

  if (window.Sync) Sync.init({ onRemote: applyRemote, onStatus: onStatus });

  /* ---------- update banner ---------- */
  function wireUpdates() {
    if (!('serviceWorker' in navigator)) return;
    var waiting = null;
    function offer(sw) { waiting = sw; $('#updateBar').hidden = false; }
    $('#updateGo').addEventListener('click', function () {
      $('#updateBar').hidden = true;
      if (waiting) waiting.postMessage({ type: 'SKIP_WAITING' });
      setTimeout(function () { location.reload(); }, 800);
    });
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', function () {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) offer(nw);
        });
      });
      setInterval(function () { reg.update(); }, 30 * 60 * 1000);
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) reg.update();
      });
    }).catch(function () {});
    var reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (reloaded) return;
      reloaded = true;
      location.reload();
    });
  }

  function boot() {
    $$('#genderSeg .seg-btn').forEach(function (x) { x.classList.toggle('is-active', x.dataset.g === state.gender); });
    renderPill(); renderProfiles(); buildPool(); renderDeck(); renderMatches();
  }
  boot();
  window.addEventListener('load', wireUpdates);
})();
