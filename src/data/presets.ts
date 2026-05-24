import type {
  ArpeggiatorState,
  BassMode,
  ChordModifier,
  ChordType,
  CompletePreset,
  DrumPattern,
  FxState,
  NoteName,
  PerformanceMode,
  ScaleMode,
  WaveforgePreset,
} from "../types";

export interface LeadPresetDefinition {
  name: string;
  oscillator: "sine" | "triangle" | "sawtooth" | "square" | "fatsawtooth" | "fattriangle";
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  filter: number;
  detune: number;
  spread: number;
}

export interface BassPresetDefinition {
  name: string;
  oscillator: "sine" | "triangle" | "sawtooth" | "square" | "fatsawtooth";
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  filter: number;
  glide: number;
  drive: number;
}

export const waveforgeChordPresets: WaveforgePreset[] = [
  {
    id: "test-poly",
    name: "TEST POLY",
    category: "chord",
    oscillator: { type: "triangle", detune: 0, level: 0.8 },
    secondaryOscillator: { type: "sine", detune: 0, level: 0.22 },
    filter: { cutoff: 3800, resonance: 0.35 },
    envelope: { attack: 0.015, decay: 0.12, sustain: 0.78, release: 0.42 },
    stereoWidth: 0.12,
    effects: { chorus: 0, reverb: 0, delay: 0, drive: 0 },
  },
  {
    id: "init-warm-poly",
    name: "WARM POLY",
    category: "chord",
    oscillator: { type: "triangle", detune: 0, level: 0.82 },
    secondaryOscillator: { type: "triangle", detune: 7, level: 0.34 },
    filter: { cutoff: 3200, resonance: 0.55 },
    envelope: { attack: 0.035, decay: 0.18, sustain: 0.72, release: 0.62 },
    stereoWidth: 0.24,
    effects: { chorus: 0, reverb: 0, delay: 0, drive: 0.02 },
  },
  {
    id: "velvet-tape",
    name: "VELVET TAPE",
    category: "chord",
    oscillator: { type: "triangle", detune: -3, level: 0.76 },
    secondaryOscillator: { type: "sawtooth", detune: 9, level: 0.3 },
    filter: { cutoff: 2350, resonance: 0.38 },
    envelope: { attack: 0.08, decay: 0.24, sustain: 0.74, release: 1.08 },
    stereoWidth: 0.42,
    effects: { chorus: 0.08, reverb: 0.03, delay: 0, drive: 0.035 },
  },
  {
    id: "tape-keys",
    name: "TAPE KEYS",
    category: "chord",
    oscillator: { type: "sawtooth", detune: 0, level: 0.78 },
    secondaryOscillator: { type: "square", detune: -6, level: 0.22 },
    filter: { cutoff: 4200, resonance: 0.62 },
    envelope: { attack: 0.008, decay: 0.2, sustain: 0.5, release: 0.38 },
    stereoWidth: 0.24,
    effects: { chorus: 0.015, reverb: 0, delay: 0, drive: 0.055 },
  },
  {
    id: "glass-memory",
    name: "GLASS MEMORY",
    category: "chord",
    oscillator: { type: "sine", detune: 0, level: 0.8 },
    secondaryOscillator: { type: "triangle", detune: 12, level: 0.38 },
    filter: { cutoff: 6800, resonance: 0.36 },
    envelope: { attack: 0.018, decay: 0.28, sustain: 0.58, release: 0.9 },
    stereoWidth: 0.48,
    effects: { chorus: 0.08, reverb: 0.04, delay: 0, drive: 0 },
  },
  {
    id: "dust-organ",
    name: "DUST ORGAN",
    category: "chord",
    oscillator: { type: "square", detune: 0, level: 0.62 },
    secondaryOscillator: { type: "triangle", detune: -3, level: 0.5 },
    filter: { cutoff: 3400, resonance: 0.24 },
    envelope: { attack: 0.006, decay: 0.09, sustain: 0.88, release: 0.42 },
    stereoWidth: 0.16,
    effects: { chorus: 0.04, reverb: 0, delay: 0, drive: 0.025 },
  },
  {
    id: "dream-pad",
    name: "DREAM PAD",
    category: "chord",
    oscillator: { type: "sawtooth", detune: -4, level: 0.7 },
    secondaryOscillator: { type: "triangle", detune: 15, level: 0.36 },
    filter: { cutoff: 1650, resonance: 0.5 },
    envelope: { attack: 0.09, decay: 0.28, sustain: 0.68, release: 1.1 },
    stereoWidth: 0.62,
    effects: { chorus: 0.1, reverb: 0.06, delay: 0.03, drive: 0.04 },
  },
];

