import { useEffect, useRef } from "react";
import { NOTE_NAMES } from "../lib/musicTheory";
import { useAuraStore } from "../store/useAuraStore";
import type { NoteName } from "../types";

const keyMap: Record<string, NoteName> = {
  a: "C",
  w: "C#",
  s: "D",
  e: "D#",
  d: "E",
  f: "F",
  t: "F#",
  g: "G",
  y: "G#",
  h: "A",
  u: "A#",
  j: "B",
};

export function KeyboardShortcuts() {
  const playRoot = useAuraStore((state) => state.playRoot);
  const releaseRoot = useAuraStore((state) => state.releaseRoot);
  const ideaRecording = useAuraStore((state) => state.ideaRecording);
  const ideaPlaying = useAuraStore((state) => state.ideaPlaying);
  const startIdeaRecording = useAuraStore((state) => state.startIdeaRecording);
  const stopIdeaRecording = useAuraStore((state) => state.stopIdeaRecording);
  const playIdeaRecording = useAuraStore((state) => state.playIdeaRecording);
  const stopIdeaPlayback = useAuraStore((state) => state.stopIdeaPlayback);
  const nextPreset = useAuraStore((state) => state.nextPreset);
  const previousPreset = useAuraStore((state) => state.previousPreset);
  const pressed = useRef(new Set<string>());

  useEffect(() => {
    const onDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "SELECT" || target?.tagName === "TEXTAREA" || target?.getAttribute("role") === "slider") return;
      const key = event.key.toLowerCase();
      if (pressed.current.has(key)) return;
      if (keyMap[key]) {
        event.preventDefault();
        pressed.current.add(key);
        playRoot(keyMap[key], 0.86, "qwerty");
      }
      if (event.code === "Space") {
        event.preventDefault();
        if (ideaPlaying) stopIdeaPlayback();
        else playIdeaRecording();
      }
      if (key === "r") {
        event.preventDefault();
        if (ideaRecording) stopIdeaRecording();
        else startIdeaRecording();
      }
      if (event.key === "ArrowRight") nextPreset();
      if (event.key === "ArrowLeft") previousPreset();
      if (event.key === "?") {
        playRoot(NOTE_NAMES[Math.floor(Math.random() * NOTE_NAMES.length)], 0.8, "qwerty");
      }
    };
    const onUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "SELECT" || target?.tagName === "TEXTAREA" || target?.getAttribute("role") === "slider") return;
      if (keyMap[key]) {
        pressed.current.delete(key);
        releaseRoot(keyMap[key], "qwerty");
      }
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [ideaPlaying, ideaRecording, nextPreset, playIdeaRecording, playRoot, previousPreset, releaseRoot, startIdeaRecording, stopIdeaPlayback, stopIdeaRecording]);

  return null;
}
