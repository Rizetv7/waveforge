import { useEffect, useMemo, useState } from "react";
import { displayChordLabel, pitchToNote } from "../lib/musicTheory";
import { useAuraStore } from "../store/useAuraStore";

const formatClock = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${rest.toString().padStart(2, "0")}`;
};

export function WaveDisplay() {
  const currentChord = useAuraStore((state) => state.currentChord);
  const currentlySoundingNotes = useAuraStore((state) => state.currentlySoundingNotes);
  const soundingNoteInfo = useAuraStore((state) => state.soundingNoteInfo);
  const activeArpNote = useAuraStore((state) => state.activeArpNote);
  const sound = useAuraStore((state) => state.layers.chord.preset);
  const displayFlash = useAuraStore((state) => state.displayFlash);
  const clearExpiredDisplay = useAuraStore((state) => state.clearExpiredDisplay);
  const ideaRecording = useAuraStore((state) => state.ideaRecording);
  const ideaPlaying = useAuraStore((state) => state.ideaPlaying);
  const ideaRecordingStartedAt = useAuraStore((state) => state.ideaRecordingStartedAt);
  const ideaPlaybackStartedAt = useAuraStore((state) => state.ideaPlaybackStartedAt);
  const ideaDuration = useAuraStore((state) => state.ideaDuration);
  const ideaPlaybackPosition = useAuraStore((state) => state.ideaPlaybackPosition);
  const [clock, setClock] = useState(() => performance.now());

  useEffect(() => {
    const timer = window.setInterval(clearExpiredDisplay, 120);
    return () => window.clearInterval(timer);
  }, [clearExpiredDisplay]);

  useEffect(() => {
    if (!ideaRecording && !ideaPlaying) return undefined;
    const timer = window.setInterval(() => setClock(performance.now()), 250);
    return () => window.clearInterval(timer);
  }, [ideaPlaying, ideaRecording]);

  const activeFlash =
    displayFlash && !(displayFlash.mode === "PLAY_VIEW" && !currentlySoundingNotes.length)
      ? displayFlash
      : null;
  const flashMode = activeFlash?.mode === "RECORD_VIEW" ? "PARAMETER_VIEW" : activeFlash?.mode;
  const mode = ideaRecording || ideaPlaying ? "RECORD_VIEW" : flashMode ?? (currentlySoundingNotes.length ? "PLAY_VIEW" : "IDLE_VIEW");
  const visualKeys = useMemo(() => Array.from({ length: 49 }, (_, index) => 36 + index), []);
  const activeSet = new Set(currentlySoundingNotes);
  const rootSet = new Set(soundingNoteInfo.filter((note) => note.root).map((note) => note.midi));
  const sustainedSet = new Set(soundingNoteInfo.filter((note) => note.sustained).map((note) => note.midi));
  const showKeyboard = mode === "PLAY_VIEW" || (mode === "PARAMETER_VIEW" && activeFlash?.title === "VOICING" && currentlySoundingNotes.length > 0);
  const colourValue = activeFlash?.title === "COLOUR" ? Number(activeFlash.lines[0] ?? 0) : 0;
  const colourPercent = activeFlash?.bars?.[0] ?? colourValue / 100;
  const recordTime = ideaRecording ? clock - ideaRecordingStartedAt : ideaPlaying && ideaPlaybackStartedAt ? clock - ideaPlaybackStartedAt : ideaPlaybackPosition;
  const title =
    mode === "IDLE_VIEW"
      ? sound
      : mode === "PLAY_VIEW"
        ? currentChord
          ? displayChordLabel(currentChord)
          : sound
        : mode === "RECORD_VIEW"
          ? ideaRecording
            ? "● REC"
            : "PLAY"
          : activeFlash?.title ?? sound;

  return (
    <section className={`wave-display display-${mode.toLowerCase().replace(/_/g, "-")}`} aria-label="Waveforge live display">
      <div className="display-scanline" />
      <div className="display-main">
        <div className="display-title">{title}</div>
        {(mode === "PARAMETER_VIEW" || mode === "ARP_VIEW" || mode === "SMART_VIEW" || mode === "MIDI_NOTIFICATION_VIEW") && activeFlash?.title !== "COLOUR" ? (
          <div className="display-parameter-lines">
            {activeFlash?.lines.slice(0, 2).map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        ) : null}
        {mode === "PARAMETER_VIEW" && activeFlash?.title === "COLOUR" ? (
          <div className="display-colour-wrap">
            <div className="display-colour-value">{Math.round(colourPercent * 100)}</div>
            <div className="display-colour-meter">
              <span>DARK</span>
              <div className="colour-line">
                <span style={{ left: `${Math.round(colourPercent * 100)}%` }} />
              </div>
              <span>BRIGHT</span>
            </div>
          </div>
        ) : null}
        {mode === "RECORD_VIEW" ? (
          <div className="display-record-time">
            {formatClock(recordTime)}
            {ideaPlaying ? ` / ${formatClock(ideaDuration)}` : ""}
          </div>
        ) : null}
      </div>
      {showKeyboard ? (
        <div className="display-mini-keys" aria-label="Aktuell klingende Noten">
          {visualKeys.map((midi) => {
            const pitch = midi % 12;
            const black = [1, 3, 6, 8, 10].includes(pitch);
            const active = activeSet.has(midi);
            const root = rootSet.has(midi);
            const sustained = sustainedSet.has(midi);
            const arpNote = activeArpNote === midi;
            return (
              <span
                key={midi}
                className={`display-mini-key ${black ? "is-black" : "is-white"} ${active ? "is-sounding" : ""} ${root ? "is-root" : ""} ${sustained ? "is-sustained" : ""} ${arpNote ? "is-arp" : ""}`}
                title={`${pitchToNote(midi)} ${midi}`}
              />
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