const fromWaveforgePreset = (preset: WaveforgePreset): LeadPresetDefinition => ({
  name: preset.name,
  oscillator:
    preset.secondaryOscillator && (preset.oscillator.type === "triangle" || preset.oscillator.type === "sawtooth")
      ? (`fat${preset.oscillator.type}` as LeadPresetDefinition["oscillator"])
      : preset.oscillator.type,
  attack: preset.envelope.attack,
  decay: preset.envelope.decay,
  sustain: preset.envelope.sustain,
  release: preset.envelope.release,
  filter: preset.filter.cutoff,
  detune: preset.secondaryOscillator?.detune ?? preset.oscillator.detune,
  spread: preset.stereoWidth ?? 0.24,
});

export const leadPresets: LeadPresetDefinition[] = [
  ...waveforgeChordPresets.map(fromWaveforgePreset),
  { name: "Velvet Poly", oscillator: "fattriangle", attack: 0.022, decay: 0.22, sustain: 0.72, release: 1.45, filter: 2800, detune: 7, spread: 0.34 },
  { name: "Glass Horizon", oscillator: "sine", attack: 0.018, decay: 0.38, sustain: 0.56, release: 1.9, filter: 6200, detune: 2, spread: 0.62 },
  { name: "Analog Bloom", oscillator: "fatsawtooth", attack: 0.065, decay: 0.32, sustain: 0.68, release: 1.8, filter: 2200, detune: 11, spread: 0.52 },
  { name: "Cosmic Tape", oscillator: "fatsawtooth", attack: 0.12, decay: 0.4, sustain: 0.6, release: 2.25, filter: 1700, detune: 16, spread: 0.7 },
  { name: "Juno Mist", oscillator: "fatsawtooth", attack: 0.045, decay: 0.26, sustain: 0.66, release: 1.7, filter: 2600, detune: 9, spread: 0.68 },
  { name: "Broken Cassette", oscillator: "triangle", attack: 0.035, decay: 0.28, sustain: 0.54, release: 1.25, filter: 1400, detune: 19, spread: 0.42 },
  { name: "Neon Keys", oscillator: "square", attack: 0.01, decay: 0.2, sustain: 0.48, release: 0.75, filter: 4800, detune: 4, spread: 0.38 },
  { name: "Warm Organ", oscillator: "fattriangle", attack: 0.008, decay: 0.12, sustain: 0.9, release: 0.55, filter: 3600, detune: 3, spread: 0.28 },
  { name: "Dream Guitar", oscillator: "triangle", attack: 0.004, decay: 0.34, sustain: 0.24, release: 1.1, filter: 4200, detune: 5, spread: 0.48 },
  { name: "Sunset Pad", oscillator: "fatsawtooth", attack: 0.28, decay: 0.55, sustain: 0.78, release: 2.8, filter: 1800, detune: 13, spread: 0.78 },
  { name: "Psychedelic Pluck", oscillator: "sawtooth", attack: 0.003, decay: 0.18, sustain: 0.2, release: 0.62, filter: 5200, detune: 8, spread: 0.58 },
  { name: "Space Choir", oscillator: "fattriangle", attack: 0.18, decay: 0.55, sustain: 0.76, release: 2.5, filter: 2400, detune: 6, spread: 0.72 },
];

