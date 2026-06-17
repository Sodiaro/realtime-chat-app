// simple looping ring tone via the Web Audio API (no asset needed)
let ctx = null;
let interval = null;

export function startRingtone() {
  stopRingtone();
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    ctx = new Ctx();
    const beep = () => {
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 440;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      osc.start(t);
      osc.stop(t + 0.45);
    };
    beep();
    interval = setInterval(beep, 1600);
  } catch {
    /* audio blocked — ignore */
  }
}

export function stopRingtone() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
  if (ctx) {
    ctx.close().catch(() => {});
    ctx = null;
  }
}
