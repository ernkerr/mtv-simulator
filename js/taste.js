// =========================================================
// TasteModel — the TV learns from how you channel-surf.
//
// Signals (all local, stored in localStorage):
//   - bailing on a video in the first seconds  -> negative
//   - watching most of it / until the end       -> positive
//   - LOVE / NOPE buttons                        -> strong explicit votes
//
// Scores are kept per genre tag and per artist. Selection is a
// softmax over candidate videos, so the TV drifts toward what you
// like without ever becoming a loop of the same five clips.
// =========================================================
(function () {
  const KEY = 'mtv.taste.v1';
  const ERA_TAGS = new Set(['80s', '90s']);
  const CLAMP = 8;

  const PRETTY = {
    'r&b': 'R&B', 'hip-hop': 'hip-hop', 'g-funk': 'G-funk', 'idm': 'IDM',
    'new-jack-swing': 'new jack swing', 'boy-band': 'boy bands', 'hair-metal': 'hair metal',
    'nu-metal': 'nu-metal', 'synth-pop': 'synth-pop', 'art-pop': 'art-pop', 'art-rock': 'art-rock',
    'trip-hop': 'trip-hop', 'big-beat': 'big beat', 'new-wave': 'new wave', 'neo-soul': 'neo-soul',
    'acid-jazz': 'acid jazz', 'eurodance': 'eurodance'
  };

  function pretty(tag) { return PRETTY[tag] || tag.replace(/-/g, ' '); }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && typeof d === 'object') return Object.assign(blank(), d);
      }
    } catch (e) { /* private mode, etc. */ }
    return blank();
  }

  function blank() {
    return { tags: {}, artists: {}, videos: {}, events: 0, watchedSec: 0, recent: [], blocked: {}, durations: {} };
  }

  class TasteModel {
    constructor() {
      this.data = load();
    }

    save() {
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ }
    }

    reset() {
      this.data = blank();
      this.save();
    }

    genreTags(video) { return video.tags.filter(t => !ERA_TAGS.has(t)); }

    // ---- learning -------------------------------------------------
    // strength: positive = liked, negative = disliked. |strength| ~ 0.3 .. 2
    // Returns the tag that moved the most, for the on-screen "noted:" toast.
    learn(video, strength, reason) {
      if (!video) return null;
      const tags = this.genreTags(video);
      const per = strength / Math.sqrt(Math.max(1, tags.length));
      let top = null;
      for (const t of tags) {
        const v = (this.data.tags[t] || 0) + per;
        this.data.tags[t] = Math.max(-CLAMP, Math.min(CLAMP, v));
        if (!top || Math.abs(this.data.tags[t]) > Math.abs(this.data.tags[top])) top = t;
      }
      // Era tags move at half weight so "80s" vs "90s" is a soft preference.
      for (const t of video.tags) if (ERA_TAGS.has(t)) {
        const v = (this.data.tags[t] || 0) + strength * 0.5;
        this.data.tags[t] = Math.max(-CLAMP, Math.min(CLAMP, v));
      }
      const a = (this.data.artists[video.artist] || 0) + strength;
      this.data.artists[video.artist] = Math.max(-CLAMP, Math.min(CLAMP, a));

      const vs = this.data.videos[video.id] || { plays: 0, skips: 0, loved: 0, noped: 0, finished: 0 };
      if (reason === 'skip') vs.skips++;
      if (reason === 'love') vs.loved++;
      if (reason === 'nope') vs.noped++;
      if (reason === 'finished') vs.finished++;
      this.data.videos[video.id] = vs;
      this.data.events++;
      this.save();
      return { tag: top, strength, reason };
    }

    // Called every time a video starts on the screen.
    notePlay(video) {
      const vs = this.data.videos[video.id] || { plays: 0, skips: 0, loved: 0, noped: 0, finished: 0 };
      vs.plays++;
      this.data.videos[video.id] = vs;
      const r = this.data.recent.filter(id => id !== video.id);
      r.unshift(video.id);
      this.data.recent = r.slice(0, 30);
      this.save();
    }

    noteWatched(seconds) {
      this.data.watchedSec += Math.max(0, seconds);
    }

    // Convert a viewing session into a signal.
    // watched: seconds actually watched; duration: known length (or null); ended: reached the end.
    signalFromWatch(video, watched, duration, ended) {
      if (!video) return null;
      this.noteWatched(watched);
      if (ended) return this.learn(video, 1.0, 'finished');
      const frac = duration ? watched / duration : null;
      if (watched < 6) return this.learn(video, -0.8, 'skip');      // instant bail: strong-ish no
      if (watched < 25) return this.learn(video, -0.35, 'skip');    // gave it a moment, then left
      if (frac !== null && frac > 0.6) return this.learn(video, 0.7, 'stayed');
      if (watched > 90) return this.learn(video, 0.5, 'stayed');
      return this.learn(video, 0.1, 'stayed');                      // neutral-ish
    }

    love(video) { return this.learn(video, 2.0, 'love'); }
    nope(video) { return this.learn(video, -2.0, 'nope'); }

    block(id) { this.data.blocked[id] = Date.now(); this.save(); }
    isBlocked(id) { return !!this.data.blocked[id]; }
    setDuration(id, sec) { if (sec > 30) { this.data.durations[id] = Math.round(sec); this.save(); } }
    duration(id) { return this.data.durations[id] || null; }

    // ---- scoring --------------------------------------------------
    score(video) {
      const tags = this.genreTags(video);
      let s = 0;
      for (const t of tags) s += (this.data.tags[t] || 0);
      s = tags.length ? s / tags.length : 0;
      for (const t of video.tags) if (ERA_TAGS.has(t)) s += (this.data.tags[t] || 0) * 0.3;
      s += (this.data.artists[video.artist] || 0) * 0.6;
      const vs = this.data.videos[video.id];
      if (vs) {
        s += vs.loved * 1.5 - vs.noped * 3 - vs.skips * 0.6 + vs.finished * 0.4;
        s -= Math.min(2, vs.plays * 0.25);           // gentle anti-repeat
      } else {
        s += 0.4;                                    // exploration bonus for unseen videos
      }
      const ri = this.data.recent.indexOf(video.id);
      if (ri >= 0) s -= (30 - ri) / 6;               // strongly avoid what just played
      return s;
    }

    // Weighted random pick. temperature: low = obey taste, high = stay eclectic.
    pick(candidates, temperature, excludeId) {
      const pool = candidates.filter(v => !this.isBlocked(v.id) && v.id !== excludeId);
      if (!pool.length) return null;
      const scored = pool.map(v => ({ v, s: this.score(v) }));
      const max = Math.max(...scored.map(x => x.s));
      const weights = scored.map(x => Math.exp((x.s - max) / temperature));
      const total = weights.reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      for (let i = 0; i < scored.length; i++) {
        r -= weights[i];
        if (r <= 0) return scored[i].v;
      }
      return scored[scored.length - 1].v;
    }

    // ---- reporting ------------------------------------------------
    confidence() {
      // 0..1, how much the TV thinks it knows you
      return Math.min(1, this.data.events / 25);
    }

    topTags(n, sign) {
      return Object.entries(this.data.tags)
        .filter(([t, v]) => !ERA_TAGS.has(t) && (sign > 0 ? v > 0.2 : v < -0.2))
        .sort((a, b) => sign > 0 ? b[1] - a[1] : a[1] - b[1])
        .slice(0, n)
        .map(([t, v]) => ({ tag: t, label: pretty(t), value: v }));
    }

    topArtists(n, sign) {
      return Object.entries(this.data.artists)
        .filter(([, v]) => sign > 0 ? v > 0.3 : v < -0.3)
        .sort((a, b) => sign > 0 ? b[1] - a[1] : a[1] - b[1])
        .slice(0, n)
        .map(([a, v]) => ({ artist: a, value: v }));
    }

    eraLean() {
      const e80 = this.data.tags['80s'] || 0, e90 = this.data.tags['90s'] || 0;
      if (Math.abs(e80 - e90) < 0.6) return null;
      return e80 > e90 ? '80s' : '90s';
    }

    summaryLine() {
      const likes = this.topTags(3, 1).map(t => t.label);
      const dislikes = this.topTags(2, -1).map(t => t.label);
      const parts = [];
      if (likes.length) parts.push('YOU LIKE: ' + likes.join(', ').toUpperCase());
      if (dislikes.length) parts.push('YOU SKIP: ' + dislikes.join(', ').toUpperCase());
      const era = this.eraLean();
      if (era) parts.push('LEANING ' + era.toUpperCase());
      if (!parts.length) return 'MTV YOU IS STILL LEARNING YOU. FLIP AROUND, HIT LOVE OR NOPE.';
      return parts.join('  ***  ');
    }

    stats() {
      const vids = Object.values(this.data.videos);
      return {
        events: this.data.events,
        videos: vids.length,
        finished: vids.reduce((a, v) => a + v.finished, 0),
        skips: vids.reduce((a, v) => a + v.skips, 0),
        loved: vids.reduce((a, v) => a + v.loved, 0),
        noped: vids.reduce((a, v) => a + v.noped, 0),
        minutes: Math.round(this.data.watchedSec / 60)
      };
    }
  }

  window.TasteModel = TasteModel;
  window.prettyTag = pretty;
})();
