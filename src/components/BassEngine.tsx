import { useAuraStore } from "../store/useAuraStore";
import type { BassMode } from "../types";
import { LedButton, MiniSelect, PanelLabel } from "./ControlPrimitives";

const bassModes: BassMode[] = ["Root Note", "Octave Pulse", "Walking Bass", "Syncopated", "Off", "Solo Bass Mode"];

export function BassEngine() {
  const bassMode = useAuraStore((state) => state.bassMode);
  const setBassMode = useAuraStore((state) => state.setBassMode);
  const midiPlayMode = useAuraStore((state) => state.midiPlayMode);
  const setMidiPlayMode = useAuraStore((state) => state.setMidiPlayMode);

  return (
    <div className="section-card">
      <PanelLabel>Bass Mode</PanelLabel>
      <MiniSelect value={bassMode} onChange={(event) => setBassMode(event.target.value as BassMode)}>
        {bassModes.map((mode) => (
          <option key={mode}>{mode}</option>
        ))}
      </MiniSelect>
      <LedButton className="mt-2 w-full" active={midiPlayMode === "Solo Bass"} tone="mint" onClick={() => setMidiPlayMode(midiPlayMode === "Solo Bass" ? "Chord Trigger" : "Solo Bass")}>
        Solo Bass Keys
      </LedButton>
    </div>
  );
}
