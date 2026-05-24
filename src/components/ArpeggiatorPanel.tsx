import { useAuraStore } from "../store/useAuraStore";
import type { ArpDirection, ArpRate, PerformanceMode } from "../types";
import { LedButton, MiniSelect, PanelLabel } from "./ControlPrimitives";

const rates: ArpRate[] = ["1/4", "1/8", "1/8T", "1/16", "1/16T", "1/32"];
const directions: ArpDirection[] = ["Up", "Down", "Up/Down", "Random", "Chord Pulse", "Cascading", "Broken Dream", "Guitar Strum", "Hypnotic Spiral"];
const performanceModes: PerformanceMode[] = ["STRUM", "PULSE", "CASCADE", "DRONE", "DREAM", "RHYTHM CHORDS", "OFF"];

export function ArpeggiatorPanel() {
  const arp = useAuraStore((state) => state.arp);
  const setArp = useAuraStore((state) => state.setArp);
  const performanceMode = useAuraStore((state) => state.performanceMode);
  const setPerformanceMode = useAuraStore((state) => state.setPerformanceMode);

  return (
    <section className="section-card">
      <div className="mb-2 flex items-center justify-between">
        <PanelLabel>Arp / Performance</PanelLabel>
        <LedButton active={arp.enabled} tone="mint" onClick={() => setArp({ enabled: !arp.enabled })}>
          ARP {arp.enabled ? "On" : "Off"}
        </LedButton>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-black uppercase tracking-wide text-black/60">
          Rate
          <MiniSelect value={arp.rate} onChange={(event) => setArp({ rate: event.target.value as ArpRate })}>
            {rates.map((rate) => (
              <option key={rate}>{rate}</option>
            ))}
          </MiniSelect>
        </label>
        <label className="text-xs font-black uppercase tracking-wide text-black/60">
          Direction
          <MiniSelect value={arp.direction} onChange={(event) => setArp({ direction: event.target.value as ArpDirection })}>
            {directions.map((direction) => (
              <option key={direction}>{direction}</option>
            ))}
          </MiniSelect>
        </label>
        <label className="text-xs font-black uppercase tracking-wide text-black/60">
          Octaves
          <input className="mini-input" type="number" min={1} max={4} value={arp.octaveRange} onChange={(event) => setArp({ octaveRange: Number(event.target.value) })} />
        </label>
        <label className="text-xs font-black uppercase tracking-wide text-black/60">
          Pattern
          <MiniSelect value={arp.patternLength} onChange={(event) => setArp({ patternLength: Number(event.target.value) as 4 | 8 | 16 | 32 })}>
            {[4, 8, 16, 32].map((length) => (
              <option key={length}>{length}</option>
            ))}
          </MiniSelect>
        </label>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs font-black uppercase tracking-wide text-black/60">
        {[
          ["Gate", "gate", arp.gate],
          ["Swing", "swing", arp.swing],
          ["Velocity", "velocityVariation", arp.velocityVariation],
          ["Humanize", "humanize", arp.humanize],
          ["Probability", "probability", arp.probability],
        ].map(([label, key, value]) => (
          <label key={String(key)} className={key === "probability" ? "col-span-2" : ""}>
            {label}
            <input className="w-full accent-aura-ember" type="range" min={0} max={key === "humanize" ? 0.08 : 1} step={0.01} value={Number(value)} onChange={(event) => setArp({ [key as string]: Number(event.target.value) })} />
          </label>
        ))}
        <LedButton active={arp.latch} tone="sky" onClick={() => setArp({ latch: !arp.latch })}>
          Hold / Latch
        </LedButton>
      </div>
      <PanelLabel>Performance Mode</PanelLabel>
      <div className="grid grid-cols-2 gap-2">
        {performanceModes.map((mode) => (
          <LedButton key={mode} active={performanceMode === mode} tone={mode === "OFF" ? "dark" : "orange"} onClick={() => setPerformanceMode(mode)}>
            {mode}
          </LedButton>
        ))}
      </div>
    </section>
  );
}
