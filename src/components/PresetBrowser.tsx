import { factoryPresets } from "../data/presets";
import { useAuraStore } from "../store/useAuraStore";
import { LedButton, MiniSelect, PanelLabel } from "./ControlPrimitives";

export function PresetBrowser() {
  const userPresets = useAuraStore((state) => state.userPresets);
  const applyPreset = useAuraStore((state) => state.applyPreset);
  const saveUserPreset = useAuraStore((state) => state.saveUserPreset);
  const deleteUserPreset = useAuraStore((state) => state.deleteUserPreset);
  const randomizeIdea = useAuraStore((state) => state.randomizeIdea);

  return (
    <section className="section-card">
      <PanelLabel>Ideas</PanelLabel>
      <MiniSelect defaultValue="" onChange={(event) => {
        const preset = [...factoryPresets, ...userPresets].find((item) => item.id === event.target.value);
        if (preset) applyPreset(preset);
      }}>
        <option value="" disabled>
          Factory / User Preset
        </option>
        {factoryPresets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.name}
          </option>
        ))}
        {userPresets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.name}
          </option>
        ))}
      </MiniSelect>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <LedButton tone="orange" onClick={randomizeIdea}>
          Randomize
        </LedButton>
        <LedButton tone="mint" onClick={() => saveUserPreset()}>
          Save User
        </LedButton>
      </div>
      {userPresets.length ? (
        <div className="mt-3 max-h-36 space-y-2 overflow-auto pr-1">
          {userPresets.map((preset) => (
            <div key={preset.id} className="flex items-center justify-between rounded-xl bg-black/10 px-3 py-2 text-xs font-black">
              <button type="button" onClick={() => applyPreset(preset)}>{preset.name}</button>
              <button className="text-aura-ember" type="button" onClick={() => deleteUserPreset(preset.id)}>Delete</button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
