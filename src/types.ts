export type NoteName =
  | "C"
  | "C#"
  | "D"
  | "D#"
  | "E"
  | "F"
  | "F#"
  | "G"
  | "G#"
  | "A"
  | "A#"
  | "B";

export type ChordType =
  | "Major"
  | "Minor"
  | "Sus2"
  | "Sus4"
  | "Diminished"
  | "Augmented"
  | "Power";

export type ChordModifier =
  | "7"
  | "Maj7"
  | "9"
  | "Add9"
  | "11"
  | "13"
  | "6"
  | "Slash Bass"
  | "Open Fifth"
  | "Dream"
  | "Tension";

export type ScaleMode =
  | "Major"
  | "Natural Minor"
  | "Harmonic Minor"
  | "Dorian"
  | "Mixolydian"
  | "Lydian"
  | "Dream / Cinematic Mode";

export type MidiPlayMode = "Chord Trigger" | "Normal Piano" | "Solo Bass";
export type WaveforgeModule = "bass" | "arp" | "beat" | "fx" | "loop";
export type MidiPermission = "unknown" | "granted" | "denied";
export type InputSource = "screen" | "midi" | "qwerty" | "test" | "loop";
export type DisplayMode =
  | "IDLE_VIEW"
  | "PLAY_VIEW"
  | "PARAMETER_VIEW"
  | "ARP_VIEW"
  | "RECORD_VIEW"
  | "SMART_VIEW"
  | "MIDI_NOTIFICATION_VIEW";
export type VoicingStage = "CLOSE" | "INV 1" | "INV 2" | "OPEN" | "WIDE" | "LOW" | "AIR";
export type HarmonyPathMode = "SAFE" | "DREAM" | "EXPLORE";
export type HarmonySuggestionRole = "resolution" | "movement" | "colour" | "tension" | "experimental";

export interface HarmonyAlternative {
  chordType: ChordType;
  modifiers: ChordModifier[];
  displayName: string;
}

export interface HarmonySuggestion {
  id: string;
  rootMidiClass: number;
  rootName: NoteName;
  chordType: ChordType;
  modifiers: ChordModifier[];
  displayName: string;
  romanNumeral?: string;
  role: HarmonySuggestionRole;
  confidence: number;
  reason?: string;
  alternatives: HarmonyAlternative[];
}
export type BassMode =
  | "Root Note"
  | "Octave Pulse"
  | "Walking Bass"
  | "Syncopated"
  | "Off"
  | "Solo Bass Mode";
export type ArpRate = "1/4" | "1/8" | "1/8T" | "1/16" | "1/16T" | "1/32";
export type ArpDirection =
  | "Up"
  | "Down"
  | "Up/Down"
  | "Random"
  | "Chord Pulse"
  | "Cascading"
  | "Broken Dream"
  | "Guitar Strum"
  | "Hypnotic Spiral";
export type PerformanceMode =
  | "STRUM"
  | "PULSE"
  | "CASCADE"
  | "DRONE"
  | "DREAM"
  | "RHYTHM CHORDS"
  | "OFF";

export type LayerId = "chord" | "bass" | "drums";
export type FxName =
  | "reverb"
  | "delay"
  | "chorus"
  | "drive"
  | "filter"
  | "wobble"
  | "wow"
  | "phaser"
  | "flanger"
  | "tremolo"
  | "bitcrush"
  | "vinyl"
  | "reverse"
  | "freeze";

export interface LayerState {
  volume: number;
  muted: boolean;
  solo: boolean;
  preset: string;
  active: boolean;
}

export interface ArpeggiatorState {
  enabled: boolean;
  rate: ArpRate;
  direction: ArpDirection;
  octaveRange: number;
  gate: number;
  swing: number;
  velocityVariation: number;
  humanize: number;
  latch: boolean;
  probability: number;
  patternLength: 4 | 8 | 16 | 32;
}

export interface DrumStepPattern {
  kick: boolean[];
  snare: boolean[];
  hat: boolean[];
  perc: boolean[];
}

export interface DrumPattern {
  name: string;
  swing: number;
  steps: DrumStepPattern;
  accents?: number[];
}

export interface FxState {
  reverb: number;
  delay: number;
  chorus: number;
  drive: number;
  filter: number;
  wobble: number;
  wow: boolean;
  phaser: boolean;
  flanger: boolean;
  tremolo: boolean;
  bitcrush: boolean;
  vinyl: boolean;
  reverse: boolean;
  freeze: boolean;
  bypass: boolean;
}

