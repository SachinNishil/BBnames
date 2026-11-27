/* Name Swipe - a two-profile swipe game for picking a name. */
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

  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, 1800);
  }

  /* ---------- deck ---------- */
  function buildPool() {
    var mine = state.votes[state.active] || {};
    var theirs = state.votes[other(state.active)] || {};
    pool = allNames().filter(function (n) {
      if (state.gender !== 'all' && n.gender !== state.gender) return false;
      if (mine[n.id]) return false;
      if (state.hidePassed && theirs[n.id] === 'pass') return false;
      return true;
    });
    if (state.shuffle) {
      for (var i = pool.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
      }
    }
  }

  function tagLabel(n) {
    if (n.tag === 'shortlist') return 'Already on our list';
    if (n.tag === 'blend') return 'Family blend';
    if (n.tag === 'custom') return 'Added by us';
    return '';
  }

  function cardHtml(n) {
    var peer = (state.votes[other(state.active)] || {})[n.id];
    var peerLine = peer === 'like'
      ? profileName(other(state.active)) + ' liked this one'
      : peer === 'pass' ? profileName(other(state.active)) + ' passed on this one'
      : profileName(other(state.active)) + ' has not seen this yet';
    var tags = '<span class="tag">' + esc(n.gender === 'boy' ? 'Boy' : 'Girl') + '</span>';
    if (tagLabel(n)) tags += '<span class="tag ' + n.tag + '">' + esc(tagLabel(n)) + '</span>';
    return '<div class="stamp yes">LIKE</div><div class="stamp no">PASS</div>' +
      '<div class="tags">' + tags + '</div>' +
      '<h1 class="name">' + esc(n.name) + '</h1>' +
      '<p class="origin">' + esc(n.origin || '') + '</p>' +
      '<p class="meaning">' + esc(n.meaning || '') + '</p>' +
      '<p class="peer">' + esc(peerLine) + '</p>';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
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
      el.style.transform = 'translateY(' + depth * 9 + 'px) scale(' + (1 - depth * 0.035) + ')';
      el.style.zIndex = String(10 + i);
      deck.appendChild(el);
    });
    var topCard = deck.lastElementChild;
    if (topCard) attachDrag(topCard);
    $('#deckEmpty').hidden = pool.length > 0;
    $('#actions').style.visibility = pool.length ? 'visible' : 'hidden';
    var total = allNames().filter(function (n) { return state.gender === 'all' || n.gender === state.gender; }).length;
    $('#counter').textContent = pool.length
      ? pool.length + ' of ' + total + ' left'
      : '';
    $('#emptyMsg').textContent = 'You have been through every name in this filter. Switch the filter, add your own, or go again.';
  }

  function attachDrag(card) {
    var startX = 0, startY = 0, dx = 0, dy = 0, dragging = false;
    var yes = card.querySelector('.stamp.yes'), no = card.querySelector('.stamp.no');

    function down(e) {
      if (e.button != null && e.button !== 0) return;
      dragging = true; startX = e.clientX; startY = e.clientY;
      card.style.transition = 'none'; card.style.cursor = 'grabbing';
      card.setPointerCapture && card.setPointerCapture(e.pointerId);
    }
    function move(e) {
      if (!dragging) return;
      dx = e.clientX - startX; dy = e.clientY - startY;
      var rot = dx / 18;
      card.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(' + rot + 'deg)';
      var p = Math.min(Math.abs(dx) / 110, 1);
      yes.style.opacity = dx > 0 ? p : 0;
      no.style.opacity = dx < 0 ? p : 0;
    }
    function up() {
      if (!dragging) return;
      dragging = false; card.style.cursor = 'grab';
      card.style.transition = 'transform .28s ease, opacity .28s ease';
      if (Math.abs(dx) > 100) { fly(card, dx > 0 ? 'like' : 'pass'); }
      else {
        card.style.transform = 'translate(0,0) rotate(0)';
        yes.style.opacity = 0; no.style.opacity = 0;
      }
      dx = dy = 0;
    }
    card.addEventListener('pointerdown', down);
    card.addEventListener('pointermove', move);
    card.addEventListener('pointerup', up);
    card.addEventListener('pointercancel', up);
  }

  function fly(card, verdict) {
    var id = card.dataset.id;
    var dir = verdict === 'like' ? 1 : -1;
    card.style.transition = 'transform .3s ease, opacity .3s ease';
    card.style.transform = 'translate(' + dir * 480 + 'px,40px) rotate(' + dir * 24 + 'deg)';
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
    if (verdict === 'like' && (state.votes[other(state.active)] || {})[id] === 'like') {
      var n = byId(id);
      if (n) toast('It is a match: ' + n.name);
    }
  }

  function swipeTop(verdict) {
    var card = $('#deck').lastElementChild;
    if (!card) return;
    var st = card.querySelector(verdict === 'like' ? '.stamp.yes' : '.stamp.no');
    if (st) st.style.opacity = '1';
    fly(card, verdict);
  }

  function undo() {
    var last = history.pop();
    if (!last) { toast('Nothing to undo'); return; }
    delete state.votes[last.profile][last.id];
    save();
    if (window.Sync) Sync.clearVote(last.profile, last.id); buildPool(); renderDeck(); renderMatches();
    var n = byId(last.id);
    toast(n ? 'Brought back ' + n.name : 'Undone');
  }

  /* ---------- matches ---------- */
  function miniHtml(n, right) {
    var v1 = (state.votes.p1 || {})[n.id], v2 = (state.votes.p2 || {})[n.id];
    var dots = '<span class="dot ' + (v1 === 'like' ? 'y' : v1 === 'pass' ? 'n' : '') + '"></span>' +
      '<span class="dot ' + (v2 === 'like' ? 'y' : v2 === 'pass' ? 'n' : '') + '"></span>';
    return '<div class="mini ' + n.gender + '"><div><div class="m-name">' + esc(n.name) + '</div>' +
      '<div class="m-meta">' + esc(n.origin || '') + (n.meaning ? ' &middot; ' + esc(n.meaning) : '') + '</div></div>' +
      '<div class="m-right">' + (right || '') + '<br>' + dots + '</div></div>';
  }

  function renderMatches() {
    var v1 = state.votes.p1 || {}, v2 = state.votes.p2 || {};
    var matches = [], solo = [];
    allNames().forEach(function (n) {
      if (v1[n.id] === 'like' && v2[n.id] === 'like') matches.push(n);
      else if (v1[n.id] === 'like' || v2[n.id] === 'like') solo.push(n);
    });
    $('#matchList').innerHTML = matches.length
      ? matches.map(function (n) { return miniHtml(n, 'both'); }).join('')
      : '<p class="hint">No matches yet. Keep swiping.</p>';
    $('#soloList').innerHTML = solo.length
      ? solo.map(function (n) {
          var who = (v1[n.id] === 'like') ? profileName('p1') : profileName('p2');
          return miniHtml(n, esc(who));
        }).join('')
      : '<p class="hint">Nothing here yet.</p>';
    $('#matchSub').textContent = matches.length
      ? matches.length + ' name' + (matches.length === 1 ? '' : 's') + ' you both swiped right on.'
      : 'Names you both swipe right on will land here.';
    var b = $('#matchBadge');
    b.hidden = matches.length === 0;
    b.textContent = matches.length;
  }

  /* ---------- list ---------- */
  var listFilter = 'all';
  function renderList() {
    var q = ($('#search').value || '').trim().toLowerCase();
    var rows = allNames().filter(function (n) {
      if (listFilter === 'boy' || listFilter === 'girl') { if (n.gender !== listFilter) return false; }
      else if (listFilter !== 'all') { if (n.tag !== listFilter) return false; }
      if (!q) return true;
      return (n.name + ' ' + (n.origin || '') + ' ' + (n.meaning || '')).toLowerCase().indexOf(q) > -1;
    });
    $('#fullList').innerHTML = rows.length
      ? rows.map(function (n) { return miniHtml(n, esc(tagLabel(n) || '')); }).join('')
      : '<p class="hint">Nothing matches that search.</p>';
  }

  /* ---------- settings ---------- */
  function renderProfiles() {
    var c = $('#profileCards');
    c.innerHTML = state.profiles.map(function (p) {
      var v = state.votes[p.id] || {};
      var likes = Object.keys(v).filter(function (k) { return v[k] === 'like'; }).length;
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
        if (p) {
          p.name = t.value; save(); renderPill(); renderMatches(); renderDeck();
          clearTimeout(t._sync);
          t._sync = setTimeout(function () {
            if (window.Sync) Sync.pushProfile(p.id, p.name);
          }, 600);
        }
      });
    });
    $('#optShuffle').checked = !!state.shuffle;
    $('#optHidePassed').checked = !!state.hidePassed;
  }

  function renderPill() {
    var n = profileName(state.active);
    $('#pillName').textContent = n;
    $('#pillAvatar').textContent = (n[0] || '?').toUpperCase();
  }

  function csv() {
    var head = ['Name', 'Gender', 'Origin', 'Meaning', 'Tag', profileName('p1'), profileName('p2'), 'Match'];
    var lines = [head];
    allNames().forEach(function (n) {
      var a = (state.votes.p1 || {})[n.id] || '', b = (state.votes.p2 || {})[n.id] || '';
      lines.push([n.name, n.gender, n.origin || '', n.meaning || '', n.tag || '', a, b, (a === 'like' && b === 'like') ? 'yes' : '']);
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

  /* ---------- wiring ---------- */
  function switchView(v) {
    $$('.view').forEach(function (s) { s.classList.toggle('is-active', s.id === 'view-' + v); });
    $$('.tab').forEach(function (t) { t.classList.toggle('is-active', t.dataset.view === v); });
    if (v === 'list') renderList();
    if (v === 'settings') renderProfiles();
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
  $('#btnUndo').addEventListener('click', undo);
  document.addEventListener('keydown', function (e) {
    if (!$('#view-swipe').classList.contains('is-active')) return;
    if (/input|textarea/i.test((e.target.tagName || ''))) return;
    if (e.key === 'ArrowRight') swipeTop('like');
    if (e.key === 'ArrowLeft') swipeTop('pass');
    if (e.key === 'ArrowDown') undo();
  });

  $('#btnResetDeck').addEventListener('click', function () {
    state.votes[state.active] = {}; save(); history = [];
    if (window.Sync) Sync.resetProfile(state.active);
    buildPool(); renderDeck(); renderMatches(); renderProfiles();
  });
  $('#btnResetProfile').addEventListener('click', function () {
    if (!confirm('Clear every swipe for ' + profileName(state.active) + '?')) return;
    state.votes[state.active] = {}; save(); history = [];
    if (window.Sync) Sync.resetProfile(state.active);
    buildPool(); renderDeck(); renderMatches(); renderProfiles();
    toast('Swipes cleared');
  });
  $('#optShuffle').addEventListener('change', function (e) {
    state.shuffle = e.target.checked; save(); buildPool(); renderDeck();
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
    if (!confirm('This clears both profiles, their swipes and any names you added. Continue?')) return;
    localStorage.removeItem(KEY);
    state = JSON.parse(JSON.stringify(defaults));
    history = []; save(); boot(); toast('All data cleared');
  });

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
    buildPool(); renderDeck(); renderList(); renderMatches();
    toast(name + ' added to the deck');
  });


  /* ---------- sync ---------- */
  function matchIds() {
    var v1 = state.votes.p1 || {}, v2 = state.votes.p2 || {};
    return allNames().filter(function (n) {
      return v1[n.id] === 'like' && v2[n.id] === 'like';
    }).map(function (n) { return n.id; });
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
    save();

    buildPool();
    if (topId) {
      var i = pool.map(function (n) { return n.id; }).indexOf(topId);
      if (i > 0) pool.unshift(pool.splice(i, 1)[0]);
    }
    renderDeck();
    renderMatches();
    if ($('#view-list').classList.contains('is-active')) renderList();

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

  function boot() {
    $$('#genderSeg .seg-btn').forEach(function (x) { x.classList.toggle('is-active', x.dataset.g === state.gender); });
    renderPill(); renderProfiles(); buildPool(); renderDeck(); renderMatches(); renderList();
  }
  boot();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
