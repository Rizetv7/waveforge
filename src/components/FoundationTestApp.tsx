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
  getDegreeInfos,
  noteNameForPitch,
  outputNoteText,
  readableMidiName,
  type FoundationExtension,
} from "../lib/foundationTheory";
import { getSuggestionVariant } from "../lib/harmonySuggestions";
import { NOTE_NAMES, normalizePitch, noteToPitch, VOICING_STAGES, voicingStageIndex } from "../lib/musicTheory";
import { useAuraStore } from "../store/useAuraStore";
import type { ChordModifier, ChordType, HarmonyPathMode, HarmonySuggestion, NoteName } from "../types";

const qwerty = ["A", "W", "S", "E", "D", "F", "T", "G", "Y", "H", "U", "J"];
const foundationSoundNames = ["TEST POLY", "WARM POLY", "TAPE KEYS", "DREAM PAD"];
const pathModes: HarmonyPathMode[] = ["SAFE", "COLOUR", "EXPLORE"];
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

const suggestionLabel = (suggestion: HarmonySuggestion, altIndex: number, preferFlats: boolean) => {
  const variant = getSuggestionVariant(suggestion, altIndex);
  return `${noteNameForPitch(suggestion.rootMidiClass, preferFlats)}${chordSuffix(variant.chordType, variant.modifiers)}`;
};

const heatmapClass = (suggestion?: HarmonySuggestion) => {
  if (!suggestion || suggestion.confidence < 0.16) return "";
  if (suggestion.confidence >= 0.7) return "heatmap-suggestion heatmap-primary";
  if (suggestion.confidence >= 0.52) return "heatmap-suggestion heatmap-strong";
  if (suggestion.confidence >= 0.34) return "heatmap-suggestion heatmap-medium";
  return "heatmap-suggestion heatmap-faint";
};

const fitLabel = (rank?: number) => {
  if (rank === 0) return "BEST";
  if (rank === 1) return "GOOD";
  if (rank === 2) return "OK";
  return "";
};

const uniqueSorted = (notes: number[]) => Array.from(new Set(notes)).sort((a, b) => a - b);

