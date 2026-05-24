import { drumPatterns } from "../data/presets";
import { useAuraStore } from "../store/useAuraStore";
import type { DrumPattern } from "../types";
import { LedButton, MiniSelect, PanelLabel } from "./ControlPrimitives";

const voices: { key: keyof DrumPattern["steps"]; label: string }[] = [
  { key: "kick", label: "Kick" },
  { key: "snare", label: "Snare" },
  { key: "hat", label: "Hat" },
  { key: "perc", label: "Perc" },
];

export function DrumMachine() {
  const drumPattern = useAuraStore((state) => state.drumPattern);
  const drumsPlaying = useAuraStore((state) => state.drumsPlaying);
  const setDrumPattern = useAuraStore((state) => state.setDrumPattern);
  const toggleDrums = useAuraStore((state) => state.toggleDrums);
  const drumFill = useAuraStore((state) => state.drumFill);
  const drumVariation = useAuraStore((state) => state.drumVariation);
  const stepSequencerOpen = useAuraStore((state) => state.stepSequencerOpen);
  const toggleStepSequencer = useAuraStore((state) => state.toggleStepSequencer);
  const updateDrumStep = useAuraStore((state) => state.updateDrumStep);
  const setLayerVolume = useAuraStore((state) => state.setLayerVolume);
  const drumVolume = useAuraStore((state) => state.layers.drums.volume);

  return (
    <section className="section-card">
      <div className="mb-2 flex items-center justify-between">
        <PanelLabel>Beat Machine</PanelLabel>
        <LedButton active={drumsPlaying} tone="sky" onClick={toggleDrums}>
          {drumsPlaying ? "Running" : "Start"}
        </LedButton>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MiniSelect className="col-span-3" value={drumPattern.name} onChange={(event) => setDrumPattern(event.target.value)}>
          {drumPatterns.map((pattern) => (
            <option key={pattern.name}>{pattern.name}</option>
          ))}
        </MiniSelect>
        <LedButton tone="orange" onClick={drumFill}>
          Fill
        </LedButton>
        <LedButton tone="mint" onClick={drumVariation}>
          Variation
        </LedButton>
        <LedButton active={stepSequencerOpen} tone="sky" onClick={toggleStepSequencer}>
          Steps
        </LedButton>
      </div>
      <label className="mt-3 block text-xs font-black uppercase tracking-wide text-black/60">
        Drum Volume
        <input className="w-full accent-aura-ember" type="range" min={0} max={1} step={0.01} value={drumVolume} onChange={(event) => setLayerVolume("drums", Number(event.target.value))} />
      </label>
      {stepSequencerOpen ? (
        <div className="mt-3 space-y-2">
          {voices.map((voice) => (
            <div key={voice.key} className="grid grid-cols-[48px_1fr] items-center gap-2 text-xs font-black uppercase">
              <span>{voice.label}</span>
              <div className="grid grid-cols-16 gap-1">
                {drumPattern.steps[voice.key].map((active, index) => (
                  <button
                    key={index}
                    className={`step-cell ${active ? "active" : ""} ${index % 4 === 0 ? "bar" : ""}`}
                    type="button"
                    aria-label={`${voice.label} Step ${index + 1}`}
                    onClick={() => updateDrumStep(voice.key, index)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
