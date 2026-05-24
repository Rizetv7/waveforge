import { currentNoteText, useAuraStore } from "../store/useAuraStore";
import { MiniSelect } from "./ControlPrimitives";

export function TopBar() {
  const currentChord = useAuraStore((state) => state.currentChord);
  const keyRoot = useAuraStore((state) => state.keyRoot);
  const scaleMode = useAuraStore((state) => state.scaleMode);
  const bpm = useAuraStore((state) => state.bpm);
  const setBpm = useAuraStore((state) => state.setBpm);
  const audioStatus = useAuraStore((state) => state.audioStatus);
  const midiMessage = useAuraStore((state) => state.midiMessage);
  const midiDevices = useAuraStore((state) => state.midiDevices);
  const selectedMidiInputId = useAuraStore((state) => state.selectedMidiInputId);
  const selectMidiInput = useAuraStore((state) => state.selectMidiInput);
  const saveUserPreset = useAuraStore((state) => state.saveUserPreset);
  const exportIdea = useAuraStore((state) => state.exportIdea);

  const hasMidi = midiMessage.includes("verbunden");

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" />
        WAVEFORGE
      </div>
      <div className="chord-display" aria-live="polite">
        <div className="chord-name">{currentChord?.name ?? "Touch a key"}</div>
        <div className="note-list">
          {currentNoteText(currentChord)} · {keyRoot} {scaleMode}
        </div>
      </div>
      <div className="top-status">
        <label className="status-pill">
          BPM
          <input className="w-14 bg-transparent text-center font-black outline-none" type="number" min={50} max={180} value={bpm} onChange={(event) => setBpm(Number(event.target.value))} />
        </label>
        <span className="status-pill">Audio: {audioStatus === "recording" ? "Recording" : audioStatus === "ready" ? "Ready" : "Aus"}</span>
        <span className="status-pill">
          {hasMidi ? <span className="green-dot" /> : null}
          {midiDevices.length > 1 ? (
            <MiniSelect className="h-8 min-h-0 border-0 bg-transparent p-0 text-xs text-aura-panel" value={selectedMidiInputId} onChange={(event) => selectMidiInput(event.target.value)} aria-label="MIDI Keyboard">
              {midiDevices.map((device) => (
                <option key={device.id} value={device.id}>
                  MIDI: {device.name}
                </option>
              ))}
            </MiniSelect>
          ) : (
            midiMessage
          )}
        </span>
        <button className="status-pill hover:bg-white/10" type="button" onClick={() => saveUserPreset()}>
          Save
        </button>
        <button className="status-pill hover:bg-white/10" type="button" onClick={exportIdea}>
          Export
        </button>
      </div>
    </header>
  );
}
