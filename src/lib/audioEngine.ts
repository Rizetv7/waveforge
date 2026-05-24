import * as Tone from "tone";
import type {
  ArpeggiatorState,
  ArpDirection,
  BassMode,
  DrumPattern,
  FxState,
  LayerState,
  PerformanceMode,
} from "../types";
import { bassPresets, drumPatterns, leadPresets } from "../data/presets";
import { midiToNoteName } from "./musicTheory";

const arpRateMap: Record<string, Tone.Unit.Time> = {
  "1/4": "4n",
  "1/8": "8n",
  "1/8T": "8t",
  "1/16": "16n",
  "1/16T": "16t",
  "1/32": "32n",
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const gainDb = (value: number) => (value <= 0 ? -80 : -42 + value * 42);
const human = (amount: number) => (Math.random() * 2 - 1) * amount;

interface HeldChord {
  notes: number[];
  bassMidi: number;
  velocity: number;
}

interface EngineTrigger extends HeldChord {
  heldNotes: boolean;
}

export class AuraAudioEngine {
  private chordSynth?: Tone.PolySynth<Tone.Synth>;
  private bassSynth?: Tone.MonoSynth;
  private kick?: Tone.MembraneSynth;
  private snare?: Tone.NoiseSynth;
  private hat?: Tone.MetalSynth;
  private perc?: Tone.Synth;
  private vinylNoise?: Tone.Noise;

  private chordGain?: Tone.Gain;
  private bassGain?: Tone.Gain;
  private drumGain?: Tone.Gain;
  private preFx?: Tone.Gain;
  private mainFilter?: Tone.Filter;
  private drive?: Tone.Distortion;
  private chorus?: Tone.Chorus;
  private phaser?: Tone.Phaser;
  private flanger?: Tone.FeedbackDelay;
  private tremolo?: Tone.Tremolo;
  private bitCrusher?: Tone.BitCrusher;
  private delay?: Tone.FeedbackDelay;
  private reverb?: Tone.Reverb;
  private compressor?: Tone.Compressor;
  private limiter?: Tone.Limiter;
  private wobbleLfo?: Tone.LFO;
  private wowLfo?: Tone.LFO;
  private recorderDestination?: MediaStreamAudioDestinationNode;
  private mediaRecorder?: MediaRecorder;
  private recordingChunks: Blob[] = [];

  private arpLoop?: Tone.Loop;
  private bassLoop?: Tone.Loop;
  private drumLoop?: Tone.Loop;
  private textureLoop?: Tone.Loop;

  private initialized = false;
  private heldChord: HeldChord | null = null;
  private latchedChord: HeldChord | null = null;
  private lastReleasedChord: HeldChord | null = null;
  private chordTriggers = new Map<string, EngineTrigger>();
  private chordTriggerOrder: string[] = [];
  private noteRefs = new Map<number, Set<string>>();
  private normalNoteRefs = new Map<number, Set<string>>();
  private previousChordNotes: number[] = [];
  private arpState?: ArpeggiatorState;
  private performanceMode: PerformanceMode = "OFF";
  private bassMode: BassMode = "Root Note";
  private drumPattern: DrumPattern = drumPatterns[0];
  private drumEnabled = true;
  private arpStep = 0;
  private bassStep = 0;
  private drumStep = 0;
  private pitchBendCents = 0;
  private colorValue = 0.56;
  private onArpNote?: (midi: number | null) => void;
  private arpClearTimer: number | null = null;

  async init() {
    if (this.initialized) {
      await Tone.start();
      return;
    }

    await Tone.start();
    Tone.Transport.bpm.value = 96;
    Tone.Transport.swing = 0.08;
    Tone.Transport.swingSubdivision = "8n";

    this.chordGain = new Tone.Gain(0.85);
    this.bassGain = new Tone.Gain(0.8);
    this.drumGain = new Tone.Gain(0.75);
    this.preFx = new Tone.Gain(0.78);
    this.mainFilter = new Tone.Filter({ type: "lowpass", frequency: 3600, rolloff: -24, Q: 0.55 });
    this.drive = new Tone.Distortion({ distortion: 0.04, wet: 0.025 });
    this.chorus = new Tone.Chorus({ frequency: 0.42, delayTime: 3.4, depth: 0.18, wet: 0.035 }).start();
    this.phaser = new Tone.Phaser({ frequency: 0.18, octaves: 3, baseFrequency: 320, wet: 0 });
    this.flanger = new Tone.FeedbackDelay({ delayTime: 0.004, feedback: 0.28, wet: 0 });
    this.tremolo = new Tone.Tremolo({ frequency: 4.2, depth: 0.22, wet: 0 }).start();
    this.bitCrusher = new Tone.BitCrusher(6);
    this.bitCrusher.wet.value = 0;
    this.delay = new Tone.FeedbackDelay({ delayTime: "8n.", feedback: 0.32, wet: 0.22 });
    this.reverb = new Tone.Reverb({ decay: 5.2, preDelay: 0.03, wet: 0.36 });
    this.compressor = new Tone.Compressor({ threshold: -18, ratio: 3.2, attack: 0.02, release: 0.18 });
    this.limiter = new Tone.Limiter(-1.5);
    this.wobbleLfo = new Tone.LFO({ frequency: 0.09, min: -80, max: 80 }).start();
    this.wowLfo = new Tone.LFO({ frequency: 0.2, min: -5, max: 5 }).start();
    this.wobbleLfo.connect(this.mainFilter.detune);

    this.chordSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "fattriangle", count: 3, spread: 18 },
      envelope: { attack: 0.045, decay: 0.22, sustain: 0.68, release: 1.15 },
    });
    this.bassSynth = new Tone.MonoSynth({
      oscillator: { type: "sine" },
      filter: { frequency: 720, type: "lowpass", rolloff: -24, Q: 1.1 },
      envelope: { attack: 0.006, decay: 0.18, sustain: 0.82, release: 0.34 },
      filterEnvelope: { attack: 0.008, decay: 0.18, sustain: 0.34, release: 0.35, baseFrequency: 70, octaves: 2.4 },
      portamento: 0.045,
    });
    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.045,
      octaves: 8,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.46, sustain: 0.02, release: 0.05 },
    });
    this.snare = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.001, decay: 0.16, sustain: 0.02, release: 0.08 },
    });
    this.hat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.07, release: 0.025 },
      harmonicity: 5.1,
      modulationIndex: 18,
      resonance: 3600,
      octaves: 1.4,
    });
    this.perc = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
    });
    this.vinylNoise = new Tone.Noise({ type: "pink", volume: -48 });

    this.chordSynth.connect(this.chordGain);
    this.bassSynth.connect(this.bassGain);
    this.kick.connect(this.drumGain);
    this.snare.connect(this.drumGain);
    this.hat.connect(this.drumGain);
    this.perc.connect(this.drumGain);
    this.vinylNoise.connect(this.preFx);
    this.chordGain.connect(this.preFx);
    this.bassGain.connect(this.preFx);
    this.drumGain.connect(this.preFx);
    this.preFx.chain(
      this.mainFilter,
      this.drive,
      this.chorus,
      this.phaser,
      this.flanger,
      this.tremolo,
      this.bitCrusher,
      this.delay,
      this.reverb,
      this.compressor,
      this.limiter,
      Tone.Destination,
    );

    this.recorderDestination = (Tone.getContext().rawContext as AudioContext).createMediaStreamDestination();
    (this.limiter as unknown as { connect: (node: AudioNode) => void }).connect(this.recorderDestination);

    this.setLeadPreset("TEST POLY");
    this.setBassPreset("Round Bass");
    this.createLoops();
    Tone.Transport.start();
    this.initialized = true;
  }

  dispose() {
    Tone.Transport.stop();
    [this.arpLoop, this.bassLoop, this.drumLoop, this.textureLoop].forEach((loop) => loop?.dispose());
  }

  setArpNoteListener(listener: (midi: number | null) => void) {
    this.onArpNote = listener;
  }

  private publishArpNote(midi: number | null) {
    this.onArpNote?.(midi);
    if (this.arpClearTimer !== null) window.clearTimeout(this.arpClearTimer);
    if (midi !== null) {
      this.arpClearTimer = window.setTimeout(() => this.onArpNote?.(null), 160);
    }
  }

  private createLoops() {
    this.arpLoop = new Tone.Loop((time) => this.handleArp(time), "16n").start(0);
    this.bassLoop = new Tone.Loop((time) => this.handleBass(time), "8n").start(0);
    this.drumLoop = new Tone.Loop((time) => this.handleDrums(time), "16n").start(0);
    this.textureLoop = new Tone.Loop((time) => this.handleTextures(time), "2n").start(0);
  }

  setBpm(bpm: number) {
    Tone.Transport.bpm.rampTo(Math.max(50, Math.min(180, bpm)), 0.08);
  }

  setLeadPreset(name: string) {
    const preset = leadPresets.find((item) => item.name === name) ?? leadPresets[0];
    this.chordSynth?.set({
      oscillator: { type: preset.oscillator, count: preset.oscillator.startsWith("fat") ? 3 : undefined, spread: preset.spread * 42 },
      envelope: {
        attack: preset.attack,
        decay: preset.decay,
        sustain: preset.sustain,
        release: preset.release,
      },
    });
    if (this.mainFilter) this.mainFilter.frequency.rampTo(preset.filter, 0.15);
    this.chordSynth?.set({ detune: preset.detune });
  }

  setColor(value: number) {
    this.colorValue = clamp(value);
    const brightness = 900 + this.colorValue * 6200;
    const q = 0.45 + this.colorValue * 1.15;
    this.mainFilter?.frequency.rampTo(brightness, 0.09);
    this.mainFilter?.Q.rampTo(q, 0.09);
    this.drive?.wet.rampTo(0.015 + this.colorValue * 0.075, 0.1);
    this.drive?.set({ distortion: 0.025 + this.colorValue * 0.13 });
    this.chorus?.wet.rampTo(0.015 + this.colorValue * 0.07, 0.1);
    this.wobbleLfo?.set({ frequency: 0.04 + this.colorValue * 0.12, min: -8 - this.colorValue * 18, max: 8 + this.colorValue * 18 });
  }

  setBassPreset(name: string) {
    const preset = bassPresets.find((item) => item.name === name) ?? bassPresets[0];
    this.bassSynth?.set({
      oscillator: { type: preset.oscillator },
      filter: { frequency: preset.filter },
      envelope: {
        attack: preset.attack,
        decay: preset.decay,
        sustain: preset.sustain,
        release: preset.release,
      },
      portamento: preset.glide,
    });
    this.bassGain?.gain.rampTo(0.68 + preset.drive * 0.28, 0.1);
  }

  setLayer(layer: "chord" | "bass" | "drums", state: LayerState, soloActive: boolean) {
    const target = state.muted || (soloActive && !state.solo) ? 0 : state.volume;
    const node = layer === "chord" ? this.chordGain : layer === "bass" ? this.bassGain : this.drumGain;
    node?.gain.rampTo(target, 0.06);
  }

  setFx(fx: FxState) {
    const bypass = fx.bypass;
    this.reverb?.wet.rampTo(bypass ? 0 : fx.reverb, 0.12);
    this.delay?.wet.rampTo(bypass ? 0 : fx.delay, 0.12);
    this.chorus?.wet.rampTo(bypass ? 0 : fx.chorus, 0.12);
    this.drive?.wet.rampTo(bypass ? 0 : fx.drive * 0.7, 0.12);
    this.drive?.set({ distortion: 0.04 + fx.drive * 0.48 });
    if (bypass) {
      this.setColor(this.colorValue);
    } else {
      this.mainFilter?.frequency.rampTo(450 + fx.filter * 10500, 0.12);
      this.wobbleLfo?.set({ frequency: 0.04 + fx.wobble * 6, min: -fx.wobble * 360, max: fx.wobble * 360 });
    }
    this.phaser?.wet.rampTo(!bypass && fx.phaser ? 0.24 : 0, 0.12);
    this.flanger?.wet.rampTo(!bypass && fx.flanger ? 0.18 : 0, 0.12);
    this.tremolo?.wet.rampTo(!bypass && fx.tremolo ? 0.28 : 0, 0.12);
    this.bitCrusher?.wet.rampTo(!bypass && fx.bitcrush ? 0.18 : 0, 0.12);
    if (fx.vinyl && !bypass) {
      if (this.vinylNoise?.state !== "started") this.vinylNoise?.start();
    } else if (this.vinylNoise?.state === "started") {
      this.vinylNoise.stop();
    }
    if (fx.wow && !bypass && this.wowLfo && this.mainFilter) {
      this.wowLfo.connect(this.mainFilter.detune);
    } else {
      this.wowLfo?.disconnect();
    }
    if (fx.freeze) {
      this.reverb?.set({ decay: 10 });
      this.delay?.set({ feedback: 0.55 });
    } else {
      this.reverb?.set({ decay: 5.2 });
      this.delay?.set({ feedback: 0.32 });
    }
  }

  setArpeggiator(state: ArpeggiatorState) {
    this.arpState = state;
    this.arpLoop?.dispose();
    const rate = arpRateMap[state.rate] ?? "16n";
    this.arpLoop = new Tone.Loop((time) => this.handleArp(time), rate).start(0);
    Tone.Transport.swing = state.swing;
    if (!state.enabled) this.publishArpNote(null);
  }

  setPerformanceMode(mode: PerformanceMode) {
    this.performanceMode = mode;
    if (mode === "OFF") this.publishArpNote(null);
  }

  setBassMode(mode: BassMode) {
    this.bassMode = mode;
  }

  setDrumPattern(patternName: string) {
    this.drumPattern = drumPatterns.find((pattern) => pattern.name === patternName) ?? drumPatterns[0];
  }

  setDrumsEnabled(enabled: boolean) {
    this.drumEnabled = enabled;
  }

  setPitchBend(rawValue: number) {
    const normalized = (rawValue - 8192) / 8192;
    this.pitchBendCents = normalized * 200;
    this.chordSynth?.set({ detune: this.pitchBendCents });
    this.bassSynth?.set({ detune: this.pitchBendCents });
  }

  setModWheel(value: number) {
    const amount = clamp(value / 127);
    this.mainFilter?.frequency.rampTo(900 + amount * 9500, 0.04);
    this.chorus?.wet.rampTo(0.18 + amount * 0.42, 0.08);
  }

  private shouldHoldChord() {
    return !this.arpState?.enabled && this.performanceMode === "OFF";
  }

  private attackNoteRef(midi: number, triggerId: string, velocity: number) {
    const refs = this.noteRefs.get(midi) ?? new Set<string>();
    const firstRef = refs.size === 0;
    refs.add(triggerId);
    this.noteRefs.set(midi, refs);
    if (firstRef) {
      this.chordSynth?.triggerAttack(midiToNoteName(midi), Tone.now(), clamp(velocity) * 0.82);
    }
  }

  private releaseNoteRef(midi: number, triggerId: string) {
    const refs = this.noteRefs.get(midi);
    if (!refs) return;
    refs.delete(triggerId);
    if (refs.size > 0) return;
    this.noteRefs.delete(midi);
    this.chordSynth?.triggerRelease(midiToNoteName(midi), Tone.now() + 0.018);
  }

  private attackNormalNoteRef(midi: number, triggerId: string, velocity: number) {
    const refs = this.normalNoteRefs.get(midi) ?? new Set<string>();
    const firstRef = refs.size === 0;
    refs.add(triggerId);
    this.normalNoteRefs.set(midi, refs);
    if (firstRef) {
      this.chordSynth?.triggerAttack(midiToNoteName(midi), Tone.now(), clamp(velocity) * 0.9);
    }
  }

  private releaseNormalNoteRef(midi: number, triggerId: string) {
    const refs = this.normalNoteRefs.get(midi);
    if (!refs) return;
    refs.delete(triggerId);
    if (refs.size > 0) return;
    this.normalNoteRefs.delete(midi);
    this.chordSynth?.triggerRelease(midiToNoteName(midi), Tone.now() + 0.018);
  }

  private refreshHeldChord() {
    const latestId = [...this.chordTriggerOrder].reverse().find((id) => this.chordTriggers.has(id));
    const latest = latestId ? this.chordTriggers.get(latestId) : null;
    this.heldChord = latest ? { notes: latest.notes, bassMidi: latest.bassMidi, velocity: latest.velocity } : null;
    if (!this.heldChord && !this.arpState?.latch) this.latchedChord = null;
  }

  private refreshHeldBass() {
    if (this.bassMode !== "Root Note") return;
    const latestId = [...this.chordTriggerOrder].reverse().find((id) => this.chordTriggers.has(id));
    const latest = latestId ? this.chordTriggers.get(latestId) : null;
    if (!latest) {
      this.bassSynth?.triggerRelease(Tone.now() + 0.02);
      return;
    }
    this.bassSynth?.triggerAttack(midiToNoteName(latest.bassMidi), Tone.now(), latest.velocity * 0.62);
  }

  attackChord(triggerId: string, notes: number[], bassMidi: number, velocity = 0.78) {
    if (this.chordTriggers.has(triggerId)) {
      this.updateChordTrigger(triggerId, notes, bassMidi, velocity);
      return;
    }

    const chord = { notes, bassMidi, velocity: clamp(velocity), heldNotes: this.shouldHoldChord() };
    this.chordTriggers.set(triggerId, chord);
    this.chordTriggerOrder = [...this.chordTriggerOrder.filter((id) => id !== triggerId), triggerId];
    this.heldChord = chord;
    if (this.arpState?.latch) this.latchedChord = chord;
    this.previousChordNotes = notes;

    if (chord.heldNotes) {
      notes.forEach((note) => this.attackNoteRef(note, triggerId, velocity));
    } else if (this.performanceMode === "STRUM") {
      this.strum(notes, velocity, 0.034);
    } else if (!this.arpState?.enabled && this.performanceMode === "DRONE") {
      notes.forEach((note) => this.attackNoteRef(note, triggerId, velocity * 0.72));
      this.chordTriggers.set(triggerId, { ...chord, heldNotes: true });
    } else if (!this.arpState?.enabled && this.performanceMode === "DREAM") {
      this.triggerDream(Tone.now(), chord);
    } else if (!this.arpState?.enabled && this.performanceMode === "CASCADE") {
      this.triggerCascade(Tone.now(), chord, false);
    } else if (!this.arpState?.enabled && this.performanceMode === "PULSE") {
      this.triggerChordNotes(notes, velocity * 0.8, "8n");
    } else if (!this.arpState?.enabled && this.performanceMode === "RHYTHM CHORDS") {
      this.triggerChordNotes(notes, velocity * 0.78, "16n");
    }

    if (this.bassMode === "Root Note") {
      this.bassSynth?.triggerAttack(midiToNoteName(bassMidi), Tone.now(), velocity * 0.62);
    }
  }

  updateChordTrigger(triggerId: string, notes: number[], bassMidi: number, velocity = 0.78) {
    const existing = this.chordTriggers.get(triggerId);
    if (!existing) {
      this.attackChord(triggerId, notes, bassMidi, velocity);
      return;
    }

    if (existing.heldNotes) {
      existing.notes.filter((note) => !notes.includes(note)).forEach((note) => this.releaseNoteRef(note, triggerId));
      notes.filter((note) => !existing.notes.includes(note)).forEach((note) => this.attackNoteRef(note, triggerId, velocity));
    }

    const next = { notes, bassMidi, velocity: clamp(velocity), heldNotes: existing.heldNotes };
    this.chordTriggers.set(triggerId, next);
    this.heldChord = next;
    this.previousChordNotes = notes;
    if (this.bassMode === "Root Note") {
      this.bassSynth?.triggerAttack(midiToNoteName(bassMidi), Tone.now(), velocity * 0.62);
    }
  }

  releaseChordTrigger(triggerId: string) {
    const existing = this.chordTriggers.get(triggerId);
    if (!existing) return;
    this.lastReleasedChord = { notes: existing.notes, bassMidi: existing.bassMidi, velocity: existing.velocity };
    if (existing.heldNotes) {
      existing.notes.forEach((note) => this.releaseNoteRef(note, triggerId));
    }
    this.chordTriggers.delete(triggerId);
    this.chordTriggerOrder = this.chordTriggerOrder.filter((id) => id !== triggerId);
    this.refreshHeldChord();
    this.refreshHeldBass();
  }

  attackNormalNote(triggerId: string, midi: number, velocity = 0.75) {
    this.attackNormalNoteRef(midi, triggerId, velocity);
  }

  releaseNormalNoteById(triggerId: string, midi: number) {
    this.releaseNormalNoteRef(midi, triggerId);
  }

  playNormalNote(midi: number, velocity = 0.75) {
    this.attackNormalNote(`normal:${midi}`, midi, velocity);
  }

  releaseNormalNote(midi: number) {
    this.releaseNormalNoteById(`normal:${midi}`, midi);
  }

  playBassNote(midi: number, velocity = 0.78) {
    this.bassSynth?.triggerAttack(midiToNoteName(midi), Tone.now(), clamp(velocity) * 0.88);
  }

  releaseBassNote() {
    this.bassSynth?.triggerRelease(Tone.now() + 0.02);
  }

  allNotesOff() {
    this.heldChord = null;
    this.latchedChord = null;
    this.lastReleasedChord = null;
    this.chordTriggers.clear();
    this.chordTriggerOrder = [];
    this.noteRefs.clear();
    this.normalNoteRefs.clear();
    this.chordSynth?.releaseAll(Tone.now() + 0.01);
    this.bassSynth?.triggerRelease(Tone.now() + 0.01);
    this.publishArpNote(null);
  }

  stopAllScheduledEvents() {
    this.arpStep = 0;
    this.bassStep = 0;
    this.drumStep = 0;
    this.publishArpNote(null);
    this.allNotesOff();
  }

  async resetAudioEngine() {
    this.stopAllScheduledEvents();
    this.setLeadPreset("TEST POLY");
    this.setBassPreset("Round Bass");
    this.setColor(0.56);
    await Tone.start();
  }

  playChord(notes: number[], bassMidi: number, velocity = 0.78) {
    this.attackChord(`legacy:${Date.now()}:${Math.random()}`, notes, bassMidi, velocity);
  }

  releaseChord() {
    [...this.chordTriggers.keys()].forEach((id) => this.releaseChordTrigger(id));
    if (!this.arpState?.latch) this.heldChord = null;
  }

  hardCut() {
    this.heldChord = null;
    this.latchedChord = null;
    this.lastReleasedChord = null;
    this.chordTriggers.clear();
    this.chordTriggerOrder = [];
    this.noteRefs.clear();
    this.normalNoteRefs.clear();
    this.chordSynth?.releaseAll(Tone.now());
    this.bassSynth?.triggerRelease(Tone.now());
    this.publishArpNote(null);
  }

  triggerFill() {
    const now = Tone.now();
    [0, 0.12, 0.24, 0.3].forEach((offset, index) => {
      this.snare?.triggerAttackRelease("16n", now + offset, 0.35 + index * 0.09);
      if (index % 2 === 0) this.hat?.triggerAttackRelease("32n", now + offset + 0.04, 0.28);
    });
  }

  triggerVariation() {
    const rotated = <T>(items: T[]) => [...items.slice(1), items[0]];
    this.drumPattern = {
      ...this.drumPattern,
      steps: {
        kick: rotated(this.drumPattern.steps.kick),
        snare: this.drumPattern.steps.snare,
        hat: rotated(rotated(this.drumPattern.steps.hat)),
        perc: rotated(this.drumPattern.steps.perc),
      },
    };
  }

  private triggerChordNotes(notes: number[], velocity: number, duration: Tone.Unit.Time) {
    const now = Tone.now();
    this.chordSynth?.triggerAttackRelease(
      notes.map((note) => midiToNoteName(note)),
      duration,
      now,
      clamp(velocity) * 0.82,
    );
  }

  private strum(notes: number[], velocity: number, step: number) {
    const now = Tone.now();
    notes.forEach((note, index) => {
      this.chordSynth?.triggerAttackRelease(midiToNoteName(note), "1n", now + index * step, clamp(velocity) * 0.78);
    });
  }

  private activeChord() {
    return this.heldChord ?? this.latchedChord ?? (this.arpState?.latch ? this.lastReleasedChord : null);
  }

  private handleArp(time: number) {
    const state = this.arpState;
    const chord = this.activeChord();
    if (!chord || (!state?.enabled && this.performanceMode === "OFF")) return;
    const probability = state?.probability ?? 0.9;
    if (Math.random() > probability) {
      this.arpStep += 1;
      return;
    }

    if (this.performanceMode === "PULSE" || this.performanceMode === "RHYTHM CHORDS" || state?.direction === "Chord Pulse") {
      this.triggerScheduledChord(chord, time, state?.gate ?? 0.7);
    } else if (this.performanceMode === "CASCADE" || state?.direction === "Cascading") {
      this.triggerCascade(time, chord, true);
    } else if (this.performanceMode === "DREAM" || state?.direction === "Broken Dream") {
      this.triggerDream(time, chord);
    } else if (state?.direction === "Guitar Strum") {
      this.triggerScheduledStrum(chord.notes, time, chord.velocity);
    } else {
      this.triggerArpNote(time, chord, state?.direction ?? "Up");
    }
    this.arpStep = (this.arpStep + 1) % (state?.patternLength ?? 16);
  }

  private triggerScheduledChord(chord: HeldChord, time: number, gate: number) {
    this.chordSynth?.triggerAttackRelease(
      chord.notes.map((note) => midiToNoteName(note)),
      Tone.Time("8n").toSeconds() * gate,
      time + human(this.arpState?.humanize ?? 0.01),
      chord.velocity * 0.66,
    );
    this.publishArpNote(chord.notes[0] ?? null);
  }

  private triggerScheduledStrum(notes: number[], time: number, velocity: number) {
    notes.forEach((note, index) => {
      this.chordSynth?.triggerAttackRelease(midiToNoteName(note), "8n", time + index * 0.026, velocity * 0.72);
      if (index === 0) this.publishArpNote(note);
    });
  }

  private getArpNotes(chord: HeldChord) {
    const octaveRange = this.arpState?.octaveRange ?? 1;
    return Array.from({ length: octaveRange }, (_, octave) => chord.notes.map((note) => note + octave * 12)).flat();
  }

  private triggerArpNote(time: number, chord: HeldChord, direction: ArpDirection) {
    const notes = this.getArpNotes(chord);
    const max = notes.length - 1;
    const upDownPosition = this.arpStep % Math.max(1, max * 2);
    const index =
      direction === "Down"
        ? max - (this.arpStep % notes.length)
        : direction === "Up/Down"
          ? upDownPosition > max
            ? max - (upDownPosition - max)
            : upDownPosition
          : direction === "Random"
            ? Math.floor(Math.random() * notes.length)
            : direction === "Hypnotic Spiral"
              ? (this.arpStep * 2 + Math.floor(this.arpStep / 3)) % notes.length
              : this.arpStep % notes.length;
    const velocityVariation = this.arpState?.velocityVariation ?? 0.1;
    const velocity = clamp(chord.velocity + human(velocityVariation), 0.2, 1);
    this.chordSynth?.triggerAttackRelease(
      midiToNoteName(notes[index]),
      Tone.Time(arpRateMap[this.arpState?.rate ?? "1/8"] ?? "8n").toSeconds() * (this.arpState?.gate ?? 0.72),
      time + human(this.arpState?.humanize ?? 0.01),
      velocity * 0.78,
    );
    this.publishArpNote(notes[index]);
  }

  private triggerCascade(time: number, chord: HeldChord, scheduled: boolean) {
    const notes = this.getArpNotes(chord);
    const direction = this.arpStep % 2 === 0 ? notes : [...notes].reverse();
    direction.slice(0, 5).forEach((note, index) => {
      this.chordSynth?.triggerAttackRelease(
        midiToNoteName(note),
        "8n",
        (scheduled ? time : Tone.now()) + index * 0.055,
        chord.velocity * (0.62 - index * 0.045),
      );
      if (index === 0) this.publishArpNote(note);
    });
  }

  private triggerDream(time: number, chord: HeldChord) {
    const notes = this.getArpNotes(chord);
    const count = 1 + (this.arpStep % 3 === 0 ? 1 : 0);
    for (let i = 0; i < count; i += 1) {
      const note = notes[Math.floor(Math.random() * notes.length)];
      this.chordSynth?.triggerAttackRelease(midiToNoteName(note), "8n", time + i * 0.075, chord.velocity * 0.62);
      if (i === 0) this.publishArpNote(note);
    }
  }

  private handleBass(time: number) {
    const chord = this.activeChord();
    if (!chord || this.bassMode === "Off" || this.bassMode === "Solo Bass Mode") return;
    const root = chord.bassMidi;
    let shouldPlay = false;
    let note = root;
    if (this.bassMode === "Octave Pulse") {
      shouldPlay = true;
      note = this.bassStep % 2 === 0 ? root : root + 12;
    } else if (this.bassMode === "Walking Bass") {
      shouldPlay = this.bassStep % 2 === 0 || this.bassStep % 7 === 0;
      note = root + [0, 7, 10, 12, 14, 12, 7, 5][this.bassStep % 8];
    } else if (this.bassMode === "Syncopated") {
      shouldPlay = [0, 3, 6, 7].includes(this.bassStep % 8);
      note = root + (this.bassStep % 4 === 3 ? 12 : 0);
    }
    if (shouldPlay) {
      this.bassSynth?.triggerAttackRelease(midiToNoteName(note), "8n", time + human(0.008), chord.velocity * 0.68);
    }
    this.bassStep = (this.bassStep + 1) % 16;
  }

  private handleDrums(time: number) {
    if (!this.drumEnabled) return;
    const step = this.drumStep % 16;
    const accent = this.drumPattern.accents?.includes(step) ? 1.1 : 0.86;
    if (this.drumPattern.steps.kick[step]) this.kick?.triggerAttackRelease("C1", "8n", time + human(0.004), 0.9 * accent);
    if (this.drumPattern.steps.snare[step]) this.snare?.triggerAttackRelease("16n", time + human(0.007), 0.46 * accent);
    if (this.drumPattern.steps.hat[step]) this.hat?.triggerAttackRelease("32n", time + human(0.01), 0.2 * accent);
    if (this.drumPattern.steps.perc[step]) this.perc?.triggerAttackRelease("G4", "32n", time + human(0.009), 0.18 * accent);
    this.drumStep = (this.drumStep + 1) % 16;
  }

  private handleTextures(time: number) {
    if (this.performanceMode !== "DRONE") return;
    const chord = this.activeChord();
    if (!chord) return;
    const note = chord.notes[(this.arpStep + 2) % chord.notes.length] + 12;
    this.chordSynth?.triggerAttackRelease(midiToNoteName(note), "2n", time, chord.velocity * 0.26);
  }

  async startRecording() {
    if (!this.recorderDestination || this.mediaRecorder?.state === "recording") return;
    this.recordingChunks = [];
    this.mediaRecorder = new MediaRecorder(this.recorderDestination.stream, { mimeType: "audio/webm" });
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.recordingChunks.push(event.data);
    };
    this.mediaRecorder.start();
  }

  async stopRecording() {
    if (!this.mediaRecorder || this.mediaRecorder.state !== "recording") return null;
    return new Promise<Blob>((resolve) => {
      this.mediaRecorder!.onstop = () => resolve(new Blob(this.recordingChunks, { type: "audio/webm" }));
      this.mediaRecorder!.stop();
    });
  }
}

export const auraAudio = new AuraAudioEngine();
