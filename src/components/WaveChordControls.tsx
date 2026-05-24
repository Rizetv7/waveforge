import { CHORD_MODIFIERS, NOTE_NAMES, SCALE_MODES } from "../lib/musicTheory";
import { getSuggestionVariant } from "../lib/harmonySuggestions";
import { useAuraStore } from "../store/useAuraStore";
import type { ChordModifier, NoteName, ScaleMode } from "../types";

export function WaveChordControls() {
  const chordType = useAuraStore((state) => state.chordType);
  const modifiers = useAuraStore((state) => state.modifiers);
  const moreChordsOpen = useAuraStore((state) => state.moreChordsOpen);
  const keyRoot = useAuraStore((state) => state.keyRoot);
  const scaleMode = useAuraStore((state) => state.scaleMode);
  const suggestions = useAuraStore((state) => state.harmonySuggestions);
  const focusedSuggestionId = useAuraStore((state) => state.focusedSuggestionId);
  const suggestionAltIndexes = useAuraStore((state) => state.suggestionAltIndexes);
  const setChordType = useAuraStore((state) => state.setChordType);
  const toggleModifier = useAuraStore((state) => state.toggleModifier);
  const toggleMoreChords = useAuraStore((state) => state.toggleMoreChords);
  const setKeyRoot = useAuraStore((state) => state.setKeyRoot);
  const setScaleMode = useAuraStore((state) => state.setScaleMode);

  const activeSus = chordType === "Sus2" || chordType === "Sus4";
  const focusedSuggestion = suggestions.find((suggestion) => suggestion.id === focusedSuggestionId);
  const focusedVariant = focusedSuggestion ? getSuggestionVariant(focusedSuggestion, suggestionAltIndexes[focusedSuggestion.id] ?? 0) : null;
  const suggestedType = focusedVariant?.chordType;
  const suggestedModifiers = focusedVariant?.modifiers ?? [];
  const suggestionClass = (active: boolean) => (active ? " suggested" : "");

  return (
    <section className="wave-chords" aria-label="Chord controls">
      <div className="hardware-label">CHORD</div>
      <div className="chord-basic-grid">
        <button className={`wave-pad ${chordType === "Major" ? "active" : ""}${suggestionClass(suggestedType === "Major")}`} type="button" onClick={() => setChordType("Major")}>
          MAJOR
        </button>
        <button className={`wave-pad ${chordType === "Minor" ? "active" : ""}${suggestionClass(suggestedType === "Minor")}`} type="button" onClick={() => setChordType("Minor")}>
          MINOR
        </button>
        <button className={`wave-pad ${activeSus ? "active" : ""}${suggestionClass(suggestedType === "Sus2" || suggestedType === "Sus4")}`} type="button" onClick={() => setChordType(activeSus && chordType === "Sus2" ? "Sus4" : "Sus2")}>
          SUS
        </button>
        <button className={`wave-pad ${modifiers.includes("7") ? "active" : ""}${suggestionClass(suggestedModifiers.includes("7"))}`} type="button" onClick={() => toggleModifier("7")}>
          7
        </button>
        <button className={`wave-pad ${modifiers.includes("Maj7") ? "active" : ""}${suggestionClass(suggestedModifiers.includes("Maj7"))}`} type="button" onClick={() => toggleModifier("Maj7")}>
          MAJ7
        </button>
        <button className={`wave-pad ${modifiers.includes("Add9") ? "active" : ""}${suggestionClass(suggestedModifiers.includes("Add9"))}`} type="button" onClick={() => toggleModifier("Add9")}>
          ADD9
        </button>
        <button className={`wave-pad more ${moreChordsOpen ? "active" : ""}`} type="button" onClick={toggleMoreChords}>
          MORE
        </button>
      </div>
      {moreChordsOpen ? (
        <div className="chord-more-row">
          <select className="wave-select compact" value={keyRoot} onChange={(event) => setKeyRoot(event.target.value as NoteName)} aria-label="Key root">
            {NOTE_NAMES.map((note) => (
              <option key={note}>{note}</option>
            ))}
          </select>
          <select className="wave-select" value={scaleMode} onChange={(event) => setScaleMode(event.target.value as ScaleMode)} aria-label="Scale mode">
            {SCALE_MODES.map((mode) => (
              <option key={mode}>{mode}</option>
            ))}
          </select>
          {CHORD_MODIFIERS.filter((modifier) => !["7", "Maj7", "Add9"].includes(modifier)).map((modifier) => (
            <button key={modifier} className={`wave-mini-pad ${modifiers.includes(modifier) ? "active" : ""}`} type="button" onClick={() => toggleModifier(modifier as ChordModifier)}>
              {modifier.toUpperCase().replace("SLASH BASS", "SLASH").replace("OPEN FIFTH", "OPEN 5")}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
