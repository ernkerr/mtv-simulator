// =========================================================
// MTV — the television itself.
// Channels run on a virtual "live" schedule (they keep playing
// whether or not you're watching), the guide is a Prevue Channel
// homage, and every flip feeds the taste model.
// =========================================================
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const has = (v, tags) => tags.some(t => v.tags.includes(t));

  // ---------- channel lineup ----------
  const CHANNELS = [
    { num: 1,  key: 'mtv',     name: 'MTV',                sub: 'MUSIC TELEVISION',  blurb: 'Everything. All of it. All the time.', temp: 2.4, filter: () => true },
    { num: 2,  key: 'you',     name: 'MTV YOU',            sub: 'YOUR MIX',          blurb: 'Programmed entirely by your taste.',   temp: 0.9, filter: () => true, taste: true },
    { num: 3,  key: 'classic', name: 'VH1 CLASSIC',        sub: '80s REWIND',        blurb: 'Big hair, bigger synths.',             temp: 2.0, filter: v => v.tags.includes('80s') },
    { num: 4,  key: 'altnat',  name: 'ALTERNATIVE NATION', sub: 'ALT NATION',        blurb: 'Flannel, feedback, feelings.',         temp: 2.0, filter: v => has(v, ['grunge', 'alternative', 'punk']) && !v.tags.includes('80s') },
    { num: 5,  key: '120',     name: '120 MINUTES',        sub: 'LATE NIGHT',        blurb: 'Indie, Britpop and the weird stuff.',  temp: 2.0, filter: v => has(v, ['indie', 'britpop', 'art-pop', 'art-rock', 'trip-hop', 'noise', 'goth', 'acid-jazz']) },
    { num: 6,  key: 'raps',    name: 'YO! MTV RAPS',       sub: 'HIP-HOP',           blurb: 'Boom bap to G-funk.',                  temp: 2.0, filter: v => has(v, ['hip-hop', 'g-funk']) },
    { num: 7,  key: 'hbb',     name: 'HEADBANGERS BALL',   sub: 'METAL',             blurb: 'Loud. Louder. Dragula.',               temp: 2.0, filter: v => has(v, ['metal', 'hair-metal', 'industrial', 'nu-metal']) },
    { num: 8,  key: 'trl',     name: 'TRL',                sub: 'TOTAL REQUEST LIVE', blurb: 'The countdown. Times Square. Screaming.', temp: 2.0, filter: v => v.tags.includes('90s') && has(v, ['pop', 'boy-band', 'eurodance', 'dance', 'latin', 'ballad']) && !has(v, ['grunge', 'metal', 'hip-hop']) },
    { num: 9,  key: 'amp',     name: 'AMP',                sub: 'ELECTRONIC',        blurb: 'Big beat, house, techno, trip-hop.',   temp: 2.0, filter: v => has(v, ['electronic', 'house', 'techno', 'big-beat', 'trip-hop', 'idm', 'dance', 'eurodance']) },
    { num: 10, key: 'jams',    name: 'MTV JAMS',           sub: 'R&B',               blurb: 'Smooth. Slow jams and new jack swing.', temp: 2.0, filter: v => has(v, ['r&b', 'new-jack-swing', 'neo-soul', 'funk']) },
  ];
  const MIN_CH = 1, MAX_CH = CHANNELS.length;
  const byNum = (n) => CHANNELS.find(c => c.num === n) || null;

  const ADS = [
    'BLOCKBUSTER: BE KIND, REWIND. NEW RELEASES $3.99.',
    'RADIO SHACK: YOU\'VE GOT QUESTIONS. WE\'VE GOT ANSWERS.',
    'COLLECT CALL? DIAL DOWN THE CENTER: 1-800-C-A-L-L-A-T-T.',
    'NOW ON PAY-PER-VIEW: THE MATRIX. ORDER BEFORE 8PM.',
    'SET YOUR VCR. TAPE IT. WATCH IT AGAIN.',
    'TRL LIVE FROM TIMES SQUARE WEEKDAYS AT 3:30.',
    'MTV SPRING BREAK: CANCUN. ENOUGH SAID.',
    'THE BOOGIEVISION 27" CONSOLE: SOLID STATE. REAL WOOD. NO PAYMENTS UNTIL SPRING.',
    'DIAL-UP TIP: PICK UP THE PHONE AND LOSE THE CONNECTION.',
  ];

  // ---------- state ----------
  const taste = new TasteModel();
  const CATALOG = window.CATALOG.slice();
  const MOCK = /[?&]mock(=|&|$)/.test(location.search);
  const NOMINAL = 240; // seconds assumed for videos we haven't measured yet

  const S = {
    power: false,
    channel: 1,
    lastChannel: 1,
    volume: 70,
    muted: false,
    guideOpen: false,
    guideTab: 'listings',
    guideSel: 0,
    digits: '',
    sched: {},          // key -> {now, next, startedAt}
    watch: null,        // {video, channelKey, startedAt, ended}
    sessionBlocked: new Set(),
    ltShownEnd: false,
  };
  const timers = {};

  function loadState() {
    try {
      const d = JSON.parse(localStorage.getItem('mtv.state') || '{}');
      if (d.channel && byNum(d.channel)) S.channel = d.channel;
      if (typeof d.volume === 'number') S.volume = Math.max(0, Math.min(100, d.volume));
      if (typeof d.muted === 'boolean') S.muted = d.muted;
      if (d.lastChannel && byNum(d.lastChannel)) S.lastChannel = d.lastChannel;
    } catch (e) { /* ignore */ }
  }
  function saveState() {
    try { localStorage.setItem('mtv.state', JSON.stringify({ channel: S.channel, lastChannel: S.lastChannel, volume: S.volume, muted: S.muted })); } catch (e) { /* ignore */ }
  }

  // ---------- scheduling ----------
  function pool(ch) {
    return CATALOG.filter(ch.filter).filter(v => !S.sessionBlocked.has(v.id));
  }
  function pickFor(ch, excludeId) {
    const p = pool(ch);
    const v = taste.pick(p, ch.temp, excludeId);
    return v || p[Math.floor(Math.random() * p.length)] || null;
  }
  function durationOf(v) { return (v && taste.duration(v.id)) || NOMINAL; }

  function initSchedule() {
    for (const ch of CHANNELS) {
      const now = pickFor(ch, null);
      const next = pickFor(ch, now && now.id);
      // Each channel is already mid-program when you turn the set on.
      const offset = Math.floor(Math.random() * 150 + 10) * 1000;
      S.sched[ch.key] = { now, next, startedAt: Date.now() - offset };
    }
  }
  function advance(ch, atTime) {
    const s = S.sched[ch.key];
    s.now = s.next || pickFor(ch, s.now && s.now.id);
    s.next = pickFor(ch, s.now && s.now.id);
    s.startedAt = atTime || Date.now();
  }
  // Catch a channel up to "now" — videos ended while we weren't watching.
  function sync(ch) {
    const s = S.sched[ch.key];
    let guard = 0;
    while (s.now && (Date.now() - s.startedAt) / 1000 >= durationOf(s.now) && guard++ < 25) {
      advance(ch, s.startedAt + durationOf(s.now) * 1000);
    }
    return s;
  }
  function elapsed(ch) {
    const s = S.sched[ch.key];
    return Math.max(0, (Date.now() - s.startedAt) / 1000);
  }
  // Re-pick upcoming videos so channels reflect what the TV has learned.
  function refreshNext() {
    for (const ch of CHANNELS) {
      const s = S.sched[ch.key];
      if (s && s.now) s.next = pickFor(ch, s.now.id);
    }
  }

  // ---------- the player (YouTube IFrame API, or a mock for offline dev) ----------
  const Player = {
    ready: false, failed: false, p: null, currentId: null, loadedAt: 0,
    init(onReady) {
      if (MOCK) { installMock(); }
      const boot = () => {
        Player.p = new YT.Player('yt', {
          width: '100%', height: '100%',
          playerVars: {
            autoplay: 1, controls: 0, disablekb: 1, fs: 0, rel: 0, iv_load_policy: 3,
            modestbranding: 1, playsinline: 1, cc_load_policy: 0,
            origin: /^https?:/.test(location.protocol) ? location.origin : undefined
          },
          events: {
            onReady: () => { Player.ready = true; Player.applyVolume(); onReady(); },
            onStateChange: (e) => App.onPlayerState(e.data),
            onError: (e) => App.onPlayerError(e.data),
          }
        });
      };
      if (window.YT && window.YT.Player) return boot();
      window.onYouTubeIframeAPIReady = boot;
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.onerror = () => { Player.failed = true; App.noSignal('CAN\'T REACH YOUTUBE'); };
      document.head.appendChild(tag);
      clearTimeout(timers.apiWatch);
      timers.apiWatch = setTimeout(() => { if (!Player.ready) { Player.failed = true; App.noSignal('CAN\'T REACH YOUTUBE'); } }, 9000);
    },
    load(id, start) {
      if (!Player.ready) return;
      Player.currentId = id; Player.loadedAt = Date.now();
      Player.p.loadVideoById({ videoId: id, startSeconds: Math.max(0, Math.floor(start || 0)) });
      Player.applyVolume();
    },
    stop() { if (Player.ready) { try { Player.p.stopVideo(); } catch (e) { /* */ } } Player.currentId = null; },
    pause() { if (Player.ready) { try { Player.p.pauseVideo(); } catch (e) { /* */ } } },
    play() { if (Player.ready) { try { Player.p.playVideo(); } catch (e) { /* */ } } },
    applyVolume() {
      if (!Player.ready) return;
      try {
        if (S.muted) Player.p.mute(); else Player.p.unMute();
        Player.p.setVolume(S.volume);
      } catch (e) { /* */ }
    },
    time() { try { return Player.ready ? Player.p.getCurrentTime() || 0 : 0; } catch (e) { return 0; } },
    duration() { try { return Player.ready ? Player.p.getDuration() || 0 : 0; } catch (e) { return 0; } },
  };

  // A stand-in for the YouTube API so the TV can be developed/tested offline (?mock=1).
  function installMock() {
    const listeners = {};
    class MockPlayer {
      constructor(elId, opts) {
        this.el = $(elId); this.opts = opts; this.t = 0; this.dur = 32; this.state = -1; this.vol = 100; this.muted = false;
        this.el.style.cssText += ';display:grid;place-items:center;background:linear-gradient(135deg,#301040,#0a3040);color:#fff;font:700 28px sans-serif;';
        this.el.textContent = 'MOCK';
        setTimeout(() => opts.events.onReady({ target: this }), 50);
        setInterval(() => {
          if (this.state === 1) { this.t += 0.25; this.el.textContent = `MOCK ${this.id} ${this.t.toFixed(0)}s`; if (this.t >= this.dur) { this.state = 0; opts.events.onStateChange({ data: 0 }); } }
        }, 250);
      }
      loadVideoById({ videoId, startSeconds }) {
        this.id = videoId; this.t = startSeconds || 0; this.state = 3;
        this.opts.events.onStateChange({ data: 3 });
        if (/^bad/.test(videoId)) { setTimeout(() => this.opts.events.onError({ data: 150 }), 200); return; }
        setTimeout(() => { this.state = 1; this.opts.events.onStateChange({ data: 1 }); }, 300);
      }
      stopVideo() { this.state = 5; } pauseVideo() { this.state = 2; } playVideo() { this.state = 1; }
      mute() { this.muted = true; } unMute() { this.muted = false; } setVolume(v) { this.vol = v; }
      getCurrentTime() { return this.t; } getDuration() { return this.dur; }
    }
    window.YT = { Player: MockPlayer, PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } };
    window.__mockListeners = listeners;
  }

  // ---------- DOM ----------
  const el = {
    screen: $('screen'), snow: $('snow'), nosignal: $('nosignal'), nosignalSub: $('nosignalSub'),
    lt: $('lowerThird'), ltArtist: $('ltArtist'), ltTitle: $('ltTitle'), ltAlbum: $('ltAlbum'), ltLabel: $('ltLabel'),
    bug: $('bug'), bugSub: $('bugSub'),
    osdChannel: $('osdChannel'), osdNum: $('osdNum'), osdName: $('osdName'),
    osdVolume: $('osdVolume'), osdVolBar: $('osdVolBar'), osdMute: $('osdMute'), osdLearn: $('osdLearn'),
    guide: $('guide'), guideGrid: $('guideGrid'), guideClock: $('guideClock'), guideNow: $('guideNow'), guideTicker: $('guideTicker'),
    tastePanel: $('tastePanel'), led: $('led'), videoLayer: $('videoLayer'),
    channelDial: $('channelDial'), channelKnob: $('channelKnob'), channelTicks: $('channelTicks'),
    volumeDial: $('volumeDial'), volumeKnob: $('volumeKnob'), manual: $('manual'), manualBtn: $('manualBtn'),
  };

  // ---------- the dials on the set ----------
  const DIAL_START = -162; // degrees: channel 1 sits upper-left, channel 10 upper-right
  const DIAL_STEP = 36;
  function buildTicks() {
    el.channelTicks.innerHTML = CHANNELS.map((ch, i) => {
      const a = DIAL_START + i * DIAL_STEP;
      return `<span class="tick" data-num="${ch.num}" style="transform: rotate(${a}deg)"><i></i><b style="transform: translate(-50%, -50%) rotate(${-a}deg)">${ch.num}</b></span>`;
    }).join('');
  }
  function updateDials() {
    const ch = byNum(S.channel);
    const idx = ch ? CHANNELS.indexOf(ch) : -1;
    const angle = idx >= 0 ? DIAL_START + idx * DIAL_STEP : DIAL_START - 18; // off the end for a dead channel
    el.channelKnob.style.transform = `rotate(${angle}deg)`;
    el.channelDial.setAttribute('aria-valuenow', S.channel);
    el.channelTicks.querySelectorAll('.tick').forEach(t => t.classList.toggle('is-on', +t.dataset.num === S.channel));
    el.volumeKnob.style.transform = `rotate(${-135 + S.volume / 100 * 270}deg)`;
    el.volumeDial.setAttribute('aria-valuenow', S.volume);
  }

  // ---------- snow ----------
  const snowCtx = el.snow.getContext('2d');
  let snowRAF = 0;
  function drawSnow() {
    const w = el.snow.width, h = el.snow.height;
    const img = snowCtx.createImageData(w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
    }
    snowCtx.putImageData(img, 0, 0);
    // a rolling dark bar, like a lost vertical hold
    const y = (Date.now() / 6) % (h + 40) - 40;
    snowCtx.fillStyle = 'rgba(0,0,0,.35)'; snowCtx.fillRect(0, y, w, 26);
    snowRAF = requestAnimationFrame(drawSnow);
  }
  function snowOn() { if (!snowRAF) snowRAF = requestAnimationFrame(drawSnow); }
  function snowOff() { if (snowRAF) { cancelAnimationFrame(snowRAF); snowRAF = 0; } }

  function setScreenState(st) {
    el.screen.dataset.state = st;
    document.body.dataset.tv = st;
    if (st === 'static' || st === 'nosignal') snowOn(); else snowOff();
  }

  // ---------- OSD helpers ----------
  function flash(elm, ms, key) {
    elm.hidden = false;
    clearTimeout(timers[key]);
    timers[key] = setTimeout(() => { elm.hidden = true; }, ms);
  }
  function showChannelOSD(text, name, ms = 3000) {
    el.osdNum.textContent = text;
    el.osdName.textContent = name || '';
    flash(el.osdChannel, ms, 'osdChannel');
  }
  function showVolumeOSD() {
    const blocks = 20, on = Math.round(S.volume / 100 * blocks);
    el.osdVolBar.innerHTML = Array.from({ length: blocks }, (_, i) => `<i class="${i < on ? 'on' : ''}"></i>`).join('');
    flash(el.osdVolume, 1800, 'osdVolume');
  }
  function showLearn(note) {
    if (!note || !note.tag) return;
    const label = window.prettyTag(note.tag);
    let text;
    switch (note.reason) {
      case 'love': text = `♥ LOVED · MORE ${label.toUpperCase()}`; break;
      case 'nope': text = `✕ NOPE · LESS ${label.toUpperCase()}`; break;
      case 'skip': text = `✗ NOTED · LESS ${label.toUpperCase()}`; break;
      case 'finished': text = `✓ NOTED · MORE ${label.toUpperCase()}`; break;
      default: text = note.strength > 0.3 ? `✓ NOTED · MORE ${label.toUpperCase()}` : null;
    }
    if (!text) return;
    el.osdLearn.textContent = text;
    flash(el.osdLearn, 2400, 'osdLearn');
  }
  // The title card. Cuts in, holds, fades out. delay = seconds before it appears.
  function showLowerThird(v, ch, ms = 9000, delay = 0) {
    if (!v) return;
    clearTimeout(timers.ltDelay); clearTimeout(timers.lt); clearTimeout(timers.ltOut);
    const show = () => {
      if (!S.power || !S.watch || S.watch.video !== v || S.guideOpen) return;
      el.ltArtist.textContent = v.artist;
      el.ltTitle.textContent = v.title;
      el.ltAlbum.textContent = v.album || '';
      el.ltLabel.textContent = v.label || '';
      el.lt.classList.remove('is-leaving');
      el.lt.hidden = false;
      timers.lt = setTimeout(() => {
        el.lt.classList.add('is-leaving');
        timers.ltOut = setTimeout(() => { el.lt.hidden = true; el.lt.classList.remove('is-leaving'); }, 500);
      }, ms);
    };
    if (delay > 0) timers.ltDelay = setTimeout(show, delay * 1000); else show();
  }
  function showBug(ch) {
    el.bugSub.textContent = ch.key === 'mtv' ? '' : ch.sub;
    el.bug.hidden = false;
  }

  // ---------- the App ----------
  const App = {
    noSignal(sub) {
      el.nosignalSub.textContent = sub || '';
      el.nosignal.hidden = false;
      el.lt.hidden = true; el.bug.hidden = true;
      setScreenState('nosignal');
    },

    // --- power ---
    togglePower() { S.power ? App.powerOff() : App.powerOn(); },
    powerOn() {
      if (S.power) return;
      S.power = true;
      SFX.resume(); SFX.powerOn();
      el.led.className = 'jewel on';
      el.screen.classList.remove('is-powering-off');
      el.screen.classList.add('is-powering-on');
      setTimeout(() => el.screen.classList.remove('is-powering-on'), 600);
      setScreenState('static');
      if (!Player.ready && !Player.failed) {
        Player.init(() => App.tune(S.channel, { silent: true }));
        // while the API loads, keep snow on the tube
      } else if (Player.failed) {
        App.noSignal('CAN\'T REACH YOUTUBE');
      } else {
        App.tune(S.channel, { silent: true });
      }
    },
    powerOff() {
      if (!S.power) return;
      App.endWatch(false);
      S.power = false;
      if (S.guideOpen) App.closeGuide();
      SFX.powerOff();
      Player.stop();
      el.led.className = 'jewel standby';
      el.lt.hidden = true; el.bug.hidden = true; el.osdChannel.hidden = true; el.osdVolume.hidden = true; el.osdMute.hidden = true; el.osdLearn.hidden = true; el.nosignal.hidden = true;
      el.screen.classList.add('is-powering-off');
      setTimeout(() => { setScreenState('off'); el.screen.classList.remove('is-powering-off'); }, 460);
      clearTimeout(timers.watchdog); clearInterval(timers.poll);
    },

    // --- tuning ---
    tune(num, opts = {}) {
      const ch = byNum(num);
      if (!S.power) return;
      App.endWatch(false);
      if (!ch) {
        S.channel = num;
        updateDials();
        SFX.clunk();
        showChannelOSD(String(num).padStart(2, '0'), '');
        App.noSignal('');
        SFX.hiss(0.5, 0.4);
        return;
      }
      if (byNum(S.channel) && ch.num !== S.channel) S.lastChannel = S.channel;
      S.channel = ch.num;
      saveState();
      el.nosignal.hidden = true;
      clearTimeout(timers.ltDelay);

      updateDials();
      // the dial notches over, then a burst of static between channels
      if (!opts.silent) { SFX.clunk(); SFX.hiss(0.32, 0.35); }
      setScreenState('static');
      el.lt.hidden = true; el.bug.hidden = true;
      showChannelOSD(String(ch.num).padStart(2, '0'), ch.name);

      const s = sync(ch);
      if (!s.now) { App.noSignal('NOTHING SCHEDULED'); return; }
      const start = elapsed(ch);
      clearTimeout(timers.tuneIn);
      timers.tuneIn = setTimeout(() => {
        if (!S.power || S.channel !== ch.num) return;
        App.startWatch(s.now, ch, start);
      }, opts.silent ? 120 : 340);
      if (S.guideOpen) App.renderGuide();
    },
    channelUp() { App.tune(S.channel >= MAX_CH ? MIN_CH : S.channel + 1); },
    channelDown() { App.tune(S.channel <= MIN_CH ? MAX_CH : S.channel - 1); },
    last() { App.tune(S.lastChannel); },

    digit(d) {
      if (!S.power) return;
      SFX.blip(true);
      S.digits = (S.digits + d).slice(-2);
      showChannelOSD(S.digits.padEnd(2, '_'), '', 1500);
      clearTimeout(timers.digits);
      if (S.digits.length === 2) return App.commitDigits();
      timers.digits = setTimeout(App.commitDigits, 1300);
    },
    commitDigits() {
      const n = parseInt(S.digits, 10); S.digits = '';
      if (!isNaN(n)) App.tune(n);
    },

    // --- watching a video ---
    startWatch(video, ch, startSeconds) {
      S.watch = { video, channelKey: ch.key, startedAt: Date.now(), playing: false, ended: false, tuneStart: startSeconds || 0 };
      S.ltShownEnd = false;
      taste.notePlay(video);
      Player.load(video.id, startSeconds);
      // if it never starts, treat as dead air and move on
      clearTimeout(timers.watchdog);
      timers.watchdog = setTimeout(() => {
        if (S.watch && S.watch.video === video && !S.watch.playing) App.skipDead(video, 'timeout');
      }, MOCK ? 4000 : 14000);
      clearInterval(timers.poll);
      timers.poll = setInterval(App.poll, 1000);
    },
    // Wrap up the current viewing and feed the taste model.
    endWatch(ended) {
      const w = S.watch; if (!w) return;
      S.watch = null;
      clearTimeout(timers.watchdog); clearInterval(timers.poll);
      const watched = (Date.now() - w.startedAt) / 1000;
      if (!w.playing && !ended) return;           // never actually saw it — no opinion
      if (ended && watched < 20) { taste.noteWatched(watched); return; } // tuned in at the tail end — no opinion
      const note = taste.signalFromWatch(w.video, watched, taste.duration(w.video.id), ended);
      showLearn(note);
      refreshNext();
    },
    poll() {
      const w = S.watch; if (!w || !w.playing) return;
      const t = Player.time(), d = Player.duration();
      if (d > 30 && !taste.duration(w.video.id)) taste.setDuration(w.video.id, d);
      // the card comes back for the last few seconds, like the real thing
      if (d && !S.ltShownEnd && d - t < 16 && d - t > 5 && !S.guideOpen) {
        S.ltShownEnd = true;
        showLowerThird(w.video, byNum(S.channel), Math.max(4000, (d - t - 3) * 1000));
      }
    },
    onPlayerState(state) {
      const w = S.watch; if (!w) return;
      const ch = byNum(S.channel);
      if (state === 1) { // PLAYING
        if (!w.playing) {
          w.playing = true;
          w.startedAt = Date.now();
          setScreenState('on');
          if (!S.guideOpen) { showBug(ch); showLowerThird(w.video, ch, 9000, (w.tuneStart || 0) < 3 ? 3 : 0.8); }
          const d = Player.duration(); if (d > 30) taste.setDuration(w.video.id, d);
        }
      } else if (state === 0) { // ENDED
        App.endWatch(true);
        advance(ch);
        const s = S.sched[ch.key];
        setScreenState('static');
        setTimeout(() => { if (S.power && S.channel === ch.num) App.startWatch(s.now, ch, 0); }, 250);
        if (S.guideOpen) App.renderGuide();
      }
    },
    onPlayerError(code) {
      const w = S.watch; if (!w) return;
      // 101/150: embedding disabled; 100: removed/private; 2: bad id
      if (code === 101 || code === 150 || code === 100 || code === 2) taste.block(w.video.id);
      App.skipDead(w.video, 'error ' + code);
    },
    skipDead(video, why) {
      S.sessionBlocked.add(video.id);
      const ch = byNum(S.channel); if (!ch) return;
      S.watch = null;
      clearTimeout(timers.watchdog); clearInterval(timers.poll);
      const s = S.sched[ch.key];
      if (s.now && s.now.id === video.id) advance(ch);
      else s.now = pickFor(ch, video.id);
      setScreenState('static');
      showChannelOSD(String(ch.num).padStart(2, '0'), ch.name);
      setTimeout(() => { if (S.power && S.channel === ch.num) App.startWatch(s.now, ch, 0); }, 300);
      if (S.guideOpen) App.renderGuide();
    },

    // --- volume ---
    volume(delta) {
      if (!S.power) return;
      S.volume = Math.max(0, Math.min(100, S.volume + delta));
      if (S.muted && delta > 0) { S.muted = false; el.osdMute.hidden = true; }
      SFX.setVolume(0.15 + S.volume / 100 * 0.6);
      Player.applyVolume(); saveState(); showVolumeOSD(); updateDials(); SFX.blip(delta > 0);
    },
    toggleMute() {
      if (!S.power) return;
      S.muted = !S.muted;
      Player.applyVolume(); saveState();
      el.osdMute.hidden = !S.muted;
      SFX.blip(!S.muted);
    },

    // --- taste buttons ---
    love() {
      const w = S.watch; if (!w || !S.power) return;
      showLearn(taste.love(w.video));
      refreshNext();
      SFX.blip(true);
      el.bug.style.filter = 'drop-shadow(0 0 14px #ff2e93)';
      setTimeout(() => { el.bug.style.filter = ''; }, 900);
      if (S.guideOpen) App.renderGuide();
    },
    nope() {
      const w = S.watch; if (!w || !S.power) return;
      showLearn(taste.nope(w.video));
      refreshNext();
      SFX.blip(false);
      // the VJ takes the hint
      const ch = byNum(S.channel);
      S.watch = null; clearTimeout(timers.watchdog); clearInterval(timers.poll);
      advance(ch);
      setScreenState('static'); SFX.hiss(0.25, 0.25);
      el.lt.hidden = true;
      setTimeout(() => { if (S.power && S.channel === ch.num) App.startWatch(S.sched[ch.key].now, ch, 0); }, 300);
      if (S.guideOpen) App.renderGuide();
    },
    info() {
      if (!S.power) return;
      const ch = byNum(S.channel); const w = S.watch;
      showChannelOSD(String(S.channel).padStart(2, '0'), ch ? ch.name : '');
      if (w && ch) showLowerThird(w.video, ch);
    },

    // --- guide ---
    toggleGuide() { S.guideOpen ? App.closeGuide() : App.openGuide(); },
    openGuide() {
      if (!S.power) return;
      S.guideOpen = true;
      S.guideSel = Math.max(0, CHANNELS.findIndex(c => c.num === S.channel));
      el.guide.hidden = false;
      el.lt.hidden = true; el.bug.hidden = true; el.osdChannel.hidden = true;
      el.videoLayer.style.transform = 'scale(0.44)';
      App.renderGuide();
      clearInterval(timers.guideClock);
      timers.guideClock = setInterval(App.renderClock, 1000);
      SFX.blip(true);
    },
    closeGuide() {
      S.guideOpen = false;
      el.guide.hidden = true;
      el.videoLayer.style.transform = '';
      clearInterval(timers.guideClock);
      const ch = byNum(S.channel);
      if (ch && S.watch && S.watch.playing) showBug(ch);
      SFX.blip(false);
    },
    guideMove(delta) {
      S.guideSel = (S.guideSel + delta + CHANNELS.length) % CHANNELS.length;
      SFX.blip(delta < 0);
      App.renderGuide();
    },
    guideSelect() {
      const ch = CHANNELS[S.guideSel];
      App.closeGuide();
      App.tune(ch.num);
    },
    guideTab(tab) {
      S.guideTab = tab;
      document.querySelectorAll('.guide-tab').forEach(b => b.classList.toggle('is-active', b.dataset.tab === tab));
      document.querySelectorAll('.guide-panel').forEach(p => p.classList.toggle('is-active', p.dataset.panel === tab));
      if (tab === 'taste') App.renderTaste();
    },
    renderClock() {
      const d = new Date();
      const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      let h = d.getHours(); const ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
      el.guideClock.textContent = `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}   ${h}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`;
    },
    renderGuide() {
      App.renderClock();
      const cur = byNum(S.channel);
      const rows = CHANNELS.map((ch, i) => {
        const s = sync(ch);
        const now = s.now ? `${s.now.artist} – ${s.now.title}` : '—';
        const next = s.next ? `${s.next.artist} – ${s.next.title}` : '—';
        return `<div class="guide-row ${cur && cur.num === ch.num ? 'is-current' : ''} ${i === S.guideSel ? 'is-selected' : ''}" data-num="${ch.num}" role="option" aria-selected="${i === S.guideSel}">
          <div class="gr-num">${ch.num}</div>
          <div class="gr-name">${ch.name}</div>
          <div class="gr-prog">${esc(now)}<small>NEXT: ${esc(next)}</small></div>
        </div>`;
      });
      el.guideGrid.innerHTML = rows.join('');
      const selEl = el.guideGrid.children[S.guideSel];
      if (selEl && selEl.scrollIntoView) selEl.scrollIntoView({ block: 'nearest' });
      const sel = CHANNELS[S.guideSel];
      const ss = S.sched[sel.key];
      el.guideNow.innerHTML = `<b>${sel.num} ${sel.name}</b> · ${esc(sel.blurb)}<br>NOW: ${ss.now ? esc(ss.now.artist + ' – ' + ss.now.title) : '—'}`;
      const ad = ADS[Math.floor(Date.now() / 30000) % ADS.length];
      el.guideTicker.textContent = `${taste.summaryLine()}   ***   ${ad}   ***   PRESS GUIDE OR ESC TO RETURN   ***   `;
      if (S.guideTab === 'taste') App.renderTaste();
    },
    renderTaste() {
      const st = taste.stats();
      const conf = taste.confidence();
      const stage = conf < 0.25 ? 'STILL LEARNING YOU' : conf < 0.6 ? 'GETTING THE PICTURE' : conf < 0.9 ? 'KNOWS YOUR TYPE' : 'BASICALLY YOUR VJ';
      const likes = taste.topTags(6, 1), skips = taste.topTags(4, -1);
      const artists = taste.topArtists(6, 1);
      const you = byNum(2);
      const upcoming = pool(you).map(v => ({ v, s: taste.score(v) })).sort((a, b) => b.s - a.s).slice(0, 5);
      const meter = (t, max, neg) => `<div class="meter"><span>${esc(t.label)}</span><div class="bar"><i class="${neg ? 'neg' : ''}" style="width:${Math.min(100, Math.abs(t.value) / max * 100)}%"></i></div><span class="val">${(t.value > 0 ? '+' : '') + t.value.toFixed(1)}</span></div>`;
      const max = Math.max(1, ...likes.map(t => t.value), ...skips.map(t => -t.value));
      el.tastePanel.innerHTML = `
        <h3>STATUS: ${stage} (${Math.round(conf * 100)}%)</h3>
        <div class="stat"><span>VIDEOS SEEN</span><span>${st.videos}</span></div>
        <div class="stat"><span>WATCHED TO THE END</span><span>${st.finished}</span></div>
        <div class="stat"><span>FLIPPED AWAY FROM</span><span>${st.skips}</span></div>
        <div class="stat"><span>LOVED / NOPED</span><span>${st.loved} / ${st.noped}</span></div>
        <div class="stat"><span>MINUTES ON THE COUCH</span><span>${st.minutes}</span></div>
        <h3>YOU LIKE</h3>
        ${likes.length ? likes.map(t => meter(t, max, false)).join('') : '<div class="empty">Not sure yet. Stick around for a video or two.</div>'}
        <h3>YOU SKIP</h3>
        ${skips.length ? skips.map(t => meter(t, max, true)).join('') : '<div class="empty">Nothing yet. Flip away from something and see.</div>'}
        <h3>ARTISTS ON YOUR SIDE</h3>
        <div class="chips">${artists.length ? artists.map(a => `<span class="chip">${esc(a.artist)}</span>`).join('') : '<div class="empty">—</div>'}</div>
        <h3>MTV YOU · LIKELY UP NEXT</h3>
        ${upcoming.map(u => `<div class="stat"><span>${esc(u.v.artist)} – ${esc(u.v.title)}</span><span>${u.s.toFixed(1)}</span></div>`).join('')}
      `;
    },
  };

  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  // ---------- input ----------
  const ACTIONS = {
    power: App.togglePower, chup: App.channelUp, chdown: App.channelDown, volup: () => App.volume(5), voldown: () => App.volume(-5),
    mute: App.toggleMute, guide: App.toggleGuide, last: App.last, info: App.info, love: App.love, nope: App.nope,
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action],[data-digit]');
    if (!b) return;
    SFX.resume();
    if (b.dataset.digit !== undefined) { App.digit(b.dataset.digit); return; }
    const a = b.dataset.action;
    if (a === 'chup' && S.guideOpen) return App.guideMove(-1);
    if (a === 'chdown' && S.guideOpen) return App.guideMove(1);
    if (ACTIONS[a]) ACTIONS[a]();
  });

  // Physical buttons: they clack on the way down and again on the way up.
  let pressedEl = null;
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.rbtn, .push, .manual-btn, .guide-tab');
    if (!b) return;
    SFX.resume(); SFX.press();
    pressedEl = b;
  });
  const releaseBtn = () => { if (pressedEl) { SFX.release(); pressedEl = null; } };
  document.addEventListener('pointerup', releaseBtn);
  document.addEventListener('pointercancel', releaseBtn);
  // Keyboard shortcuts push the matching button on the remote so you can see what you did.
  function pressKey(k) {
    const b = document.querySelector(`.remote [data-key="${CSS.escape(k)}"]`);
    if (!b) return;
    b.classList.add('is-pressed'); SFX.press();
    setTimeout(() => { b.classList.remove('is-pressed'); SFX.release(); }, 110);
  }

  // The dials: click to turn up, shift-click (or right-click) to turn down, scroll either way.
  function dialTurn(dialEl, up, down) {
    dialEl.addEventListener('click', (e) => { SFX.resume(); (e.shiftKey ? down : up)(); dialEl.blur(); });
    dialEl.addEventListener('contextmenu', (e) => { e.preventDefault(); SFX.resume(); down(); });
    let last = 0;
    dialEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      const now = Date.now(); if (now - last < 160) return; last = now;
      SFX.resume(); (e.deltaY < 0 ? up : down)();
    }, { passive: false });
    dialEl.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); up(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); down(); }
    });
  }
  dialTurn(el.channelDial, () => { if (S.power) App.channelUp(); else App.powerOn(); }, () => { if (S.power) App.channelDown(); else App.powerOn(); });
  dialTurn(el.volumeDial, () => App.volume(5), () => App.volume(-5));

  // The owner's manual
  function openManual() { el.manual.hidden = false; el.manualBtn.setAttribute('aria-expanded', 'true'); }
  function closeManual() { el.manual.hidden = true; el.manualBtn.setAttribute('aria-expanded', 'false'); }
  el.manualBtn.addEventListener('click', () => el.manual.hidden ? openManual() : closeManual());
  $('manualClose').addEventListener('click', closeManual);
  el.manual.addEventListener('click', (e) => { if (e.target === el.manual) closeManual(); });
  document.querySelectorAll('.guide-tab').forEach(b => b.addEventListener('click', () => App.guideTab(b.dataset.tab)));
  el.guideGrid.addEventListener('click', (e) => {
    const row = e.target.closest('.guide-row'); if (!row) return;
    S.guideSel = CHANNELS.findIndex(c => c.num === +row.dataset.num);
    App.guideSelect();
  });
  $('resetTaste').addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('Forget everything the TV has learned about you?')) { taste.reset(); refreshNext(); if (S.guideOpen) App.renderGuide(); showLearn({ tag: 'everything', reason: 'nope' }); }
  });

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    const k = e.key;
    if (!el.manual.hidden) { if (k === 'Escape' || k === '?') { closeManual(); e.preventDefault(); } return; }
    if (k === '?') { openManual(); e.preventDefault(); return; }
    let handled = true;
    if (/^[0-9]$/.test(k)) App.digit(k);
    else if (k === 'ArrowUp') S.guideOpen ? App.guideMove(-1) : App.channelUp();
    else if (k === 'ArrowDown') S.guideOpen ? App.guideMove(1) : App.channelDown();
    else if (k === 'ArrowRight') S.guideOpen ? App.guideTab('taste') : App.volume(5);
    else if (k === 'ArrowLeft') S.guideOpen ? App.guideTab('listings') : App.volume(-5);
    else if (k === 'PageUp') App.channelUp();
    else if (k === 'PageDown') App.channelDown();
    else if (k === 'Enter') { if (S.guideOpen) App.guideSelect(); else App.info(); }
    else if (k === 'Escape') { if (S.guideOpen) App.closeGuide(); else handled = false; }
    else switch (k.toLowerCase()) {
      case 'g': App.toggleGuide(); break;
      case 'p': App.togglePower(); break;
      case 'm': App.toggleMute(); break;
      case 'f': App.love(); break;
      case 'x': App.nope(); break;
      case 'i': App.info(); break;
      case 'l': App.last(); break;
      case 't': if (S.guideOpen) App.guideTab(S.guideTab === 'taste' ? 'listings' : 'taste'); else { App.openGuide(); App.guideTab('taste'); } break;
      default: handled = false;
    }
    if (handled) { SFX.resume(); e.preventDefault(); pressKey(k.length === 1 ? k.toLowerCase() : k); }
  });

  // swipe up/down on the tube to flip channels; tap for info
  let touchY = null, touchT = 0;
  el.screen.addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; touchT = Date.now(); }, { passive: true });
  el.screen.addEventListener('touchend', (e) => {
    if (touchY === null) return;
    const dy = e.changedTouches[0].clientY - touchY; touchY = null;
    if (Math.abs(dy) > 40) { dy < 0 ? App.channelUp() : App.channelDown(); }
    else if (Date.now() - touchT < 300) { S.power ? App.info() : App.powerOn(); }
  });
  el.screen.addEventListener('click', () => { if (!S.power) App.powerOn(); });

  // ---------- boot ----------
  loadState();
  initSchedule();
  buildTicks();
  updateDials();
  SFX.setVolume(0.15 + S.volume / 100 * 0.6);
  el.led.className = 'jewel standby';
  setScreenState('off');
  el.nosignalSub.textContent = '';
  // an "off" tube shows a faint reflection and a hint
  el.nosignal.hidden = false; $('nosignal').querySelector('.nosignal-text').textContent = 'PRESS POWER';
  el.nosignalSub.textContent = 'or click the screen';

  // Once powered on, the NO SIGNAL card gets real text again.
  const _powerOn = App.powerOn;
  App.powerOn = function () {
    $('nosignal').querySelector('.nosignal-text').textContent = 'NO SIGNAL';
    el.nosignal.hidden = true;
    _powerOn();
  };
  ACTIONS.power = App.togglePower;

  // expose for debugging / tests
  window.MTV = { App, S, CHANNELS, taste, Player, pool };
})();
