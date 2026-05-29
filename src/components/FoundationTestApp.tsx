import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { MidiManager } from "./MidiManager";
import { FoundationKeyboardShortcuts } from "./FoundationKeyboardShortcuts";
import { VoicingEncoder } from "./VoicingEncoder";
import { HarmonyControlSurface } from "./HarmonyControlSurface";
import {
  chromaticKeyLabel,
  chordDisplayName,
  degreeForRoot,
  extensionFromModifiers,
  foundationChordTypes,
  foundationExtensions,
  foundationKeys,
  noteNameForPitch,
  outputNoteText,
  readableMidiName,
} from "../lib/foundationTheory";
import { getSuggestionVariant } from "../lib/harmonySuggestions";
import { NOTE_NAMES, normalizePitch, noteToPitch, VOICING_STAGES, voicingStageIndex } from "../lib/musicTheory";
import { useAuraStore } from "../store/useAuraStore";
import type { ArpeggiatorState, ChordModifier, ChordResult, ChordType, HarmonyPathMode, NoteName, RecordedMidiNote } from "../types";

const foundationSoundNames = ["TEST POLY", "WARM POLY", "TAPE KEYS", "DREAM PAD"];
const foundationArpPatterns: Array<{ label: string; patch: Partial<ArpeggiatorState> }> = [
  { label: "OFF", patch: { enabled: false } },
  { label: "SOFT PULSE", patch: { enabled: true, direction: "Chord Pulse", rate: "1/8", gate: 0.62, octaveRange: 1, patternLength: 8, latch: false, probability: 1, humanize: 0.012, velocityVariation: 0.05 } },
  { label: "UP 1/8", patch: { enabled: true, direction: "Up", rate: "1/8", gate: 0.58, octaveRange: 1, patternLength: 8, latch: false, probability: 1, humanize: 0.01, velocityVariation: 0.08 } },
  { label: "DOWN 1/8", patch: { enabled: true, direction: "Down", rate: "1/8", gate: 0.58, octaveRange: 1, patternLength: 8, latch: false, probability: 1, humanize: 0.01, velocityVariation: 0.08 } },
  { label: "UP/DOWN", patch: { enabled: true, direction: "Up/Down", rate: "1/8", gate: 0.56, octaveRange: 1, patternLength: 8, latch: false, probability: 1, humanize: 0.01, velocityVariation: 0.08 } },
  { label: "DREAM CASCADE", patch: { enabled: true, direction: "Broken Dream", rate: "1/16", gate: 0.5, octaveRange: 2, patternLength: 16, latch: false, probability: 1, humanize: 0.018, velocityVariation: 0.12 } },
  { label: "SLOW STRUM", patch: { enabled: true, direction: "Guitar Strum", rate: "1/4", gate: 0.72, octaveRange: 1, patternLength: 4, latch: false, probability: 1, humanize: 0.018, velocityVariation: 0.06 } },
];
const pathModes: HarmonyPathMode[] = ["SAFE", "DREAM", "EXPLORE"];
const blackPitches = [1, 3, 6, 8, 10];
const WAVEFORGE_ARTBOARD_WIDTH = 1474;
const WAVEFORGE_ARTBOARD_HEIGHT = 1158;

const useWaveforgeArtboardScale = () => {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    let frame = 0;

    const updateScale = () => {
      frame = 0;
      const width = window.innerWidth || WAVEFORGE_ARTBOARD_WIDTH;
      const height = window.innerHeight || WAVEFORGE_ARTBOARD_HEIGHT;
      const nextScale = Math.min(width / WAVEFORGE_ARTBOARD_WIDTH, height / WAVEFORGE_ARTBOARD_HEIGHT, 1);
      setScale((current) => (Math.abs(current - nextScale) < 0.001 ? current : nextScale));
    };

    const scheduleScale = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateScale);
    };

    scheduleScale();
    window.addEventListener("resize", scheduleScale, { passive: true });
    window.visualViewport?.addEventListener("resize", scheduleScale);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleScale);
      window.visualViewport?.removeEventListener("resize", scheduleScale);
    };
  }, []);

  return scale;
};

const chordSuffix = (type: ChordType, modifiers: ChordModifier[]) => {
  if (type === "Minor") {
    if (modifiers.includes("7")) return "m7";
    if (modifiers.includes("Add9")) return "madd9";
    return "m";
  }
  if (type === "Diminished") return "dim";
  if (type === "Sus2") return "sus2";
  if (type === "Sus4") return "sus4";
  if (type === "Augmented") return "aug";
  if (type === "Power") return "5";
  if (modifiers.includes("7")) return "7";
  if (modifiers.includes("Maj7")) return "maj7";
  if (modifiers.includes("Add9")) return "add9";
  if (modifiers.includes("6")) return "6";
  return "";
};

const reelChordLabel = (chord: ChordResult, preferFlats: boolean) => {
  const root = noteNameForPitch(noteToPitch(chord.root), preferFlats);
  return `${root}${chordSuffix(chord.type, chord.modifiers)}`.replace("madd9", "m add9");
};

const uniqueSorted = (notes: number[]) => Array.from(new Set(notes)).sort((a, b) => a - b);

type DisplayToneMarker = {
  id: string;
  midi: number;
  active: boolean;
  root: boolean;
};

const takeNumberLabel = (number: number) => `TAKE ${String(number).padStart(2, "0")}`;

const displayToneRange = (notes: number[]) => {
  if (!notes.length) return undefined;
  const sorted = uniqueSorted(notes);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  if (min < 48) {
    return { start: 36, end: max > 60 ? 72 : 60, twoOctave: true };
  }
  if (max >= 60) {
    return { start: 48, end: max > 72 ? 84 : 72, twoOctave: true };
  }
  return {
    start: 48,
    end: 59,
    twoOctave: false,
  };
};

