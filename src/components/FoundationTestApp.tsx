import { useEffect, useMemo, useRef, useState } from "react";
import { MidiManager } from "./MidiManager";
import { FoundationKeyboardShortcuts } from "./FoundationKeyboardShortcuts";
import { VoicingEncoder } from "./VoicingEncoder";
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
  type FoundationExtension,
} from "../lib/foundationTheory";
import { getSuggestionVariant } from "../lib/harmonySuggestions";
import { NOTE_NAMES, normalizePitch, noteToPitch, VOICING_STAGES, voicingStageIndex } from "../lib/musicTheory";
import { useAuraStore } from "../store/useAuraStore";
import type { ArpeggiatorState, ChordModifier, ChordResult, ChordType, HarmonyPathMode, NoteName } from "../types";

const qwerty = ["A", "W", "S", "E", "D", "F", "T", "G", "Y", "H", "U", "J"];
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
  const displayIsVoicing = displayFlash?.title === "VOICING";
  const displayIsSound = displayFlash?.title === "PRESET";
  const displayIsArp = displayFlash?.title === "ARP" || displayFlash?.title === "ARP OFF";
  const displayIsHarmony = Boolean(displayFlash && (
    ["NEXT", "EXPLORE", "ALT", "PATH", "SMART ON", "SMART OFF", "MANUAL LOCK", "SMART PLAY", "LOOP SET", "NEW PATH", "NEW PHRASE"].includes(displayFlash.title) ||
    displayFlash.title.startsWith("BUILD ") ||
    displayFlash.title.startsWith("LOOP ")
  ));
  const displayHarmonyLine = [displayFlash?.title, displayFlash?.lines[0]].filter(Boolean).join(" · ");
  const displayMain = displayIsVoicing
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
  const displaySub = displayIsVoicing
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

  return (
    <main className="foundation-app">
      <MidiManager />
      <FoundationKeyboardShortcuts />
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

        <section className="display-bay" aria-label="Display">
          <div className="foundation-display">
            <div className="display-glass" />
            <div className="display-content">
              <div key={displayMain} className="display-main">
                {displayMain}
              </div>
              <div className={`display-tone-trace ${traceRange?.twoOctave ? "two-octave" : "compact"} ${traceRange ? "" : "empty"}`} aria-label="Aktuell klingende Akkordtoene">
                <div className="tone-rail" />
                {traceRange
                  ? displayMarkers.map((marker) => {
                    const midi = marker.midi;
                    const pitch = normalizePitch(midi);
                    const active = marker.active && outputMidiSet.has(midi);
                    const root = active && marker.root;
                    const left = `${((midi - traceRange.start) / Math.max(1, traceRange.end - traceRange.start)) * 100}%`;
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
            </div>
          </div>
        </section>

        <section className="foundation-grid" aria-label="Musiksteuerung">
          <div className="foundation-panel mode-panel">
            <h2>Mode</h2>
            <div className="foundation-toggle-row">
              <button className={!keyModeEnabled ? "active" : ""} type="button" onClick={() => setFoundationKeyMode(false)}>FREE</button>
              <button className={keyModeEnabled ? "active" : ""} type="button" onClick={() => setFoundationKeyMode(true)}>GUIDED</button>
            </div>
            <div className="hardware-key-selector" aria-label="Tonart">
              <span>KEY</span>
              <div className="key-stepper">
                <button type="button" onClick={() => stepKey(-1)} aria-label="Vorherige Tonart">‹</button>
                <strong>{key.label}</strong>
                <button type="button" onClick={() => stepKey(1)} aria-label="Naechste Tonart">›</button>
              </div>
            </div>
          </div>

          <div className="foundation-panel chord-panel">
            <h2>Chord</h2>
            <div className="foundation-button-grid">
              {foundationChordTypes.map((type) => (
                <button key={type} className={chordType === type ? "active" : ""} type="button" onClick={() => setChordType(type as ChordType)} disabled={keyModeEnabled && !manualLock}>
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="foundation-panel extension-panel">
            <h2>Extension</h2>
            <div className="foundation-button-grid extensions">
              {foundationExtensions.map((item) => (
                <button key={item} className={extension === item ? "active" : ""} type="button" onClick={() => setChordExtension(item as FoundationExtension)} disabled={keyModeEnabled && !manualLock}>
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="foundation-panel smart-panel">
            <div className="path-controls" aria-label="Heatmap Path">
              <span>PATH</span>
              <div>
                {pathModes.map((mode) => (
                  <button key={mode} className={harmonyPath === mode ? "active" : ""} type="button" onClick={() => setHarmonyPath(mode)} disabled={!keyModeEnabled}>
                    {mode}
                  </button>
                ))}
              </div>
            </div>
            <div className="control-controls" aria-label="Smart Control">
              <span>CONTROL</span>
              <div className="foundation-toggle-row compact">
                <button className={!manualLock ? "active" : ""} type="button" onClick={() => setManualLock(false)} disabled={!keyModeEnabled}>AUTO</button>
                <button className={manualLock ? "active" : ""} type="button" onClick={() => setManualLock(true)} disabled={!keyModeEnabled}>MANUAL</button>
                <button type="button" onClick={cycleHarmonyAlternative} disabled={!keyModeEnabled || !harmonySuggestions.length}>ALT</button>
              </div>
            </div>
            <div className="phrase-controls" aria-label="Phrase Control">
              <span>PHRASE</span>
              <button type="button" onClick={newPhrase} disabled={!keyModeEnabled}>NEW</button>
              <button type="button" onClick={clearPhrase}>CLEAR</button>
            </div>
          </div>
        </section>

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
            {NOTE_NAMES.map((note, index) => {
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
                  <small>{qwerty[index]}</small>
                </button>
              );
            })}
          </section>
        </section>
      </section>
    </main>
  );
}
