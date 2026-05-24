import { NOTE_NAMES } from "../lib/musicTheory";
import { getSuggestionVariant } from "../lib/harmonySuggestions";
import { useAuraStore } from "../store/useAuraStore";
import type { NoteName } from "../types";

const computerKeys = ["A", "W", "S", "E", "D", "F", "T", "G", "Y", "H", "U", "J"];

export function PianoKeyboard() {
  const playRoot = useAuraStore((state) => state.playRoot);
  const releaseRoot = useAuraStore((state) => state.releaseRoot);
  const activeRoots = useAuraStore((state) => state.activeRoots);
  const smartEnabled = useAuraStore((state) => state.smartEnabled);
  const suggestions = useAuraStore((state) => state.harmonySuggestions);
  const focusedSuggestionId = useAuraStore((state) => state.focusedSuggestionId);
  const suggestionAltIndexes = useAuraStore((state) => state.suggestionAltIndexes);
  const focusHarmonySuggestion = useAuraStore((state) => state.focusHarmonySuggestion);
  const clearHarmonyFocus = useAuraStore((state) => state.clearHarmonyFocus);

  return (
    <section className="mt-5">
      <div className="grid grid-cols-12 gap-2">
        {NOTE_NAMES.map((note, index) => {
          const sharp = note.includes("#");
          const active = activeRoots.includes(note);
          const suggestion = smartEnabled ? suggestions.find((item) => item.rootName === note) : undefined;
          const variant = suggestion ? getSuggestionVariant(suggestion, suggestionAltIndexes[suggestion.id] ?? 0) : null;
          const focused = suggestion?.id === focusedSuggestionId;
          return (
            <button
              key={note}
              className={`piano-key ${sharp ? "is-sharp" : ""} ${active ? "is-active" : ""} ${suggestion ? `is-suggested is-${suggestion.role}` : ""} ${focused ? "is-focused-suggestion" : ""}`}
              type="button"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                if (suggestion) focusHarmonySuggestion(suggestion.id);
                playRoot(note as NoteName, event.pointerType === "touch" ? 0.78 : 0.88, "screen");
              }}
              onPointerUp={(event) => {
                event.currentTarget.releasePointerCapture(event.pointerId);
                releaseRoot(note as NoteName, "screen");
              }}
              onPointerCancel={() => releaseRoot(note as NoteName, "screen")}
              onPointerLeave={(event) => {
                if (event.buttons) releaseRoot(note as NoteName, "screen");
                else if (suggestion) clearHarmonyFocus();
              }}
              onPointerEnter={() => {
                if (suggestion) focusHarmonySuggestion(suggestion.id);
              }}
              onFocus={() => {
                if (suggestion) focusHarmonySuggestion(suggestion.id);
              }}
              onBlur={() => {
                if (suggestion) clearHarmonyFocus();
              }}
              aria-label={`Akkord ${note}`}
            >
              {suggestion && variant ? <span className="key-suggestion">{suggestion.romanNumeral ?? variant.displayName}</span> : null}
              <span className="key-note">{note}</span>
              <span className="key-computer">{computerKeys[index]}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
