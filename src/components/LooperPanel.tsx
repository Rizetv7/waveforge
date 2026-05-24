import { useAuraStore } from "../store/useAuraStore";
import { LedButton, MiniSelect, PanelLabel } from "./ControlPrimitives";

const bars = [1, 2, 4, 8, 16] as const;

export function LooperPanel() {
  const looperBars = useAuraStore((state) => state.looperBars);
  const setLooperBars = useAuraStore((state) => state.setLooperBars);
  const looperRecording = useAuraStore((state) => state.looperRecording);
  const looperPlaying = useAuraStore((state) => state.looperPlaying);
  const looperOverdub = useAuraStore((state) => state.looperOverdub);
  const countIn = useAuraStore((state) => state.countIn);
  const quantize = useAuraStore((state) => state.quantize);
  const loopPosition = useAuraStore((state) => state.loopPosition);
  const loopLayers = useAuraStore((state) => state.loopLayers);
  const savedLoops = useAuraStore((state) => state.savedLoops);
  const toggleRecord = useAuraStore((state) => state.toggleRecord);
  const togglePlayback = useAuraStore((state) => state.togglePlayback);
  const stopLooper = useAuraStore((state) => state.stopLooper);
  const toggleOverdub = useAuraStore((state) => state.toggleOverdub);
  const undoLoop = useAuraStore((state) => state.undoLoop);
  const redoLoop = useAuraStore((state) => state.redoLoop);
  const clearLoop = useAuraStore((state) => state.clearLoop);
  const saveLoop = useAuraStore((state) => state.saveLoop);
  const loadLoop = useAuraStore((state) => state.loadLoop);
  const hardCut = useAuraStore((state) => state.hardCut);
  const toggleCountIn = useAuraStore((state) => state.toggleCountIn);
  const toggleQuantize = useAuraStore((state) => state.toggleQuantize);

  return (
    <section className="section-card">
      <div className="mb-2 flex items-center justify-between gap-3">
        <PanelLabel>Looper</PanelLabel>
        <div className="loop-ring" style={{ background: `conic-gradient(#f2692e ${loopPosition * 360}deg, rgba(23,17,14,.14) 0deg)` }}>
          <span>{loopLayers.length}</span>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <LedButton active={looperRecording} tone="berry" onClick={toggleRecord}>
          Record
        </LedButton>
        <LedButton active={looperPlaying} tone="mint" onClick={togglePlayback}>
          Play
        </LedButton>
        <LedButton onClick={stopLooper}>Stop</LedButton>
        <LedButton active={looperOverdub} tone="sky" onClick={toggleOverdub}>
          Overdub
        </LedButton>
        <LedButton onClick={undoLoop}>Undo</LedButton>
        <LedButton onClick={redoLoop}>Redo</LedButton>
        <LedButton tone="berry" onClick={clearLoop}>
          Clear
        </LedButton>
        <LedButton tone="berry" onClick={hardCut}>
          Hard Cut
        </LedButton>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <MiniSelect value={looperBars} onChange={(event) => setLooperBars(Number(event.target.value) as 1 | 2 | 4 | 8 | 16)}>
          {bars.map((bar) => (
            <option key={bar} value={bar}>
              {bar} Bars
            </option>
          ))}
        </MiniSelect>
        <LedButton tone="mint" onClick={saveLoop}>
          Save Loop
        </LedButton>
        <MiniSelect defaultValue="" onChange={(event) => loadLoop(event.target.value)}>
          <option value="" disabled>
            Load Loop
          </option>
          {savedLoops.map((loop) => (
            <option key={loop.id} value={loop.id}>
              {loop.name}
            </option>
          ))}
        </MiniSelect>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <LedButton active={countIn} tone="sky" onClick={toggleCountIn}>
          Count-In
        </LedButton>
        <LedButton active={quantize} tone="mint" onClick={toggleQuantize}>
          Quantize
        </LedButton>
      </div>
    </section>
  );
}
