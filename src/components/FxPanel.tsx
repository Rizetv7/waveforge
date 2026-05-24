import { useAuraStore } from "../store/useAuraStore";
import type { FxName } from "../types";
import { LedButton, PanelLabel } from "./ControlPrimitives";
import { Knob } from "./Knob";

const knobFx: { key: FxName; label: string }[] = [
  { key: "reverb", label: "REVERB" },
  { key: "delay", label: "DELAY" },
  { key: "chorus", label: "CHORUS" },
  { key: "drive", label: "DRIVE" },
  { key: "filter", label: "FILTER" },
  { key: "wobble", label: "WOBBLE" },
];

const toggleFx: { key: FxName; label: string }[] = [
  { key: "wow", label: "Wow" },
  { key: "phaser", label: "Phaser" },
  { key: "flanger", label: "Flanger" },
  { key: "tremolo", label: "Tremolo" },
  { key: "bitcrush", label: "Bit Crush" },
  { key: "vinyl", label: "Vinyl" },
  { key: "reverse", label: "Reverse" },
  { key: "freeze", label: "Freeze" },
];

export function FxPanel() {
  const fx = useAuraStore((state) => state.fx);
  const setFxValue = useAuraStore((state) => state.setFxValue);
  const toggleFxBypass = useAuraStore((state) => state.toggleFxBypass);
  const setMidiLearnTarget = useAuraStore((state) => state.setMidiLearnTarget);

  return (
    <section className="section-card">
      <div className="mb-2 flex items-center justify-between">
        <PanelLabel>Master FX</PanelLabel>
        <LedButton active={fx.bypass} tone="berry" onClick={toggleFxBypass}>
          FX Bypass
        </LedButton>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {knobFx.map((item) => (
          <Knob key={item.key} label={item.label} value={fx[item.key] as number} onChange={(value) => setFxValue(item.key, value)} learnId={`fx.${item.key}`} onLearn={setMidiLearnTarget} />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {toggleFx.map((item) => (
          <LedButton key={item.key} active={Boolean(fx[item.key])} tone={item.key === "freeze" ? "sky" : "orange"} onClick={() => setFxValue(item.key, !fx[item.key])}>
            {item.label}
          </LedButton>
        ))}
      </div>
    </section>
  );
}
