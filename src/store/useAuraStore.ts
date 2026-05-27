import { create } from "zustand";
import { bassPresets, defaultArp, defaultFx, drumPatterns, factoryPresets, leadPresets, randomBass, randomDrum, randomLead } from "../data/presets";
import { auraAudio } from "../lib/audioEngine";
import { buildMidiFile, buildMidiTakeFile, downloadBlob, midiTakeFilename } from "../lib/export";
import { createHarmonySuggestions, getSuggestionVariant, hasCuratedLoopContinuation } from "../lib/harmonySuggestions";
import { extensionToModifiers, type FoundationExtension } from "../lib/foundationTheory";
import { buildChord, displayChordLabel, formatNoteList, midiToNoteName, NOTE_NAMES, noteToMidi, noteToPitch, pitchToNote, voicingStageName } from "../lib/musicTheory";
import { loadMidiMappings, loadSavedLoops, loadUserPresets, saveMidiMappings, saveSavedLoops, saveUserPresets } from "../lib/storage";
import type {
  ArpeggiatorState,
  ActiveTrigger,
  BassMode,
  ChordSelfTestResult,
  ChordModifier,
  ChordResult,
  ChordType,
  CompletePreset,
  DisplayFlash,
  DisplayMode,
  DrumPattern,
  FxName,
  FxState,
  HarmonyPathMode,
  HarmonySuggestion,
  InputSource,
  IdeaRecordingEvent,
  LayerId,
  LayerState,
  LoopEvent,
  LoopLayer,
  MidiCaptureEvent,
  MidiDeviceInfo,
  MidiMapping,
  MidiPermission,
  MidiPlayMode,
  MidiTake,
  MidiTakeExportKind,
  NoteName,
  PerformanceMode,
  PhraseSlot,
  PhraseStatus,
  PhraseStep,
  RecordedMidiNote,
  SavedLoop,
  ScaleMode,
  SoundAuditItem,
  SoundingNoteInfo,
  VoicingStage,
  WaveforgeModule,
} from "../types";

const initialPreset: CompletePreset = {
  id: "waveforge-init",
  name: "Simple Chords",
  keyRoot: "C",
  scaleMode: "Major",
  bpm: 92,
  chordType: "Major",
  modifiers: [],
  leadPreset: "TEST POLY",
  bassPreset: "Round Bass",
  bassMode: "Off",
  drumPattern: "Soft Disco",
  arp: { enabled: false },
  performanceMode: "OFF",
  spread: 0,
  motion: 0,
  color: 0.56,
  fx: {
    reverb: 0,
    delay: 0,
    chorus: 0,
    drive: 0,
    filter: 0.82,
    wobble: 0,
    bypass: true,
  },
};
const uuid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const nowSeconds = () => performance.now() / 1000;
const loopSeconds = (bpm: number, bars: number) => (60 / bpm) * 4 * bars;
const releaseTailMs = 1200;

let loopTimer: number | null = null;
let lastLoopPos = 0;
let ideaPlaybackTimers: number[] = [];
let midiTakePlaybackTimers: number[] = [];
let fpsTimer: number | null = null;

const inputKeyFor = (source: InputSource, root: NoteName, inputMidi?: number) => `${source}:${inputMidi ?? root}`;

const sourceLabel = (source: InputSource) => {
  if (source === "qwerty") return "QWERTY";
  if (source === "midi") return "MIDI";
  return source.toUpperCase();
};

const deriveSoundingState = (triggers: Record<string, ActiveTrigger>, normalNotes: number[], activeArpNote: number | null = null) => {
  const infos = new Map<number, SoundingNoteInfo>();
  Object.values(triggers).forEach((trigger) => {
    trigger.outputNotes.forEach((midi) => {
      const existing = infos.get(midi);
      const root = pitchToNote(midi) === trigger.chord.root;
      const sustained = trigger.sustained || trigger.released;
      if (existing) {
        infos.set(midi, {
          ...existing,
          root: existing.root || root,
          sustained: existing.sustained || sustained,
          arp: existing.arp || activeArpNote === midi,
          sources: Array.from(new Set([...existing.sources, trigger.source])),
        });
        return;
      }
      infos.set(midi, { midi, noteName: midiToNoteName(midi), root, sustained, arp: activeArpNote === midi, sources: [trigger.source] });
    });
  });
  normalNotes.forEach((midi) => {
    if (!infos.has(midi)) infos.set(midi, { midi, noteName: midiToNoteName(midi), root: true, arp: activeArpNote === midi, sources: ["qwerty"] });
  });
  const soundingNoteInfo = [...infos.values()].sort((a, b) => a.midi - b.midi);
  return {
    activeRoots: Array.from(new Set(Object.values(triggers).filter((trigger) => !trigger.released).map((trigger) => trigger.root))),
    currentlySoundingNotes: soundingNoteInfo.map((info) => info.midi),
    soundingNoteInfo,
  };
};

const buildSoundAudit = (): SoundAuditItem[] => [
  {
    category: "Chord",
    name: "TEST POLY",
    status: "repariert",
    notes: "Basispatch: gehaltene Akkorde, Polyphonie, Velocity und weichere Release-Phase priorisiert.",
  },
  ...leadPresets
    .filter((preset) => preset.name !== "TEST POLY")
    .map<SoundAuditItem>((preset) => ({
      category: "Chord",
      name: preset.name,
      status: preset.release > 2.4 || preset.filter < 1000 ? "noch schwach" : "funktioniert",
      notes: preset.release > 2.4 ? "Technisch spielbar, aber im Foundation-Test potenziell zu lang/matschig." : "Laedt korrekt und nutzt die neue Hold/Release-Engine.",
    })),
  ...bassPresets.map<SoundAuditItem>((preset) => ({
    category: "Bass",
    name: preset.name,
    status: preset.filter < 180 ? "noch schwach" : "funktioniert",
    notes: "Laedt korrekt; Root-Bass folgt jetzt gehaltenen Chord-Triggern.",
  })),
  ...drumPatterns.map<SoundAuditItem>((pattern) => ({
    category: "Drums",
    name: pattern.name,
    status: "funktioniert",
    notes: "Pattern ist BPM-synchron ueber den zentralen Transport testbar.",
  })),
  ...["Reverb", "Delay", "Chorus", "Filter", "Drive"].map<SoundAuditItem>((name) => ({
    category: "FX",
    name,
    status: "funktioniert",
    notes: "Parameter ist mit Audio-Chain verbunden; FX bleiben im Init-Zustand bypassed.",
  })),
];

const chordTestCases = [
  { label: "C Major", type: "Major" as ChordType, modifiers: [] as ChordModifier[], expected: "C3 E3 G3" },
  { label: "C Minor", type: "Minor" as ChordType, modifiers: [] as ChordModifier[], expected: "C3 D#3 G3" },
  { label: "C Sus2", type: "Sus2" as ChordType, modifiers: [] as ChordModifier[], expected: "C3 D3 G3" },
  { label: "C Sus4", type: "Sus4" as ChordType, modifiers: [] as ChordModifier[], expected: "C3 F3 G3" },
  { label: "C7", type: "Major" as ChordType, modifiers: ["7"] as ChordModifier[], expected: "C3 E3 G3 A#3" },
  { label: "Cmaj7", type: "Major" as ChordType, modifiers: ["Maj7"] as ChordModifier[], expected: "C3 E3 G3 B3" },
  { label: "Cm7", type: "Minor" as ChordType, modifiers: ["7"] as ChordModifier[], expected: "C3 D#3 G3 A#3" },
  { label: "Cadd9", type: "Major" as ChordType, modifiers: ["Add9"] as ChordModifier[], expected: "C3 E3 G3 D4" },
  { label: "Cmadd9", type: "Minor" as ChordType, modifiers: ["Add9"] as ChordModifier[], expected: "C3 D#3 G3 D4" },
  { label: "Cdim", type: "Diminished" as ChordType, modifiers: [] as ChordModifier[], expected: "C3 D#3 F#3" },
  { label: "Caug", type: "Augmented" as ChordType, modifiers: [] as ChordModifier[], expected: "C3 E3 G#3" },
];

interface AuraState {
  audioReady: boolean;
  audioStatus: "sleeping" | "ready" | "recording";
  midiSupported: boolean;
  midiDevices: MidiDeviceInfo[];
  midiOutputs: MidiDeviceInfo[];
  selectedMidiInputId: string;
  selectedMidiOutputId: string;
  midiMessage: string;
  midiPermission: MidiPermission;
  midiReconnectToken: number;
  lastMidiEvent: string;
  lastMidiAt: number;
  midiDiagnosticsOpen: boolean;
  toast: string;
  midiMappings: MidiMapping[];
  midiLearnTarget: string;
  midiPlayMode: MidiPlayMode;
  sustain: boolean;
  activeRoots: string[];
  activeNormalNotes: number[];
  sustainedNormalNotes: number[];
  activeTriggers: Record<string, ActiveTrigger>;
  activeTriggerKeys: Record<string, string>;
  sustainedReleasedTriggerIds: string[];
  currentlySoundingNotes: number[];
  soundingNoteInfo: SoundingNoteInfo[];
  activeArpNote: number | null;
  lastNoteOn: string;
  lastNoteOff: string;
  lastVelocity: number;
  fps: number;
  developerTestMode: boolean;
  chordSelfTests: ChordSelfTestResult[];
  soundAudit: SoundAuditItem[];
  keyRoot: NoteName;
  scaleMode: ScaleMode;
  keyModeEnabled: boolean;
  chordType: ChordType;
  modifiers: ChordModifier[];
  currentChord: ChordResult | null;
  previousChordNotes: number[];
  spread: number;
  motion: number;
  color: number;
  displayMode: DisplayMode;
  displayFlash: DisplayFlash | null;
  modules: Record<WaveforgeModule, boolean>;
  moreChordsOpen: boolean;
  settingsOpen: boolean;
  bpm: number;
  layers: Record<LayerId, LayerState>;
  bassMode: BassMode;
  drumPattern: DrumPattern;
  drumsPlaying: boolean;
  arp: ArpeggiatorState;
  performanceMode: PerformanceMode;
  fx: FxState;
  fxPanelExpanded: boolean;
  looperBars: 1 | 2 | 4 | 8 | 16;
  countIn: boolean;
  quantize: boolean;
  looperRecording: boolean;
  looperPlaying: boolean;
  looperOverdub: boolean;
  loopPosition: number;
  loopLayers: LoopLayer[];
  currentLoopLayer: LoopLayer | null;
  redoLayers: LoopLayer[];
  savedLoops: SavedLoop[];
  ideaRecording: boolean;
  ideaPlaying: boolean;
  ideaEvents: IdeaRecordingEvent[];
  ideaRecordingStartedAt: number;
  ideaPlaybackStartedAt: number;
  ideaDuration: number;
  ideaPlaybackPosition: number;
  userPresets: CompletePreset[];
  selectedPresetIndex: number;
  audioCaptureBlob: Blob | null;
  stepSequencerOpen: boolean;
  guidedMode: boolean;
  smartEnabled: boolean;
  harmonyPath: HarmonyPathMode;
  manualLock: boolean;
  harmonySuggestions: HarmonySuggestion[];
  focusedSuggestionId: string;
  suggestionAltIndexes: Record<string, number>;
  harmonyHistory: ChordResult[];
  phraseSlots: PhraseSlot[];
  phraseStep: PhraseStep;
  phraseStatus: PhraseStatus;
  phraseAdvanceToken: number;
  phraseReturnToken: number;
  midiRecording: boolean;
  midiTakePlaying: boolean;
  midiTake: MidiTake | null;
  midiTakeCounter: number;
  midiRecordingStartedAt: number;
  midiRecordingBpm: number;
  midiRecordingChordEvents: RecordedMidiNote[];
  midiRecordingArpEvents: RecordedMidiNote[];
  midiRecordingOpenNotes: Record<string, RecordedMidiNote[]>;
  midiRecordingLastError: string;