export function FoundationTestApp() {
  const artboardScale = useWaveforgeArtboardScale();
  const artboardStyle = useMemo(() => ({ "--wf-scale": artboardScale.toFixed(4) }) as CSSProperties, [artboardScale]);
  const audioReady = useAuraStore((state) => state.audioReady);
  const activateAudio = useAuraStore((state) => state.activateAudio);
  const requestMidiReconnect = useAuraStore((state) => state.requestMidiReconnect);
  const allNotesOff = useAuraStore((state) => state.allNotesOff);
  const keyModeEnabled = useAuraStore((state) => state.keyModeEnabled);
  const setKeyModeEnabled = useAuraStore((state) => state.setKeyModeEnabled);
  const keyRoot = useAuraStore((state) => state.keyRoot);
  const scaleMode = useAuraStore((state) => state.scaleMode);
  const setKeyRoot = useAuraStore((state) => state.setKeyRoot);
  const setScaleMode = useAuraStore((state) => state.setScaleMode);
  const clearHarmonyContext = useAuraStore((state) => state.clearHarmonyContext);
  const setSmartEnabled = useAuraStore((state) => state.setSmartEnabled);
  const harmonyPath = useAuraStore((state) => state.harmonyPath);
  const setHarmonyPath = useAuraStore((state) => state.setHarmonyPath);
  const manualLock = useAuraStore((state) => state.manualLock);
  const setManualLock = useAuraStore((state) => state.setManualLock);
  const harmonySuggestions = useAuraStore((state) => state.harmonySuggestions);
  const focusedSuggestionId = useAuraStore((state) => state.focusedSuggestionId);
  const suggestionAltIndexes = useAuraStore((state) => state.suggestionAltIndexes);
  const focusHarmonySuggestion = useAuraStore((state) => state.focusHarmonySuggestion);
  const clearHarmonyFocus = useAuraStore((state) => state.clearHarmonyFocus);
  const cycleHarmonyAlternative = useAuraStore((state) => state.cycleHarmonyAlternative);
  const newPhrase = useAuraStore((state) => state.newPhrase);
  const clearPhrase = useAuraStore((state) => state.clearPhrase);
  const phraseSlots = useAuraStore((state) => state.phraseSlots);
  const phraseStep = useAuraStore((state) => state.phraseStep);
  const phraseStatus = useAuraStore((state) => state.phraseStatus);
  const phraseAdvanceToken = useAuraStore((state) => state.phraseAdvanceToken);
  const phraseReturnToken = useAuraStore((state) => state.phraseReturnToken);
  const chordType = useAuraStore((state) => state.chordType);
  const setChordType = useAuraStore((state) => state.setChordType);
  const modifiers = useAuraStore((state) => state.modifiers);
  const setChordExtension = useAuraStore((state) => state.setChordExtension);
  const spread = useAuraStore((state) => state.spread);
  const setSpread = useAuraStore((state) => state.setSpread);
  const setLayerPreset = useAuraStore((state) => state.setLayerPreset);
  const arp = useAuraStore((state) => state.arp);
  const setArp = useAuraStore((state) => state.setArp);
  const activeArpNote = useAuraStore((state) => state.activeArpNote);
  const displayFlash = useAuraStore((state) => state.displayFlash);
  const flashDisplay = useAuraStore((state) => state.flashDisplay);
  const clearExpiredDisplay = useAuraStore((state) => state.clearExpiredDisplay);
  const midiRecording = useAuraStore((state) => state.midiRecording);
  const midiTakePlaying = useAuraStore((state) => state.midiTakePlaying);
  const midiTake = useAuraStore((state) => state.midiTake);
  const midiTakeDisplayOpen = useAuraStore((state) => state.midiTakeDisplayOpen);
  const midiTakePlaybackStartedAt = useAuraStore((state) => state.midiTakePlaybackStartedAt);
  const midiTakePlaybackEndBeat = useAuraStore((state) => state.midiTakePlaybackEndBeat);
  const midiTakePlaybackKind = useAuraStore((state) => state.midiTakePlaybackKind);
  const midiRecordingStartedAt = useAuraStore((state) => state.midiRecordingStartedAt);
  const midiRecordingBpm = useAuraStore((state) => state.midiRecordingBpm);
  const midiRecordingChordEvents = useAuraStore((state) => state.midiRecordingChordEvents);
  const midiRecordingArpEvents = useAuraStore((state) => state.midiRecordingArpEvents);
  const midiRecordingOpenNotes = useAuraStore((state) => state.midiRecordingOpenNotes);
  const startMidiRecording = useAuraStore((state) => state.startMidiRecording);
  const stopMidiRecording = useAuraStore((state) => state.stopMidiRecording);
  const clearMidiTake = useAuraStore((state) => state.clearMidiTake);
  const captureLockedPhrase = useAuraStore((state) => state.captureLockedPhrase);
  const playMidiTake = useAuraStore((state) => state.playMidiTake);
  const stopMidiTakePlayback = useAuraStore((state) => state.stopMidiTakePlayback);
  const saveMidiTake = useAuraStore((state) => state.saveMidiTake);
  const playRoot = useAuraStore((state) => state.playRoot);
  const releaseRoot = useAuraStore((state) => state.releaseRoot);
  const activeRoots = useAuraStore((state) => state.activeRoots);
  const activeTriggers = useAuraStore((state) => state.activeTriggers);
  const currentChord = useAuraStore((state) => state.currentChord);
  const midiSupported = useAuraStore((state) => state.midiSupported);
  const midiDevices = useAuraStore((state) => state.midiDevices);
  const midiOutputs = useAuraStore((state) => state.midiOutputs);
  const activePresetName = useAuraStore((state) => state.layers.chord.preset);
  const selectedMidiInputId = useAuraStore((state) => state.selectedMidiInputId);
  const selectedMidiOutputId = useAuraStore((state) => state.selectedMidiOutputId);
  const selectMidiInput = useAuraStore((state) => state.selectMidiInput);
  const selectMidiOutput = useAuraStore((state) => state.selectMidiOutput);
  const lastNoteOn = useAuraStore((state) => state.lastNoteOn);
  const lastVelocity = useAuraStore((state) => state.lastVelocity);
  const lastMidiAt = useAuraStore((state) => state.lastMidiAt);

  const key = useMemo(() => {
    const current = foundationKeys.find((item) => item.root === keyRoot && item.scaleMode === scaleMode);
    return current ?? foundationKeys[0];
  }, [keyRoot, scaleMode]);
  const extension = extensionFromModifiers(modifiers);
  const heldTriggers = useMemo(
    () => Object.values(activeTriggers).filter((trigger) => !trigger.released).sort((a, b) => a.startedAt - b.startedAt),
    [activeTriggers],
  );
  const displayChord = heldTriggers[heldTriggers.length - 1]?.chord ?? (activeRoots.length ? currentChord : null);
  const rootPitch = displayChord ? noteToPitch(displayChord.root) : -1;
  const preferFlats = keyModeEnabled
    ? key.preferFlats
    : displayChord
      ? [3, 8, 10].includes(rootPitch) || (rootPitch === 0 && (displayChord.type === "Minor" || displayChord.type === "Diminished" || displayChord.modifiers.includes("7")))
      : false;
  const latestHeldTrigger = heldTriggers[heldTriggers.length - 1] ?? null;
  const midiDiagnosticChord = latestHeldTrigger ? chordDisplayName(latestHeldTrigger.chord, preferFlats) : "NONE";
  const midiDiagnosticOutput = latestHeldTrigger ? latestHeldTrigger.outputNotes.map((midi) => readableMidiName(midi, preferFlats)).join(" ") : "NONE";
  const degree = displayChord && keyModeEnabled ? degreeForRoot(displayChord.root, key) : undefined;
  const suggestionByPitch = useMemo(
    () => new Map(harmonySuggestions.map((suggestion) => [suggestion.rootMidiClass, suggestion])),
    [harmonySuggestions],
  );
  const visibleGuidanceSuggestions = useMemo(
    () => keyModeEnabled
      ? harmonySuggestions.filter((suggestion) => suggestion.confidence >= 0.16).slice(0, phraseStatus === "LOOP_FOLLOW" ? 1 : 4)
      : [],
    [harmonySuggestions, keyModeEnabled, phraseStatus],
  );
  const guidanceRanks = useMemo(
    () => new Map(visibleGuidanceSuggestions.map((suggestion, rank) => [suggestion.id, rank])),
    [visibleGuidanceSuggestions],
  );
  const focusedSuggestion = useMemo(
    () => harmonySuggestions.find((suggestion) => suggestion.id === focusedSuggestionId),
    [focusedSuggestionId, harmonySuggestions],
  );
  const focusedVariant = focusedSuggestion ? getSuggestionVariant(focusedSuggestion, suggestionAltIndexes[focusedSuggestion.id] ?? 0) : undefined;
  const phrasePreviewLabel = focusedSuggestion && focusedVariant
    ? `${noteNameForPitch(focusedSuggestion.rootMidiClass, preferFlats)}${chordSuffix(focusedVariant.chordType, focusedVariant.modifiers)}`
    : "";
  const [activeReturnToken, setActiveReturnToken] = useState(0);
  const phraseCurrentIndex = (phraseStep + 2) % 4;
  const phrasePreviewIndex = phraseStep - 1;
  const phraseIsReturning = activeReturnToken === phraseReturnToken && phraseReturnToken > 0 && phraseStep === 1 && phraseSlots.every((slot) => slot.chord);
  const hasPhraseContent = phraseSlots.some((slot) => slot.chord) || Boolean(phrasePreviewLabel);
  const chordName = displayChord ? chordDisplayName(displayChord, preferFlats) : "-";
  const playedText = displayChord
    ? `${chordName}${degree ? ` · ${degree.roman}` : ""}`
    : "-";
  const outputMidiNotes = useMemo(
    () => uniqueSorted(heldTriggers.flatMap((trigger) => trigger.outputNotes)),
    [heldTriggers],
  );
  const output = outputMidiNotes.length ? outputNoteText(outputMidiNotes, preferFlats) : "-";
  const hasAudibleChord = Boolean(displayChord && outputMidiNotes.length);
  const outputMidiSet = new Set(outputMidiNotes);
  const rootOutputPitch = displayChord ? noteToPitch(displayChord.root) : -1;
  const activeInput = midiDevices.find((device) => device.id === selectedMidiInputId);
  const activeOutput = midiOutputs.find((device) => device.id === selectedMidiOutputId);
  const [midiServiceOpen, setMidiServiceOpen] = useState(false);
  const [midiRecorderMode, setMidiRecorderMode] = useState<"LIVE" | "LOOP">("LIVE");
  const [printingLoop, setPrintingLoop] = useState(false);
  const [midiRollClock, setMidiRollClock] = useState(() => performance.now());
  const voicingIndex = voicingStageIndex(spread);
  const voicingName = VOICING_STAGES[voicingIndex];
  const presetIndex = foundationSoundNames.includes(activePresetName) ? foundationSoundNames.indexOf(activePresetName) : 0;
  const activeArpIndex = useMemo(() => {
    if (!arp.enabled) return 0;
    const index = foundationArpPatterns.findIndex((pattern) => (
      pattern.patch.enabled &&
      pattern.patch.direction === arp.direction &&
      pattern.patch.rate === arp.rate
    ));
    return index > 0 ? index : 0;
  }, [arp.direction, arp.enabled, arp.rate]);
  const activeArpPattern = foundationArpPatterns[activeArpIndex] ?? foundationArpPatterns[0];
  const keyIndex = Math.max(0, foundationKeys.findIndex((item) => item.id === key.id));
  useEffect(() => {
    if (!midiRecording && !midiTakePlaying) return undefined;
    let frame = 0;
    const tick = () => {
      setMidiRollClock(performance.now());
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [midiRecording, midiTakePlaying]);
  const recordingPlayheadBeat = midiRecording
    ? Math.max(0, ((midiRollClock - midiRecordingStartedAt) / 1000) * (midiRecordingBpm / 60))
    : 0;
  const playbackPlayheadBeat = midiTakePlaying && midiTake && midiTakePlaybackStartedAt
    ? Math.min(
        Math.max(midiTakePlaybackEndBeat, midiTake.bars * 4),
        Math.max(0, ((midiRollClock - midiTakePlaybackStartedAt) / 1000) * (midiTake.bpm / 60)),
      )
    : 0;
  const recordingOpenEvents = useMemo<RecordedMidiNote[]>(
    () => Object.values(midiRecordingOpenNotes).flat().map((event) => ({
      ...event,
      durationBeats: Math.max(event.durationBeats, recordingPlayheadBeat - event.startBeats, 0.12),
    })),
    [midiRecordingOpenNotes, recordingPlayheadBeat],
  );
  const midiTraceEvents = useMemo<RecordedMidiNote[]>(
    () => {
      if (midiRecording) {
        return midiRecordingArpEvents.length || arp.enabled
          ? midiRecordingArpEvents
          : [...midiRecordingChordEvents, ...recordingOpenEvents];
      }
      if (midiTake) {
        return midiTakePlaybackKind === "ARP" && midiTake.arpEvents.length ? midiTake.arpEvents : midiTake.chordEvents;
      }
      return [];
    },
    [arp.enabled, midiRecording, midiRecordingChordEvents, midiRecordingArpEvents, recordingOpenEvents, midiTake, midiTakePlaybackKind],
  );
  const midiTraceBars = Math.max(
    1,
    midiRecording
      ? Math.ceil(Math.max(4, ...midiTraceEvents.map((event) => event.startBeats + event.durationBeats)) / 4)
      : midiTake?.bars ?? 4,
  );
  const midiTraceTotalBeats = Math.max(4, midiTraceBars * 4);
  const midiTracePitchRange = useMemo(() => {
    if (!midiTraceEvents.length) return { start: 48, end: 72 };
    const notes = midiTraceEvents.map((event) => event.midiNote);
    const min = Math.min(...notes);
    const max = Math.max(...notes);
    const start = Math.max(0, Math.floor((min - 2) / 12) * 12);
    const end = Math.min(127, Math.max(start + 12, Math.ceil((max + 2) / 12) * 12));
    return { start, end };
  }, [midiTraceEvents]);
  const midiTraceLaneNotes = useMemo(
    () => uniqueSorted(midiTraceEvents.map((event) => event.midiNote)),
    [midiTraceEvents],
  );
  const midiRollActive = midiRecording || midiTakePlaying;
  const midiRollPlayheadBeat = midiRecording ? recordingPlayheadBeat : playbackPlayheadBeat;
  const midiRollPlayheadLeft = `${Math.min(100, Math.max(0, (midiRollPlayheadBeat / midiTraceTotalBeats) * 100))}%`;
  const midiTakeLabel = midiTake ? takeNumberLabel(midiTake.number) : "NO TAKE";
  const lockedPhraseReady = phraseStatus === "LOOP_FOLLOW" && phraseSlots.every((slot) => slot.chord);
  const displayIsRecord = Boolean(midiRecording || midiTakePlaying || midiTakeDisplayOpen || displayFlash?.mode === "RECORD_VIEW");
  const displayIsVoicing = displayFlash?.title === "VOICING";
  const displayIsSound = displayFlash?.title === "PRESET";
  const displayIsArp = displayFlash?.title === "ARP" || displayFlash?.title === "ARP OFF";
  const displayIsHarmony = Boolean(displayFlash && (
    ["NEXT", "EXPLORE", "ALT", "PATH", "SMART ON", "SMART OFF", "MANUAL LOCK", "SMART PLAY", "LOOP SET", "NEW PATH", "NEW PHRASE"].includes(displayFlash.title) ||
    displayFlash.title.startsWith("BUILD ") ||
    displayFlash.title.startsWith("LOOP ")
  ));
  const displayHarmonyLine = [displayFlash?.title, displayFlash?.lines[0]].filter(Boolean).join(" · ");
  const displayMain = printingLoop
    ? "PRINT · LOOP"
    : midiRecording
    ? `REC · ${midiRecorderMode}`
    : midiTakePlaying && midiTake
      ? `PLAY · ${midiTakeLabel}`
      : displayIsRecord
        ? displayFlash?.mode === "RECORD_VIEW" && !midiTakeDisplayOpen
          ? displayFlash.title
          : midiTake
          ? `${midiTakeLabel} · READY`
          : displayFlash?.title ?? "MIDI TAKE"
        : displayIsVoicing
          ? `VOICING · ${voicingName}`
          : displayIsSound
            ? activePresetName
            : displayIsArp
              ? displayFlash.title === "ARP OFF" ? "ARP" : "ARP"
              : displayIsHarmony
                ? displayHarmonyLine
                : hasAudibleChord
                  ? playedText
                  : activePresetName;
  const displaySub = printingLoop
    ? "MIDI"
    : midiRecording
    ? `${midiTraceBars} BAR · ${midiRecordingBpm} BPM`
    : midiTakePlaying && midiTake
      ? `${midiTake.bars} BAR · ${midiTakePlaybackKind === "ARP" ? "ARP MIDI" : "CHORD MIDI"}`
      : displayIsRecord
        ? displayFlash?.mode === "RECORD_VIEW" && !midiTakeDisplayOpen
          ? displayFlash.lines[0] ?? ""
          : midiTake
          ? `${midiTake.bars} BAR · MIDI`
          : displayFlash?.lines[0] ?? ""
        : displayIsVoicing
          ? hasAudibleChord ? playedText : ""
          : displayIsSound
            ? ""
            : displayIsArp
              ? displayFlash?.lines[0] ?? activeArpPattern.label
              : displayIsHarmony
                ? ""
                : hasAudibleChord
                  ? output
                  : "";
  const [displayMarkers, setDisplayMarkers] = useState<DisplayToneMarker[]>([]);
  const displayMarkerId = useRef(0);
  const displayNoteKey = outputMidiNotes.join(",");
  const traceRange = useMemo(() => displayToneRange(displayMarkers.map((marker) => marker.midi)), [displayMarkers]);
  const showMidiTapeTrace = displayIsRecord;

  useEffect(() => {
    const timer = window.setInterval(clearExpiredDisplay, 120);
    return () => window.clearInterval(timer);
  }, [clearExpiredDisplay]);

  useEffect(() => {
    if (!phraseReturnToken) return undefined;
    setActiveReturnToken(phraseReturnToken);
    const timer = window.setTimeout(() => setActiveReturnToken(0), 720);
    return () => window.clearTimeout(timer);
  }, [phraseReturnToken]);

  useEffect(() => {
    setDisplayMarkers((previous) => {
      const nextNotes = uniqueSorted(outputMidiNotes);
      const previousActive = previous.filter((marker) => marker.active);
      const usedPrevious = new Set<string>();
      const usedNext = new Set<number>();
      const nextMarkers: DisplayToneMarker[] = [];

      nextNotes.forEach((midi) => {
        const exact = previousActive.find((marker) => marker.midi === midi && !usedPrevious.has(marker.id));
        if (!exact) return;
        usedPrevious.add(exact.id);
        usedNext.add(midi);
        nextMarkers.push({ ...exact, midi, active: true, root: normalizePitch(midi) === rootOutputPitch });
      });

      nextNotes
        .filter((midi) => !usedNext.has(midi))
        .forEach((midi) => {
          const remaining = previousActive
            .filter((marker) => !usedPrevious.has(marker.id))
            .sort((a, b) => Math.abs(a.midi - midi) - Math.abs(b.midi - midi))[0];
          if (remaining) {
            usedPrevious.add(remaining.id);
            nextMarkers.push({ ...remaining, midi, active: true, root: normalizePitch(midi) === rootOutputPitch });
            return;
          }
          displayMarkerId.current += 1;
          nextMarkers.push({ id: `tone-${displayMarkerId.current}`, midi, active: true, root: normalizePitch(midi) === rootOutputPitch });
        });

      previousActive
        .filter((marker) => !usedPrevious.has(marker.id))
        .forEach((marker) => nextMarkers.push({ ...marker, active: false, root: false }));

      return nextMarkers.sort((a, b) => a.midi - b.midi);
    });
    const timer = window.setTimeout(() => {
      setDisplayMarkers((markers) => markers.filter((marker) => marker.active));
    }, 240);
    return () => window.clearTimeout(timer);
  }, [displayNoteKey, rootOutputPitch]);

  const setKey = (id: string) => {
    const next = foundationKeys.find((item) => item.id === id) ?? foundationKeys[0];
    allNotesOff();
    clearHarmonyContext();
    setKeyRoot(next.root);
    setScaleMode(next.scaleMode);
  };

  const stepKey = (direction: -1 | 1) => {
    const next = (keyIndex + direction + foundationKeys.length) % foundationKeys.length;
    setKey(foundationKeys[next].id);
  };

  const setFoundationKeyMode = (enabled: boolean) => {
    allNotesOff();
    clearHarmonyContext();
    setKeyModeEnabled(enabled);
    setSmartEnabled(enabled);
    if (!enabled) setManualLock(false);
  };

  const selectPreset = (name: string) => {
    setLayerPreset("chord", name);
  };

  const stepPreset = (direction: -1 | 1) => {
    const next = (presetIndex + direction + foundationSoundNames.length) % foundationSoundNames.length;
    selectPreset(foundationSoundNames[next]);
  };

  const selectArpPattern = (index: number) => {
    const next = (index + foundationArpPatterns.length) % foundationArpPatterns.length;
    const pattern = foundationArpPatterns[next];
    setArp(pattern.patch);
    flashDisplay(pattern.label === "OFF" ? "ARP OFF" : "ARP", [pattern.label], undefined, "ARP_VIEW");
  };

  const stepArpPattern = (direction: -1 | 1) => {
    selectArpPattern(activeArpIndex + direction);
  };

  const setVoicingIndex = (index: number) => {
    const max = Math.max(1, VOICING_STAGES.length - 1);
    setSpread(index / max);
  };

  const start = async () => {
    await activateAudio();
    requestMidiReconnect();
  };

  const toggleMidiService = async () => {
    if (!audioReady) await activateAudio();
    requestMidiReconnect();
    setMidiServiceOpen((open) => !open);
  };

  const recorderStatus = midiRecording
    ? "RECORDING"
    : printingLoop
      ? "PRINTING"
      : midiTakePlaying
        ? "PLAYBACK"
        : midiTake
          ? "TAKE READY"
          : "READY";

  const handlePrintLoop = () => {
    setPrintingLoop(true);
    captureLockedPhrase();
    window.setTimeout(() => setPrintingLoop(false), 180);
  };

  return (
    <main className="foundation-app" style={artboardStyle}>
      <MidiManager />
      <FoundationKeyboardShortcuts />
      <div className="foundation-scale-stage">
      <section className="foundation-device" aria-label="WAVEFORGE Smart Chord Instrument">
        <div className="device-screw screw-a" />
        <div className="device-screw screw-b" />
        <div className="device-screw screw-c" />
        <div className="device-screw screw-d" />

        <header className="foundation-header">
          <div className="brand-lockup">
            <span className={`power-led ${audioReady ? "on" : ""}`} />
            <div>
              <h1>WAVEFORGE</h1>
              <p>Smart Chord Instrument</p>
            </div>
          </div>
          <div className="status-cluster" aria-label="Status">
            <span key={lastMidiAt || "midi-idle"} className={`midi-led ${midiDevices.length ? "on" : ""} ${lastMidiAt ? "signal" : ""}`} />
            <span className="status-text">{activeInput?.name ? "MIDI" : midiSupported ? "MIDI" : "NO MIDI"}</span>
            <button type="button" className="utility-button" onClick={toggleMidiService}>{audioReady ? "MIDI" : "POWER"}</button>
            <button type="button" className="panic-button" onPointerDown={allNotesOff} onClick={allNotesOff}>PANIC</button>
          </div>
        </header>

        {midiServiceOpen ? (
          <section className="midi-service-drawer" aria-label="MIDI Service">
            <div>
              <span>INPUT</span>
              <strong>{activeInput?.name ?? (midiDevices.length ? "AUTO / SAME AS SYSTEM" : "NO MIDI INPUT")}</strong>
            </div>
            <div>
              <span>OUTPUT</span>
              <strong>{activeOutput?.name ?? "SAME AS SYSTEM"}</strong>
            </div>
            <div>
              <span>SIGNAL</span>
              <strong>{lastNoteOn.replace("MIDI ", "")} / VEL {Math.round(lastVelocity * 127)}</strong>
            </div>
            <div>
              <span>CHORD</span>
              <strong>{midiDiagnosticChord}</strong>
            </div>
            <div>
              <span>ACTIVE</span>
              <strong>{heldTriggers.length} / {midiDiagnosticOutput}</strong>
            </div>
            <div>
              <span>STATUS</span>
              <strong>{midiDevices.length ? "CONNECTED" : "CONNECT USB KEYBOARD"}</strong>
            </div>
            <label>
              <span>IN</span>
              <select value={selectedMidiInputId} onChange={(event) => selectMidiInput(event.target.value)} aria-label="MIDI Input">
                <option value="">AUTO / SAME AS SYSTEM</option>
                {midiDevices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}
              </select>
            </label>
            <label>
              <span>OUT</span>
              <select value={selectedMidiOutputId} onChange={(event) => selectMidiOutput(event.target.value)} aria-label="MIDI Output">
                <option value="">SAME AS SYSTEM</option>
                {midiOutputs.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}
              </select>
            </label>
            <button type="button" onClick={start}>RECONNECT</button>
            <button type="button" onClick={() => setMidiServiceOpen(false)}>CLOSE</button>
          </section>
        ) : null}

        <section className="foundation-cockpit" aria-label="Display und Performance Controls">
          <section className="foundation-expression-row" aria-label="Voicing und Sound">
            <VoicingEncoder value={voicingIndex} stages={VOICING_STAGES} onChange={setVoicingIndex} />
            <div className="selector-bank" aria-label="Sound und Arp">
              <div className="sound-selector" aria-label="Instrument Preset">
                <span className="sound-label">SOUND</span>
                <div className="sound-stepper">
                  <button type="button" onClick={() => stepPreset(-1)} aria-label="Vorheriger Sound">‹</button>
                  <strong>{activePresetName}</strong>
                  <button type="button" onClick={() => stepPreset(1)} aria-label="Naechster Sound">›</button>
                </div>
                <div className="selector-position" aria-label={`Sound ${presetIndex + 1} von ${foundationSoundNames.length}`}>
                  {foundationSoundNames.map((name, index) => (
                    <span key={name} className={index === presetIndex ? "active" : ""} />
                  ))}
                </div>
              </div>
              <div className={`sound-selector arp-selector ${arp.enabled ? "arp-active" : ""}`} aria-label="Arpeggiator Pattern">
                <span className="sound-label">ARP</span>
                <div className="sound-stepper">
                  <button type="button" onClick={() => stepArpPattern(-1)} aria-label="Vorheriger Arp">‹</button>
                  <strong>{activeArpPattern.label}</strong>
                  <button type="button" onClick={() => stepArpPattern(1)} aria-label="Naechster Arp">›</button>
                </div>
                <div className="selector-position" aria-label={`Arp ${activeArpIndex + 1} von ${foundationArpPatterns.length}`}>
                  {foundationArpPatterns.map((pattern, index) => (
                    <span key={pattern.label} className={index === activeArpIndex ? "active" : ""} />
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="display-bay" aria-label="Display">
            <div className="foundation-display">
              <div className="display-glass" />
              <div className="display-content">
                <div key={displayMain} className="display-main">
                  {displayMain}
                </div>
                <div
                  className={`display-tone-trace ${showMidiTapeTrace ? "midi-trace" : traceRange?.twoOctave ? "two-octave" : "compact"} ${showMidiTapeTrace || traceRange ? "" : "empty"}`}
                  aria-label={showMidiTapeTrace ? "MIDI Tape Trace" : "Aktuell klingende Akkordtoene"}
                >
                  <div className="tone-rail" />
                  {showMidiTapeTrace ? (
                    <div className={`midi-tape-trace ${midiRecording ? "recording" : ""} ${midiTakePlaying ? "playing" : ""} ${midiRollActive ? "has-playhead" : ""}`}>
                      <div className="midi-roll-lanes" aria-hidden="true">
                        {midiTraceLaneNotes.map((midi) => {
                          const ratio = (midi - midiTracePitchRange.start) / Math.max(1, midiTracePitchRange.end - midiTracePitchRange.start);
                          return (
                            <span
                              key={`lane-${midi}`}
                              style={{ top: `${90 - ratio * 80}%` }}
                              title={readableMidiName(midi, preferFlats)}
                            />
                          );
                        })}
                      </div>
                      <div className="midi-tape-bars" aria-hidden="true">
                        {Array.from({ length: midiTraceBars }).map((_, index) => (
                          <span key={`bar-${index}`} style={{ left: `${(index / Math.max(1, midiTraceBars)) * 100}%` }} />
                        ))}
                      </div>
                      {midiTraceEvents.map((event, index) => {
                        const pitchRatio = (event.midiNote - midiTracePitchRange.start) / Math.max(1, midiTracePitchRange.end - midiTracePitchRange.start);
                        const left = `${Math.min(99, Math.max(0, (event.startBeats / midiTraceTotalBeats) * 100))}%`;
                        const width = `${Math.max(event.source === "arp" ? 0.65 : 3.2, (event.durationBeats / midiTraceTotalBeats) * 100)}%`;
                        const top = `${90 - pitchRatio * 80}%`;
                        return (
                          <span
                            key={`midi-tape-${event.source}-${event.midiNote}-${event.startBeats}-${index}`}
                            className={`midi-tape-event ${event.source}`}
                            style={{ left, width, top }}
                            title={`${readableMidiName(event.midiNote, preferFlats)} · ${event.source.toUpperCase()}`}
                          />
                        );
                      })}
                      <span
                        className="midi-roll-playhead"
                        style={{ left: midiRollPlayheadLeft }}
                        aria-hidden="true"
                      />
                    </div>
                  ) : traceRange
                    ? displayMarkers.map((marker) => {
                      const midi = marker.midi;
                      const pitch = normalizePitch(midi);
                      const active = marker.active && outputMidiSet.has(midi);
                      const root = active && marker.root;
                      const position = (midi - traceRange.start) / Math.max(1, traceRange.end - traceRange.start);
                      const left = `${6 + position * 88}%`;
                      return (
                        <span
                          key={marker.id}
                          className={[
                            "tone-marker",
                            blackPitches.includes(pitch) ? "black-tone" : "white-tone",
                            active ? "active-tone" : "",
                            root ? "root-tone" : "",
                            activeArpNote === midi ? "arp-tone" : "",
                            !marker.active ? "ghost-tone" : "",
                          ].filter(Boolean).join(" ")}
                          style={{ left }}
                          title={readableMidiName(midi, preferFlats)}
                        >
                          {noteNameForPitch(midi, preferFlats)}
                        </span>
                      );
                    })
                    : null}
                </div>
                <div key={displaySub || "empty-footer"} className={`display-footer ${displaySub ? "" : "empty"}`}>
                  {displaySub || "\u00a0"}
                </div>
                {showMidiTapeTrace ? (
                  <div className="midi-roll-footer" aria-label="MIDI Roll Status">
                    {midiTraceEvents.length ? `${midiTraceEvents.length} NOTES · ${midiTraceBars} BAR` : "ARMED"}
                  </div>
                ) : hasPhraseContent ? (
                  <div
                    key={`phrase-${phraseAdvanceToken}-${phraseReturnToken}-${focusedSuggestionId}`}
                    className={`phrase-reel ${phraseIsReturning ? "returning" : ""}`}
                    aria-label="Four Step Chord Reel"
                  >
                    <div className="phrase-track" />
                    {phraseSlots.map((slot, index) => {
                      const preview = index === phrasePreviewIndex && phrasePreviewLabel;
                      const label = preview || (slot.chord ? reelChordLabel(slot.chord, preferFlats) : "");
                      return (
                        <span
                          key={slot.step}
                          className={[
                            "phrase-slot",
                            slot.chord ? "filled" : "",
                            index === phraseCurrentIndex ? "recent" : "",
                            index === phrasePreviewIndex ? "armed" : "",
                            preview ? "preview" : "",
                          ].filter(Boolean).join(" ")}
                        >
                          <i>{slot.step}</i>
                          <b>{label}</b>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <div className="display-reel-placeholder" aria-hidden="true" />
                )}
              </div>
            </div>
          </section>
        </section>

        <HarmonyControlSurface
          keyModeEnabled={keyModeEnabled}
          setFoundationKeyMode={setFoundationKeyMode}
          keyLabel={key.label}
          stepKey={stepKey}
          chordType={chordType}
          chordTypes={foundationChordTypes}
          setChordType={setChordType}
          chordDisabled={keyModeEnabled && !manualLock}
          extension={extension}
          extensions={foundationExtensions}
          setChordExtension={setChordExtension}
          extensionDisabled={keyModeEnabled && !manualLock}
          harmonyPath={harmonyPath}
          pathModes={pathModes}
          setHarmonyPath={setHarmonyPath}
          pathDisabled={!keyModeEnabled}
          manualLock={manualLock}
          setManualLock={setManualLock}
          cycleHarmonyAlternative={cycleHarmonyAlternative}
          altDisabled={!keyModeEnabled || !harmonySuggestions.length}
          newPhrase={newPhrase}
          clearPhrase={clearPhrase}
          newPhraseDisabled={!keyModeEnabled}
        />

        <section
          className={`midi-take-recorder-strip ${midiRecording ? "is-recording" : ""} ${printingLoop ? "is-printing" : ""} ${midiTake ? "has-take" : ""} ${midiTakePlaying ? "is-playing" : ""}`}
          aria-label="MIDI Take Recorder"
        >
          <div className="recorder-title-block">
            <span className="capture-led" aria-hidden="true" />
            <div>
              <strong>MIDI TAKE RECORDER</strong>
              <small>{recorderStatus}</small>
            </div>
          </div>

          <div className="recorder-mode-switch" aria-label="Recording Mode">
            <button type="button" className={midiRecorderMode === "LIVE" ? "active" : ""} aria-pressed={midiRecorderMode === "LIVE"} onClick={() => setMidiRecorderMode("LIVE")}>
              LIVE
            </button>
            <button type="button" className={midiRecorderMode === "LOOP" ? "active" : ""} aria-pressed={midiRecorderMode === "LOOP"} onClick={() => setMidiRecorderMode("LOOP")}>
              LOOP
            </button>
          </div>

          <div className="recorder-transport" aria-label="MIDI Transport">
            {midiRecorderMode === "LOOP" ? (
              <button type="button" className="print-button" onClick={handlePrintLoop} disabled={!lockedPhraseReady || midiRecording || midiTakePlaying || printingLoop}>
                PRINT
              </button>
            ) : (
              <button type="button" className="rec-button" onClick={() => void startMidiRecording()} disabled={midiRecording || midiTakePlaying}>
                REC
              </button>
            )}
            <button
              type="button"
              onClick={midiRecording ? stopMidiRecording : stopMidiTakePlayback}
              disabled={!midiRecording && !midiTakePlaying}
            >
              STOP
            </button>
            <button
              type="button"
              onClick={() => playMidiTake(midiTake?.arpEvents.length ? "ARP" : "CHORDS")}
              disabled={!midiTake || midiRecording || midiTakePlaying}
            >
              PLAY
            </button>
          </div>

          <div className="recorder-take-section">
            {midiTake ? (
              <div className="midi-take-cartridge" aria-label={`${midiTakeLabel} MIDI`}>
                <span>{midiTakeLabel}</span>
                <small>{midiTake.bars} BAR · MIDI</small>
              </div>
            ) : (
              <span className="midi-take-empty">NO TAKE</span>
            )}
            <div className="take-actions">
              <button type="button" onClick={() => saveMidiTake(midiTake?.arpEvents.length ? "ARP" : "CHORDS")} disabled={!midiTake || midiRecording || midiTakePlaying}>SAVE MIDI</button>
              <button type="button" onClick={clearMidiTake} disabled={!midiTake || midiRecording}>CLEAR TAKE</button>
            </div>
          </div>
        </section>

        <section className={`keyboard-stage ${phraseStatus === "LOOP_FOLLOW" ? "loop-follow" : "phrase-building"}`} aria-label="Keyboard und Guidance Rail">
          <div className="guidance-rail" aria-label="Guidance Rail">
            {NOTE_NAMES.map((note) => {
              const pitch = noteToPitch(note);
              const suggestion = keyModeEnabled ? suggestionByPitch.get(pitch) : undefined;
              const guidanceRank = suggestion ? guidanceRanks.get(suggestion.id) : undefined;
              const visibleSuggestion = suggestion && guidanceRank !== undefined ? suggestion : undefined;
              const variant = visibleSuggestion ? getSuggestionVariant(visibleSuggestion, suggestionAltIndexes[visibleSuggestion.id] ?? 0) : undefined;
              const lampLabel = variant?.displayName ?? chromaticKeyLabel(note as NoteName, key.preferFlats);
              return (
                <button
                  key={`guidance-${note}`}
                  className={[
                    "guidance-lamp-cell",
                    visibleSuggestion ? "is-lit" : "",
                    guidanceRank !== undefined ? `guidance-rank-${guidanceRank + 1}` : "",
                    visibleSuggestion?.role === "experimental" || visibleSuggestion?.role === "tension" ? "is-explore" : "",
                    visibleSuggestion?.id === focusedSuggestionId ? "is-focused" : "",
                    phraseStatus === "LOOP_FOLLOW" && visibleSuggestion ? "loop-next" : "",
                  ].filter(Boolean).join(" ")}
                  type="button"
                  onPointerEnter={() => {
                    if (visibleSuggestion) focusHarmonySuggestion(visibleSuggestion.id);
                  }}
                  onFocus={() => {
                    if (visibleSuggestion) focusHarmonySuggestion(visibleSuggestion.id);
                  }}
                  onBlur={() => {
                    if (visibleSuggestion) clearHarmonyFocus();
                  }}
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    playRoot(note as NoteName, event.pointerType === "touch" ? 0.78 : 0.88, "screen");
                  }}
                  onPointerUp={(event) => {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                    releaseRoot(note as NoteName, "screen");
                  }}
                  onPointerCancel={() => releaseRoot(note as NoteName, "screen")}
                  onLostPointerCapture={() => releaseRoot(note as NoteName, "screen")}
                  onPointerLeave={(event) => {
                    if (event.buttons) releaseRoot(note as NoteName, "screen");
                    if (visibleSuggestion) clearHarmonyFocus();
                  }}
                  aria-label={visibleSuggestion ? `Guidance ${chromaticKeyLabel(note as NoteName, key.preferFlats)}: ${lampLabel}` : `Guidance ${chromaticKeyLabel(note as NoteName, key.preferFlats)}`}
                >
                  <span className="guidance-jewel" aria-hidden="true" />
                  <span className="guidance-root-label">{chromaticKeyLabel(note as NoteName, key.preferFlats)}</span>
                </button>
              );
            })}
          </div>

          <section className="foundation-keyboard" aria-label="Chromatisches Test-Keyboard">
            {NOTE_NAMES.map((note) => {
              const pitch = noteToPitch(note);
              const suggestion = keyModeEnabled ? suggestionByPitch.get(pitch) : undefined;
              const visibleSuggestion = suggestion && guidanceRanks.has(suggestion.id) ? suggestion : undefined;
              const active = activeRoots.includes(note);
              const played = active || Boolean(keyModeEnabled && currentChord && noteToPitch(currentChord.root) === pitch && activeRoots.length);
              const black = [1, 3, 6, 8, 10].includes(pitch);
              return (
                <button
                  key={note}
                  className={[
                    black ? "black" : "white",
                    active ? "active" : "",
                    played ? "played-root" : "",
                  ].filter(Boolean).join(" ")}
                  type="button"
                  onPointerEnter={() => {
                    if (visibleSuggestion) focusHarmonySuggestion(visibleSuggestion.id);
                  }}
                  onFocus={() => {
                    if (visibleSuggestion) focusHarmonySuggestion(visibleSuggestion.id);
                  }}
                  onBlur={() => {
                    if (visibleSuggestion) clearHarmonyFocus();
                  }}
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    playRoot(note as NoteName, event.pointerType === "touch" ? 0.78 : 0.88, "screen");
                  }}
                  onPointerUp={(event) => {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                    releaseRoot(note as NoteName, "screen");
                  }}
                  onPointerCancel={() => releaseRoot(note as NoteName, "screen")}
                  onLostPointerCapture={() => releaseRoot(note as NoteName, "screen")}
                  onPointerLeave={(event) => {
                    if (event.buttons) releaseRoot(note as NoteName, "screen");
                    if (visibleSuggestion) clearHarmonyFocus();
                  }}
                  aria-label={`Akkord ${note}`}
                >
                  <strong>{chromaticKeyLabel(note as NoteName, key.preferFlats)}</strong>
                </button>
              );
            })}
          </section>
        </section>
      </section>
      </div>
    </main>
  );
}
