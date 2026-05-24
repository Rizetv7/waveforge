import { bassPresets, drumPatterns } from "../data/presets";
import { useAuraStore } from "../store/useAuraStore";
import type { ArpDirection, ArpRate, BassMode, WaveforgeModule } from "../types";
import { RotaryKnob } from "./Knob";

const modules: { id: WaveforgeModule; label: string }[] = [
  { id: "bass", label: "+ BASS" },
  { id: "arp", label: "+ ARP" },
  { id: "beat", label: "+ BEAT" },
  { id: "fx", label: "+ FX" },
];

const arpDirections: ArpDirection[] = ["Up", "Down", "Up/Down"];
const arpRates: ArpRate[] = ["1/4", "1/8", "1/16"];
const bassModes: BassMode[] = ["Root Note", "Octave Pulse", "Walking Bass", "Syncopated"];

export function WaveLayerControls() {
  const active = useAuraStore((state) => state.modules);
  const toggleModule = useAuraStore((state) => state.toggleModule);
  const layers = useAuraStore((state) => state.layers);
  const setLayerPreset = useAuraStore((state) => state.setLayerPreset);
  const setLayerVolume = useAuraStore((state) => state.setLayerVolume);
  const bassMode = useAuraStore((state) => state.bassMode);
  const setBassMode = useAuraStore((state) => state.setBassMode);
  const arp = useAuraStore((state) => state.arp);
  const setArp = useAuraStore((state) => state.setArp);
  const drumPattern = useAuraStore((state) => state.drumPattern);
  const setDrumPattern = useAuraStore((state) => state.setDrumPattern);
  const bpm = useAuraStore((state) => state.bpm);
  const setBpm = useAuraStore((state) => state.setBpm);
  const fx = useAuraStore((state) => state.fx);
  const setFxValue = useAuraStore((state) => state.setFxValue);

  return (
    <section className="wave-layer-zone">
      <div className="add-layer-row">
        {modules.map((module) => (
          <button key={module.id} className={`module-switch ${active[module.id] ? "active" : ""}`} type="button" onClick={() => toggleModule(module.id)}>
            {module.label}
          </button>
        ))}
      </div>

      {active.bass ? (
        <div className="module-strip">
          <span className="strip-title">BASS</span>
          <select className="wave-select" value={layers.bass.preset} onChange={(event) => setLayerPreset("bass", event.target.value)}>
            {bassPresets.map((preset) => (
              <option key={preset.name}>{preset.name}</option>
            ))}
          </select>
          <select className="wave-select" value={bassMode} onChange={(event) => setBassMode(event.target.value as BassMode)}>
            {bassModes.map((mode) => (
              <option key={mode}>{mode}</option>
            ))}
          </select>
          <RotaryKnob label="LEVEL" value={layers.bass.volume} onChange={(value) => setLayerVolume("bass", value)} size="md" accent="mint" />
        </div>
      ) : null}

      {active.arp ? (
        <div className="module-strip">
          <span className="strip-title">ARP</span>
          <select className="wave-select" value={arp.direction} onChange={(event) => setArp({ direction: event.target.value as ArpDirection })}>
            {arpDirections.map((direction) => (
              <option key={direction}>{direction}</option>
            ))}
          </select>
          <select className="wave-select compact" value={arp.rate} onChange={(event) => setArp({ rate: event.target.value as ArpRate })}>
            {arpRates.map((rate) => (
              <option key={rate}>{rate}</option>
            ))}
          </select>
          <RotaryKnob label="GATE" value={arp.gate} onChange={(value) => setArp({ gate: value })} size="md" />
          <button className={`wave-mini-pad ${arp.latch ? "active" : ""}`} type="button" onClick={() => setArp({ latch: !arp.latch })}>
            HOLD
          </button>
        </div>
      ) : null}

      {active.beat ? (
        <div className="module-strip">
          <span className="strip-title">BEAT</span>
          <select className="wave-select" value={drumPattern.name} onChange={(event) => setDrumPattern(event.target.value)}>
            {drumPatterns.map((pattern) => (
              <option key={pattern.name}>{pattern.name}</option>
            ))}
          </select>
          <RotaryKnob label="BPM" value={bpm} min={50} max={180} step={1} defaultValue={92} onChange={setBpm} size="md" accent="sky" />
          <RotaryKnob label="LEVEL" value={layers.drums.volume} onChange={(value) => setLayerVolume("drums", value)} size="md" accent="sky" />
        </div>
      ) : null}

      {active.fx ? (
        <div className="module-strip">
          <span className="strip-title">FX</span>
          <RotaryKnob label="SPACE" value={fx.reverb} onChange={(value) => setFxValue("reverb", value)} size="md" />
          <RotaryKnob label="ECHO" value={fx.delay} onChange={(value) => setFxValue("delay", value)} size="md" />
          <RotaryKnob label="TEXTURE" value={fx.chorus} onChange={(value) => setFxValue("chorus", value)} size="md" accent="mint" />
          <button className={`wave-mini-pad ${fx.freeze ? "active" : ""}`} type="button" onClick={() => setFxValue("freeze", !fx.freeze)}>
            FREEZE
          </button>
        </div>
      ) : null}
    </section>
  );
}