  activateAudio: () => Promise<void>;
  setMidiSupported: (supported: boolean) => void;
  setMidiDevices: (inputs: MidiDeviceInfo[], outputs: MidiDeviceInfo[]) => void;
  setMidiPermission: (permission: MidiPermission) => void;
  requestMidiReconnect: () => void;
  registerMidiEvent: (message: string) => void;
  toggleMidiDiagnostics: () => void;
  selectMidiInput: (id: string) => void;
  selectMidiOutput: (id: string) => void;
  setToast: (message: string) => void;
  setMidiLearnTarget: (target: string) => void;
  handleMidiCc: (cc: number, value: number) => void;
  setMidiPlayMode: (mode: MidiPlayMode) => void;
  setSustain: (enabled: boolean) => void;
  setPitchBend: (value: number) => void;
  playRoot: (root: NoteName, velocity?: number, source?: InputSource, inputMidi?: number) => void;
  releaseRoot: (root: NoteName, source?: InputSource, inputMidi?: number) => void;
  playMidiNote: (midi: number, velocity?: number) => void;
  releaseMidiNote: (midi: number) => void;
  allNotesOff: () => void;
  stopAllScheduledEvents: () => void;
  resetAudioEngine: () => Promise<void>;
  setArpVisualNote: (midi: number | null) => void;
  setFps: (fps: number) => void;
  clearMidiLog: () => void;
  toggleDeveloperTestMode: () => void;
  runChordSelfTest: () => void;
  runSoundAudit: () => void;
  playTestChord: (type: ChordType, modifiers?: ChordModifier[]) => void;
  setChordType: (type: ChordType) => void;
  toggleModifier: (modifier: ChordModifier) => void;
  setChordExtension: (extension: FoundationExtension) => void;
  setKeyRoot: (root: NoteName) => void;
  setScaleMode: (mode: ScaleMode) => void;
  setKeyModeEnabled: (enabled: boolean) => void;
  setSpread: (value: number) => void;
  setMotion: (value: number) => void;
  setColor: (value: number) => void;
  flashDisplay: (title: string, lines?: string[], bars?: number[], mode?: DisplayMode) => void;
  clearExpiredDisplay: () => void;
  toggleModule: (module: WaveforgeModule) => void;
  setModule: (module: WaveforgeModule, enabled: boolean) => void;
  toggleMoreChords: () => void;
  toggleSettings: () => void;
  setBpm: (bpm: number) => void;
  setLayerVolume: (layer: LayerId, value: number) => void;
  toggleLayerMute: (layer: LayerId) => void;
  toggleLayerSolo: (layer: LayerId) => void;
  setLayerPreset: (layer: LayerId, preset: string) => void;
  setBassMode: (mode: BassMode) => void;
  setDrumPattern: (pattern: string) => void;
  toggleDrums: () => void;
  drumFill: () => void;
  drumVariation: () => void;
  updateDrumStep: (voice: keyof DrumPattern["steps"], step: number) => void;
  setArp: (patch: Partial<ArpeggiatorState>) => void;
  setPerformanceMode: (mode: PerformanceMode) => void;
  setFxValue: (name: FxName, value: number | boolean) => void;
  toggleFxBypass: () => void;
  applyPreset: (preset: CompletePreset) => void;
  randomizeIdea: () => void;
  saveUserPreset: (name?: string) => void;
  deleteUserPreset: (id: string) => void;
  nextPreset: () => void;
  previousPreset: () => void;
  setLooperBars: (bars: 1 | 2 | 4 | 8 | 16) => void;
  toggleCountIn: () => void;
  toggleQuantize: () => void;
  toggleRecord: () => void;
  togglePlayback: () => void;
  toggleOverdub: () => void;
  stopLooper: () => void;
  undoLoop: () => void;
  redoLoop: () => void;
  clearLoop: () => void;
  saveLoop: () => void;
  loadLoop: (id: string) => void;
  startIdeaRecording: () => void;
  stopIdeaRecording: () => void;
  playIdeaRecording: () => void;
  stopIdeaPlayback: () => void;
  clearIdeaRecording: () => void;
  hardCut: () => void;
  tickLoop: () => void;
  startAudioCapture: () => Promise<void>;
  stopAudioCapture: () => Promise<void>;
  exportIdea: () => void;
  toggleStepSequencer: () => void;
  toggleGuidedMode: () => void;
  setSmartEnabled: (enabled: boolean) => void;
  setHarmonyPath: (mode: HarmonyPathMode) => void;
  setManualLock: (enabled: boolean) => void;
  focusHarmonySuggestion: (id: string) => void;
  clearHarmonyFocus: () => void;
  cycleHarmonyAlternative: () => void;
  newPhrase: () => void;
  clearHarmonyContext: () => void;
  clearPhrase: () => void;
  refreshHarmonySuggestions: (chord?: ChordResult | null) => void;
  startMidiRecording: () => Promise<void>;
  stopMidiRecording: () => void;
  clearMidiTake: () => void;
  captureLockedPhrase: () => void;
  playMidiTake: (kind?: MidiTakeExportKind) => void;
  stopMidiTakePlayback: () => void;
  saveMidiTake: (kind?: MidiTakeExportKind) => void;
  recordArpMidiEvent: (event: MidiCaptureEvent) => void;
}

const setTriggerState = (
  set: (partial: Partial<AuraState>) => void,
  triggers: Record<string, ActiveTrigger>,
  normalNotes: number[],
  extra: Partial<AuraState> = {},
) => {
  set({
    activeTriggers: triggers,
    activeNormalNotes: normalNotes,
    ...deriveSoundingState(triggers, normalNotes, extra.activeArpNote ?? null),
    ...extra,
  });
};

const scheduleTriggerCleanup = (get: () => AuraState, set: (partial: Partial<AuraState>) => void, triggerId: string) => {
  window.setTimeout(() => {
    const state = get();
    const trigger = state.activeTriggers[triggerId];
    if (!trigger || !trigger.released || trigger.sustained || (trigger.releaseUntil ?? 0) > Date.now()) return;
    const activeTriggers = { ...state.activeTriggers };
    delete activeTriggers[triggerId];
    const activeTriggerKeys = { ...state.activeTriggerKeys };
    Object.entries(activeTriggerKeys).forEach(([key, value]) => {
      if (value === triggerId) delete activeTriggerKeys[key];
    });
    setTriggerState(set, activeTriggers, state.activeNormalNotes, { activeTriggerKeys });
  }, releaseTailMs + 40);
};

const refreshActiveChordTriggers = (get: () => AuraState, set: (partial: Partial<AuraState>) => void) => {
  const state = get();
  const activeTriggers = { ...state.activeTriggers };
  let latestChord: ChordResult | null = state.currentChord;
  Object.values(state.activeTriggers).forEach((trigger) => {
    if (trigger.released) return;
    const chord = buildChord({
      inputRoot: trigger.root,
      chordType: state.chordType,
      modifiers: state.modifiers,
      keyRoot: state.keyRoot,
      scaleMode: state.scaleMode,
      keyModeEnabled: state.keyModeEnabled,
      spread: state.spread,
      motion: state.motion,
    });
    auraAudio.updateChordTrigger(trigger.id, chord.midiNotes, chord.bassMidi, trigger.velocity);
    activeTriggers[trigger.id] = { ...trigger, chord, outputNotes: chord.midiNotes, bassMidi: chord.bassMidi };
    latestChord = chord;
  });
  setTriggerState(set, activeTriggers, state.activeNormalNotes, {
    currentChord: latestChord,
    previousChordNotes: latestChord?.midiNotes ?? state.previousChordNotes,
  });
};

const applyLayerToAudio = (layers: Record<LayerId, LayerState>) => {
  const soloActive = Object.values(layers).some((layer) => layer.solo);
  (Object.keys(layers) as LayerId[]).forEach((layer) => auraAudio.setLayer(layer, layers[layer], soloActive));
};

const eventAtLoop = (state: AuraState) => {
  const seconds = loopSeconds(state.bpm, state.looperBars);
  const elapsed = (nowSeconds() - (window as unknown as { auraLoopStart?: number }).auraLoopStart!) % seconds;
  if (!state.quantize) return elapsed;
  const sixteenth = (60 / state.bpm) / 4;
  return Math.round(elapsed / sixteenth) * sixteenth;
};

const startLoopTimer = (get: () => AuraState) => {
  if (loopTimer !== null) return;
  lastLoopPos = 0;
  (window as unknown as { auraLoopStart?: number }).auraLoopStart = nowSeconds();
  loopTimer = window.setInterval(() => get().tickLoop(), 30);
};

const stopLoopTimer = () => {
  if (loopTimer !== null) window.clearInterval(loopTimer);
  loopTimer = null;
};

const clearIdeaPlaybackTimers = () => {
  ideaPlaybackTimers.forEach((timer) => window.clearTimeout(timer));
  ideaPlaybackTimers = [];
};

const findSuggestionForRoot = (state: AuraState, root: NoteName) =>
  state.smartEnabled
    ? state.harmonySuggestions.find((suggestion) => suggestion.rootMidiClass === noteToPitch(root) && suggestion.confidence >= 0.16)
    : undefined;

const createEmptyPhraseSlots = (): PhraseSlot[] => [
  { step: 1, chord: null },
  { step: 2, chord: null },
  { step: 3, chord: null },
  { step: 4, chord: null },
];

const beatsFromMs = (elapsedMs: number, bpm: number) => Math.max(0, (elapsedMs / 1000) * (bpm / 60));

const recordingBeatNow = (state: Pick<AuraState, "midiRecordingStartedAt" | "midiRecordingBpm">) =>
  beatsFromMs(performance.now() - state.midiRecordingStartedAt, state.midiRecordingBpm);

const takeBarsForEvents = (events: RecordedMidiNote[]) => {
  const endBeat = Math.max(4, ...events.map((event) => event.startBeats + event.durationBeats));
  return Math.max(1, Math.ceil(endBeat / 4));
};

const phraseLabelForTake = (phraseSlots: PhraseSlot[]) =>
  phraseSlots.map((slot) => (slot.chord ? displayChordLabel(slot.chord).replace(/\s+/g, "") : "")).filter(Boolean);

const clearMidiTakePlaybackTimers = () => {
  midiTakePlaybackTimers.forEach((timer) => window.clearTimeout(timer));
  midiTakePlaybackTimers = [];
};

const rateToBeats = (rate: ArpeggiatorState["rate"]) => {
  if (rate === "1/4") return 1;
  if (rate === "1/8") return 0.5;
  if (rate === "1/8T") return 1 / 3;
  if (rate === "1/16") return 0.25;
  if (rate === "1/16T") return 1 / 6;
  return 0.125;
};

const arpNotesForChord = (chord: ChordResult, arp: ArpeggiatorState, startBeats: number, durationBeats: number, velocity = 0.78): RecordedMidiNote[] => {
  if (!arp.enabled) return [];
  const stepBeats = rateToBeats(arp.rate);
  const gate = Math.max(0.08, stepBeats * arp.gate);
  const octaveNotes = Array.from({ length: Math.max(1, arp.octaveRange) }, (_, octave) => chord.midiNotes.map((note) => note + octave * 12)).flat();
  const events: RecordedMidiNote[] = [];
  const steps = Math.max(1, Math.floor(durationBeats / stepBeats));
  for (let step = 0; step < steps; step += 1) {
    const at = startBeats + step * stepBeats;
    if (arp.direction === "Chord Pulse") {
      chord.midiNotes.forEach((midiNote) => events.push({ midiNote, velocity: velocity * 0.66, startBeats: at, durationBeats: gate, channel: 0, source: "arp" }));
      continue;
    }
    if (arp.direction === "Guitar Strum") {
      chord.midiNotes.forEach((midiNote, index) => events.push({ midiNote, velocity: velocity * 0.72, startBeats: at + index * 0.05, durationBeats: Math.min(0.5, gate), channel: 0, source: "arp" }));
      continue;
    }
    if (arp.direction === "Broken Dream") {
      const first = octaveNotes[(step * 2) % octaveNotes.length];
      events.push({ midiNote: first, velocity: velocity * 0.62, startBeats: at, durationBeats: gate, channel: 0, source: "arp" });
      if (step % 3 === 0) {
        const second = octaveNotes[(step * 2 + 3) % octaveNotes.length];
        events.push({ midiNote: second, velocity: velocity * 0.56, startBeats: at + Math.min(0.16, stepBeats * 0.35), durationBeats: gate, channel: 0, source: "arp" });
      }
      continue;
    }
    const max = octaveNotes.length - 1;
    const upDownPosition = step % Math.max(1, max * 2);
    const index =
      arp.direction === "Down"
        ? max - (step % octaveNotes.length)
        : arp.direction === "Up/Down"
          ? upDownPosition > max
            ? max - (upDownPosition - max)
            : upDownPosition
          : arp.direction === "Random"
            ? (step * 5 + 1) % octaveNotes.length
            : step % octaveNotes.length;
    events.push({ midiNote: octaveNotes[index], velocity: velocity * 0.78, startBeats: at, durationBeats: gate, channel: 0, source: "arp" });
  }
  return events;
};

const sameChordIdentity = (a: ChordResult | null | undefined, b: ChordResult | null | undefined) =>
  Boolean(a && b && a.root === b.root && a.type === b.type && a.modifiers.length === b.modifiers.length && a.modifiers.every((modifier) => b.modifiers.includes(modifier)));

