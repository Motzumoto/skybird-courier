// Engine, wind, gate chime and impact, all synthesised with the Web Audio API: no files, no network.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineGain = null;
  let windGain = null;
  let engineFilter = null;
  let oscA = null;
  let oscB = null;

  function start() {
    if (ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);

    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;
    noise.connect(engineFilter).connect(engineGain).connect(master);

    windGain = ctx.createGain();
    windGain.gain.value = 0.0;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 900;
    windFilter.Q.value = 0.6;
    noise.connect(windFilter).connect(windGain).connect(master);
    noise.start();

    oscA = ctx.createOscillator();
    oscA.type = 'sawtooth';
    oscA.frequency.value = 74;
    const oscAGain = ctx.createGain();
    oscAGain.gain.value = 0.16;
    oscA.connect(oscAGain).connect(engineGain);
    oscA.start();

    oscB = ctx.createOscillator();
    oscB.type = 'square';
    oscB.frequency.value = 111;
    const oscBGain = ctx.createGain();
    oscBGain.gain.value = 0.07;
    oscB.connect(oscBGain).connect(engineGain);
    oscB.start();
  }

  return {
    start,
    suspend() {
      ctx?.suspend();
    },
    resume() {
      ctx?.resume();
    },
    update(throttle, speed) {
      if (!ctx) return;
      const t = ctx.currentTime;
      engineGain.gain.setTargetAtTime(0.16 + throttle * 0.4, t, 0.12);
      engineFilter.frequency.setTargetAtTime(340 + throttle * 1500, t, 0.2);
      windGain.gain.setTargetAtTime(Math.min(0.24, speed / 900), t, 0.3);
      const pitch = 58 + throttle * 78;
      oscA.frequency.setTargetAtTime(pitch, t, 0.16);
      oscB.frequency.setTargetAtTime(pitch * 1.5, t, 0.16);
    },
    chime() {
      if (!ctx) return;
      const t = ctx.currentTime;
      for (const [index, freq] of [880, 1320].entries()) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t + index * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.3, t + index * 0.09 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + index * 0.09 + 0.35);
        osc.connect(gain).connect(master);
        osc.start(t + index * 0.09);
        osc.stop(t + index * 0.09 + 0.4);
      }
    },
    thud(strength = 1) {
      if (!ctx) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120 * strength, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.4);
      gain.gain.setValueAtTime(0.5 * strength, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(gain).connect(master);
      osc.start(t);
      osc.stop(t + 0.55);
    },
  };
}
