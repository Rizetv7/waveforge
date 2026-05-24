import { bassPresets, drumPatterns, leadPresets } from "../data/presets";
import { useAuraStore } from "../store/useAuraStore";
import type { LayerId } from "../types";
import { BassEngine } from "./BassEngine";
import { ActivityLed, LedButton, MiniSelect, PanelLabel } from "./ControlPrimitives";
import { Knob } from "./Knob";

function LayerCard({
  layer,
  label,
  presets,
  color,
}: {
  layer: LayerId;
  label: string;
  presets: string[];
  color: "orange" | "mint" | "sky";
}) {
  const layerState = useAuraStore((state) => state.layers[layer]);
  const setLayerPreset = useAuraStore((state) => state.setLayerPreset);
  const setLayerVolume = useAuraStore((state) => state.setLayerVolume);
  const toggleLayerMute = useAuraStore((state) => state.toggleLayerMute);
  const toggleLayerSolo = useAuraStore((state) => state.toggleLayerSolo);
  const setMidiLearnTarget = useAuraStore((state) => state.setMidiLearnTarget);

  return (
    <div className="section-card">
      <div className="mb-2 flex items-center justify-between">
        <PanelLabel>{label}</PanelLabel>
        <ActivityLed active={layerState.active} color={color} />
      </div>
      <MiniSelect value={layerState.preset} onChange={(event) => setLayerPreset(layer, event.target.value)}>
        {presets.map((preset) => (
          <option key={preset}>{preset}</option>
        ))}
      </MiniSelect>
      <div className="mt-3 grid grid-cols-[1fr_auto_auto] items-center gap-2">
        <Knob label="VOL" value={layerState.volume} onChange={(value) => setLayerVolume(layer, value)} learnId={`${layer}.volume`} onLearn={setMidiLearnTarget} accent={color} />
        <LedButton active={layerState.muted} tone="berry" onClick={() => toggleLayerMute(layer)}>
          Mute
        </LedButton>
        <LedButton active={layerState.solo} tone="mint" onClick={() => toggleLayerSolo(layer)}>
          Solo
        </LedButton>
      </div>
    </div>
  );
}

export function SoundEnginePanel() {
  return (
    <aside className="control-strip">
      <LayerCard layer="chord" label="Chord / Lead" presets={leadPresets.map((preset) => preset.name)} color="orange" />
      <LayerCard layer="bass" label="Bass Engine" presets={bassPresets.map((preset) => preset.name)} color="mint" />
      <BassEngine />
      <LayerCard layer="drums" label="Drum / Rhythm" presets={drumPatterns.map((pattern) => pattern.name)} color="sky" />
    </aside>
  );
}