export interface CompletePreset {
  id: string;
  name: string;
  keyRoot: NoteName;
  scaleMode: ScaleMode;
  bpm: number;
  chordType: ChordType;
  modifiers: ChordModifier[];
  leadPreset: string;
  bassPreset: string;
  bassMode: BassMode;
  drumPattern: string;
  arp: Partial<ArpeggiatorState>;
  performanceMode: PerformanceMode;
  spread: number;
  motion: number;
  color?: number;
  fx: Partial<FxState>;
}

export interface WaveforgePreset {
  id: string;
  name: string;
  category: "chord" | "bass" | "lead" | "custom";
  oscillator: {
    type: "sine" | "triangle" | "sawtooth" | "square";
    detune: number;
    level: number;
  };
  secondaryOscillator?: {
    type: "sine" | "triangle" | "sawtooth" | "square";
    detune: number;
    level: number;
  };
  filter: {
    cutoff: number;
    resonance: number;
  };
  envelope: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
  };
  stereoWidth?: number;
  effects?: {
    chorus?: number;
    reverb?: number;
    delay?: number;
    drive?: number;
  };
}

export interface ChordResult {
  root: NoteName;
  displayRoot: NoteName;
  type: ChordType;
  modifiers: ChordModifier[];
  name: string;
  noteNames: string[];
  midiNotes: number[];
  bassMidi: number;
}

export type PhraseStep = 1 | 2 | 3 | 4;
export type PhraseStatus = "BUILDING_PHRASE" | "LOOP_FOLLOW";

export interface PhraseSlot {
  step: PhraseStep;
  chord: ChordResult | null;
}

export interface ActiveTrigger {
  id: string;
  inputKey: string;
  root: NoteName;
  source: InputSource;
  inputMidi?: number;
  chord: ChordResult;
  outputNotes: number[];
  bassMidi: number;
  velocity: number;
  released: boolean;
  sustained: boolean;
  startedAt: number;
  releaseUntil?: number;
}

export type RecordedMidiSource = "chord" | "arp";
export type MidiTakeExportKind = "CHORDS" | "ARP";

export interface RecordedMidiNote {
  midiNote: number;
  velocity: number;
  startBeats: number;
  durationBeats: number;
  channel: number;
  source: RecordedMidiSource;
}

export interface MidiTake {
  id: string;
  number: number;
  name: string;
  bpm: number;
  timeSignature: { numerator: 4; denominator: 4 };
  bars: number;
  key?: string;
  phraseChords?: string[];
  soundName?: string;
  arpName?: string;
  voicing?: VoicingStage;
  chordEvents: RecordedMidiNote[];
  arpEvents: RecordedMidiNote[];
  createdAt: number;
}

export interface MidiCaptureEvent {
  midiNote: number;
  velocity: number;
  startPerformanceMs: number;
  durationSeconds: number;
  source: "arp";
}

export interface SoundingNoteInfo {
  midi: number;
  noteName: string;
  root: boolean;
  sustained?: boolean;
  arp?: boolean;
  bass?: boolean;
  sources: InputSource[];
}

export interface IdeaRecordingEvent {
  id: string;
  at: number;
  type: "note-on" | "note-off";
  triggerId: string;
  root: NoteName;
  outputNotes: number[];
  bassMidi: number;
  velocity: number;
  preset: string;
  voicing: VoicingStage;
  source: InputSource;
}

export type SoundAuditStatus = "funktioniert" | "repariert" | "noch schwach" | "vorläufig deaktiviert";

export interface SoundAuditItem {
  category: "Chord" | "Bass" | "Drums" | "FX";
  name: string;
  status: SoundAuditStatus;
  notes: string;
}

export interface ChordSelfTestResult {
  label: string;
  expected: string;
  actual: string;
  passed: boolean;
}

export type LoopEventType = "chord-on" | "chord-off" | "param" | "beat-fill";

export interface LoopEvent {
  id: string;
  at: number;
  type: LoopEventType;
  payload: Record<string, unknown>;
}

export interface LoopLayer {
  id: string;
  events: LoopEvent[];
  createdAt: number;
}

export interface SavedLoop {
  id: string;
  name: string;
  bars: number;
  bpm: number;
  layers: LoopLayer[];
  createdAt: number;
}

export interface MidiMapping {
  cc: number;
  parameter: string;
}

export interface MidiDeviceInfo {
  id: string;
  name: string;
  manufacturer?: string;
}

export interface DisplayFlash {
  title: string;
  lines: string[];
  bars?: number[];
  mode?: DisplayMode;
  expiresAt: number;
}