const advancePhrase = (state: AuraState, chord: ChordResult) => {
  const currentStep = state.phraseStep;
  if (state.phraseStatus === "LOOP_FOLLOW") {
    const expected = state.phraseSlots[currentStep - 1]?.chord ?? null;
    if (sameChordIdentity(expected, chord)) {
      const completed = currentStep === 4;
      return {
        phraseSlots: state.phraseSlots.map((slot) => ({ ...slot })),
        phraseStep: (completed ? 1 : currentStep + 1) as PhraseStep,
        phraseStatus: "LOOP_FOLLOW" as PhraseStatus,
        phraseAdvanceToken: state.phraseAdvanceToken + 1,
        phraseReturnToken: completed ? state.phraseReturnToken + 1 : state.phraseReturnToken,
      };
    }
    const phraseSlots = createEmptyPhraseSlots();
    phraseSlots[0] = { step: 1, chord };
    return {
      phraseSlots,
      phraseStep: 2 as PhraseStep,
      phraseStatus: "BUILDING_PHRASE" as PhraseStatus,
      phraseAdvanceToken: state.phraseAdvanceToken + 1,
      phraseReturnToken: state.phraseReturnToken,
    };
  }

  if (
    currentStep > 1 &&
    state.smartEnabled &&
    state.keyModeEnabled &&
    (state.harmonyPath === "DREAM" || state.harmonyPath === "SAFE") &&
    !hasCuratedLoopContinuation({
      chord,
      phrase: {
        currentStep,
        chords: state.phraseSlots.map((slot) => slot.chord),
        status: state.phraseStatus,
      },
      keyRoot: state.keyRoot,
      scaleMode: state.scaleMode,
      keyModeEnabled: state.keyModeEnabled,
      pathMode: state.harmonyPath,
      spread: state.spread,
    })
  ) {
    const phraseSlots = createEmptyPhraseSlots();
    phraseSlots[0] = { step: 1, chord };
    return {
      phraseSlots,
      phraseStep: 2 as PhraseStep,
      phraseStatus: "BUILDING_PHRASE" as PhraseStatus,
      phraseAdvanceToken: state.phraseAdvanceToken + 1,
      phraseReturnToken: state.phraseReturnToken,
    };
  }

  const phraseSlots = currentStep === 1 ? createEmptyPhraseSlots() : state.phraseSlots.map((slot) => ({ ...slot }));
  phraseSlots[currentStep - 1] = { step: currentStep, chord };
  const completed = currentStep === 4;
  return {
    phraseSlots,
    phraseStep: (completed ? 1 : currentStep + 1) as PhraseStep,
    phraseStatus: (completed ? "LOOP_FOLLOW" : "BUILDING_PHRASE") as PhraseStatus,
    phraseAdvanceToken: state.phraseAdvanceToken + 1,
    phraseReturnToken: completed ? state.phraseReturnToken + 1 : state.phraseReturnToken,
  };
};

const computeHarmonySuggestions = (state: AuraState, chord: ChordResult | null = state.currentChord) =>
  state.smartEnabled
    ? createHarmonySuggestions({
        currentChord: chord,
        history: state.harmonyHistory,
        keyRoot: state.keyRoot,
        scaleMode: state.scaleMode,
        keyModeEnabled: state.keyModeEnabled,
        pathMode: state.harmonyPath,
        spread: state.spread,
        phrase: {
          currentStep: state.phraseStep,
          chords: state.phraseSlots.map((slot) => slot.chord),
          status: state.phraseStatus,
        },
      })
    : [];

const finalizeOpenRecordingNotes = (state: AuraState, endBeat = recordingBeatNow(state)) => {
  const open = Object.values(state.midiRecordingOpenNotes).flat();
  if (!open.length) return { chordEvents: state.midiRecordingChordEvents, openNotes: {} as Record<string, RecordedMidiNote[]> };
  const closed = open.map((note) => ({
    ...note,
    durationBeats: Math.max(0.05, endBeat - note.startBeats),
  }));
  return {
    chordEvents: [...state.midiRecordingChordEvents, ...closed],
    openNotes: {},
  };
};

const makeMidiTakeFromEvents = (state: AuraState, chordEvents: RecordedMidiNote[], arpEvents: RecordedMidiNote[]): MidiTake => {
  const number = state.midiTakeCounter + 1;
  const allEvents = [...chordEvents, ...arpEvents];
  const bars = takeBarsForEvents(allEvents);
  const phraseChords = phraseLabelForTake(state.phraseSlots);
  return {
    id: uuid(),
    number,
    name: `TAKE ${String(number).padStart(2, "0")}`,
    bpm: state.midiRecordingBpm || state.bpm,
    timeSignature: { numerator: 4, denominator: 4 },
    bars,
    key: `${state.keyRoot} ${state.scaleMode}`,
    phraseChords,
    soundName: state.layers.chord.preset,
    arpName: state.arp.enabled ? `${state.arp.direction} ${state.arp.rate}` : "OFF",
    voicing: voicingStageName(state.spread),
    chordEvents,
    arpEvents,
    createdAt: Date.now(),
  };
};

const buildCurrentVoicedChord = (state: AuraState, chord: ChordResult) =>
  buildChord({
    inputRoot: chord.root,
    chordType: chord.type,
    modifiers: chord.modifiers,
    keyRoot: state.keyRoot,
    scaleMode: state.scaleMode,
    keyModeEnabled: false,
    spread: state.spread,
    motion: state.motion,
  });

