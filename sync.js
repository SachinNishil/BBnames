/* Supabase sync for Name Swipe.
   Local storage stays the source of truth for the screen, so the app never
   waits on the network. Every change is queued, pushed, and pulled back. */
(function () {
  'use strict';

  var QKEY = 'nameswipe.queue.v1';
  var S = { client: null, h: null, status: 'off', timer: null, busy: false };

  function config() {
    var c = window.SUPABASE_CONFIG || {};
    if (!c.url || !c.anonKey) return null;
    if (String(c.url).indexOf('http') !== 0) return null;
    return c;
  }

  function queue() {
    try { return JSON.parse(localStorage.getItem(QKEY) || '[]'); } catch (e) { return []; }
  }
  function setQueue(q) {
    try { localStorage.setItem(QKEY, JSON.stringify(q)); } catch (e) {}
  }
  // Queue locally and push a moment later, so a fast run of swipes goes up as
  // one batch instead of one network round trip per card.
  function enqueue(op) {
    if (!S.client) return;
    var q = queue(); q.push(op); setQueue(q);
    setStatus('pending');
    nudge();
  }
  function setStatus(s, msg) {
    S.status = s;
    if (S.h && S.h.onStatus) S.h.onStatus(s, msg || '');
  }

  function apply(op) {
    var c = S.client;
    if (op.t === 'vote') {
      if (op.verdict === null) {
        return c.from('votes').delete().eq('profile_id', op.profile).eq('name_id', op.name);
      }
      return c.from('votes').upsert(
        { profile_id: op.profile, name_id: op.name, verdict: op.verdict, updated_at: new Date().toISOString() },
        { onConflict: 'profile_id,name_id' }
      );
    }
    if (op.t === 'reset') return c.from('votes').delete().eq('profile_id', op.profile);
    if (op.t === 'settings') {
      var rows = Object.keys(op.kv).map(function (k) { return { key: k, value: String(op.kv[k]) }; });
      return c.from('settings').upsert(rows, { onConflict: 'key' });
    }
    if (op.t === 'comment') {
      return c.from('comments').insert({
        name_id: op.row.name_id, profile_id: op.row.profile_id,
        body: op.row.body, created_at: op.row.created_at
      });
    }
    if (op.t === 'name') return c.from('names').upsert(op.row, { onConflict: 'id' });
    if (op.t === 'profile') {
      return c.from('profiles').upsert({ id: op.id, display_name: op.name }, { onConflict: 'id' });
    }
    return Promise.resolve({});
  }

  function flush() {
    var q = queue();
    if (!q.length) return Promise.resolve(true);
    var left = [];
    var chain = Promise.resolve();
    q.forEach(function (op) {
      chain = chain.then(function () {
        return apply(op).then(function (r) {
          if (r && r.error) left.push(op);
        }).catch(function () { left.push(op); });
      });
    });
    return chain.then(function () {
      setQueue(left);
      return left.length === 0;
    });
  }

  function pull() {
    var c = S.client;
    return Promise.all([
      c.from('votes').select('*'),
      c.from('names').select('*'),
      c.from('profiles').select('*'),
      c.from('settings').select('*'),
      c.from('comments').select('*').order('created_at', { ascending: true })
    ]).then(function (res) {
      var err = res.filter(function (r) { return r.error; })[0];
      if (err) { setStatus('error', err.error.message); return; }
      var votes = { p1: {}, p2: {} };
      res[0].data.forEach(function (r) {
        if (!votes[r.profile_id]) votes[r.profile_id] = {};
        votes[r.profile_id][r.name_id] = r.verdict;
      });
      var custom = res[1].data.map(function (r) {
        return { id: r.id, name: r.name, gender: r.gender, origin: r.origin || '', meaning: r.meaning || '', tag: r.tag || 'custom' };
      });
      var pnames = {};
      res[2].data.forEach(function (r) { pnames[r.id] = r.display_name; });
      var settings = {};
      (res[3] && res[3].data ? res[3].data : []).forEach(function (r) { settings[r.key] = r.value; });
      var comments = (res[4] && res[4].data ? res[4].data : []).map(function (r) {
        return { id: r.id, name_id: r.name_id, profile_id: r.profile_id, body: r.body, created_at: r.created_at };
      });
      if (S.h && S.h.onRemote) {
        S.h.onRemote({
          votes: votes, custom: custom, profileNames: pnames,
          settings: settings, comments: comments
        });
      }
      setStatus('live');
    }).catch(function (e) { setStatus('offline', String(e && e.message || e)); });
  }

  function sync() {
    if (!S.client || S.busy) return;
    if (!navigator.onLine) { setStatus('offline'); return; }
    S.busy = true;
    flush().then(function (clean) {
      if (!clean) { setStatus('pending'); return; }
      return pull();
    }).catch(function () { setStatus('offline'); })
      .then(function () { S.busy = false; });
  }

  var debounce;
  function nudge() {
    clearTimeout(debounce);
    debounce = setTimeout(sync, 500);
  }

  window.Sync = {
    get status() { return S.status; },
    get on() { return !!S.client; },
    init: function (handlers) {
      S.h = handlers || {};
      var c = config();
      if (!c) { setStatus('off'); return; }
      if (!window.supabase || !window.supabase.createClient) {
        setStatus('error', 'Sync library did not load'); return;
      }
      try {
        S.client = window.supabase.createClient(c.url, c.anonKey);
      } catch (e) { setStatus('error', String(e.message || e)); return; }
      setStatus('connecting');
      sync();
      try {
        S.client.channel('nameswipe')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, nudge)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'names' }, nudge)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, nudge)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, nudge)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, nudge)
          .subscribe();
      } catch (e) {}
      window.addEventListener('online', sync);
      S.timer = setInterval(sync, 20000);
    },
    pushVote: function (profile, name, verdict) { enqueue({ t: 'vote', profile: profile, name: name, verdict: verdict }); },
    clearVote: function (profile, name) { enqueue({ t: 'vote', profile: profile, name: name, verdict: null }); },
    pushComment: function (row) { enqueue({ t: 'comment', row: row }); },
    pushSettings: function (kv) { enqueue({ t: 'settings', kv: kv }); },
    resetProfile: function (profile) { enqueue({ t: 'reset', profile: profile }); },
    pushName: function (row) { enqueue({ t: 'name', row: row }); },
    pushProfile: function (id, name) { enqueue({ t: 'profile', id: id, name: name }); },
    refresh: sync
  };
})();