export const bassPresets: BassPresetDefinition[] = [
  { name: "Round Bass", oscillator: "sine", attack: 0.006, decay: 0.19, sustain: 0.82, release: 0.36, filter: 780, glide: 0.045, drive: 0.12 },
  { name: "Sub Bloom", oscillator: "sine", attack: 0.014, decay: 0.28, sustain: 0.9, release: 0.75, filter: 420, glide: 0.09, drive: 0.06 },
  { name: "Rubber Mono", oscillator: "square", attack: 0.004, decay: 0.12, sustain: 0.58, release: 0.28, filter: 980, glide: 0.06, drive: 0.2 },
  { name: "Vintage Organ Bass", oscillator: "fatsawtooth", attack: 0.008, decay: 0.18, sustain: 0.7, release: 0.38, filter: 1150, glide: 0.025, drive: 0.16 },
  { name: "Tape Bass", oscillator: "triangle", attack: 0.012, decay: 0.2, sustain: 0.72, release: 0.48, filter: 690, glide: 0.075, drive: 0.24 },
  { name: "Resonant 808", oscillator: "sine", attack: 0.006, decay: 0.45, sustain: 0.84, release: 1.1, filter: 520, glide: 0.11, drive: 0.18 },
  { name: "Fuzzy Bass", oscillator: "sawtooth", attack: 0.003, decay: 0.15, sustain: 0.62, release: 0.34, filter: 840, glide: 0.035, drive: 0.46 },
  { name: "Moogish Pulse", oscillator: "fatsawtooth", attack: 0.004, decay: 0.18, sustain: 0.66, release: 0.3, filter: 1050, glide: 0.055, drive: 0.26 },
];

const p = (kick: number[], snare: number[], hat: number[], perc: number[], swing = 0.08): DrumPattern => {
  const steps = (hits: number[]) => Array.from({ length: 16 }, (_, index) => hits.includes(index));
  return {
    name: "",
    swing,
    steps: {
      kick: steps(kick),
      snare: steps(snare),
      hat: steps(hat),
      perc: steps(perc),
    },
    accents: [0, 4, 8, 12],
  };
};

export const drumPatterns: DrumPattern[] = [
  { ...p([0, 7, 10], [4, 12], [0, 2, 4, 6, 8, 10, 12, 14], [3, 11], 0.1), name: "Soft Disco" },
  { ...p([0, 6, 10], [4, 12], [0, 2, 5, 8, 10, 13], [7, 15], 0.04), name: "Psych Rock" },
  { ...p([0, 4, 8, 12], [4, 12], [0, 2, 4, 6, 8, 10, 12, 14], [6, 14], 0.02), name: "Motorik" },
  { ...p([0, 5, 11], [3, 12], [0, 3, 6, 8, 10, 14], [2, 9, 15], 0.16), name: "Broken Groove" },
  { ...p([0, 8, 11], [4, 12], [0, 4, 7, 10, 12, 15], [6, 14], 0.11), name: "Dream Pop" },
  { ...p([0, 6, 9, 13], [4, 11], [0, 2, 4, 6, 8, 10, 12, 14], [5, 10, 15], 0.2), name: "Lo-Fi Tape" },
  { ...p([0, 4, 8, 12], [4, 12], [0, 2, 4, 6, 8, 10, 12, 14], [3, 7, 11, 15], 0.06), name: "House Pulse" },
  { ...p([0, 9, 14], [4, 12], [0, 3, 6, 9, 12, 15], [5, 10], 0.18), name: "Slow Funk" },
  { ...p([0, 6, 10], [4, 12], [0, 3, 4, 7, 8, 11, 12, 15], [2, 5, 10, 13], 0.14), name: "Bossa Glow" },
  { ...p([0, 3, 10], [8, 12], [0, 1, 3, 6, 8, 10, 13, 15], [5, 11, 14], 0.12), name: "Trap Haze" },
  { ...p([0, 6, 8, 14], [4, 12], [0, 2, 4, 6, 9, 10, 12, 14], [7, 15], 0.07), name: "Indie Jam" },
  { ...p([0, 10], [6, 14], [0, 4, 8, 12], [3, 11], 0.04), name: "Minimal Click" },
];

export const defaultFx: FxState = {
  reverb: 0.36,
  delay: 0.22,
  chorus: 0.32,
  drive: 0.12,
  filter: 0.72,
  wobble: 0.12,
  wow: false,
  phaser: false,
  flanger: false,
  tremolo: false,
  bitcrush: false,
  vinyl: false,
  reverse: false,
  freeze: false,
  bypass: false,
};

export const defaultArp: ArpeggiatorState = {
  enabled: false,
  rate: "1/8",
  direction: "Up",
  octaveRange: 1,
  gate: 0.72,
  swing: 0.04,
  velocityVariation: 0.08,
  humanize: 0.012,
  latch: false,
  probability: 1,
  patternLength: 16,
};

