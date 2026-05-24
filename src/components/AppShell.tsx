import { useEffect } from "react";
import { IdeaTransport } from "./IdeaTransport";
import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { MidiManager } from "./MidiManager";
import { PianoKeyboard } from "./PianoKeyboard";
import { RotaryKnob } from "./Knob";
import { SmartHarmonyControls } from "./SmartHarmonyControls";
import { WaveChordControls } from "./WaveChordControls";
import { WaveDisplay } from "./WaveDisplay";
import { WaveLayerControls } from "./WaveLayerControls";
import { WavePresetSelector } from "./WavePresetSelector";
import { WaveSettings } from "./WaveSettings";
import { useAuraStore } from "../store/useAuraStore";

export function AppShell() {
  const audioReady = useAuraStore((state) => state.audioReady);
  const toast = useAuraStore((state) => state.toast);
  const spread = useAuraStore((state) => state.spread);
  const color = useAuraStore((state) => state.color);
  const setSpread = useAuraStore((state) => state.setSpread);
  const setColor = useAuraStore((state) => state.setColor);
  const midiMessage = useAuraStore((state) => state.midiMessage);
  const allNotesOff = useAuraStore((state) => state.allNotesOff);
  const stopAllScheduledEvents = useAuraStore((state) => state.stopAllScheduledEvents);
  const toggleMidiDiagnostics = useAuraStore((state) => state.toggleMidiDiagnostics);
  const setFps = useAuraStore((state) => state.setFps);

  useEffect(() => {
    const stop = () => allNotesOff();
    const onVisibility = () => {
      if (document.hidden) stopAllScheduledEvents();
    };
    window.addEventListener("blur", stop);
    window.addEventListener("pointercancel", stop);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", stop);
      window.removeEventListener("pointercancel", stop);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [allNotesOff, stopAllScheduledEvents]);

  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const loop = (time: number) => {
      frames += 1;
      if (time - last >= 1000) {
        setFps((frames * 1000) / (time - last));
        frames = 0;
        last = time;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [setFps]);

  return (
    <div className="app-stage">
      <MidiManager />
      <KeyboardShortcuts />
      {toast ? <div className="toast">{toast}</div> : null}
      <div className="waveforge-hardware">
        <WaveSettings />
        <div className="wave-top-strip">
          <div className="wave-brand">
            <span />
            WAVEFORGE
          </div>
          <div className="wave-status-strip">
            <button type="button" className="status-pill" onClick={toggleMidiDiagnostics}>
              {midiMessage.replace("MIDI: ", "MIDI ")}
            </button>
            <span className="status-pill">{audioReady ? "AUDIO READY" : "CLICK A KEY"}</span>
            <button type="button" className="panic-button" onPointerDown={allNotesOff} onClick={allNotesOff}>
              PANIC
            </button>
          </div>
        </div>
        <div className="wave-head">
          <WaveDisplay />
        </div>
        <div className="wave-control-surface">
          <div className="direct-control-row">
            <WavePresetSelector />
            <WaveChordControls />
            <IdeaTransport />
          </div>
          <div className="master-knob-row">
            <RotaryKnob
              label="VOICING"
              value={spread}
              defaultValue={0}
              onChange={setSpread}
              step={1 / 6}
              size="lg"
            />
            <RotaryKnob label="COLOUR" value={color} defaultValue={0.56} onChange={setColor} size="lg" accent="mint" />
            <SmartHarmonyControls />
          </div>
          <PianoKeyboard />
          <WaveLayerControls />
        </div>
      </div>
    </div>
  );
}
