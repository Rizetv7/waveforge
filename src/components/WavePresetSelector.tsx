import { waveforgeChordPresets } from "../data/presets";
import { useAuraStore } from "../store/useAuraStore";

export function WavePresetSelector() {
  const current = useAuraStore((state) => state.layers.chord.preset);
  const setLayerPreset = useAuraStore((state) => state.setLayerPreset);
  const index = Math.max(0, waveforgeChordPresets.findIndex((preset) => preset.name === current));
  const active = waveforgeChordPresets[index] ?? waveforgeChordPresets[0];

  const move = (direction: -1 | 1) => {
    const next = (index + direction + waveforgeChordPresets.length) % waveforgeChordPresets.length;
    setLayerPreset("chord", waveforgeChordPresets[next].name);
  };

  return (
    <div className="preset-selector" aria-label="Sound preset selector">
      <button type="button" onClick={() => move(-1)} aria-label="Vorheriger Sound">
        &lt;
      </button>
      <select value={active.name} onChange={(event) => setLayerPreset("chord", event.target.value)} aria-label="Aktiver Sound">
        {waveforgeChordPresets.map((preset) => (
          <option key={preset.id} value={preset.name}>
            {preset.name}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => move(1)} aria-label="Naechster Sound">
        &gt;
      </button>
    </div>
  );
}
