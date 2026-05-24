import type { ChordModifier, ChordResult, ChordType, NoteName, ScaleMode, VoicingStage } from "../types";

export const NOTE_NAMES: NoteName[] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const CHORD_TYPES: ChordType[] = ["Major", "Minor", "Sus2", "Sus4", "Diminished", "Augmented", "Power"];
export const CHORD_MODIFIERS: ChordModifier[] = [
  "7",
  "Maj7",
  "9",
  "Add9",
  "11",
  "13",
  "6",
  "Slash Bass",
  "Open Fifth",
  "Dream",
  "Tension",
];

export const SCALE_MODES: ScaleMode[] = [
  "Major",
  "Natural Minor",
  "Harmonic Minor",
  "Dorian",
  "Mixolydian",
  "Lydian",
  "Dream / Cinematic Mode",
];

const typeIntervals: Record<ChordType, number[]> = {
  Major: [0, 4, 7],
  Minor: [0, 3, 7],
  Sus2: [0, 2, 7],
  Sus4: [0, 5, 7],
  Diminished: [0, 3, 6],
  Augmented: [0, 4, 8],
  Power: [0, 7],
};

const modeIntervals: Record<ScaleMode, number[]> = {
  Major: [0, 2, 4, 5, 7, 9, 11],
  "Natural Minor": [0, 2, 3, 5, 7, 8, 10],
  "Harmonic Minor": [0, 2, 3, 5, 7, 8, 11],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Mixolydian: [0, 2, 4, 5, 7, 9, 10],
  Lydian: [0, 2, 4, 6, 7, 9, 11],
  "Dream / Cinematic Mode": [0, 2, 3, 6, 7, 9, 11],
};

const romanQualities: Record<ScaleMode, ChordType[]> = {
  Major: ["Major", "Minor", "Minor", "Major", "Major", "Minor", "Diminished"],
  "Natural Minor": ["Minor", "Diminished", "Major", "Minor", "Major", "Major", "Major"],
  "Harmonic Minor": ["Minor", "Diminished", "Augmented", "Minor", "Major", "Major", "Diminished"],
  Dorian: ["Minor", "Minor", "Major", "Major", "Minor", "Diminished", "Major"],
  Mixolydian: ["Major", "Minor", "Diminished", "Major", "Minor", "Minor", "Major"],
  Lydian: ["Major", "Major", "Minor", "Diminished", "Major", "Minor", "Minor"],
  "Dream / Cinematic Mode": ["Sus2", "Minor", "Major", "Major", "Power", "Minor", "Major"],
};

export const noteToPitch = (note: NoteName) => NOTE_NAMES.indexOf(note);

export const normalizePitch = (pitch: number) => ((pitch % 12) + 12) % 12;

export const pitchToNote = (pitch: number): NoteName => NOTE_NAMES[normalizePitch(pitch)];

export const midiToNoteName = (midi: number) => {
  const name = pitchToNote(midi);
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
};

export const noteToMidi = (note: NoteName, octave = 3) => (octave + 1) * 12 + noteToPitch(note);

export const transposeMidiToRootOctave = (pitch: number, octave = 3) => (octave + 1) * 12 + normalizePitch(pitch);

const uniqueSorted = (values: number[]) => Array.from(new Set(values)).sort((a, b) => a - b);
const uniqueInOrder = (values: number[]) => values.filter((value, index) => values.indexOf(value) === index);

const nearestScalePitch = (pitch: number, keyRoot: NoteName, mode: ScaleMode) => {
  const key = noteToPitch(keyRoot);
  const allowed = modeIntervals[mode].map((interval) => normalizePitch(key + interval));
  if (allowed.includes(normalizePitch(pitch))) {
    return normalizePitch(pitch);
  }

  for (let distance = 1; distance <= 6; distance += 1) {
    const up = normalizePitch(pitch + distance);
    const down = normalizePitch(pitch - distance);
    if (allowed.includes(up)) return up;
    if (allowed.includes(down)) return down;
  }
  return normalizePitch(pitch);
};

export const getScaleNotes = (root: NoteName, mode: ScaleMode) =>
  modeIntervals[mode].map((interval) => pitchToNote(noteToPitch(root) + interval));

export const mapRootToKeyChord = (inputRoot: NoteName, keyRoot: NoteName, mode: ScaleMode) => {
  const keyPitch = noteToPitch(keyRoot);
  const mappedPitch = nearestScalePitch(noteToPitch(inputRoot), keyRoot, mode);
  const intervals = modeIntervals[mode];
  const degree = intervals.findIndex((interval) => normalizePitch(keyPitch + interval) === mappedPitch);
  const chordType = romanQualities[mode][Math.max(0, degree)];
  return {
    root: pitchToNote(mappedPitch),
    degree: Math.max(0, degree),
    chordType,
  };
};

