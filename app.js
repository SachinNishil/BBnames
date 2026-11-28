/* Name Swipe v1.3 */
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
    comments: [],
    shuffle: false,
    seed: 1,
    theme: 'auto'
  };

  var state = load();
  var undoStack = [];
  var pool = [];
  var detailId = null;

  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || '{}');
      var s = Object.assign({}, defaults, raw);
      s.votes = Object.assign({ p1: {}, p2: {} }, raw.votes || {});
      s.profiles = raw.profiles && raw.profiles.length === 2 ? raw.profiles : defaults.profiles.slice();
      s.custom = raw.custom || [];
      s.comments = raw.comments || [];
      s.seed = raw.seed || 1;
      s.theme = raw.theme || 'auto';
      return s;
    } catch (e) { return JSON.parse(JSON.stringify(defaults)); }
  }
  function save() {
    clearTimeout(save._t); save._t = null;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }
  // Swipes land in memory at once and hit storage a moment later, so a fast
  // run of them never blocks on serialising the whole state each time.
  function saveSoon() {
    if (save._t) return;
    save._t = setTimeout(save, 400);
  }
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', function () { if (document.hidden) save(); });

  function allNames() { return (window.NAMES || []).concat(state.custom); }
  function other(id) { return id === 'p1' ? 'p2' : 'p1'; }
  function profileName(id) {
    var p = state.profiles.filter(function (x) { return x.id === id; })[0];
    return (p && p.name && p.name.trim()) || (id === 'p1' ? 'Profile 1' : 'Profile 2');
  }
  function initial(id) { return (profileName(id).trim()[0] || '?').toUpperCase(); }
  function byId(id) { return allNames().filter(function (n) { return n.id === id; })[0]; }
  function liked(v) { return v === 'like' || v === 'super'; }
  function vote1(n) { return (state.votes.p1 || {})[n.id]; }
  function vote2(n) { return (state.votes.p2 || {})[n.id]; }
  function starCount(n) { return (vote1(n) === 'super' ? 1 : 0) + (vote2(n) === 'super' ? 1 : 0); }

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

  /* ---------- theme ---------- */
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    var dark = state.theme === 'dark' ||
      (state.theme === 'auto' && window.matchMedia &&
       window.matchMedia('(prefers-color-scheme: dark)').matches);
    var m = $('#themeMeta');
    if (m) m.setAttribute('content', dark ? '#1E1A17' : '#FBF4EA');
    $$('#themeSeg .seg-btn').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.t === state.theme);
    });
  }

  /* ---------- navigation, with a back stack ---------- */
  var currentView = 'swipe';
  var navStack = [];

  function snapshot() {
    return {
      view: currentView,
      list: $('#listPanel').hidden === false,
      detail: $('#detailPanel').hidden === false ? detailId : null,
      history: $('#historyPanel').hidden === false,
      add: $('#addSheet').hidden === false
    };
  }
  function pushNav() {
    navStack.push(snapshot());
    try { history.pushState({ n: navStack.length }, ''); } catch (e) {}
  }
  function restore(s) {
    $('#historyPanel').hidden = !s.history;
    if (s.history) renderHistory();
    $('#addSheet').hidden = !s.add;
    $('#listPanel').hidden = !s.list;
    if (s.detail) { detailId = s.detail; renderDetail(); $('#detailPanel').hidden = false; }
    else $('#detailPanel').hidden = true;
    if (s.list) renderList();
    setView(s.view);
  }
  window.addEventListener('popstate', function () {
    if (navStack.length) restore(navStack.pop());
    else { try { history.pushState({ n: 0 }, ''); } catch (e) {} }
  });

  function setView(v) {
    currentView = v;
    $$('.view').forEach(function (s) { s.classList.toggle('is-active', s.id === 'view-' + v); });
    $$('.tab').forEach(function (t) { t.classList.toggle('is-active', t.dataset.view === v); });
    var settings = v === 'settings';
    $('#genderSeg').hidden = settings;
    $('#settingsTitle').hidden = !settings;
    $('#profilePill').classList.toggle('open', settings);
    if (settings) renderProfiles();
    if (v === 'matches') { renderMatchChips(); if (matchesDirty) renderMatches(); }
  }
  function goView(v) {
    if (v === currentView) return;
    pushNav();
    setView(v);
  }
  function openOverlay(fn) { pushNav(); fn(); }
  function closeTop() { if (navStack.length) history.back(); }

  /* ---------- shared shuffle ---------- */
  function sortKey(id, seed) {
    var h = (2166136261 ^ seed) >>> 0;
    for (var i = 0; i < id.length; i++) {
      h ^= id.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  var orderCache = null, orderCacheKey = '';
  function invalidateOrder() { orderCache = null; }
  function orderedNames() {
    var key = (state.shuffle ? '1' : '0') + ':' + (state.seed || 1) + ':' + state.custom.length;
    if (orderCache && orderCacheKey === key) return orderCache;
    var all = allNames();
    if (state.shuffle) {
      var seed = state.seed || 1;
      all = all.slice().sort(function (a, b) {
        var ka = sortKey(a.id, seed), kb = sortKey(b.id, seed);
        return ka === kb ? (a.id < b.id ? -1 : 1) : ka - kb;
      });
    }
    orderCache = all; orderCacheKey = key;
    return all;
  }

  /* ---------- deck ---------- */
  function buildPool() {
    var mine = state.votes[state.active] || {};
    pool = orderedNames().filter(function (n) {
      if (state.gender !== 'all' && n.gender !== state.gender) return false;
      return !mine[n.id];
    });
  }

  function tagLabel(n) {
    if (n.tag === 'shortlist') return 'On our list';
    if (n.tag === 'blend') return 'Family blend';
    if (n.tag === 'world') return 'World roots';
    if (n.tag === 'kerala') return 'Malayalam';
    if (n.tag === 'middle') return 'Middle ground';
    if (n.tag === 'custom') return 'Added by us';
    return '';
  }

  function cardHtml(n) {
    var tags = '<span class="tag">' + (n.gender === 'boy' ? 'Boy' : 'Girl') + '</span>';
    if (tagLabel(n)) tags += '<span class="tag ' + n.tag + '">' + esc(tagLabel(n)) + '</span>';
    return '<div class="stamp yes">LIKE</div><div class="stamp no">PASS</div>' +
      '<div class="tags">' + tags + '</div>' +
      '<h1 class="name">' + esc(n.name) + '</h1>' +
      '<p class="origin">' + esc(n.origin || '') + '</p>' +
      '<p class="meaning">' + esc(n.meaning || '') + '</p>';
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
    var startX = 0, dx = 0, dy = 0, dragging = false;
    var yes = card.querySelector('.stamp.yes'), no = card.querySelector('.stamp.no');
    card.addEventListener('pointerdown', function (e) {
      if (e.button != null && e.button !== 0) return;
      dragging = true; startX = e.clientX;
      card.style.transition = 'none'; card.style.cursor = 'grabbing';
      if (card.setPointerCapture) card.setPointerCapture(e.pointerId);
    });
    card.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      dx = e.clientX - startX;
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
      dx = 0;
    }
    card.addEventListener('pointerup', up);
    card.addEventListener('pointercancel', up);
  }

  function fly(card, verdict) {
    var id = card.dataset.id;
    if (!id || card.dataset.gone) return;
    card.dataset.gone = '1';
    var dir = verdict === 'pass' ? -1 : 1;

    // Move the leaving card onto its own layer, then rebuild the deck straight
    // away. The next card is live immediately, so rapid swipes never queue up.
    card.style.pointerEvents = 'none';
    $('#deckFx').appendChild(card);
    requestAnimationFrame(function () {
      card.style.transition = 'transform .28s ease-out, opacity .28s ease-out';
      card.style.transform = verdict === 'super'
        ? 'translateY(-560px) rotate(6deg)'
        : 'translate(' + dir * 520 + 'px,40px) rotate(' + dir * 22 + 'deg)';
      card.style.opacity = '0';
    });
    setTimeout(function () { if (card.parentNode) card.parentNode.removeChild(card); }, 340);

    pool = pool.filter(function (n) { return n.id !== id; });
    renderDeck();
    castVote(id, verdict, true);
  }

  function castVote(id, verdict, track) {
    var had = (state.votes[state.active] || {})[id];
    state.votes[state.active][id] = verdict;
    if (track) undoStack.push({ profile: state.active, id: id, was: had });
    saveSoon();
    if (window.Sync) Sync.pushVote(state.active, id, verdict);
    touchMatches();
    if (liked(verdict) && !liked(had) && liked((state.votes[other(state.active)] || {})[id])) {
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
    var last = undoStack.pop();
    if (!last) { toast('Nothing to undo'); return; }
    if (last.was) state.votes[last.profile][last.id] = last.was;
    else delete state.votes[last.profile][last.id];
    save();
    if (window.Sync) {
      if (last.was) Sync.pushVote(last.profile, last.id, last.was);
      else Sync.clearVote(last.profile, last.id);
    }
    buildPool(); renderDeck(); renderMatches();
    var n = byId(last.id);
    toast(n ? 'Brought back ' + n.name : 'Undone');
  }

  /* ---------- rows ---------- */
  var ICON = { like: '', pass: '', super: '★' };
  function slotHtml(pid, v) {
    var cls = v === 'super' ? 'super' : v === 'like' ? 'like' : v === 'pass' ? 'pass' : 'none';
    var glyph = v === 'super' ? '★' : v === 'pass' ? '✕' : v === 'like' ? '✓' : '';
    return '<span class="slot"><span class="ic ' + cls + '">' + glyph + '</span>' +
      '<span class="cap">' + esc(initial(pid)) + '</span></span>';
  }
  function commentsFor(id) {
    return state.comments.filter(function (c) { return c.name_id === id; })
      .sort(function (a, b) { return (a.created_at || '') < (b.created_at || '') ? -1 : 1; });
  }

  function rowHtml(n, tappable) {
    var cc = commentsFor(n.id).length;
    return '<button class="mini ' + n.gender + (tappable ? '' : ' flat') + '" data-open="' + n.id + '" type="button">' +
      '<span class="swatch"></span>' +
      '<span class="m-main"><span class="m-name">' + esc(n.name) + '</span>' +
      '<span class="m-meta">' + esc(n.origin || '') + (n.meaning ? ' &middot; ' + esc(n.meaning) : '') + '</span>' +
      (cc ? '<span class="cbadge">💬 ' + cc + '</span>' : '') + '</span>' +
      '<span class="m-right">' + slotHtml('p1', vote1(n)) + slotHtml('p2', vote2(n)) + '</span></button>';
  }

  /* ---------- matches ---------- */
  var matchFilter = 'all';
  var matchesDirty = true;

  function updateBadge() {
    var c = 0;
    allNames().forEach(function (n) { if (liked(vote1(n)) && liked(vote2(n))) c++; });
    var bd = $('#matchBadge');
    bd.hidden = c === 0;
    bd.textContent = c;
  }
  // Called after every vote: cheap counter now, full redraw only when visible.
  function touchMatches() {
    matchesDirty = true;
    updateBadge();
    if (currentView === 'matches') renderMatches();
  }

  function renderMatchChips() {
    var chips = [
      ['all', 'All'],
      ['star', '★ All stars, grouped'],
      ['dstar', '★★ Both starred'],
      ['mystar', '★ ' + profileName(state.active) + '’s stars'],
      ['theirstar', '★ ' + profileName(other(state.active)) + '’s stars'],
      ['plain', 'Liked, not starred'],
      ['commented', '💬 Has comments']
    ];
    $('#matchChips').innerHTML = chips.map(function (c) {
      return '<button class="chip ' + (matchFilter === c[0] ? 'is-active' : '') +
        '" data-m="' + c[0] + '" type="button">' + esc(c[1]) + '</button>';
    }).join('');
  }
  $('#matchChips').addEventListener('click', function (e) {
    var c = e.target.closest && e.target.closest('.chip');
    if (!c) return;
    matchFilter = c.dataset.m;
    renderMatchChips();
    renderMatches();
  });
  function matchQuery() {
    return ($('#matchSearch').value || '').trim().toLowerCase();
  }
  function hits(n, q) {
    if (state.gender !== 'all' && n.gender !== state.gender) return false;
    if (!q) return true;
    return (n.name + ' ' + (n.origin || '') + ' ' + (n.meaning || '')).toLowerCase().indexOf(q) > -1;
  }
  function byName(a, b) { return a.name < b.name ? -1 : 1; }
  function v(pid, n) { return (state.votes[pid] || {})[n.id]; }

  /* Every lens over the two sets of votes. A lens either filters flat, or
     gathers a base set and groups it by what the other person said. */
  function lenses() {
    var p1 = profileName('p1'), p2 = profileName('p2');
    return [
      { id: 'all', label: 'All matches',
        test: function (n) { return liked(v('p1', n)) && liked(v('p2', n)); } },
      { id: 'dstar', label: '\u2605\u2605 Both starred',
        test: function (n) { return v('p1', n) === 'super' && v('p2', n) === 'super'; } },

      { id: 'star1', label: '\u2605 ' + p1 + ' starred', group: 'p1',
        test: function (n) { return v('p1', n) === 'super'; } },
      { id: 'star2', label: '\u2605 ' + p2 + ' starred', group: 'p2',
        test: function (n) { return v('p2', n) === 'super'; } },
      { id: 'like1', label: '\u2665 ' + p1 + ' said yes', group: 'p1',
        test: function (n) { return liked(v('p1', n)); } },
      { id: 'like2', label: '\u2665 ' + p2 + ' said yes', group: 'p2',
        test: function (n) { return liked(v('p2', n)); } },

      { id: 'plain', label: 'Liked by both, no stars',
        test: function (n) { return liked(v('p1', n)) && liked(v('p2', n)) && starCount(n) === 0; } },
      { id: 'split', label: 'One yes, one no',
        test: function (n) {
          var a = v('p1', n), b = v('p2', n);
          return (liked(a) && b === 'pass') || (liked(b) && a === 'pass');
        } },
      { id: 'bothpass', label: 'Passed by both',
        test: function (n) { return v('p1', n) === 'pass' && v('p2', n) === 'pass'; } },

      { id: 'wait1', label: 'Waiting on ' + p1,
        test: function (n) { return !v('p1', n) && !!v('p2', n); } },
      { id: 'wait2', label: 'Waiting on ' + p2,
        test: function (n) { return !v('p2', n) && !!v('p1', n); } },
      { id: 'untouched', label: 'Neither has seen',
        test: function (n) { return !v('p1', n) && !v('p2', n); } },

      { id: 'commented', label: '\uD83D\uDCAC Has comments',
        test: function (n) { return commentsFor(n.id).length > 0; } }
    ];
  }
  function currentLens() {
    var all = lenses();
    for (var i = 0; i < all.length; i++) if (all[i].id === matchFilter) return all[i];
    return all[0];
  }

  function renderMatchChips() {
    $('#matchChips').innerHTML = lenses().map(function (c) {
      return '<button class="chip ' + (matchFilter === c.id ? 'is-active' : '') +
        '" data-m="' + c.id + '" type="button">' + esc(c.label) + '</button>';
    }).join('');
  }
  $('#matchChips').addEventListener('click', function (e) {
    var c = e.target.closest && e.target.closest('.chip');
    if (!c) return;
    matchFilter = c.dataset.m;
    renderMatchChips();
    renderMatches();
  });

  function section(title, note, rows) {
    if (!rows.length) return '';
    return '<div class="group-head"><b>' + esc(title) + '</b>' +
      (note ? '<span>' + esc(note) + '</span>' : '') + '</div>' +
      rows.map(function (n) { return rowHtml(n, true); }).join('');
  }

  /* Grouped lens: everything in the base set, best response first. */
  function renderGrouped(lens, q) {
    var mine = lens.group, theirs = other(mine);
    var who = profileName(theirs);
    var g = { super: [], like: [], pass: [], none: [] };
    allNames().forEach(function (n) {
      if (!hits(n, q) || !lens.test(n)) return;
      var t = v(theirs, n);
      g[t === 'super' ? 'super' : t === 'like' ? 'like' : t === 'pass' ? 'pass' : 'none'].push(n);
    });
    ['super', 'like', 'pass', 'none'].forEach(function (k) { g[k].sort(byName); });
    var total = g.super.length + g.like.length + g.pass.length + g.none.length;

    $('#matchList').innerHTML = total
      ? section(who + ' starred it too', 'The strongest agreement you have', g.super) +
        section(who + ' liked it', 'Agreed, one of you more than the other', g.like) +
        section(who + ' passed on it', 'Worth talking about', g.pass) +
        section(who + ' has not seen it yet', 'Still waiting', g.none)
      : '<p class="hint">' + (q ? 'Nothing here matches that search.' : 'Nothing here yet.') + '</p>';
    $('#soloHead').hidden = true;
    $('#soloList').hidden = true;
    $('#matchHead').textContent = total + ' ' + (total === 1 ? 'name' : 'names');
    $('#matchSub').textContent = lens.label.replace(/^[^A-Za-z]+/, '') +
      ', grouped by what ' + who + ' said.';
  }

  function renderMatches() {
    matchesDirty = false;
    var q = matchQuery();
    var lens = currentLens();

    if (lens.group) { renderGrouped(lens, q); updateBadge(); return; }

    var rows = [], solo = [];
    allNames().forEach(function (n) {
      if (!hits(n, q)) return;
      if (lens.test(n)) rows.push(n);
      if (lens.id === 'all') {
        var a = v('p1', n), b = v('p2', n);
        if (!(liked(a) && liked(b)) && (liked(a) || liked(b))) solo.push(n);
      }
    });
    rows.sort(function (a, b) { return starCount(b) - starCount(a) || byName(a, b); });
    solo.sort(byName);

    var showSolo = lens.id === 'all';
    $('#soloHead').hidden = !showSolo;
    $('#soloList').hidden = !showSolo;
    if (showSolo) {
      $('#soloList').innerHTML = solo.length
        ? solo.map(function (n) { return rowHtml(n, true); }).join('')
        : '<p class="hint">Nothing here yet.</p>';
    }

    $('#matchList').innerHTML = rows.length
      ? rows.map(function (n) { return rowHtml(n, true); }).join('')
      : '<p class="hint">' + (q ? 'No match for that search.' : 'Nothing in this filter yet.') + '</p>';

    var stars = rows.filter(function (n) { return starCount(n) > 0; }).length;
    $('#matchHead').textContent = lens.id === 'all'
      ? (rows.length ? rows.length + ' matches' : 'Matches')
      : rows.length + ' ' + (rows.length === 1 ? 'name' : 'names');
    $('#matchSub').textContent = lens.id === 'all'
      ? (rows.length ? (stars ? stars + ' of them starred.' : 'Tap any name to change your vote or leave a comment.')
         : 'Names you both swipe right on land here.')
      : lens.label.replace(/^[^A-Za-z]+/, '') + '.';
    updateBadge();
  }

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
      ? rows.map(function (n) { return rowHtml(n, true); }).join('')
      : '<p class="hint">Nothing matches that search.</p>';
  }

  /* ---------- detail ---------- */
  function renderDetail() {
    var n = byId(detailId);
    if (!n) return;
    $('#detailTitle').textContent = n.name;
    var mine = (state.votes[state.active] || {})[n.id];
    var theirId = other(state.active);
    var theirs = (state.votes[theirId] || {})[n.id];
    var theirWord = theirs === 'super' ? 'starred it' : theirs === 'like' ? 'liked it'
      : theirs === 'pass' ? 'passed on it' : 'has not seen it yet';

    var opts = [['pass', '✕', 'Pass'], ['like', '♥', 'Like'], ['super', '★', 'Star']];
    var votes = opts.map(function (o) {
      return '<button class="vote-btn ' + (mine === o[0] ? 'on' : '') + '" data-v="' + o[0] + '" type="button">' +
        '<b>' + o[1] + '</b>' + o[2] + '</button>';
    }).join('');

    var list = commentsFor(n.id);
    var cmts = list.length ? list.map(function (c) {
      var when = '';
      try { when = new Date(c.created_at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) {}
      return '<div class="cmt"><div class="who">' + esc(profileName(c.profile_id)) +
        '<i>' + esc(when) + '</i></div><div class="body">' + esc(c.body) + '</div></div>';
    }).join('') : '<p class="hint">No comments yet. Say what you think.</p>';

    $('#detailBody').innerHTML =
      '<div class="d-hero ' + n.gender + '"><div class="n">' + esc(n.name) + '</div>' +
      '<div class="o">' + esc(n.origin || '') + '</div>' +
      '<div class="m">' + esc(n.meaning || '') + '</div></div>' +
      '<div class="d-label">Your call</div><div class="vote-seg">' + votes + '</div>' +
      '<div class="d-label">' + esc(profileName(theirId)) + '</div>' +
      '<div class="their">' + slotHtml(theirId, theirs) + '<span>' + esc(profileName(theirId) + ' ' + theirWord) + '</span></div>' +
      '<div class="d-label">Comments</div>' + cmts;

    $$('#detailBody .vote-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.dataset.v;
        if (mine === v) { 
          delete state.votes[state.active][n.id];
          save();
          if (window.Sync) Sync.clearVote(state.active, n.id);
          renderMatches();
        } else {
          castVote(n.id, v, false);
        }
        buildPool(); renderDeck(); renderDetail();
        if ($('#listPanel').hidden === false) renderList();
      });
    });
  }

  function openDetail(id) {
    detailId = id;
    openOverlay(function () { renderDetail(); $('#detailPanel').hidden = false; });
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-open]');
    if (b) openDetail(b.dataset.open);
  });

  $('#commentForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var input = $('#commentInput');
    var body = input.value.trim();
    if (!body || !detailId) return;
    var c = {
      id: 'tmp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      name_id: detailId, profile_id: state.active, body: body,
      created_at: new Date().toISOString()
    };
    state.comments.push(c);
    save();
    if (window.Sync) Sync.pushComment(c);
    input.value = '';
    renderDetail(); renderMatches();
    if ($('#listPanel').hidden === false) renderList();
  });

  /* ---------- version history ---------- */
  function appVersion() {
    var log = window.CHANGELOG || [];
    return log.length ? log[0].version : '';
  }
  function renderHistory() {
    var log = window.CHANGELOG || [];
    if (!log.length) { $('#historyBody').innerHTML = '<p class="hint">No history recorded.</p>'; return; }
    $('#historyBody').innerHTML = log.map(function (v, i) {
      var when = v.date;
      try {
        when = new Date(v.date + 'T00:00:00').toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
      } catch (e) {}
      return '<div class="ver ' + (i === 0 ? 'now' : '') + '">' +
        '<div class="ver-top"><span class="ver-no">v' + esc(v.version) + '</span>' +
        (i === 0 ? '<span class="ver-now">You are here</span>' : '') +
        '<span class="ver-date">' + esc(when) + '</span></div>' +
        '<div class="ver-title">' + esc(v.title) + '</div>' +
        '<ul>' + (v.changes || []).map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' +
        '</div>';
    }).join('');
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
        state.active = r.value; save(); undoStack = [];
        renderProfiles(); renderPill(); buildPool(); renderDeck();
        renderMatchChips(); renderMatches();
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
    applyTheme();
  }

  function renderPill() {
    $('#profilePill').textContent = initial(state.active);
    $('#profilePill').setAttribute('aria-label', 'Swiping as ' + profileName(state.active) + '. Tap for settings.');
  }

  function csv() {
    var head = ['Name', 'Gender', 'Origin', 'Meaning', 'Tag', profileName('p1'), profileName('p2'),
      'Match', 'Stars', 'Comments'];
    var lines = [head];
    allNames().forEach(function (n) {
      var a = vote1(n) || '', b = vote2(n) || '';
      var cs = commentsFor(n.id).map(function (c) { return profileName(c.profile_id) + ': ' + c.body; }).join(' | ');
      lines.push([n.name, n.gender, n.origin || '', n.meaning || '', n.tag || '', a, b,
        (liked(a) && liked(b)) ? 'yes' : '', starCount(n) || '', cs]);
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
  $$('.tab').forEach(function (t) {
    t.addEventListener('click', function () { goView(t.dataset.view); });
  });
  $('#profilePill').addEventListener('click', function () {
    if (currentView === 'settings') closeTop();
    else goView('settings');
  });

  $$('#themeSeg .seg-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      state.theme = b.dataset.t; save(); applyTheme();
    });
  });
  if (window.matchMedia) {
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
    } catch (e) {}
  }

  $$('#genderSeg .seg-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      state.gender = b.dataset.g; save();
      $$('#genderSeg .seg-btn').forEach(function (x) { x.classList.toggle('is-active', x === b); });
      buildPool(); renderDeck();
      if (currentView === 'matches') renderMatches(); else matchesDirty = true;
    });
  });

  $('#btnLike').addEventListener('click', function () { swipeTop('like'); });
  $('#btnPass').addEventListener('click', function () { swipeTop('pass'); });
  $('#btnSuper').addEventListener('click', function () { swipeTop('super'); });
  $('#btnUndo').addEventListener('click', undo);
  document.addEventListener('keydown', function (e) {
    if (currentView !== 'swipe') return;
    if ($('#listPanel').hidden === false || $('#addSheet').hidden === false ||
        $('#detailPanel').hidden === false || $('#historyPanel').hidden === false) return;
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
    state.votes[state.active] = {}; save(); undoStack = [];
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
    save(); invalidateOrder();
    if (window.Sync) Sync.pushSettings({ shuffle: state.shuffle ? '1' : '0', seed: String(state.seed) });
    buildPool(); renderDeck();
  });
  $('#btnReshuffle').addEventListener('click', function () {
    state.seed = (Date.now() % 2147483647) || 7;
    state.shuffle = true; save(); invalidateOrder();
    if (window.Sync) Sync.pushSettings({ shuffle: '1', seed: String(state.seed) });
    renderProfiles(); buildPool(); renderDeck();
    toast('New order, same on both phones');
  });

  $('#btnSyncNow').addEventListener('click', function () {
    if (window.Sync && Sync.on) { Sync.refresh(); toast('Checking...'); }
    else toast('Sync is not set up yet');
  });
  $('#btnExport').addEventListener('click', download);
  $('#btnWipe').addEventListener('click', function () {
    if (!confirm('This clears both profiles, their swipes, comments and any names you added, on this phone. Continue?')) return;
    localStorage.removeItem(KEY);
    state = JSON.parse(JSON.stringify(defaults));
    undoStack = []; save(); boot(); toast('All data cleared');
  });

  $('#btnHistory').addEventListener('click', function () {
    openOverlay(function () { renderHistory(); $('#historyPanel').hidden = false; });
  });
  $('#historyBack').addEventListener('click', closeTop);
  $('#btnOpenList').addEventListener('click', function () {
    openOverlay(function () { $('#listPanel').hidden = false; renderList(); });
  });
  $('#listBack').addEventListener('click', closeTop);
  $('#detailBack').addEventListener('click', closeTop);
  $('#search').addEventListener('input', renderList);
  $('#matchSearch').addEventListener('input', renderMatches);
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
  $('#btnAddOpen').addEventListener('click', function () {
    openOverlay(function () { $('#addSheet').hidden = false; $('#addName').focus(); });
  });
  $('#addCancel').addEventListener('click', closeTop);
  $('#addSheet').addEventListener('click', function (e) { if (e.target.id === 'addSheet') closeTop(); });
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
    invalidateOrder();
    if (window.Sync) Sync.pushName(state.custom[state.custom.length - 1]);
    $('#addName').value = ''; $('#addOrigin').value = ''; $('#addMeaning').value = '';
    closeTop();
    buildPool(); renderDeck(); renderMatches();
    if ($('#listPanel').hidden === false) renderList();
    toast(name + ' added to the deck');
  });

  /* ---------- sync ---------- */
  function matchIds() {
    return allNames().filter(function (n) { return liked(vote1(n)) && liked(vote2(n)); })
      .map(function (n) { return n.id; });
  }

  function applyRemote(d) {
    var before = matchIds();
    var topId = pool.length ? pool[0].id : null;

    state.votes = { p1: d.votes.p1 || {}, p2: d.votes.p2 || {} };
    state.custom = d.custom || [];
    invalidateOrder();
    if (d.comments) state.comments = d.comments;
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
    if ($('#detailPanel').hidden === false && document.activeElement !== $('#commentInput')) renderDetail();
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
    applyTheme();
    $('#versionLine').textContent = 'Name Swipe v' + appVersion();
    $$('#genderSeg .seg-btn').forEach(function (x) { x.classList.toggle('is-active', x.dataset.g === state.gender); });
    renderPill(); renderProfiles(); buildPool(); renderDeck();
    renderMatchChips(); renderMatches();
    setView('swipe');
  }
  try { history.replaceState({ n: 0 }, ''); } catch (e) {}
  boot();
  window.addEventListener('load', wireUpdates);
})();
