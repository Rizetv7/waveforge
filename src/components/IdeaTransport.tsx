import { useMemo } from "react";
import { useAuraStore } from "../store/useAuraStore";

const formatSeconds = (ms: number) => `${(ms / 1000).toFixed(2)}s`;

export function IdeaTransport() {
  const recording = useAuraStore((state) => state.ideaRecording);
  const playing = useAuraStore((state) => state.ideaPlaying);
  const events = useAuraStore((state) => state.ideaEvents);
  const duration = useAuraStore((state) => state.ideaDuration);
  const startIdeaRecording = useAuraStore((state) => state.startIdeaRecording);
  const stopIdeaRecording = useAuraStore((state) => state.stopIdeaRecording);
  const playIdeaRecording = useAuraStore((state) => state.playIdeaRecording);
  const stopIdeaPlayback = useAuraStore((state) => state.stopIdeaPlayback);
  const clearIdeaRecording = useAuraStore((state) => state.clearIdeaRecording);

  const status = useMemo(() => {
    if (recording) return `REC ${events.length}`;
    if (playing) return "PLAY";
    return events.length ? `${formatSeconds(duration)} / ${events.length} EV` : "EMPTY";
  }, [duration, events.length, playing, recording]);

  return (
    <div className="idea-transport" aria-label="Idea recorder">
      <button className={`transport-key rec ${recording ? "active" : ""}`} type="button" onClick={recording ? stopIdeaRecording : startIdeaRecording}>
        REC
      </button>
      <button className={`transport-key ${playing ? "active" : ""}`} type="button" onClick={playing ? stopIdeaPlayback : playIdeaRecording} disabled={!events.length && !playing}>
        PLAY
      </button>
      <button className="transport-key" type="button" onClick={playing || recording ? (playing ? stopIdeaPlayback : stopIdeaRecording) : stopIdeaPlayback}>
        STOP
      </button>
      <button className="transport-key" type="button" onClick={clearIdeaRecording} disabled={!events.length && !recording && !playing}>
        CLEAR
      </button>
      <span className="transport-readout">{status}</span>
    </div>
  );
}
