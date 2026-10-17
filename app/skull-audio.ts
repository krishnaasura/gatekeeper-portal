/** Original three-beat, low-register formant laugh. No audio recording or media download. */
export const LAUGH_BEATS = [0, .84, 1.68] as const;
export const LAUGH_DURATION = 2.65;

export function synthesizeSkullLaugh(sampleRate = 32000): Float32Array {
  const samples = new Float32Array(Math.ceil(LAUGH_DURATION * sampleRate));
  let randomState = 51041;
  const noise = () => { randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0; return randomState / 2147483648 - 1; };
  for (let beat = 0; beat < LAUGH_BEATS.length; beat++) {
    const start = Math.round(LAUGH_BEATS[beat] * sampleRate);
    const duration = .63 + beat * .028;
    let phase = 0, held = 0, previousNoise = 0;
    for (let index = 0; index < duration * sampleRate; index++) {
      const t = index / sampleRate;
      const progress = t / duration;
      const pitch = (92 - beat * 6) - progress * 21 + Math.sin(t * 34) * 1.7;
      phase += Math.PI * 2 * pitch / sampleRate;
      let voiced = 0;
      // The changing ah/uh formants make this a voice-like sound rather than a bass tone.
      const f1 = 660 - progress * 190, f2 = 1120 - progress * 120;
      for (let harmonic = 1; harmonic <= 44; harmonic++) {
        const frequency = pitch * harmonic;
        const resonance = .035 + Math.exp(-Math.pow((frequency - f1) / 145, 2))
          + .55 * Math.exp(-Math.pow((frequency - f2) / 190, 2))
          + .22 * Math.exp(-Math.pow((frequency - 2450) / 280, 2));
        voiced += Math.sin(phase * harmonic + harmonic * .12) * resonance / Math.pow(harmonic, .85);
      }
      const attack = Math.min(1, t / .065);
      const release = Math.pow(Math.max(0, 1 - progress), .75);
      const envelope = attack * release * (.88 + Math.sin(t * 25) * .12);
      const n = noise(), hiss = n - previousNoise; previousNoise = n;
      const breath = hiss * Math.exp(-t * 25) * .07;
      const stutter = (t > .26 && t < .29) || (t > .51 && t < .525) ? .18 : 1;
      const signal = Math.tanh((voiced * 1.9 + breath) * 1.8) * envelope * stutter;
      // Sample-and-hold plus light quantization creates deliberate 8-bit grit.
      if (index % 3 === 0) held = Math.round(signal * 100) / 100;
      if (start + index < samples.length) samples[start + index] += held;
    }
  }
  const delay = Math.round(sampleRate * .117);
  for (let i = samples.length - 1; i >= delay; i--) samples[i] += samples[i - delay] * .15;
  let peak = .001;
  for (const value of samples) peak = Math.max(peak, Math.abs(value));
  for (let i = 0; i < samples.length; i++) samples[i] = samples[i] / peak * .58;
  return samples;
}

export function scheduleSkullAudio(context: AudioContext, laughDelay: number) {
  const master = context.createGain(); master.gain.value = .65; master.connect(context.destination);
  const data = synthesizeSkullLaugh(context.sampleRate);
  const laughBuffer = context.createBuffer(1, data.length, context.sampleRate);
  laughBuffer.copyToChannel(new Float32Array(data), 0);
  const laugh = context.createBufferSource(); laugh.buffer = laughBuffer; laugh.connect(master);
  laugh.start(context.currentTime + laughDelay);
  // Quiet band-limited interference during the initial corruption.
  const noiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * .75), context.sampleRate);
  const channel = noiseBuffer.getChannelData(0);
  let seed = 722;
  for (let i = 0; i < channel.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; channel[i] = (seed / 2147483648 - 1) * .09; }
  const crackle = context.createBufferSource(); crackle.buffer = noiseBuffer;
  const filter = context.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 1900;
  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0, context.currentTime);
  envelope.gain.linearRampToValueAtTime(.6, context.currentTime + .08);
  envelope.gain.linearRampToValueAtTime(0, context.currentTime + .7);
  crackle.connect(filter); filter.connect(envelope); envelope.connect(master); crackle.start();
  return () => {
    try { laugh.stop(); } catch { /* A completed source is already silent. */ }
    try { crackle.stop(); } catch { /* A completed source is already silent. */ }
    master.disconnect();
  };
}
