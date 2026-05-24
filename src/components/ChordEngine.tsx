import { CHORD_MODIFIERS, CHORD_TYPES, NOTE_NAMES, SCALE_MODES } from "../lib/musicTheory";
import { useAuraStore } from "../store/useAuraStore";
import type { ChordModifier, ChordType, NoteName, ScaleMode } from "../types";
import { LedButton, MiniSelect, PanelLabel } from "./ControlPrimitives";

export function ChordEngine() {
  const chordType = useAuraStore((state) => state.chordType);
  const modifiers = useAuraStore((state) => state.modifiers);
  const keyRoot = useAuraStore((state) => state.keyRoot);
  const scaleMode = useAuraStore((state) => state.scaleMode);
  const keyModeEnabled = useAuraStore((state) => state.keyModeEnabled);
  const setChordType = useAuraStore((state) => state.setChordType);
  const toggleModifier = useAuraStore((state) => state.toggleModifier);
  const setKeyRoot = useAuraStore((state) => state.setKeyRoot);
  const setScaleMode = useAuraStore((state) => state.setScaleMode);
  const setKeyModeEnabled = useAuraStore((state) => state.setKeyModeEnabled);
  const randomizeIdea = useAuraStore((state) => state.randomizeIdea);
  const setMidiPlayMode = useAuraStore((state) => state.setMidiPlayMode);
  const midiPlayMode = useAuraStore((state) => state.midiPlayMode);

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr_.8fr]">
        <div className="section-card">
          <PanelLabel>Chord Type</PanelLabel>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(86px,1fr))] gap-2">
            {CHORD_TYPES.map((type) => (
              <LedButton key={type} active={type === chordType} tone="orange" onClick={() => setChordType(type as ChordType)}>
                {type}
              </LedButton>
            ))}
          </div>
        </div>
        <div className="section-card">
          <PanelLabel>Key Mode</PanelLabel>
          <div className="grid grid-cols-[.7fr_1.3fr] gap-2">
            <MiniSelect value={keyRoot} onChange={(event) => setKeyRoot(event.target.value as NoteName)}>
              {NOTE_NAMES.map((note) => (
                <option key={note}>{note}</option>
              ))}
            </MiniSelect>
            <MiniSelect value={scaleMode} onChange={(event) => setScaleMode(event.target.value as ScaleMode)}>
              {SCALE_MODES.map((mode) => (
                <option key={mode}>{mode}</option>
              ))}
            </MiniSelect>
            <LedButton className="col-span-1" active={keyModeEnabled} tone="mint" onClick={() => setKeyModeEnabled(!keyModeEnabled)}>
              Key Lock
            </LedButton>
            <div className="trigger-status">Chord Trigger On</div>
          </div>
        </div>
      </div>
      <details className="advanced-section">
        <summary>Harmony erweitern</summary>
        <div className="section-card mt-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <PanelLabel>Chord Modifiers</PanelLabel>
            <button className="text-xs font-black uppercase tracking-wide text-aura-ember" type="button" onClick={randomizeIdea}>
              Surprise Me
            </button>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(76px,1fr))] gap-2">
            {CHORD_MODIFIERS.map((modifier) => (
              <LedButton key={modifier} active={modifiers.includes(modifier)} tone={modifier === "Dream" || modifier === "Tension" ? "berry" : "orange"} onClick={() => toggleModifier(modifier as ChordModifier)}>
                {modifier}
              </LedButton>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <label className="text-xs font-black uppercase tracking-wide text-black/60">
              MIDI / Keyboard Mode
              <MiniSelect value={midiPlayMode} onChange={(event) => setMidiPlayMode(event.target.value as typeof midiPlayMode)}>
                <option>Chord Trigger</option>
                <option>Normal Piano</option>
                <option>Solo Bass</option>
              </MiniSelect>
            </label>
          </div>
        </div>
      </details>
    </section>
  );
}