export const useAuraStore = create<AuraState>((set, get) => ({
  audioReady: false,
  audioStatus: "sleeping",
  midiSupported: true,
  midiDevices: [],
  midiOutputs: [],
  selectedMidiInputId: "",
  selectedMidiOutputId: "",
  midiMessage: "MIDI: Kein Keyboard verbunden",
  midiPermission: "unknown",
  midiReconnectToken: 0,
  lastMidiEvent: "Noch kein MIDI-Signal",
  lastMidiAt: 0,
  midiDiagnosticsOpen: false,
  toast: "",
  midiMappings: loadMidiMappings(),
  midiLearnTarget: "",
  midiPlayMode: "Chord Trigger",
  sustain: false,
  activeRoots: [],
  activeNormalNotes: [],
  sustainedNormalNotes: [],
  activeTriggers: {},
  activeTriggerKeys: {},
  sustainedReleasedTriggerIds: [],
  currentlySoundingNotes: [],
  soundingNoteInfo: [],
  activeArpNote: null,
  lastNoteOn: "Noch kein Note On",
  lastNoteOff: "Noch kein Note Off",
  lastVelocity: 0,
  fps: 0,
  developerTestMode: true,
  chordSelfTests: [],
  soundAudit: buildSoundAudit(),
  keyRoot: initialPreset.keyRoot,
  scaleMode: initialPreset.scaleMode,
  keyModeEnabled: false,
  chordType: initialPreset.chordType,
  modifiers: initialPreset.modifiers,
  currentChord: null,
  previousChordNotes: [],
  spread: initialPreset.spread,
  motion: initialPreset.motion,
  color: initialPreset.color ?? 0.56,
  displayMode: "IDLE_VIEW",
  displayFlash: null,
  modules: {
    bass: false,
    arp: false,
    beat: false,
    fx: false,
    loop: false,
  },
  moreChordsOpen: false,
  settingsOpen: false,
  bpm: initialPreset.bpm,
  layers: {
    chord: { volume: 0.84, muted: false, solo: false, preset: initialPreset.leadPreset, active: false },
    bass: { volume: 0.7, muted: true, solo: false, preset: initialPreset.bassPreset, active: false },
    drums: { volume: 0.72, muted: true, solo: false, preset: initialPreset.drumPattern, active: false },
  },
  bassMode: initialPreset.bassMode,
  drumPattern: drumPatterns.find((pattern) => pattern.name === initialPreset.drumPattern) ?? drumPatterns[0],
  drumsPlaying: false,
  arp: { ...defaultArp, ...initialPreset.arp },
  performanceMode: initialPreset.performanceMode,
  fx: { ...defaultFx, ...initialPreset.fx },
  fxPanelExpanded: false,
  looperBars: 4,
  countIn: false,
  quantize: true,
  looperRecording: false,
  looperPlaying: false,
  looperOverdub: false,
  loopPosition: 0,
  loopLayers: [],
  currentLoopLayer: null,
  redoLayers: [],
  savedLoops: typeof window === "undefined" ? [] : loadSavedLoops(),
  ideaRecording: false,
  ideaPlaying: false,
  ideaEvents: [],
  ideaRecordingStartedAt: 0,
  ideaPlaybackStartedAt: 0,
  ideaDuration: 0,
  ideaPlaybackPosition: 0,
  userPresets: typeof window === "undefined" ? [] : loadUserPresets(),
  selectedPresetIndex: 0,
  audioCaptureBlob: null,
  stepSequencerOpen: false,
  guidedMode: false,
  smartEnabled: false,
  harmonyPath: "DREAM",
  manualLock: false,
  harmonySuggestions: [],
  focusedSuggestionId: "",
  suggestionAltIndexes: {},
  harmonyHistory: [],
  phraseSlots: createEmptyPhraseSlots(),
  phraseStep: 1,
  phraseStatus: "BUILDING_PHRASE",
  phraseAdvanceToken: 0,
  phraseReturnToken: 0,
  midiRecording: false,
  midiTakePlaying: false,
  midiTake: null,
  midiTakeCounter: 0,
  midiRecordingStartedAt: 0,
  midiRecordingBpm: initialPreset.bpm,
  midiRecordingChordEvents: [],
  midiRecordingArpEvents: [],
  midiRecordingOpenNotes: {},
  midiRecordingLastError: "",

  activateAudio: async () => {
    if (get().audioReady) return;
    await auraAudio.init();
    const state = get();
    auraAudio.setArpNoteListener((midi) => useAuraStore.getState().setArpVisualNote(midi));
    auraAudio.setMidiCaptureListener((event) => useAuraStore.getState().recordArpMidiEvent(event));
    auraAudio.setBpm(state.bpm);
    auraAudio.setLeadPreset(state.layers.chord.preset);
    auraAudio.setBassPreset(state.layers.bass.preset);
    auraAudio.setDrumPattern(state.drumPattern.name);
    auraAudio.setDrumsEnabled(state.drumsPlaying);
    auraAudio.setArpeggiator(state.arp);
    auraAudio.setPerformanceMode(state.performanceMode);
    auraAudio.setBassMode(state.bassMode);
    auraAudio.setFx(state.fx);
    auraAudio.setColor(state.color);
    applyLayerToAudio(state.layers);
    set({ audioReady: true, audioStatus: "ready" });
  },

  setMidiSupported: (supported) =>
    set({
      midiSupported: supported,
      midiMessage: supported
        ? get().midiMessage
        : "MIDI: Browser ohne Web-MIDI. Bildschirm-Keyboard aktiv.",
    }),

  setMidiDevices: (inputs, outputs) => {
    const currentInputId = get().selectedMidiInputId;
    const currentOutputId = get().selectedMidiOutputId;
    const previousInputIds = new Set(get().midiDevices.map((device) => device.id));
    const selected = currentInputId ? inputs.find((input) => input.id === currentInputId) : undefined;
    const output = currentOutputId ? outputs.find((item) => item.id === currentOutputId) : undefined;
    const inputDisconnected =
      Boolean(currentInputId && !selected) ||
      inputs.length < previousInputIds.size ||
      Array.from(previousInputIds).some((id) => !inputs.some((input) => input.id === id));
    const midiMessage = selected ? `MIDI: ${selected.name} verbunden` : "MIDI: Kein Keyboard verbunden";
    const previous = currentInputId;
    if (selected && selected.id !== previous) {
      set({ toast: `Keyboard verbunden: ${selected.name}` });
      window.setTimeout(() => {
        if (get().toast.includes(selected.name)) set({ toast: "" });
      }, 2600);
    }
    set({
      midiDevices: inputs,
      midiOutputs: outputs,
      selectedMidiInputId: selected?.id ?? "",
      selectedMidiOutputId: output?.id ?? "",
      midiMessage: selected ? midiMessage : inputs.length ? "MIDI: Auto Input bereit" : midiMessage,
    });
    if (inputDisconnected) {
      get().allNotesOff();
      set({ lastMidiEvent: "MIDI disconnected: all notes off" });
    }
    if (selected && selected.id !== previous) {
      get().flashDisplay("MIDI CONNECTED", [selected.name.toUpperCase().slice(0, 24)], undefined, "MIDI_NOTIFICATION_VIEW");
    }
  },

  setMidiPermission: (permission) => set({ midiPermission: permission }),

  requestMidiReconnect: () =>
    set({
      midiReconnectToken: get().midiReconnectToken + 1,
      midiPermission: "unknown",
      lastMidiEvent: "Verbinde MIDI neu...",
    }),

  registerMidiEvent: (message) => set({ lastMidiEvent: message, lastMidiAt: Date.now() }),

  toggleMidiDiagnostics: () => set({ midiDiagnosticsOpen: !get().midiDiagnosticsOpen, settingsOpen: true }),

  selectMidiInput: (id) => {
    if (!id) {
      set({
        selectedMidiInputId: "",
        midiMessage: get().midiDevices.length ? "MIDI: Auto Input bereit" : "MIDI: Kein Keyboard verbunden",
      });
      return;
    }
    const selected = get().midiDevices.find((device) => device.id === id);
    set({ selectedMidiInputId: id, midiMessage: selected ? `MIDI: ${selected.name} verbunden` : "MIDI: Kein Keyboard verbunden" });
  },

  selectMidiOutput: (id) => set({ selectedMidiOutputId: id }),

  setToast: (message) => set({ toast: message }),

  setMidiLearnTarget: (target) => set({ midiLearnTarget: target, toast: target ? "MIDI Learn: Bewege jetzt einen Hardware-Regler." : "" }),

  handleMidiCc: (cc, value) => {
    const target = get().midiLearnTarget;
    if (target) {
      const mappings = [...get().midiMappings.filter((mapping) => mapping.parameter !== target), { cc, parameter: target }];
      saveMidiMappings(mappings);
      set({ midiMappings: mappings, midiLearnTarget: "", toast: `CC ${cc} steuert jetzt ${target}.` });
      return;
    }
    const mapping = get().midiMappings.find((item) => item.cc === cc);
    if (!mapping) return;
    const normalized = value / 127;
    if (mapping.parameter === "spread") get().setSpread(normalized);
    if (mapping.parameter === "motion") get().setMotion(normalized);
    if (mapping.parameter.startsWith("fx.")) get().setFxValue(mapping.parameter.replace("fx.", "") as FxName, normalized);
    if (mapping.parameter === "chord.volume") get().setLayerVolume("chord", normalized);
    if (mapping.parameter === "bass.volume") get().setLayerVolume("bass", normalized);
    if (mapping.parameter === "drums.volume") get().setLayerVolume("drums", normalized);
  },

  setMidiPlayMode: (mode) => {
    auraAudio.allNotesOff();
    set({
      midiPlayMode: mode,
      activeRoots: [],
      activeNormalNotes: [],
      sustainedNormalNotes: [],
      activeTriggers: {},
      activeTriggerKeys: {},
      sustainedReleasedTriggerIds: [],
      currentlySoundingNotes: [],
      soundingNoteInfo: [],
      currentChord: null,
    });
    get().flashDisplay(mode === "Normal Piano" ? "NOTE MODE" : mode === "Solo Bass" ? "BASS KEYS" : "CHORD MODE", ["ALL NOTES OFF"]);
  },
  setSustain: (enabled) => {
    const state = get();
    if (enabled) {
      set({ sustain: true });
      return;
    }
    const activeTriggers = { ...state.activeTriggers };
    state.sustainedReleasedTriggerIds.forEach((triggerId) => {
      const trigger = activeTriggers[triggerId];
      if (!trigger) return;
      auraAudio.releaseChordTrigger(triggerId);
      activeTriggers[triggerId] = { ...trigger, sustained: false, releaseUntil: Date.now() + releaseTailMs };
      scheduleTriggerCleanup(get, set, triggerId);
    });
    state.sustainedNormalNotes.forEach((midi) => auraAudio.releaseNormalNoteById(`normal:midi:${midi}`, midi));
    setTriggerState(set, activeTriggers, state.activeNormalNotes.filter((midi) => !state.sustainedNormalNotes.includes(midi)), {
      sustain: false,
      sustainedReleasedTriggerIds: [],
      sustainedNormalNotes: [],
    });
  },
  setPitchBend: (value) => auraAudio.setPitchBend(value),

  playRoot: (root, velocity = 0.82, source = "screen", inputMidi) => {
    const state = get();
    if (!state.audioReady) {
      void get().activateAudio().then(() => get().playRoot(root, velocity, source, inputMidi));
      return;
    }
    const inputKey = inputKeyFor(source, root, inputMidi);
    if (state.midiPlayMode === "Normal Piano") {
      const midi = inputMidi ?? noteToMidi(root, 3);
      const normalTriggerId = `normal:${inputKey}`;
      if (state.activeNormalNotes.includes(midi)) return;
      auraAudio.attackNormalNote(normalTriggerId, midi, velocity);
      setTriggerState(set, state.activeTriggers, Array.from(new Set([...state.activeNormalNotes, midi])), {
        currentChord: null,
        lastNoteOn: `${sourceLabel(source)} ${midiToNoteName(midi)}`,
        lastVelocity: velocity,
      });
      return;
    }
    const existingId = state.activeTriggerKeys[inputKey];
    if (existingId && state.activeTriggers[existingId] && !state.activeTriggers[existingId].released) return;
    const smartSuggestion = !state.manualLock ? findSuggestionForRoot(state, root) : undefined;
    const smartVariant = smartSuggestion
      ? getSuggestionVariant(smartSuggestion, state.suggestionAltIndexes[smartSuggestion.id] ?? 0)
      : null;
    const chordType = smartVariant?.chordType ?? state.chordType;
    const modifiers = smartVariant?.modifiers ?? state.modifiers;
    const useDirectChord = Boolean(smartVariant) || (state.smartEnabled && state.manualLock);
    const chord = buildChord({
      inputRoot: root,
      chordType,
      modifiers,
      keyRoot: state.keyRoot,
      scaleMode: state.scaleMode,
      keyModeEnabled: state.keyModeEnabled && !useDirectChord,
      spread: state.spread,
      motion: state.motion,
      previousNotes: state.previousChordNotes,
    });
    const triggerId = uuid();

    if (state.midiPlayMode === "Solo Bass" || state.bassMode === "Solo Bass Mode") {
      auraAudio.playBassNote(chord.bassMidi, velocity);
    } else {
      auraAudio.attackChord(triggerId, chord.midiNotes, chord.bassMidi, velocity);
    }

    const trigger: ActiveTrigger = {
      id: triggerId,
      inputKey,
      root,
      source,
      inputMidi,
      chord,
      outputNotes: chord.midiNotes,
      bassMidi: chord.bassMidi,
      velocity,
      released: false,
      sustained: false,
      startedAt: Date.now(),
    };
    const midiRecordingOpenNotes = state.midiRecording
      ? {
          ...state.midiRecordingOpenNotes,
          [triggerId]: chord.midiNotes.map<RecordedMidiNote>((midiNote) => ({
            midiNote,
            velocity,
            startBeats: recordingBeatNow(state),
            durationBeats: 0,
            channel: 0,
            source: "chord",
          })),
        }
      : state.midiRecordingOpenNotes;
    const activeTriggers = { ...state.activeTriggers, [triggerId]: trigger };
    const activeTriggerKeys = { ...state.activeTriggerKeys, [inputKey]: triggerId };
    const phrasePatch = advancePhrase(state, chord);
    const startedVariation = state.phraseStatus === "LOOP_FOLLOW" && phrasePatch.phraseStatus === "BUILDING_PHRASE";
    const restartedDuringBuild =
      state.phraseStatus === "BUILDING_PHRASE" &&
      state.phraseStep !== 1 &&
      phrasePatch.phraseStatus === "BUILDING_PHRASE" &&
      phrasePatch.phraseStep === 2 &&
      sameChordIdentity(phrasePatch.phraseSlots[0]?.chord, chord) &&
      !phrasePatch.phraseSlots[1]?.chord;
    const harmonyHistory = startedVariation || restartedDuringBuild ? [chord] : [...state.harmonyHistory, chord].slice(-8);
    const harmonySuggestions = computeHarmonySuggestions(
      { ...state, ...phrasePatch, harmonyHistory, currentChord: chord },
      chord,
    );
    setTriggerState(set, activeTriggers, state.activeNormalNotes, {
      currentChord: chord,
      previousChordNotes: chord.midiNotes,
      activeTriggerKeys,
      midiRecordingOpenNotes,
      chordType,
      modifiers,
      harmonyHistory,
      harmonySuggestions,
      ...phrasePatch,
      focusedSuggestionId: "",
      lastNoteOn: `${sourceLabel(source)} ${root}${inputMidi !== undefined ? ` (${midiToNoteName(inputMidi)})` : ""}`,
      lastVelocity: velocity,
      layers: {
        ...state.layers,
        chord: { ...state.layers.chord, active: true },
        bass: { ...state.layers.bass, active: state.bassMode !== "Off" },
      },
    });
    if (!state.smartEnabled || !state.keyModeEnabled) {
      get().flashDisplay(displayChordLabel(chord), [], undefined, "PLAY_VIEW");
    } else if (phrasePatch.phraseStatus === "LOOP_FOLLOW" && state.phraseStatus !== "LOOP_FOLLOW") {
      get().flashDisplay("LOOP SET", phrasePatch.phraseSlots.map((slot) => (slot.chord ? displayChordLabel(slot.chord) : "-")), undefined, "SMART_VIEW");
    } else if (phrasePatch.phraseStatus === "LOOP_FOLLOW") {
      get().flashDisplay(`LOOP ${state.phraseStep}/4`, [displayChordLabel(chord)], undefined, "SMART_VIEW");
    } else if (state.phraseStatus === "LOOP_FOLLOW" || restartedDuringBuild) {
      get().flashDisplay("NEW PATH", [displayChordLabel(chord)], undefined, "SMART_VIEW");
    } else {
      get().flashDisplay(`BUILD ${state.phraseStep}/4`, [displayChordLabel(chord)], undefined, "SMART_VIEW");
    }

    const recording = get().looperRecording || get().looperOverdub;
    if (recording) {
      const event: LoopEvent = {
        id: uuid(),
        at: eventAtLoop(get()),
        type: "chord-on",
        payload: { root, velocity, chordName: chord.name, midiNotes: chord.midiNotes, bassMidi: chord.bassMidi, inputKey },
      };
      const layer = get().currentLoopLayer ?? { id: uuid(), events: [], createdAt: Date.now() };
      set({ currentLoopLayer: { ...layer, events: [...layer.events, event] } });
    }
    if (get().ideaRecording) {
      const event: IdeaRecordingEvent = {
        id: uuid(),
        at: performance.now() - get().ideaRecordingStartedAt,
        type: "note-on",
        triggerId,
        root,
        outputNotes: chord.midiNotes,
        bassMidi: chord.bassMidi,
        velocity,
        preset: get().layers.chord.preset,
        voicing: voicingStageName(get().spread),
        source,
      };
      set({ ideaEvents: [...get().ideaEvents, event], ideaDuration: Math.max(get().ideaDuration, event.at) });
    }
  },

  releaseRoot: (root, source = "screen", inputMidi) => {
    const state = get();
    const inputKey = inputKeyFor(source, root, inputMidi);
    if (state.midiPlayMode === "Normal Piano") {
      const midi = inputMidi ?? noteToMidi(root, 3);
      const normalTriggerId = `normal:${inputKey}`;
      if (state.sustain) {
        set({ sustainedNormalNotes: Array.from(new Set([...state.sustainedNormalNotes, midi])), lastNoteOff: `${sourceLabel(source)} ${midiToNoteName(midi)} (SUSTAIN)` });
        return;
      }
      auraAudio.releaseNormalNoteById(normalTriggerId, midi);
      setTriggerState(set, state.activeTriggers, state.activeNormalNotes.filter((note) => note !== midi), {
        lastNoteOff: `${sourceLabel(source)} ${midiToNoteName(midi)}`,
      });
      return;
    }
    const triggerId =
      state.activeTriggerKeys[inputKey] ??
      Object.values(state.activeTriggers).find((trigger) => trigger.root === root && trigger.source === source && !trigger.released)?.id;
    if (state.midiPlayMode === "Solo Bass" || state.bassMode === "Solo Bass Mode") {
      if (!state.sustain) auraAudio.releaseBassNote();
      set({ activeRoots: state.activeRoots.filter((item) => item !== root), lastNoteOff: `${sourceLabel(source)} ${root}` });
      return;
    }
    if (!triggerId) return;

    const trigger = state.activeTriggers[triggerId];
    if (!trigger) return;
    const activeTriggers = { ...state.activeTriggers };
    const activeTriggerKeys = { ...state.activeTriggerKeys };
    delete activeTriggerKeys[inputKey];
    const openRecordingNotes = state.midiRecordingOpenNotes[triggerId] ?? [];
    const recordingEndBeat = state.midiRecording ? recordingBeatNow(state) : 0;
    const closedRecordingNotes = openRecordingNotes.map((note) => ({
      ...note,
      durationBeats: Math.max(0.05, recordingEndBeat - note.startBeats),
    }));
    const midiRecordingOpenNotes = { ...state.midiRecordingOpenNotes };
    delete midiRecordingOpenNotes[triggerId];
    const midiRecordingChordEvents = closedRecordingNotes.length
      ? [...state.midiRecordingChordEvents, ...closedRecordingNotes]
      : state.midiRecordingChordEvents;

    if (state.sustain) {
      activeTriggers[triggerId] = { ...trigger, released: true, sustained: true };
      setTriggerState(set, activeTriggers, state.activeNormalNotes, {
        activeTriggerKeys,
        midiRecordingChordEvents,
        midiRecordingOpenNotes,
        sustainedReleasedTriggerIds: Array.from(new Set([...state.sustainedReleasedTriggerIds, triggerId])),
        lastNoteOff: `${sourceLabel(source)} ${root} (SUSTAIN)`,
      });
    } else {
      auraAudio.releaseChordTrigger(triggerId);
      activeTriggers[triggerId] = { ...trigger, released: true, sustained: false, releaseUntil: Date.now() + releaseTailMs };
      scheduleTriggerCleanup(get, set, triggerId);
      setTriggerState(set, activeTriggers, state.activeNormalNotes, {
        activeTriggerKeys,
        midiRecordingChordEvents,
        midiRecordingOpenNotes,
        lastNoteOff: `${sourceLabel(source)} ${root}`,
      });
    }

    const nextRoots = deriveSoundingState(activeTriggers, state.activeNormalNotes).activeRoots;
    set({
      layers: {
        ...state.layers,
        chord: { ...state.layers.chord, active: nextRoots.length > 0 },
        bass: { ...state.layers.bass, active: nextRoots.length > 0 && state.bassMode !== "Off" },
      },
    });
    if (get().looperRecording || get().looperOverdub) {
      const event: LoopEvent = { id: uuid(), at: eventAtLoop(get()), type: "chord-off", payload: { root, inputKey } };
      const layer = get().currentLoopLayer ?? { id: uuid(), events: [], createdAt: Date.now() };
      set({ currentLoopLayer: { ...layer, events: [...layer.events, event] } });
    }
    if (get().ideaRecording) {
      const event: IdeaRecordingEvent = {
        id: uuid(),
        at: performance.now() - get().ideaRecordingStartedAt,
        type: "note-off",
        triggerId,
        root,
        outputNotes: trigger.outputNotes,
        bassMidi: trigger.bassMidi,
        velocity: trigger.velocity,
        preset: get().layers.chord.preset,
        voicing: voicingStageName(get().spread),
        source,
      };
      set({ ideaEvents: [...get().ideaEvents, event], ideaDuration: Math.max(get().ideaDuration, event.at) });
    }
  },

  playMidiNote: (midi, velocity = 0.82) => {
    if (!get().audioReady) {
      void get().activateAudio().then(() => get().playMidiNote(midi, velocity));
      return;
    }
    if (get().midiPlayMode === "Normal Piano") {
      const inputKey = `normal:midi:${midi}`;
      if (get().activeNormalNotes.includes(midi)) return;
      auraAudio.attackNormalNote(inputKey, midi, velocity);
      const normalNotes = Array.from(new Set([...get().activeNormalNotes, midi]));
      setTriggerState(set, get().activeTriggers, normalNotes, {
        currentChord: null,
        lastNoteOn: `MIDI ${midiToNoteName(midi)}`,
        lastVelocity: velocity,
      });
      return;
    }
    set({ lastNoteOn: `MIDI ${midiToNoteName(midi)}`, lastVelocity: velocity });
    get().playRoot(pitchToNote(midi), velocity, "midi", midi);
  },

  releaseMidiNote: (midi) => {
    if (get().midiPlayMode === "Normal Piano") {
      if (get().sustain) {
        set({ sustainedNormalNotes: Array.from(new Set([...get().sustainedNormalNotes, midi])), lastNoteOff: `MIDI ${midiToNoteName(midi)} (SUSTAIN)` });
        return;
      }
      auraAudio.releaseNormalNoteById(`normal:midi:${midi}`, midi);
      setTriggerState(set, get().activeTriggers, get().activeNormalNotes.filter((note) => note !== midi), { lastNoteOff: `MIDI ${midiToNoteName(midi)}` });
      return;
    }
    set({ lastNoteOff: `MIDI ${midiToNoteName(midi)}` });
    get().releaseRoot(pitchToNote(midi), "midi", midi);
  },

  allNotesOff: () => {
    const recordingState = get();
    const finalized = recordingState.midiRecording ? finalizeOpenRecordingNotes(recordingState) : null;
    auraAudio.allNotesOff();
    clearIdeaPlaybackTimers();
    clearMidiTakePlaybackTimers();
    set({
      activeRoots: [],
      activeNormalNotes: [],
      sustainedNormalNotes: [],
      activeTriggers: {},
      activeTriggerKeys: {},
      sustainedReleasedTriggerIds: [],
      currentlySoundingNotes: [],
      soundingNoteInfo: [],
      activeArpNote: null,
      currentChord: null,
      midiTakePlaying: false,
      ...(finalized ? { midiRecordingChordEvents: finalized.chordEvents, midiRecordingOpenNotes: finalized.openNotes } : {}),
      displayFlash: null,
      ideaPlaying: false,
      ideaPlaybackStartedAt: 0,
      ideaPlaybackPosition: 0,
      displayMode: "IDLE_VIEW",
      layers: {
        ...get().layers,
        chord: { ...get().layers.chord, active: false },
        bass: { ...get().layers.bass, active: false },
      },
    });
  },

  stopAllScheduledEvents: () => {
    auraAudio.stopAllScheduledEvents();
    stopLoopTimer();
    clearIdeaPlaybackTimers();
    clearMidiTakePlaybackTimers();
    set({
      activeRoots: [],
      activeNormalNotes: [],
      sustainedNormalNotes: [],
      activeTriggers: {},
      activeTriggerKeys: {},
      sustainedReleasedTriggerIds: [],
      currentlySoundingNotes: [],
      soundingNoteInfo: [],
      activeArpNote: null,
      midiTakePlaying: false,
      currentChord: null,
      displayFlash: null,
      looperPlaying: false,
      looperRecording: false,
      looperOverdub: false,
      ideaPlaying: false,
      ideaPlaybackStartedAt: 0,
      ideaPlaybackPosition: 0,
      layers: {
        ...get().layers,
        chord: { ...get().layers.chord, active: false },
        bass: { ...get().layers.bass, active: false },
      },
    });
  },

  resetAudioEngine: async () => {
    get().stopAllScheduledEvents();
    await auraAudio.resetAudioEngine();
    const layers = {
      ...get().layers,
      chord: { ...get().layers.chord, preset: "TEST POLY", active: false },
      bass: { ...get().layers.bass, active: false },
      drums: { ...get().layers.drums, active: false },
    };
    applyLayerToAudio(layers);
    set({
      layers,
      chordType: "Major",
      modifiers: [],
      spread: 0,
      motion: 0,
      color: 0.56,
      arp: { ...defaultArp, enabled: false },
      modules: { bass: false, arp: false, beat: false, fx: false, loop: false },
      fx: { ...defaultFx, bypass: true, reverb: 0, delay: 0, chorus: 0, drive: 0, wobble: 0, filter: 0.82 },
      smartEnabled: false,
      harmonySuggestions: [],
      focusedSuggestionId: "",
      suggestionAltIndexes: {},
      harmonyHistory: [],
      phraseSlots: createEmptyPhraseSlots(),
      phraseStep: 1,
      phraseStatus: "BUILDING_PHRASE",
      phraseAdvanceToken: get().phraseAdvanceToken + 1,
      phraseReturnToken: get().phraseReturnToken,
      displayMode: "IDLE_VIEW",
    });
    get().flashDisplay("PRESET", ["TEST POLY"], undefined, "PARAMETER_VIEW");
  },

  setArpVisualNote: (midi) => {
    const state = get();
    setTriggerState(set, state.activeTriggers, state.activeNormalNotes, { activeArpNote: midi });
  },

  setFps: (fps) => set({ fps }),

  clearMidiLog: () => set({ lastMidiEvent: "Noch kein MIDI-Signal", lastMidiAt: 0, lastNoteOn: "Noch kein Note On", lastNoteOff: "Noch kein Note Off", lastVelocity: 0 }),
  toggleDeveloperTestMode: () => set({ developerTestMode: !get().developerTestMode, settingsOpen: true }),
  runChordSelfTest: () => {
    const results = chordTestCases.map<ChordSelfTestResult>((test) => {
      const chord = buildChord({
        inputRoot: "C",
        chordType: test.type,
        modifiers: test.modifiers,
        keyRoot: "C",
        scaleMode: "Major",
        keyModeEnabled: false,
        spread: 0,
        motion: 0,
      });
      const actual = chord.midiNotes.map(midiToNoteName).join(" ");
      return { label: test.label, expected: test.expected, actual, passed: actual === test.expected };
    });
    set({ chordSelfTests: results });
  },
  runSoundAudit: () => set({ soundAudit: buildSoundAudit() }),
  playTestChord: (type, modifiers = []) => {
    get().allNotesOff();
    set({ chordType: type, modifiers, keyModeEnabled: false });
    get().playRoot("C", 0.82, "test");
    window.setTimeout(() => get().releaseRoot("C", "test"), 900);
  },

  setChordType: (type) => {
    set({ chordType: type });
    refreshActiveChordTriggers(get, set);
    get().refreshHarmonySuggestions();
    get().flashDisplay("CHORD", [type.toUpperCase()], undefined, "PARAMETER_VIEW");
  },
  toggleModifier: (modifier) => {
    const modifiers = get().modifiers.includes(modifier)
      ? get().modifiers.filter((item) => item !== modifier)
      : [...get().modifiers, modifier];
    const resolved = modifiers.includes("7") && modifiers.includes("Maj7") ? modifiers.filter((item) => item !== "7") : modifiers;
    set({ modifiers: resolved });
    refreshActiveChordTriggers(get, set);
    get().refreshHarmonySuggestions();
    get().flashDisplay("CHORD", [resolved.length ? resolved.join(" ") : "PURE TRIAD"], undefined, "PARAMETER_VIEW");
  },
  setChordExtension: (extension) => {
    const modifiers = extensionToModifiers(extension);
    set({ modifiers });
    refreshActiveChordTriggers(get, set);
    get().refreshHarmonySuggestions();
    get().flashDisplay("EXT", [extension.toUpperCase()], undefined, "PARAMETER_VIEW");
  },
  setKeyRoot: (root) => {
    set({ keyRoot: root });
    refreshActiveChordTriggers(get, set);
    get().refreshHarmonySuggestions();
    get().flashDisplay("KEY", [`${root} ${get().scaleMode}`], undefined, "PARAMETER_VIEW");
  },
  setScaleMode: (mode) => {
    set({ scaleMode: mode });
    refreshActiveChordTriggers(get, set);
    get().refreshHarmonySuggestions();
    get().flashDisplay("KEY", [`${get().keyRoot} ${mode}`], undefined, "PARAMETER_VIEW");
  },
  setKeyModeEnabled: (enabled) => {
    set({ keyModeEnabled: enabled });
    refreshActiveChordTriggers(get, set);
    get().refreshHarmonySuggestions();
    get().flashDisplay(enabled ? "KEY LOCK" : "FREE ROOTS", [enabled ? `${get().keyRoot} ${get().scaleMode}` : "CHROMATIC"], undefined, "PARAMETER_VIEW");
  },
  setSpread: (value) => {
    const next = Math.max(0, Math.min(1, value));
    set({ spread: next });
    refreshActiveChordTriggers(get, set);
    get().refreshHarmonySuggestions();
    const stage = voicingStageName(next);
    get().flashDisplay("VOICING", [stage, `${Math.round(next * 6) + 1}/7`], undefined, "PARAMETER_VIEW");
  },
  setMotion: (value) => {
    const next = Math.max(0, Math.min(1, value));
    set({ motion: next });
    refreshActiveChordTriggers(get, set);
    get().flashDisplay("MOTION", [voicingStageName(get().spread)], undefined, "PARAMETER_VIEW");
  },
  setColor: (value) => {
    const next = Math.max(0, Math.min(1, value));
    auraAudio.setColor(next);
    set({ color: next });
    get().flashDisplay("COLOUR", [`${Math.round(next * 100)}`], [next], "PARAMETER_VIEW");
  },
  flashDisplay: (title, lines = [], bars, mode = "PARAMETER_VIEW") => set({ displayFlash: { title, lines, bars, mode, expiresAt: Date.now() + 850 }, displayMode: mode }),
  clearExpiredDisplay: () => {
    const flash = get().displayFlash;
    if (flash && flash.expiresAt <= Date.now()) {
      set({
        displayFlash: null,
        displayMode: get().ideaRecording || get().ideaPlaying ? "RECORD_VIEW" : get().currentlySoundingNotes.length ? "PLAY_VIEW" : "IDLE_VIEW",
      });
    }
  },
  toggleModule: (module) => get().setModule(module, !get().modules[module]),
  setModule: (module, enabled) => {
    const state = get();
    const modules = { ...state.modules, [module]: enabled };
    if (module === "bass") {
      const layers = { ...state.layers, bass: { ...state.layers.bass, muted: !enabled, active: false } };
      auraAudio.setBassMode(enabled ? "Root Note" : "Off");
      applyLayerToAudio(layers);
      set({ modules, layers, bassMode: enabled ? "Root Note" : "Off" });
      get().flashDisplay(enabled ? "BASS ON" : "BASS OFF", [enabled ? `ROOT / ${state.layers.bass.preset}` : ""], undefined, "PARAMETER_VIEW");
      return;
    }
    if (module === "arp") {
      const direction: ArpeggiatorState["direction"] = state.arp.direction === "Down" || state.arp.direction === "Up/Down" ? state.arp.direction : "Up";
      const rate: ArpeggiatorState["rate"] = state.arp.rate === "1/4" || state.arp.rate === "1/8" || state.arp.rate === "1/16" ? state.arp.rate : "1/8";
      const arp: ArpeggiatorState = { ...state.arp, enabled, direction, rate };
      auraAudio.setArpeggiator(arp);
      set({ modules, arp, activeArpNote: null });
      get().flashDisplay(enabled ? "ARP ON" : "ARP OFF", [enabled ? `${arp.direction.toUpperCase()}  ${arp.rate}` : ""], undefined, "ARP_VIEW");
      return;
    }
    if (module === "beat") {
      const layers = { ...state.layers, drums: { ...state.layers.drums, muted: !enabled, active: false } };
      auraAudio.setDrumsEnabled(enabled);
      applyLayerToAudio(layers);
      set({ modules, layers, drumsPlaying: enabled });
      get().flashDisplay(enabled ? "BEAT ON" : "BEAT OFF", [enabled ? state.drumPattern.name.toUpperCase() : ""], undefined, "PARAMETER_VIEW");
      return;
    }
    if (module === "fx") {
      const fx = enabled
        ? { ...state.fx, bypass: false, reverb: Math.max(state.fx.reverb, 0.24), delay: Math.max(state.fx.delay, 0.12), chorus: Math.max(state.fx.chorus, 0.08) }
        : { ...state.fx, bypass: true };
      auraAudio.setFx(fx);
      set({ modules, fx });
      get().flashDisplay(enabled ? "FX ON" : "FX OFF", [enabled ? "SPACE / ECHO" : "DRY"], undefined, "PARAMETER_VIEW");
      return;
    }
    set({ modules });
    get().flashDisplay(enabled ? "LOOP READY" : "LOOP HIDDEN", [enabled ? `${state.looperBars} BARS` : ""], undefined, "PARAMETER_VIEW");
  },
  toggleMoreChords: () => set({ moreChordsOpen: !get().moreChordsOpen }),
  toggleSettings: () => set({ settingsOpen: !get().settingsOpen }),
  setBpm: (bpm) => {
    const next = Math.round(Math.max(50, Math.min(180, bpm)));
    auraAudio.setBpm(next);
    set({ bpm: next });
    get().flashDisplay("TEMPO", [`${next} BPM`], undefined, "PARAMETER_VIEW");
  },

  setLayerVolume: (layer, value) => {
    const next = Math.max(0, Math.min(1, value));
    const layers = { ...get().layers, [layer]: { ...get().layers[layer], volume: next } };
    applyLayerToAudio(layers);
    set({ layers });
    get().flashDisplay(`${layer.toUpperCase()} VOL`, [`${Math.round(next * 100)}`], undefined, "PARAMETER_VIEW");
  },
  toggleLayerMute: (layer) => {
    const layers = { ...get().layers, [layer]: { ...get().layers[layer], muted: !get().layers[layer].muted } };
    applyLayerToAudio(layers);
    set({ layers });
  },
  toggleLayerSolo: (layer) => {
    const layers = { ...get().layers, [layer]: { ...get().layers[layer], solo: !get().layers[layer].solo } };
    applyLayerToAudio(layers);
    set({ layers });
  },
  setLayerPreset: (layer, presetName) => {
    if (layer === "chord") get().allNotesOff();
    const layers = { ...get().layers, [layer]: { ...get().layers[layer], preset: presetName } };
    if (layer === "chord") auraAudio.setLeadPreset(presetName);
    if (layer === "bass") auraAudio.setBassPreset(presetName);
    if (layer === "drums") {
      const pattern = drumPatterns.find((item) => item.name === presetName) ?? get().drumPattern;
      auraAudio.setDrumPattern(pattern.name);
      set({ drumPattern: pattern });
    }
    set({ layers });
    get().flashDisplay(layer === "chord" ? "PRESET" : layer.toUpperCase(), [presetName.toUpperCase()], undefined, "PARAMETER_VIEW");
  },

  setBassMode: (mode) => {
    auraAudio.setBassMode(mode);
    set({ bassMode: mode });
    get().flashDisplay("BASS", [mode.toUpperCase()], undefined, "PARAMETER_VIEW");
  },
  setDrumPattern: (name) => {
    const pattern = drumPatterns.find((item) => item.name === name) ?? get().drumPattern;
    auraAudio.setDrumPattern(pattern.name);
    set({
      drumPattern: pattern,
      layers: { ...get().layers, drums: { ...get().layers.drums, preset: pattern.name } },
    });
    get().flashDisplay("BEAT", [pattern.name.toUpperCase()], undefined, "PARAMETER_VIEW");
  },
  toggleDrums: () => {
    const enabled = !get().drumsPlaying;
    auraAudio.setDrumsEnabled(enabled);
    const layers = { ...get().layers, drums: { ...get().layers.drums, muted: !enabled } };
    applyLayerToAudio(layers);
    set({ drumsPlaying: enabled, modules: { ...get().modules, beat: enabled }, layers });
    get().flashDisplay(enabled ? "BEAT ON" : "BEAT OFF", [get().drumPattern.name.toUpperCase()], undefined, "PARAMETER_VIEW");
  },
  drumFill: () => auraAudio.triggerFill(),
  drumVariation: () => auraAudio.triggerVariation(),
  updateDrumStep: (voice, step) => {
    const current = get().drumPattern;
    const nextSteps = { ...current.steps, [voice]: current.steps[voice].map((hit, index) => (index === step ? !hit : hit)) };
    const next = { ...current, steps: nextSteps };
    set({ drumPattern: next });
  },

  setArp: (patch) => {
    const nextPatch = { ...patch };
    const arp = { ...get().arp, ...nextPatch };
    auraAudio.setArpeggiator(arp);
    set({
      arp,
      activeArpNote: arp.enabled ? get().activeArpNote : null,
      modules: { ...get().modules, arp: arp.enabled },
    });
    get().flashDisplay(arp.enabled ? "ARP" : "ARP OFF", [`${arp.direction.toUpperCase()}  ${arp.rate}`], undefined, "ARP_VIEW");
  },
  setPerformanceMode: (mode) => {
    auraAudio.setPerformanceMode(mode);
    set({ performanceMode: mode });
    get().flashDisplay("PERFORM", [mode], undefined, "PARAMETER_VIEW");
  },
  setFxValue: (name, value) => {
    const fx = { ...get().fx, bypass: false, [name]: value } as FxState;
    auraAudio.setFx(fx);
    set({ fx, modules: { ...get().modules, fx: true } });
    get().flashDisplay("FX", [`${name.toUpperCase()} ${typeof value === "number" ? Math.round(value * 99) : value ? "ON" : "OFF"}`], undefined, "PARAMETER_VIEW");
  },
  toggleFxBypass: () => {
    const fx = { ...get().fx, bypass: !get().fx.bypass };
    auraAudio.setFx(fx);
    set({ fx, modules: { ...get().modules, fx: !fx.bypass } });
    get().flashDisplay(fx.bypass ? "FX OFF" : "FX ON", [fx.bypass ? "DRY" : "SPACE / ECHO"], undefined, "PARAMETER_VIEW");
  },

  applyPreset: (preset) => {
    get().allNotesOff();
    const arp = { ...defaultArp, ...preset.arp };
    const fx = { ...defaultFx, ...preset.fx };
    const pattern = drumPatterns.find((item) => item.name === preset.drumPattern) ?? drumPatterns[0];
    const layers = {
      chord: { ...get().layers.chord, preset: preset.leadPreset },
      bass: { ...get().layers.bass, preset: preset.bassPreset },
      drums: { ...get().layers.drums, preset: preset.drumPattern },
    };
    auraAudio.setBpm(preset.bpm);
    auraAudio.setLeadPreset(preset.leadPreset);
    auraAudio.setBassPreset(preset.bassPreset);
    auraAudio.setBassMode(preset.bassMode);
    auraAudio.setDrumPattern(pattern.name);
    auraAudio.setArpeggiator(arp);
    auraAudio.setPerformanceMode(preset.performanceMode);
    auraAudio.setFx(fx);
    auraAudio.setColor(preset.color ?? get().color);
    applyLayerToAudio(layers);
    set({
      keyRoot: preset.keyRoot,
      scaleMode: preset.scaleMode,
      bpm: preset.bpm,
      chordType: preset.chordType,
      modifiers: preset.modifiers,
      spread: preset.spread,
      motion: preset.motion,
      color: preset.color ?? get().color,
      layers,
      bassMode: preset.bassMode,
      drumPattern: pattern,
      arp,
      performanceMode: preset.performanceMode,
      fx,
      modules: {
        bass: preset.bassMode !== "Off",
        arp: Boolean(arp.enabled),
        beat: false,
        fx: !fx.bypass,
        loop: get().modules.loop,
      },
      toast: `Preset geladen: ${preset.name}`,
    });
  },

  randomizeIdea: () => {
    const roots = NOTE_NAMES;
    const modes: ScaleMode[] = ["Major", "Natural Minor", "Dorian", "Mixolydian", "Lydian", "Dream / Cinematic Mode"];
    const types: ChordType[] = ["Major", "Minor", "Sus2", "Sus4"];
    const mode = modes[Math.floor(Math.random() * modes.length)];
    const root = roots[Math.floor(Math.random() * roots.length)];
    const dreamy = mode.includes("Dream") || Math.random() > 0.58;
    const preset: CompletePreset = {
      id: uuid(),
      name: "Random Idea",
      keyRoot: root,
      scaleMode: mode,
      bpm: 72 + Math.round(Math.random() * 58),
      chordType: types[Math.floor(Math.random() * types.length)],
      modifiers: dreamy ? ["Add9", "Dream"] : Math.random() > 0.5 ? ["7", "9"] : ["6", "Add9"],
      leadPreset: randomLead(),
      bassPreset: randomBass(),
      bassMode: Math.random() > 0.55 ? "Walking Bass" : "Octave Pulse",
      drumPattern: randomDrum(),
      arp: { enabled: Math.random() > 0.35, rate: Math.random() > 0.5 ? "1/8" : "1/16", direction: dreamy ? "Broken Dream" : "Up/Down" },
      performanceMode: dreamy ? "DREAM" : "PULSE",
      spread: 0.42 + Math.random() * 0.48,
      motion: 0.24 + Math.random() * 0.58,
      color: 0.34 + Math.random() * 0.48,
      fx: { reverb: 0.35 + Math.random() * 0.4, delay: 0.14 + Math.random() * 0.22, chorus: 0.18 + Math.random() * 0.34 },
    };
    get().applyPreset(preset);
  },

  saveUserPreset: (name) => {
    const state = get();
    const preset: CompletePreset = {
      id: uuid(),
      name: name?.trim() || `Waveforge Idea ${state.userPresets.length + 1}`,
      keyRoot: state.keyRoot,
      scaleMode: state.scaleMode,
      bpm: state.bpm,
      chordType: state.chordType,
      modifiers: state.modifiers,
      leadPreset: state.layers.chord.preset,
      bassPreset: state.layers.bass.preset,
      bassMode: state.bassMode,
      drumPattern: state.drumPattern.name,
      arp: state.arp,
      performanceMode: state.performanceMode,
      spread: state.spread,
      motion: state.motion,
      color: state.color,
      fx: state.fx,
    };
    const userPresets = [preset, ...state.userPresets];
    saveUserPresets(userPresets);
    set({ userPresets, toast: `Gespeichert: ${preset.name}` });
  },
  deleteUserPreset: (id) => {
    const userPresets = get().userPresets.filter((preset) => preset.id !== id);
    saveUserPresets(userPresets);
    set({ userPresets });
  },
  nextPreset: () => {
    const index = (get().selectedPresetIndex + 1) % factoryPresets.length;
    set({ selectedPresetIndex: index });
    get().applyPreset(factoryPresets[index]);
  },
  previousPreset: () => {
    const index = (get().selectedPresetIndex - 1 + factoryPresets.length) % factoryPresets.length;
    set({ selectedPresetIndex: index });
    get().applyPreset(factoryPresets[index]);
  },

  setLooperBars: (bars) => set({ looperBars: bars }),
  toggleCountIn: () => set({ countIn: !get().countIn }),
  toggleQuantize: () => set({ quantize: !get().quantize }),
  toggleRecord: () => {
    const state = get();
    if (state.looperRecording) {
      const current = state.currentLoopLayer;
      set({
        looperRecording: false,
        looperPlaying: true,
        loopLayers: current && current.events.length ? [...state.loopLayers, current] : state.loopLayers,
        currentLoopLayer: null,
      });
      return;
    }
    if (state.countIn) {
      set({ toast: "Count-in: 1 bar" });
      window.setTimeout(() => {
        if (get().looperRecording) return;
        startLoopTimer(get);
        set({ looperRecording: true, looperPlaying: true, currentLoopLayer: { id: uuid(), events: [], createdAt: Date.now() }, redoLayers: [], toast: "" });
      }, (60 / state.bpm) * 4 * 1000);
      return;
    }
    startLoopTimer(get);
    set({ looperRecording: true, looperPlaying: true, currentLoopLayer: { id: uuid(), events: [], createdAt: Date.now() }, redoLayers: [] });
  },
  togglePlayback: () => {
    if (get().looperPlaying) {
      stopLoopTimer();
      set({ looperPlaying: false, loopPosition: 0 });
    } else {
      startLoopTimer(get);
      set({ looperPlaying: true });
    }
  },
  toggleOverdub: () => {
    const active = !get().looperOverdub;
    if (active) startLoopTimer(get);
    const current = get().currentLoopLayer;
    if (!active && current && current.events.length) {
      set({ loopLayers: [...get().loopLayers, current], currentLoopLayer: null, looperOverdub: false });
    } else {
      set({ looperOverdub: active, looperPlaying: true, currentLoopLayer: active ? { id: uuid(), events: [], createdAt: Date.now() } : null });
    }
  },
  stopLooper: () => {
    stopLoopTimer();
    get().allNotesOff();
    set({ looperPlaying: false, looperRecording: false, looperOverdub: false, loopPosition: 0, currentLoopLayer: null });
  },
  undoLoop: () => {
    const layers = get().loopLayers;
    if (!layers.length) return;
    set({ loopLayers: layers.slice(0, -1), redoLayers: [layers[layers.length - 1], ...get().redoLayers] });
  },
  redoLoop: () => {
    const redo = get().redoLayers;
    if (!redo.length) return;
    set({ loopLayers: [...get().loopLayers, redo[0]], redoLayers: redo.slice(1) });
  },
  clearLoop: () => {
    auraAudio.hardCut();
    set({ loopLayers: [], redoLayers: [], currentLoopLayer: null, looperRecording: false, looperOverdub: false, loopPosition: 0 });
    get().allNotesOff();
  },
  saveLoop: () => {
    const state = get();
    const loop: SavedLoop = {
      id: uuid(),
      name: `Loop ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      bars: state.looperBars,
      bpm: state.bpm,
      layers: state.loopLayers,
      createdAt: Date.now(),
    };
    const savedLoops = [loop, ...state.savedLoops];
    saveSavedLoops(savedLoops);
    set({ savedLoops, toast: `Loop gespeichert: ${loop.name}` });
  },
  loadLoop: (id) => {
    const loop = get().savedLoops.find((item) => item.id === id);
    if (!loop) return;
    get().setBpm(loop.bpm);
    set({ loopLayers: loop.layers, looperBars: loop.bars as 1 | 2 | 4 | 8 | 16, toast: `Loop geladen: ${loop.name}` });
  },
  startIdeaRecording: () => {
    get().allNotesOff();
    clearIdeaPlaybackTimers();
    const startedAt = performance.now();
    set({
      ideaRecording: true,
      ideaPlaying: false,
      ideaEvents: [],
      ideaRecordingStartedAt: startedAt,
      ideaPlaybackStartedAt: 0,
      ideaDuration: 0,
      ideaPlaybackPosition: 0,
      displayMode: "RECORD_VIEW",
    });
    get().flashDisplay("REC", ["00:00"], undefined, "RECORD_VIEW");
  },
  stopIdeaRecording: () => {
    const state = get();
    const duration = state.ideaRecording ? performance.now() - state.ideaRecordingStartedAt : state.ideaDuration;
    get().allNotesOff();
    set({
      ideaRecording: false,
      ideaDuration: Math.max(duration, state.ideaDuration),
      displayMode: "IDLE_VIEW",
      displayFlash: null,
    });
  },
  playIdeaRecording: () => {
    const state = get();
    if (!state.ideaEvents.length) {
      get().flashDisplay("PLAY", ["EMPTY"], undefined, "RECORD_VIEW");
      return;
    }
    get().allNotesOff();
    clearIdeaPlaybackTimers();
    const startedAt = performance.now();
    const playbackIds = new Map<string, string>();
    set({ ideaPlaying: true, ideaPlaybackStartedAt: startedAt, ideaPlaybackPosition: 0, displayMode: "RECORD_VIEW" });
    state.ideaEvents.forEach((event) => {
      const timer = window.setTimeout(() => {
        const current = get();
        if (!current.ideaPlaying) return;
        set({ ideaPlaybackPosition: performance.now() - startedAt });
        if (event.type === "note-on") {
          const triggerId = `idea:${event.triggerId}:${event.id}`;
          playbackIds.set(event.triggerId, triggerId);
          auraAudio.setLeadPreset(event.preset);
          auraAudio.attackChord(triggerId, event.outputNotes, event.bassMidi, event.velocity);
          const chord: ChordResult = {
            root: event.root,
            displayRoot: event.root,
            type: current.chordType,
            modifiers: current.modifiers,
            name: `${event.root} REC`,
            noteNames: event.outputNotes.map((note) => midiToNoteName(note).replace(/\d+$/, "")),
            midiNotes: event.outputNotes,
            bassMidi: event.bassMidi,
          };
          const trigger: ActiveTrigger = {
            id: triggerId,
            inputKey: `idea:${event.triggerId}`,
            root: event.root,
            source: "loop",
            chord,
            outputNotes: event.outputNotes,
            bassMidi: event.bassMidi,
            velocity: event.velocity,
            released: false,
            sustained: false,
            startedAt: Date.now(),
          };
          setTriggerState(set, { ...current.activeTriggers, [triggerId]: trigger }, current.activeNormalNotes, {
            currentChord: chord,
            previousChordNotes: event.outputNotes,
            activeTriggerKeys: { ...current.activeTriggerKeys, [`idea:${event.triggerId}`]: triggerId },
          });
        } else {
          const triggerId = playbackIds.get(event.triggerId);
          if (!triggerId) return;
          auraAudio.releaseChordTrigger(triggerId);
          const activeTriggers = { ...get().activeTriggers };
          if (activeTriggers[triggerId]) {
            activeTriggers[triggerId] = { ...activeTriggers[triggerId], released: true, sustained: false, releaseUntil: Date.now() + releaseTailMs };
          }
          const activeTriggerKeys = { ...get().activeTriggerKeys };
          delete activeTriggerKeys[`idea:${event.triggerId}`];
          scheduleTriggerCleanup(get, set, triggerId);
          setTriggerState(set, activeTriggers, get().activeNormalNotes, { activeTriggerKeys });
        }
      }, event.at);
      ideaPlaybackTimers.push(timer);
    });
    const finish = window.setTimeout(() => {
      get().allNotesOff();
      set({ ideaPlaying: false, ideaPlaybackStartedAt: 0, ideaPlaybackPosition: state.ideaDuration, displayMode: "IDLE_VIEW" });
    }, state.ideaDuration + 900);
    ideaPlaybackTimers.push(finish);
    get().flashDisplay("PLAY", [`00 / ${Math.ceil(state.ideaDuration / 1000).toString().padStart(2, "0")}`], undefined, "RECORD_VIEW");
  },
  stopIdeaPlayback: () => {
    clearIdeaPlaybackTimers();
    get().allNotesOff();
    set({ ideaPlaying: false, ideaPlaybackStartedAt: 0, ideaPlaybackPosition: 0, displayMode: "IDLE_VIEW" });
  },
  clearIdeaRecording: () => {
    clearIdeaPlaybackTimers();
    get().allNotesOff();
    set({
      ideaRecording: false,
      ideaPlaying: false,
      ideaEvents: [],
      ideaRecordingStartedAt: 0,
      ideaPlaybackStartedAt: 0,
      ideaDuration: 0,
      ideaPlaybackPosition: 0,
      displayMode: "IDLE_VIEW",
      displayFlash: null,
    });
  },
  hardCut: () => {
    auraAudio.hardCut();
    stopLoopTimer();
    clearIdeaPlaybackTimers();
    set({
      activeRoots: [],
      activeNormalNotes: [],
      sustainedNormalNotes: [],
      activeTriggers: {},
      activeTriggerKeys: {},
      sustainedReleasedTriggerIds: [],
      currentlySoundingNotes: [],
      soundingNoteInfo: [],
      currentChord: null,
      displayFlash: null,
      looperPlaying: false,
      looperRecording: false,
      looperOverdub: false,
      loopPosition: 0,
      ideaRecording: false,
      ideaPlaying: false,
      ideaPlaybackStartedAt: 0,
      ideaPlaybackPosition: 0,
      activeArpNote: null,
    });
  },
  tickLoop: () => {
    const state = get();
    if (!state.looperPlaying && !state.looperRecording && !state.looperOverdub) return;
    const length = loopSeconds(state.bpm, state.looperBars);
    const pos = ((nowSeconds() - ((window as unknown as { auraLoopStart?: number }).auraLoopStart ?? nowSeconds())) % length + length) % length;
    const wrapped = pos < lastLoopPos;
    const events = state.loopLayers.flatMap((layer) => layer.events);
    events.forEach((event) => {
      const inWindow = wrapped ? event.at >= lastLoopPos || event.at <= pos : event.at >= lastLoopPos && event.at <= pos;
      if (!inWindow) return;
      if (event.type === "chord-on") {
        const notes = event.payload.midiNotes as number[];
        const bassMidi = Number(event.payload.bassMidi);
        const root = (event.payload.root as NoteName | undefined) ?? "C";
        const inputKey = `loop:${root}`;
        const loopState = get();
        const previousLoopTrigger = loopState.activeTriggerKeys[inputKey];
        if (previousLoopTrigger) auraAudio.releaseChordTrigger(previousLoopTrigger);
        const triggerId = `loop:${event.id}:${Date.now()}`;
        const velocity = Number(event.payload.velocity ?? 0.75);
        auraAudio.attackChord(triggerId, notes, bassMidi, velocity);
        const chord: ChordResult = {
          root,
          displayRoot: root,
          type: get().chordType,
          modifiers: get().modifiers,
          name: String(event.payload.chordName ?? "Loop Chord"),
          noteNames: notes.map((note) => midiToNoteName(note).replace(/\d+$/, "")),
          midiNotes: notes,
          bassMidi,
        };
        const activeTriggers = { ...loopState.activeTriggers };
        if (previousLoopTrigger) delete activeTriggers[previousLoopTrigger];
        activeTriggers[triggerId] = {
          id: triggerId,
          inputKey,
          root,
          source: "loop",
          chord,
          outputNotes: notes,
          bassMidi,
          velocity,
          released: false,
          sustained: false,
          startedAt: Date.now(),
        };
        setTriggerState(set, activeTriggers, loopState.activeNormalNotes, {
          activeTriggerKeys: { ...loopState.activeTriggerKeys, [inputKey]: triggerId },
          currentChord: chord,
          previousChordNotes: notes,
        });
      }
      if (event.type === "chord-off") {
        const root = (event.payload.root as NoteName | undefined) ?? "C";
        const inputKey = `loop:${root}`;
        const loopState = get();
        const triggerId = loopState.activeTriggerKeys[inputKey];
        if (!triggerId || !loopState.activeTriggers[triggerId]) return;
        auraAudio.releaseChordTrigger(triggerId);
        const activeTriggers = {
          ...loopState.activeTriggers,
          [triggerId]: { ...loopState.activeTriggers[triggerId], released: true, sustained: false, releaseUntil: Date.now() + releaseTailMs },
        };
        const activeTriggerKeys = { ...loopState.activeTriggerKeys };
        delete activeTriggerKeys[inputKey];
        scheduleTriggerCleanup(get, set, triggerId);
        setTriggerState(set, activeTriggers, loopState.activeNormalNotes, { activeTriggerKeys });
      }
    });
    lastLoopPos = pos;
    set({ loopPosition: pos / length });
  },

  startAudioCapture: async () => {
    await auraAudio.startRecording();
    set({ audioStatus: "recording", audioCaptureBlob: null });
  },
  stopAudioCapture: async () => {
    const blob = await auraAudio.stopRecording();
    if (blob) {
      downloadBlob(blob, "waveforge-mix.webm");
      set({ audioCaptureBlob: blob });
    }
    set({ audioStatus: "ready" });
  },
  exportIdea: () => {
    const state = get();
    const midi = buildMidiFile({ bpm: state.bpm, bars: state.looperBars, layers: state.loopLayers, drumPattern: state.drumsPlaying ? state.drumPattern : undefined });
    downloadBlob(midi, "waveforge-idea.mid");
    if (state.audioCaptureBlob) downloadBlob(state.audioCaptureBlob, "waveforge-mix.webm");
    set({ toast: "Idea exportiert: MIDI und vorhandene Audioaufnahme." });
  },
  startMidiRecording: async () => {
    if (!get().audioReady) await get().activateAudio();
    const state = get();
    if (state.midiRecording) return;
    clearMidiTakePlaybackTimers();
    set({
      midiRecording: true,
      midiTakePlaying: false,
      midiRecordingStartedAt: performance.now(),
      midiRecordingBpm: state.bpm,
      midiRecordingChordEvents: [],
      midiRecordingArpEvents: [],
      midiRecordingOpenNotes: {},
      midiRecordingLastError: "",
      audioStatus: "recording",
      displayMode: "RECORD_VIEW",
    });
    get().flashDisplay("REC", [`${state.bpm} BPM  4/4`], undefined, "RECORD_VIEW");
  },
  stopMidiRecording: () => {
    const state = get();
    if (!state.midiRecording) {
      get().stopMidiTakePlayback();
      return;
    }
    const finalized = finalizeOpenRecordingNotes(state);
    const chordEvents = finalized.chordEvents;
    const arpEvents = state.midiRecordingArpEvents;
    const take = makeMidiTakeFromEvents(state, chordEvents, arpEvents);
    set({
      midiRecording: false,
      midiTake: take,
      midiTakeCounter: take.number,
      midiRecordingChordEvents: chordEvents,
      midiRecordingArpEvents: arpEvents,
      midiRecordingOpenNotes: {},
      audioStatus: "ready",
    });
    get().flashDisplay(`TAKE ${String(take.number).padStart(2, "0")} SAVED`, [`${take.bars} BAR MIDI`], undefined, "RECORD_VIEW");
  },
  clearMidiTake: () => {
    get().stopMidiTakePlayback();
    set({
      midiTake: null,
      midiRecordingChordEvents: [],
      midiRecordingArpEvents: [],
      midiRecordingOpenNotes: {},
      midiRecordingLastError: "",
    });
    get().flashDisplay("TAKE CLEAR", ["MIDI EMPTY"], undefined, "RECORD_VIEW");
  },
  captureLockedPhrase: () => {
    const state = get();
    if (state.phraseStatus !== "LOOP_FOLLOW" || state.phraseSlots.some((slot) => !slot.chord)) {
      get().flashDisplay("CAPTURE", ["LOCK LOOP FIRST"], undefined, "RECORD_VIEW");
      return;
    }
    const chords = state.phraseSlots.map((slot) => buildCurrentVoicedChord(state, slot.chord!));
    const chordEvents = chords.flatMap((chord, index) =>
      chord.midiNotes.map<RecordedMidiNote>((midiNote) => ({
        midiNote,
        velocity: 0.82,
        startBeats: index * 4,
        durationBeats: 4,
        channel: 0,
        source: "chord",
      })),
    );
    const arpEvents = state.arp.enabled
      ? chords.flatMap((chord, index) => arpNotesForChord(chord, state.arp, index * 4, 4, 0.82))
      : [];
    const take = makeMidiTakeFromEvents({ ...state, midiRecordingBpm: state.bpm }, chordEvents, arpEvents);
    set({
      midiTake: take,
      midiTakeCounter: take.number,
      midiRecording: false,
      midiTakePlaying: false,
      midiRecordingChordEvents: chordEvents,
      midiRecordingArpEvents: arpEvents,
      midiRecordingOpenNotes: {},
      midiRecordingLastError: "",
    });
    get().flashDisplay("TAKE READY", [`TAKE ${String(take.number).padStart(2, "0")} · LOOP PRINT`], undefined, "RECORD_VIEW");
  },
  playMidiTake: (kind = "CHORDS") => {
    const state = get();
    const take = state.midiTake;
    if (!take || state.midiRecording) return;
    if (!state.audioReady) {
      void get().activateAudio().then(() => get().playMidiTake(kind));
      return;
    }
    get().stopMidiTakePlayback();
    const events = kind === "ARP" && take.arpEvents.length ? take.arpEvents : take.chordEvents;
    if (!events.length) return;
    const secondsPerBeat = 60 / take.bpm;
    set({ midiTakePlaying: true });
    events.forEach((event, index) => {
      const triggerId = `take:${take.id}:${kind}:${index}`;
      const startMs = Math.max(0, event.startBeats * secondsPerBeat * 1000);
      const durationMs = Math.max(20, event.durationBeats * secondsPerBeat * 1000);
      midiTakePlaybackTimers.push(window.setTimeout(() => auraAudio.attackNormalNote(triggerId, event.midiNote, event.velocity), startMs));
      midiTakePlaybackTimers.push(window.setTimeout(() => auraAudio.releaseNormalNoteById(triggerId, event.midiNote), startMs + durationMs));
    });
    const endBeat = Math.max(...events.map((event) => event.startBeats + event.durationBeats));
    midiTakePlaybackTimers.push(window.setTimeout(() => set({ midiTakePlaying: false }), endBeat * secondsPerBeat * 1000 + 80));
    get().flashDisplay(`PLAY TAKE ${String(take.number).padStart(2, "0")}`, [kind === "ARP" ? "ARP MIDI" : "CHORD MIDI"], undefined, "RECORD_VIEW");
  },
  stopMidiTakePlayback: () => {
    clearMidiTakePlaybackTimers();
    auraAudio.allNotesOff();
    set({ midiTakePlaying: false });
  },
  saveMidiTake: (kind = "CHORDS") => {
    const take = get().midiTake;
    if (!take) return;
    const exportKind = kind === "ARP" && take.arpEvents.length ? "ARP" : "CHORDS";
    const blob = buildMidiTakeFile(take, exportKind);
    downloadBlob(blob, midiTakeFilename(take, exportKind));
    get().flashDisplay("SAVE MIDI", [exportKind === "ARP" ? "ARP MIDI" : "CHORD MIDI"], undefined, "RECORD_VIEW");
  },
  recordArpMidiEvent: (event) => {
    const state = get();
    if (!state.midiRecording) return;
    const startBeats = beatsFromMs(event.startPerformanceMs - state.midiRecordingStartedAt, state.midiRecordingBpm);
    const durationBeats = Math.max(0.03, event.durationSeconds * (state.midiRecordingBpm / 60));
    const note: RecordedMidiNote = {
      midiNote: event.midiNote,
      velocity: event.velocity,
      startBeats,
      durationBeats,
      channel: 0,
      source: "arp",
    };
    set({ midiRecordingArpEvents: [...state.midiRecordingArpEvents, note] });
  },
  toggleStepSequencer: () => set({ stepSequencerOpen: !get().stepSequencerOpen }),
  toggleGuidedMode: () => set({ guidedMode: !get().guidedMode }),
  setSmartEnabled: (enabled) => {
    const state = get();
    const harmonySuggestions = enabled ? computeHarmonySuggestions({ ...state, smartEnabled: enabled }) : [];
    set({ smartEnabled: enabled, harmonySuggestions, focusedSuggestionId: "" });
    get().flashDisplay(enabled ? "SMART ON" : "SMART OFF", [enabled ? state.harmonyPath : "MANUAL"], undefined, "SMART_VIEW");
  },
  setHarmonyPath: (mode) => {
    const state = get();
    const harmonySuggestions = computeHarmonySuggestions({ ...state, harmonyPath: mode });
    set({ harmonyPath: mode, harmonySuggestions, focusedSuggestionId: "" });
    get().flashDisplay("PATH", [mode], undefined, "SMART_VIEW");
  },
  setManualLock: (enabled) => {
    set({ manualLock: enabled });
    get().flashDisplay(enabled ? "MANUAL LOCK" : "SMART PLAY", [enabled ? "ROOT HINTS ONLY" : "AUTO DREAM"], undefined, "SMART_VIEW");
  },
  focusHarmonySuggestion: (id) => {
    const suggestion = get().harmonySuggestions.find((item) => item.id === id);
    if (!suggestion) return;
    const variant = getSuggestionVariant(suggestion, get().suggestionAltIndexes[id] ?? 0);
    set({ focusedSuggestionId: id });
    get().flashDisplay(suggestion.role === "experimental" ? "EXPLORE" : "NEXT", [variant.displayName], undefined, "SMART_VIEW");
  },
  clearHarmonyFocus: () => set({ focusedSuggestionId: "" }),
  cycleHarmonyAlternative: () => {
    const state = get();
    const suggestion = state.harmonySuggestions.find((item) => item.id === state.focusedSuggestionId) ?? state.harmonySuggestions[0];
    if (!suggestion) return;
    const nextIndex = ((state.suggestionAltIndexes[suggestion.id] ?? 0) + 1) % Math.max(1, suggestion.alternatives.length);
    const suggestionAltIndexes = { ...state.suggestionAltIndexes, [suggestion.id]: nextIndex };
    const variant = getSuggestionVariant(suggestion, nextIndex);
    set({ suggestionAltIndexes, focusedSuggestionId: suggestion.id });
    get().flashDisplay("ALT", [variant.displayName], undefined, "SMART_VIEW");
  },
  clearHarmonyContext: () => {
    set({
      harmonyHistory: [],
      harmonySuggestions: [],
      focusedSuggestionId: "",
      suggestionAltIndexes: {},
      phraseSlots: createEmptyPhraseSlots(),
      phraseStep: 1,
      phraseStatus: "BUILDING_PHRASE",
      phraseAdvanceToken: get().phraseAdvanceToken + 1,
      phraseReturnToken: get().phraseReturnToken,
    });
    get().flashDisplay("SMART RESET", ["NEW PATH"], undefined, "SMART_VIEW");
  },
  newPhrase: () => {
    set({
      harmonyHistory: [],
      harmonySuggestions: [],
      focusedSuggestionId: "",
      suggestionAltIndexes: {},
      phraseSlots: createEmptyPhraseSlots(),
      phraseStep: 1,
      phraseStatus: "BUILDING_PHRASE",
      phraseAdvanceToken: get().phraseAdvanceToken + 1,
      phraseReturnToken: get().phraseReturnToken,
    });
    get().flashDisplay("NEW PHRASE", ["BUILD 1/4"], undefined, "SMART_VIEW");
  },
  clearPhrase: () => {
    set({
      harmonyHistory: [],
      harmonySuggestions: [],
      focusedSuggestionId: "",
      suggestionAltIndexes: {},
      phraseSlots: createEmptyPhraseSlots(),
      phraseStep: 1,
      phraseStatus: "BUILDING_PHRASE",
      phraseAdvanceToken: get().phraseAdvanceToken + 1,
      phraseReturnToken: get().phraseReturnToken,
    });
    get().flashDisplay("PHRASE CLEAR", ["1/4"], undefined, "SMART_VIEW");
  },
  refreshHarmonySuggestions: (chord) => {
    const state = get();
    set({
      harmonySuggestions: computeHarmonySuggestions(state, chord === undefined ? state.currentChord : chord),
      focusedSuggestionId: "",
    });
  },
}));

export const currentNoteText = (chord: ChordResult | null) => (chord ? formatNoteList(chord.noteNames) : "C - E - G");
