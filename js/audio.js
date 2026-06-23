// Gentle generative ambient music via the Web Audio API — no audio file needed.
// A slow chord pad (a few detuned oscillators) drifts through a calm progression,
// with a subtle tremolo and a feedback-delay tail for space. Must be started from
// a user gesture (browsers block autoplay); see main.js.
const CHORDS = [
  [196.00, 246.94, 293.66, 392.00],   // G  B  D  G
  [220.00, 261.63, 329.63, 392.00],   // A  C  E  G
  [174.61, 220.00, 261.63, 349.23],   // F  A  C  F
  [164.81, 196.00, 246.94, 329.63],   // E  G  B  E
];
const VOLUME = 0.11;

export function createAmbience() {
  let ctx, master, trem, filter, voices = [], lfo, timer, ci = 0;
  let started = false;
  let muted = false;

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();

    master = ctx.createGain(); master.gain.value = 0;           // volume / fade / mute
    master.connect(ctx.destination);

    trem = ctx.createGain(); trem.gain.value = 1;               // tremolo (LFO-modulated)
    trem.connect(master);

    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 950; filter.Q.value = 0.4;
    filter.connect(trem);

    // Feedback delay for an ambient tail.
    const delay = ctx.createDelay(1.0); delay.delayTime.value = 0.46;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    filter.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(trem);

    // Pad voices.
    const base = CHORDS[0];
    voices = base.map((f, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 ? 'sine' : 'triangle';
      o.frequency.value = f;
      o.detune.value = (i - 1.5) * 4;
      const g = ctx.createGain(); g.gain.value = 0.9 / base.length;
      o.connect(g); g.connect(filter); o.start();
      return o;
    });

    // Slow tremolo on the whole pad.
    lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 0.12;
    lfo.connect(lg); lg.connect(trem.gain); lfo.start();

    // Drift through the chord progression.
    timer = setInterval(() => {
      ci = (ci + 1) % CHORDS.length;
      const ch = CHORDS[ci];
      voices.forEach((o, k) => o.frequency.setTargetAtTime(ch[k % ch.length], ctx.currentTime, 2.6));
    }, 12000);

    return true;
  }

  function fadeTo(v) {
    if (!master) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(v, ctx.currentTime, 1.4);
  }

  return {
    get muted() { return muted; },
    // Called from a user gesture; safe to call repeatedly.
    start() {
      if (muted) return;
      if (!ctx && !build()) return;
      ctx.resume?.();
      if (!started) { started = true; }
      fadeTo(VOLUME);
    },
    setMuted(m) {
      muted = m;
      if (m) { fadeTo(0); }
      else { if (!ctx && !build()) return; ctx.resume?.(); started = true; fadeTo(VOLUME); }
    },
  };
}
