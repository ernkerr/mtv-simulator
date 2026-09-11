// Tiny WebAudio sound effects: static hiss, remote click, power thunk.
// Everything is synthesized, so there are no audio files to load.
(function () {
  let ctx = null;
  let noiseBuffer = null;
  let master = null;
  let volume = 0.6;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    const len = ctx.sampleRate * 1.5;
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function resume() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume();
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (master) master.gain.value = volume;
  }

  function hiss(duration = 0.35, level = 0.35) {
    const c = ensure(); if (!c) return;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 0.4;
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(bp).connect(g).connect(master);
    src.start(t); src.stop(t + duration + 0.05);
  }

  // A short filtered noise burst with a pitched tick: the clack of a rubber button on a plastic dome.
  function tick(freq, level, dur) {
    const c = ensure(); if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'square'; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(level, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.01);
    const n = c.createBufferSource(); n.buffer = noiseBuffer;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
    const ng = c.createGain();
    ng.gain.setValueAtTime(level * 0.9, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.8);
    n.connect(f).connect(ng).connect(master); n.start(t); n.stop(t + dur);
  }
  function press() { tick(2200, 0.16, 0.035); }     // button goes down
  function release() { tick(1400, 0.09, 0.03); }    // button comes back up
  function click() { press(); setTimeout(release, 70); }

  // The heavy mechanical clunk of a channel dial notching over.
  function clunk() {
    const c = ensure(); if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'triangle'; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.08);
    const g = c.createGain();
    g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(master); o.start(t); o.stop(t + 0.13);
    const n = c.createBufferSource(); n.buffer = noiseBuffer;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.8;
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.25, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    n.connect(f).connect(ng).connect(master); n.start(t); n.stop(t + 0.07);
  }

  function powerOn() {
    const c = ensure(); if (!c) return;
    const o = c.createOscillator();
    o.type = 'sine';
    const t = c.currentTime;
    o.frequency.setValueAtTime(60, t);
    o.frequency.exponentialRampToValueAtTime(15600, t + 0.6); // the old CRT whine
    const g = c.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.75);
    hiss(0.5, 0.2);
  }

  function powerOff() {
    const c = ensure(); if (!c) return;
    const o = c.createOscillator();
    o.type = 'triangle';
    const t = c.currentTime;
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.4);
    const g = c.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.5);
  }

  function blip(up) {
    const c = ensure(); if (!c) return;
    const o = c.createOscillator();
    o.type = 'sine'; o.frequency.value = up ? 880 : 660;
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.1);
  }

  window.SFX = { resume, setVolume, hiss, click, press, release, clunk, powerOn, powerOff, blip };
})();
