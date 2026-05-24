import { ChordEngine } from "./ChordEngine";
import { PianoKeyboard } from "./PianoKeyboard";
import { VoicingControls } from "./VoicingControls";

export function MainInstrumentPanel() {
  return (
    <main className="main-panel">
      <div className="flex flex-col gap-5">
        <ChordEngine />
        <details className="advanced-section">
          <summary>Voicing und Movement</summary>
          <div className="mt-3 flex flex-col items-center justify-between gap-5 rounded-2xl bg-aura-ink/5 p-4 lg:flex-row">
            <div className="voice-display">
              <div className="text-sm font-black uppercase tracking-[0.18em] text-black/50">Voicing Core</div>
              <div className="voice-bars" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
            <VoicingControls />
          </div>
        </details>
        <PianoKeyboard />
      </div>
    </main>
  );
}