const applyModifiers = (intervals: number[], modifiers: ChordModifier[], chordType: ChordType) => {
  const next = [...intervals];
  const add = (interval: number) => next.push(interval);

  const has = (modifier: ChordModifier) => modifiers.includes(modifier);
  if (has("Maj7")) {
    add(11);
  } else if (has("7")) {
    add(10);
  }

  if (has("6")) add(9);
  if (has("Add9")) add(14);
  if (has("9")) {
    if (!next.includes(10) && !next.includes(11)) add(10);
    add(14);
  }
  if (has("11")) {
    if (!next.includes(10) && !next.includes(11)) add(10);
    add(14);
    add(17);
  }
  if (has("13")) {
    if (!next.includes(10) && !next.includes(11)) add(10);
    add(14);
    add(21);
  }
  if (has("Open Fifth")) {
    add(19);
    if (chordType !== "Power") add(24);
  }
  if (has("Dream")) {
    add(chordType === "Minor" || chordType === "Diminished" ? 15 : 16);
    add(26);
  }
  if (has("Tension")) {
    add(chordType === "Minor" ? 13 : 18);
    add(22);
  }

  return uniqueSorted(next).filter((interval) => interval <= 29);
};

const secretVoicing = (intervals: number[], modifiers: ChordModifier[], type: ChordType) => {
  const names = modifiers.slice().sort().join("|");
  if (type === "Sus2" && names.includes("Dream") && names.includes("Maj7")) {
    return uniqueSorted([0, 7, 14, 18, 23, 26]);
  }
  if (type === "Minor" && names.includes("Maj7") && names.includes("11")) {
    return uniqueSorted([0, 7, 10, 14, 17, 23, 26]);
  }
  if (type === "Major" && names.includes("6") && names.includes("Add9") && names.includes("Dream")) {
    return uniqueSorted([0, 7, 11, 14, 16, 21, 26]);
  }
  return intervals;
};

export const chordName = (root: NoteName, type: ChordType, modifiers: ChordModifier[]) => {
  const typeName: Record<ChordType, string> = {
    Major: "",
    Minor: "m",
    Sus2: "sus2",
    Sus4: "sus4",
    Diminished: "dim",
    Augmented: "aug",
    Power: "5",
  };
  const suffix = modifiers
    .filter((modifier) => modifier !== "Slash Bass" && modifier !== "Open Fifth")
    .map((modifier) => {
      if (modifier === "Maj7") return "maj7";
      if (modifier === "Add9") return "add9";
      if (modifier === "Dream") return "dream";
      return modifier.toLowerCase();
    })
    .join(" ");
  const slash = modifiers.includes("Slash Bass") ? `/${pitchToNote(noteToPitch(root) + 7)}` : "";
  return `${root}${typeName[type]}${suffix ? ` ${suffix}` : ""}${slash}`.trim();
};

export const applySpread = (midiNotes: number[], spread: number) => {
  const sorted = uniqueSorted(midiNotes);
  return sorted.map((note, index) => {
    if (index === 0) return note;
    const wide = spread > 0.35 && index % 2 === 1;
    const cinematic = spread > 0.65 && index > 2;
    return note + (wide ? 12 : 0) + (cinematic ? 12 : 0);
  });
};

export const applyMotion = (midiNotes: number[], motion: number) => {
  const inversion = Math.round(motion * 4);
  const notes = [...midiNotes].sort((a, b) => a - b);
  for (let index = 0; index < inversion; index += 1) {
    const shifted = notes.shift();
    if (shifted !== undefined) notes.push(shifted + 12);
  }
  if (motion > 0.72 && notes.length > 4) {
    notes[1] += 12;
  }
  return notes.sort((a, b) => a - b);
};

const normalizeInterval = (interval: number) => {
  const pitch = normalizePitch(interval);
  if (interval >= 12 && pitch === 0) return 12;
  return pitch;
};

const chooseChordTone = (intervals: number[], candidates: number[], fallback: number) =>
  candidates.find((candidate) => intervals.some((interval) => normalizeInterval(interval) === candidate)) ?? fallback;

export const VOICING_STAGES: VoicingStage[] = ["CLOSE", "INV 1", "INV 2", "OPEN", "WIDE", "LOW", "AIR"];