const displayToneRange = (notes: number[]) => {
  if (!notes.length) return undefined;
  const sorted = uniqueSorted(notes);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const musicalSpan = max - min;
  const padding = musicalSpan > 16 ? 1 : 2;
  const minimumSpan = musicalSpan <= 11 ? 9 : 14;
  const centeredStart = Math.floor((min + max - minimumSpan) / 2);
  const start = Math.min(min - padding, centeredStart);
  const end = Math.max(max + padding, start + minimumSpan);
  return {
    start: Math.max(12, start),
    end: Math.min(108, end),
    twoOctave: musicalSpan > 14,
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
  const cycleHarmonyAlternative = useAuraStore((state) => state.cycleHarmonyAlternative);
  const chordType = useAuraStore((state) => state.chordType);
  const setChordType = useAuraStore((state) => state.setChordType);
  const modifiers = useAuraStore((state) => state.modifiers);
  const setChordExtension = useAuraStore((state) => state.setChordExtension);
  const spread = useAuraStore((state) => state.spread);
  const setSpread = useAuraStore((state) => state.setSpread);
  const setLayerPreset = useAuraStore((state) => state.setLayerPreset);
  const displayFlash = useAuraStore((state) => state.displayFlash);
  const clearExpiredDisplay = useAuraStore((state) => state.clearExpiredDisplay);
  const playRoot = useAuraStore((state) => state.playRoot);
  const releaseRoot = useAuraStore((state) => state.releaseRoot);
  const activeRoots = useAuraStore((state) => state.activeRoots);
  const currentChord = useAuraStore((state) => state.currentChord);
  const currentlySoundingNotes = useAuraStore((state) => state.currentlySoundingNotes);
  const midiSupported = useAuraStore((state) => state.midiSupported);
  const midiPermission = useAuraStore((state) => state.midiPermission);
  const midiDevices = useAuraStore((state) => state.midiDevices);
  const activePresetName = useAuraStore((state) => state.layers.chord.preset);
  const selectedMidiInputId = useAuraStore((state) => state.selectedMidiInputId);
  const lastMidiEvent = useAuraStore((state) => state.lastMidiEvent);
  const lastNoteOn = useAuraStore((state) => state.lastNoteOn);
  const lastNoteOff = useAuraStore((state) => state.lastNoteOff);
  const lastVelocity = useAuraStore((state) => state.lastVelocity);
  const lastMidiAt = useAuraStore((state) => state.lastMidiAt);

  const key = useMemo(() => {
    const current = foundationKeys.find((item) => item.root === keyRoot && item.scaleMode === scaleMode);
    return current ?? foundationKeys[0];
  }, [keyRoot, scaleMode]);
  const degrees = useMemo(() => getDegreeInfos(key), [key]);
  const extension = extensionFromModifiers(modifiers);
  const rootPitch = currentChord ? noteToPitch(currentChord.root) : -1;
  const preferFlats = keyModeEnabled
    ? key.preferFlats
    : currentChord
      ? [3, 8, 10].includes(rootPitch) || (rootPitch === 0 && (currentChord.type === "Minor" || currentChord.type === "Diminished" || currentChord.modifiers.includes("7")))
      : false;
  const degree = currentChord && keyModeEnabled ? degreeForRoot(currentChord.root, key) : undefined;
  const suggestionByPitch = useMemo(
    () => new Map(harmonySuggestions.map((suggestion) => [suggestion.rootMidiClass, suggestion])),
    [harmonySuggestions],
  );
  const labelledSuggestionIds = useMemo(
    () => new Set(harmonySuggestions.filter((suggestion) => suggestion.confidence >= 0.28).slice(0, 5).map((suggestion) => suggestion.id)),
    [harmonySuggestions],
  );
  const heatmapRanks = useMemo(
    () => new Map(harmonySuggestions.filter((suggestion) => suggestion.confidence >= 0.16).map((suggestion, rank) => [suggestion.id, rank])),
    [harmonySuggestions],
  );
  const tonicDegree = keyModeEnabled && !currentChord ? degrees[0] : undefined;
  const chordName = currentChord ? chordDisplayName(currentChord, preferFlats) : "-";
  const playedText = currentChord
    ? `${chordName}${degree ? ` · ${degree.roman}` : ""}`
    : "-";
  const output = currentChord ? outputNoteText(currentChord.midiNotes, preferFlats) : "-";
  const hasAudibleChord = Boolean(currentChord && currentlySoundingNotes.length);
  const outputMidiNotes = hasAudibleChord ? currentChord?.midiNotes ?? [] : [];
  const outputMidiSet = new Set(outputMidiNotes);
  const rootOutputPitch = currentChord ? noteToPitch(currentChord.root) : -1;
  const activeInput = midiDevices.find((device) => device.id === selectedMidiInputId);
  const waitingForMidi = midiDevices.length > 0 && (!lastMidiAt || Date.now() - lastMidiAt > 5000);
  const voicingIndex = voicingStageIndex(spread);
  const voicingName = VOICING_STAGES[voicingIndex];
  const presetIndex = foundationSoundNames.includes(activePresetName) ? foundationSoundNames.indexOf(activePresetName) : 0;
  const keyIndex = Math.max(0, foundationKeys.findIndex((item) => item.id === key.id));
  const displayIsVoicing = displayFlash?.title === "VOICING";
  const displayIsSound = displayFlash?.title === "PRESET";
  const displayIsHarmony = Boolean(displayFlash && ["NEXT", "EXPLORE", "ALT", "PATH", "SMART ON", "SMART OFF", "MANUAL LOCK", "SMART PLAY"].includes(displayFlash.title));
  const displayHarmonyLine = [displayFlash?.title, displayFlash?.lines[0]].filter(Boolean).join(" · ");
  const displayMain = displayIsVoicing
    ? `VOICING · ${voicingName}`
    : displayIsSound
      ? activePresetName
      : displayIsHarmony
        ? displayHarmonyLine
        : hasAudibleChord
          ? playedText
          : activePresetName;
  const displaySub = displayIsVoicing
    ? hasAudibleChord ? playedText : ""
    : displayIsSound
      ? ""
      : displayIsHarmony
        ? ""
        : hasAudibleChord
          ? output
          : "";
  const [ghostNotes, setGhostNotes] = useState<number[]>([]);
  const previousDisplayNotes = useRef<number[]>([]);
  const displayNoteKey = outputMidiNotes.join(",");
  const traceNotes = useMemo(() => (outputMidiNotes.length ? uniqueSorted([...ghostNotes, ...outputMidiNotes]) : []), [displayNoteKey, ghostNotes]);
  const traceRange = useMemo(() => displayToneRange(traceNotes), [traceNotes]);

  useEffect(() => {
    const timer = window.setInterval(clearExpiredDisplay, 120);
    return () => window.clearInterval(timer);
  }, [clearExpiredDisplay]);

  useEffect(() => {
    const previous = previousDisplayNotes.current;
    if (previous.join(",") === displayNoteKey) return;
    setGhostNotes(previous.filter((midi) => !outputMidiNotes.includes(midi)));
    previousDisplayNotes.current = outputMidiNotes;
    const timer = window.setTimeout(() => setGhostNotes([]), 230);
    return () => window.clearTimeout(timer);
  }, [displayNoteKey]);

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

  const setVoicingIndex = (index: number) => {
    const max = Math.max(1, VOICING_STAGES.length - 1);
    setSpread(index / max);
  };

  const start = async () => {
    await activateAudio();
    requestMidiReconnect();
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
            <span className={`midi-led ${midiDevices.length ? "on" : ""}`} />
            <span className="status-text">{activeInput?.name ? "MIDI" : midiSupported ? "MIDI" : "NO MIDI"}</span>
            <button type="button" className="utility-button" onClick={start}>{audioReady ? "MIDI" : "POWER"}</button>
            <button type="button" className="panic-button" onPointerDown={allNotesOff} onClick={allNotesOff}>PANIC</button>
          </div>
        </header>

        <section className="display-bay" aria-label="Display">
          <div className="foundation-display">
            <div className="display-glass" />
            <div className="display-content">
              <div className="display-main">
                {displayMain}
              </div>
              {traceRange ? (
                <div className={`display-tone-trace ${traceRange.twoOctave ? "two-octave" : "compact"}`} aria-label="Aktuell klingende Akkordtoene">
                  <div className="tone-rail" />
                  {traceNotes.map((midi) => {
                    const pitch = normalizePitch(midi);
                    const active = outputMidiSet.has(midi);
                    const ghost = !active && ghostNotes.includes(midi);
                    const root = active && pitch === rootOutputPitch;
                    const left = `${((midi - traceRange.start) / Math.max(1, traceRange.end - traceRange.start)) * 100}%`;
                    return (
                      <span
                        key={midi}
                        className={[
                          "tone-marker",
                          blackPitches.includes(pitch) ? "black-tone" : "white-tone",
                          active ? "active-tone" : "",
                          root ? "root-tone" : "",
                          ghost ? "ghost-tone" : "",
                        ].filter(Boolean).join(" ")}
                        style={{ left }}
                        title={readableMidiName(midi, preferFlats)}
                      >
                        {noteNameForPitch(midi, preferFlats)}
                      </span>
                    );
                  })}
                </div>
              ) : null}
              {displaySub ? (
                <div className="display-footer">
                  {displaySub}
                </div>
              ) : null}
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
            <div className="foundation-toggle-row compact">
              <button className={!manualLock ? "active" : ""} type="button" onClick={() => setManualLock(false)} disabled={!keyModeEnabled}>AUTO</button>
              <button className={manualLock ? "active" : ""} type="button" onClick={() => setManualLock(true)} disabled={!keyModeEnabled}>MANUAL</button>
              <button type="button" onClick={cycleHarmonyAlternative} disabled={!keyModeEnabled || !harmonySuggestions.length}>ALT</button>
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
        </section>

        <section className="foundation-expression-row" aria-label="Voicing und Sound">
          <VoicingEncoder value={voicingIndex} stages={VOICING_STAGES} onChange={setVoicingIndex} />
          <div className="sound-selector" aria-label="Instrument Preset">
            <span className="sound-label">SOUND</span>
            <div className="sound-stepper">
              <button type="button" onClick={() => stepPreset(-1)} aria-label="Vorheriger Sound">‹</button>
              <strong>{activePresetName}</strong>
              <button type="button" onClick={() => stepPreset(1)} aria-label="Naechster Sound">›</button>
            </div>
            <div className="sound-preset-row">
              {foundationSoundNames.map((name) => (
                <button key={name} type="button" className={name === activePresetName ? "active" : ""} onClick={() => selectPreset(name)}>
                  {name}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="foundation-keyboard" aria-label="Chromatisches Test-Keyboard">
          {NOTE_NAMES.map((note, index) => {
            const pitch = noteToPitch(note);
            const suggestion = keyModeEnabled ? suggestionByPitch.get(pitch) : undefined;
            const altIndex = suggestion ? suggestionAltIndexes[suggestion.id] ?? 0 : 0;
            const showSuggestionLabel = suggestion ? labelledSuggestionIds.has(suggestion.id) : false;
            const heatRank = suggestion ? heatmapRanks.get(suggestion.id) : undefined;
            const heatClass = heatmapClass(suggestion);
            const playedDegree = keyModeEnabled && currentChord && noteToPitch(currentChord.root) === pitch ? degree : undefined;
            const startupDegree = tonicDegree?.pitch === pitch ? tonicDegree : undefined;
            const degreeInfo = playedDegree ?? startupDegree;
            const active = activeRoots.includes(note);
            const played = Boolean(playedDegree);
            const black = [1, 3, 6, 8, 10].includes(pitch);
            return (
              <button
                key={note}
                className={[
                  black ? "black" : "white",
                  active ? "active" : "",
                  played ? "played-root" : "",
                  startupDegree ? "tonic-start" : "",
                  heatClass,
                  heatRank !== undefined && heatRank < 4 ? `heatmap-rank-${heatRank + 1}` : "",
                  suggestion?.role === "experimental" || suggestion?.role === "tension" ? "heatmap-explore" : "",
                  suggestion?.id === focusedSuggestionId ? "focused-suggestion" : "",
                ].filter(Boolean).join(" ")}
                type="button"
                onPointerEnter={() => {
                  if (suggestion) focusHarmonySuggestion(suggestion.id);
                }}
                onFocus={() => {
                  if (suggestion) focusHarmonySuggestion(suggestion.id);
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
                onPointerLeave={(event) => {
                  if (event.buttons) releaseRoot(note as NoteName, "screen");
                }}
                aria-label={`Akkord ${note}`}
              >
                {showSuggestionLabel && suggestion ? (
                  <span className="degree-label heatmap-label">
                    <b>{suggestionLabel(suggestion, altIndex, key.preferFlats)}</b>
                    {suggestion.romanNumeral ? <em>{suggestion.romanNumeral}</em> : null}
                    {fitLabel(heatRank) ? <i>{fitLabel(heatRank)}</i> : null}
                  </span>
                ) : degreeInfo ? <span className="degree-label">{degreeInfo.roman}</span> : null}
                <strong>{chromaticKeyLabel(note as NoteName, key.preferFlats)}</strong>
                <small>{qwerty[index]}</small>
              </button>
            );
          })}
        </section>

        <details className="foundation-midi">
          <summary>MIDI DIAGNOSTICS</summary>
          <div className="midi-grid">
            <div><span>Web MIDI</span>{midiSupported ? "Ja" : "Nein"}</div>
            <div><span>Permission</span>{midiPermission}</div>
            <div><span>Yamaha / Inputs</span>{midiDevices.length ? midiDevices.map((device) => device.name).join(" / ") : "Kein Input"}</div>
            <div><span>Aktiver Input</span>{activeInput?.name ?? "-"}</div>
            <div><span>Last Event</span>{lastMidiEvent}</div>
            <div><span>Last Note On</span>{lastNoteOn}</div>
            <div><span>Last Note Off</span>{lastNoteOff}</div>
            <div><span>Velocity</span>{Math.round(lastVelocity * 127)}</div>
            <div className="wide"><span>Generated Chord</span>{chordName} / {output}</div>
            {waitingForMidi ? <div className="wide warning">Geraet erkannt. Warte auf Tastensignal.</div> : null}
          </div>
        </details>
      </section>
    </main>
  );
}
