import { useEffect, useRef } from "react";
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

export function FoundationKeyboardShortcuts() {
  const playRoot = useAuraStore((state) => state.playRoot);
  const releaseRoot = useAuraStore((state) => state.releaseRoot);
  const allNotesOff = useAuraStore((state) => state.allNotesOff);
  const pressed = useRef(new Set<string>());

  useEffect(() => {
    const onDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "SELECT" || target?.tagName === "TEXTAREA") return;
      const key = event.key.toLowerCase();
      if (event.code === "Escape") {
        allNotesOff();
        return;
      }
      const note = keyMap[key];
      if (!note || pressed.current.has(key)) return;
      event.preventDefault();
      pressed.current.add(key);
      playRoot(note, 0.86, "qwerty");
    };
    const onUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const note = keyMap[key];
      if (!note) return;
      event.preventDefault();
      pressed.current.delete(key);
      releaseRoot(note, "qwerty");
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [allNotesOff, playRoot, releaseRoot]);

  return null;
}
