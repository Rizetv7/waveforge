import { useAuraStore } from "../store/useAuraStore";
import type { HarmonyPathMode } from "../types";

const pathModes: HarmonyPathMode[] = ["SAFE", "DREAM", "EXPLORE"];

export function SmartHarmonyControls() {
  const smartEnabled = useAuraStore((state) => state.smartEnabled);
  const harmonyPath = useAuraStore((state) => state.harmonyPath);
  const manualLock = useAuraStore((state) => state.manualLock);
  const suggestions = useAuraStore((state) => state.harmonySuggestions);
  const focusedSuggestionId = useAuraStore((state) => state.focusedSuggestionId);
  const setSmartEnabled = useAuraStore((state) => state.setSmartEnabled);
  const setHarmonyPath = useAuraStore((state) => state.setHarmonyPath);
  const setManualLock = useAuraStore((state) => state.setManualLock);
  const cycleHarmonyAlternative = useAuraStore((state) => state.cycleHarmonyAlternative);
  const clearHarmonyContext = useAuraStore((state) => state.clearHarmonyContext);
  const focused = suggestions.find((suggestion) => suggestion.id === focusedSuggestionId) ?? suggestions[0];

  return (
    <section className="smart-harmony" aria-label="Smart harmony controls">
      <div className="hardware-label">SMART PATH</div>
      <div className="smart-control-row">
        <button className={`hardware-toggle ${smartEnabled ? "active" : ""}`} type="button" onClick={() => setSmartEnabled(!smartEnabled)}>
          SMART
        </button>
        <div className="path-selector" role="group" aria-label="Harmony path">
          {pathModes.map((mode) => (
            <button key={mode} className={harmonyPath === mode ? "active" : ""} type="button" onClick={() => setHarmonyPath(mode)}>
              {mode}
            </button>
          ))}
        </div>
        <button className={`hardware-toggle ${manualLock ? "active" : ""}`} type="button" onClick={() => setManualLock(!manualLock)}>
          LOCK
        </button>
        <button className="hardware-toggle alt" type="button" onClick={cycleHarmonyAlternative} disabled={!focused}>
          ALT
        </button>
        <button className="hardware-toggle ghost" type="button" onClick={clearHarmonyContext}>
          CLR
        </button>
      </div>
      <div className="smart-readout" aria-live="polite">
        {smartEnabled && focused ? `${focused.romanNumeral ?? "NEXT"}  ${focused.displayName}` : smartEnabled ? "PLAY A CHORD" : "MANUAL"}
      </div>
    </section>
  );
}