const preset = (
  id: string,
  name: string,
  keyRoot: NoteName,
  scaleMode: ScaleMode,
  bpm: number,
  leadPreset: string,
  bassPreset: string,
  bassMode: BassMode,
  drumPattern: string,
  chordType: ChordType,
  modifiers: ChordModifier[],
  performanceMode: PerformanceMode,
  spread: number,
  motion: number,
  arp: Partial<ArpeggiatorState>,
  fx: Partial<FxState>,
): CompletePreset => ({
  id,
  name,
  keyRoot,
  scaleMode,
  bpm,
  leadPreset,
  bassPreset,
  bassMode,
  drumPattern,
  chordType,
  modifiers,
  performanceMode,
  spread,
  motion,
  arp,
  fx,
});

export const factoryPresets: CompletePreset[] = [
  preset("midnight-bloom", "Midnight Bloom", "F#", "Natural Minor", 86, "Velvet Poly", "Sub Bloom", "Root Note", "Dream Pop", "Minor", ["7", "Add9", "Dream"], "DRONE", 0.72, 0.42, { enabled: true, rate: "1/8", direction: "Broken Dream", octaveRange: 3 }, { reverb: 0.58, delay: 0.28, chorus: 0.52, filter: 0.62, wobble: 0.18 }),
  preset("orange-static", "Orange Static", "C", "Mixolydian", 112, "Broken Cassette", "Tape Bass", "Octave Pulse", "Lo-Fi Tape", "Major", ["7", "Open Fifth"], "PULSE", 0.54, 0.35, { enabled: true, rate: "1/16", direction: "Hypnotic Spiral" }, { drive: 0.24, delay: 0.2, vinyl: true, wow: true }),
  preset("slow-satellite", "Slow Satellite", "A", "Dorian", 74, "Space Choir", "Round Bass", "Walking Bass", "Minimal Click", "Minor", ["9", "11"], "CASCADE", 0.88, 0.64, { enabled: true, rate: "1/8T", direction: "Cascading", octaveRange: 3 }, { reverb: 0.66, chorus: 0.46, phaser: true }),
  preset("velvet-drive", "Velvet Drive", "D", "Major", 104, "Analog Bloom", "Moogish Pulse", "Syncopated", "Soft Disco", "Major", ["Maj7", "Add9"], "RHYTHM CHORDS", 0.66, 0.48, { enabled: false }, { reverb: 0.34, delay: 0.18, drive: 0.19, chorus: 0.42 }),
  preset("dream-machine", "Dream Machine", "G", "Dream / Cinematic Mode", 92, "Glass Horizon", "Resonant 808", "Root Note", "Bossa Glow", "Sus2", ["Add9", "Dream", "13"], "DREAM", 0.82, 0.74, { enabled: true, rate: "1/16", direction: "Random", probability: 0.76 }, { reverb: 0.72, delay: 0.35, freeze: true }),
  preset("coastal-tape", "Coastal Tape", "E", "Lydian", 98, "Cosmic Tape", "Tape Bass", "Octave Pulse", "Indie Jam", "Major", ["6", "Add9"], "STRUM", 0.7, 0.33, { enabled: true, rate: "1/8", direction: "Guitar Strum" }, { wow: true, vinyl: true, filter: 0.56, chorus: 0.38 }),
  preset("neon-garden", "Neon Garden", "B", "Major", 126, "Neon Keys", "Rubber Mono", "Syncopated", "House Pulse", "Major", ["Maj7", "9"], "PULSE", 0.45, 0.58, { enabled: true, rate: "1/16", direction: "Up/Down", octaveRange: 2 }, { delay: 0.31, drive: 0.18, filter: 0.76 }),
  preset("psychedelic-morning", "Psychedelic Morning", "C#", "Dorian", 118, "Psychedelic Pluck", "Fuzzy Bass", "Walking Bass", "Psych Rock", "Minor", ["7", "9", "Tension"], "CASCADE", 0.77, 0.67, { enabled: true, rate: "1/16T", direction: "Hypnotic Spiral", probability: 0.84 }, { phaser: true, flanger: true, delay: 0.24, drive: 0.22 }),
  preset("analog-memory", "Analog Memory", "A", "Natural Minor", 82, "Juno Mist", "Vintage Organ Bass", "Root Note", "Slow Funk", "Minor", ["Maj7", "Dream"], "DRONE", 0.58, 0.4, { enabled: false }, { reverb: 0.5, chorus: 0.48, wow: true }),
  preset("glass-sunset", "Glass Sunset", "F", "Lydian", 100, "Glass Horizon", "Round Bass", "Root Note", "Soft Disco", "Major", ["Maj7", "Add9", "13"], "DREAM", 0.84, 0.52, { enabled: true, rate: "1/8", direction: "Broken Dream" }, { reverb: 0.62, delay: 0.29, chorus: 0.44 }),
  preset("cassette-dawn", "Cassette Dawn", "D#", "Harmonic Minor", 90, "Broken Cassette", "Sub Bloom", "Walking Bass", "Trap Haze", "Minor", ["7", "Add9"], "OFF", 0.61, 0.29, { enabled: true, rate: "1/8T", direction: "Down" }, { vinyl: true, drive: 0.16, filter: 0.49 }),
  preset("organ-lagoon", "Organ Lagoon", "G#", "Mixolydian", 108, "Warm Organ", "Vintage Organ Bass", "Octave Pulse", "Bossa Glow", "Sus4", ["7", "9"], "RHYTHM CHORDS", 0.4, 0.46, { enabled: false }, { reverb: 0.44, delay: 0.17, tremolo: true }),
  preset("saturn-strum", "Saturn Strum", "E", "Major", 96, "Dream Guitar", "Round Bass", "Root Note", "Dream Pop", "Major", ["Add9", "Open Fifth"], "STRUM", 0.74, 0.38, { enabled: true, rate: "1/8", direction: "Guitar Strum" }, { reverb: 0.48, chorus: 0.35 }),
  preset("mirror-city", "Mirror City", "C", "Lydian", 132, "Neon Keys", "Rubber Mono", "Syncopated", "Motorik", "Major", ["Maj7", "9", "Tension"], "PULSE", 0.52, 0.62, { enabled: true, rate: "1/16", direction: "Up" }, { delay: 0.34, filter: 0.8 }),
  preset("amber-field", "Amber Field", "B", "Natural Minor", 78, "Sunset Pad", "Tape Bass", "Root Note", "Minimal Click", "Minor", ["11", "Dream"], "DRONE", 0.91, 0.56, { enabled: false }, { reverb: 0.74, chorus: 0.5, freeze: true }),
  preset("motor-dream", "Motor Dream", "F#", "Dorian", 122, "Analog Bloom", "Moogish Pulse", "Octave Pulse", "Motorik", "Minor", ["7", "9"], "RHYTHM CHORDS", 0.64, 0.7, { enabled: true, rate: "1/16", direction: "Cascading" }, { drive: 0.21, phaser: true, wobble: 0.26 }),
  preset("soft-orbit", "Soft Orbit", "A#", "Major", 88, "Space Choir", "Sub Bloom", "Root Note", "Dream Pop", "Major", ["6", "Add9", "Dream"], "DREAM", 0.86, 0.6, { enabled: true, rate: "1/8", direction: "Random", probability: 0.7 }, { reverb: 0.67, delay: 0.32 }),
  preset("lofi-ritual", "Lo-Fi Ritual", "D", "Harmonic Minor", 94, "Cosmic Tape", "Fuzzy Bass", "Walking Bass", "Broken Groove", "Minor", ["7", "Tension"], "CASCADE", 0.69, 0.51, { enabled: true, rate: "1/16T", direction: "Broken Dream" }, { vinyl: true, wow: true, bitcrush: true, drive: 0.18 }),
  preset("honey-grid", "Honey Grid", "G", "Mixolydian", 116, "Velvet Poly", "Rubber Mono", "Syncopated", "House Pulse", "Major", ["7", "13"], "PULSE", 0.56, 0.44, { enabled: true, rate: "1/8T", direction: "Chord Pulse" }, { delay: 0.26, chorus: 0.31, filter: 0.72 }),
  preset("violet-memory", "Violet Memory", "C#", "Dream / Cinematic Mode", 70, "Sunset Pad", "Resonant 808", "Off", "Minimal Click", "Sus2", ["Maj7", "Dream", "11"], "DRONE", 0.95, 0.82, { enabled: false }, { reverb: 0.82, delay: 0.38, chorus: 0.58, freeze: true }),
];

export const randomLead = () => leadPresets[Math.floor(Math.random() * leadPresets.length)].name;
export const randomBass = () => bassPresets[Math.floor(Math.random() * bassPresets.length)].name;
export const randomDrum = () => drumPatterns[Math.floor(Math.random() * drumPatterns.length)].name;