export const voicingStageIndex = (spread: number) => Math.round(Math.max(0, Math.min(1, spread)) * (VOICING_STAGES.length - 1));

export const voicingStageName = (spread: number) => VOICING_STAGES[voicingStageIndex(spread)];

export const applyVoicing = (intervals: number[], rootMidi: number, spread: number, motion: number) => {
  void motion;
  const stage = voicingStageIndex(spread);
  const sortedIntervals = uniqueSorted(intervals);
  const normalized = uniqueInOrder(sortedIntervals.map(normalizeInterval));
  const fifth = chooseChordTone(normalized, [7, 6, 8], 7);
  const third = chooseChordTone(normalized, [3, 4, 2, 5, 6, 8], normalized[1] ?? 4);
  const extensions = sortedIntervals.filter((interval) => interval >= 9 && normalizeInterval(interval) !== 0);
  const extensionNotes = (air = false) => extensions.map((interval) => rootMidi + interval + (air ? 12 : 0));

  const fromOffsets = (offsets: number[], airExtensions = false) =>
    uniqueSorted([...offsets.map((offset) => rootMidi + offset), ...extensionNotes(airExtensions)]).filter((note) => note >= 24 && note <= 96);

  if (stage === 0) return fromOffsets(sortedIntervals);
  if (stage === 1) return fromOffsets([third, fifth, 12]);
  if (stage === 2) return fromOffsets([fifth, 12, third + 12]);
  if (stage === 3) return fromOffsets([0, fifth, third + 12]);
  if (stage === 4) return fromOffsets([-12, fifth - 12, third, 12]);
  if (stage === 5) return fromOffsets([-12, 0, third, fifth]);
  return fromOffsets([0, fifth, third + 12, fifth + 12], true);
};

export const voiceLead = (target: number[], previous: number[]) => {
  if (!previous.length) return target;
  const averagePrevious = previous.reduce((sum, note) => sum + note, 0) / previous.length;
  return target
    .map((note) => {
      const candidates = [note - 24, note - 12, note, note + 12, note + 24];
      return candidates.reduce((best, candidate) =>
        Math.abs(candidate - averagePrevious) < Math.abs(best - averagePrevious) ? candidate : best,
      );
    })
    .sort((a, b) => a - b);
};

export const buildChord = ({
  inputRoot,
  chordType,
  modifiers,
  keyRoot,
  scaleMode,
  keyModeEnabled,
  spread,
  motion,
  previousNotes = [],
}: {
  inputRoot: NoteName;
  chordType: ChordType;
  modifiers: ChordModifier[];
  keyRoot: NoteName;
  scaleMode: ScaleMode;
  keyModeEnabled: boolean;
  spread: number;
  motion: number;
  previousNotes?: number[];
}): ChordResult => {
  const mapped = keyModeEnabled ? mapRootToKeyChord(inputRoot, keyRoot, scaleMode) : null;
  const displayRoot = inputRoot;
  const root = mapped?.root ?? inputRoot;
  const actualType = mapped?.chordType ?? chordType;
  const rootMidi = noteToMidi(root, 3);
  let intervals = applyModifiers(typeIntervals[actualType], modifiers, actualType);
  intervals = secretVoicing(intervals, modifiers, actualType);
  const midiNotes = applyVoicing(intervals, rootMidi, spread, motion);

  const bassMidi = modifiers.includes("Slash Bass") ? rootMidi + 7 - 12 : rootMidi - 12;
  return {
    root,
    displayRoot,
    type: actualType,
    modifiers,
    name: chordName(root, actualType, modifiers),
    noteNames: midiNotes.map((midi) => midiToNoteName(midi).replace(/\d+$/, "")),
    midiNotes,
    bassMidi,
  };
};

export const formatNoteList = (notes: string[]) => notes.join(" - ");

export const displayChordLabel = (chord: ChordResult) => {
  const typeName: Record<ChordType, string> = {
    Major: "MAJOR",
    Minor: "MINOR",
    Sus2: "SUS2",
    Sus4: "SUS4",
    Diminished: "DIM",
    Augmented: "AUG",
    Power: "POWER",
  };
  const modifiers = chord.modifiers
    .filter((modifier) => !["Slash Bass", "Open Fifth", "Dream", "Tension"].includes(modifier))
    .join(" ")
    .toUpperCase();
  const base = chord.type === "Major" && modifiers ? "" : typeName[chord.type];
  return `${chord.root} ${[base, modifiers].filter(Boolean).join(" ")}`.trim();
};
