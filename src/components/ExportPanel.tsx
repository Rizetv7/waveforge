import { useAuraStore } from "../store/useAuraStore";
import { LedButton, PanelLabel } from "./ControlPrimitives";

export function ExportPanel() {
  const audioStatus = useAuraStore((state) => state.audioStatus);
  const startAudioCapture = useAuraStore((state) => state.startAudioCapture);
  const stopAudioCapture = useAuraStore((state) => state.stopAudioCapture);
  const exportIdea = useAuraStore((state) => state.exportIdea);
  const toggleGuidedMode = useAuraStore((state) => state.toggleGuidedMode);
  const guidedMode = useAuraStore((state) => state.guidedMode);

  return (
    <section className="section-card">
      <PanelLabel>Export / Help</PanelLabel>
      <div className="grid grid-cols-2 gap-2">
        <LedButton active={audioStatus === "recording"} tone="berry" onClick={audioStatus === "recording" ? stopAudioCapture : startAudioCapture}>
          {audioStatus === "recording" ? "Stop Audio" : "Record Audio"}
        </LedButton>
        <LedButton tone="mint" onClick={exportIdea}>
          Export Idea
        </LedButton>
        <LedButton active={guidedMode} tone="sky" className="col-span-2" onClick={toggleGuidedMode}>
          Guided Mode
        </LedButton>
      </div>
      {guidedMode ? (
        <div className="mt-3 rounded-xl bg-black/10 p-3 text-sm font-bold leading-snug text-black/70">
          Spiele unten eine Taste. Key Lock macht daraus automatisch passende Akkorde. SPREAD oeffnet das Voicing, MOTION bewegt Inversions, ARP und Beats laufen zum BPM.
        </div>
      ) : null}
    </section>
  );
}
