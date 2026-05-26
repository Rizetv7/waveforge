import type { ChordModifier, ChordResult, ChordType, NoteName, ScaleMode } from "../types";
import { NOTE_NAMES, normalizePitch, noteToPitch, pitchToNote } from "./musicTheory";

export type FoundationExtension = "None" | "6" | "7" | "Maj7" | "Add9" | "9";
export type FoundationMode = "FREE" | "KEY";
export type FoundationKeyQuality = "Major" | "Minor";

export interface FoundationKey {
  id: string;
  label: string;
  root: NoteName;
  quality: FoundationKeyQuality;
  scaleMode: ScaleMode;
  preferFlats: boolean;
  scaleNames?: string[];
}

export interface DegreeInfo {
  pitch: number;
  noteName: string;
  degree: number;
  roman: string;
  chordType: ChordType;
}

export interface CadenceSuggestion {
  degree: DegreeInfo;
  strength: "primary" | "secondary";
}

const sharpNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const flatNames = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const majorIntervals = [0, 2, 4, 5, 7, 9, 11];
const minorIntervals = [0, 2, 3, 5, 7, 8, 10];
const majorRomans = ["I", "ii", "iii", "IV", "V", "vi", "vii°"];
const minorRomans = ["i", "ii°", "III", "iv", "V", "VI", "VII"];
const majorTypes: ChordType[] = ["Major", "Minor", "Minor", "Major", "Major", "Minor", "Diminished"];
const minorTypes: ChordType[] = ["Minor", "Diminished", "Major", "Minor", "Major", "Major", "Major"];

const majorCadences: Record<number, number[]> = {
  0: [3, 4, 5, 1],
  1: [4, 3, 6],
  2: [5, 3],
  3: [4, 0, 1],
  4: [0, 5],
  5: [3, 1, 4, 0],
  6: [0],
};

const minorCadences: Record<number, number[]> = {
  0: [3, 4, 5, 2],
  1: [4, 0],
  2: [5, 3, 6],
  3: [4, 0, 5],
  4: [0, 5],
  5: [3, 4, 2],
  6: [2, 0],
};

export const foundationKeys: FoundationKey[] = [
  { id: "C-Major", label: "C Major", root: "C", quality: "Major", scaleMode: "Major", preferFlats: false, scaleNames: ["C", "D", "E", "F", "G", "A", "B"] },
  { id: "A-Minor", label: "A Minor", root: "A", quality: "Minor", scaleMode: "Natural Minor", preferFlats: false, scaleNames: ["A", "B", "C", "D", "E", "F", "G"] },
  { id: "F#-Major", label: "F# Major", root: "F#", quality: "Major", scaleMode: "Major", preferFlats: false, scaleNames: ["F#", "G#", "A#", "B", "C#", "D#", "E#"] },
  { id: "Eb-Minor", label: "Eb Minor", root: "D#", quality: "Minor", scaleMode: "Natural Minor", preferFlats: true, scaleNames: ["Eb", "F", "Gb", "Ab", "Bb", "Cb", "Db"] },
  { id: "Eb-Major", label: "Eb Major", root: "D#", quality: "Major", scaleMode: "Major", preferFlats: true, scaleNames: ["Eb", "F", "G", "Ab", "Bb", "C", "D"] },
  { id: "Bb-Major", label: "Bb Major", root: "A#", quality: "Major", scaleMode: "Major", preferFlats: true, scaleNames: ["Bb", "C", "D", "Eb", "F", "G", "A"] },
  { id: "D-Major", label: "D Major", root: "D", quality: "Major", scaleMode: "Major", preferFlats: false, scaleNames: ["D", "E", "F#", "G", "A", "B", "C#"] },
  { id: "E-Minor", label: "E Minor", root: "E", quality: "Minor", scaleMode: "Natural Minor", preferFlats: false, scaleNames: ["E", "F#", "G", "A", "B", "C", "D"] },
];

export const foundationChordTypes: ChordType[] = ["Major", "Minor", "Sus2", "Sus4", "Diminished", "Augmented", "Power"];
export const foundationExtensions: FoundationExtension[] = ["None", "6", "7", "Maj7", "Add9", "9"];

export const extensionToModifiers = (extension: FoundationExtension): ChordModifier[] =>
  extension === "None" ? [] : [extension];

export const extensionFromModifiers = (modifiers: ChordModifier[]): FoundationExtension => {
  const found = foundationExtensions.find((extension) => extension !== "None" && modifiers.includes(extension as ChordModifier));
  return found ?? "None";
};

export const noteNameForPitch = (pitch: number, preferFlats = false) =>
  (preferFlats ? flatNames : sharpNames)[normalizePitch(pitch)];

export const readableRootName = (note: NoteName, preferFlats = false) => noteNameForPitch(noteToPitch(note), preferFlats);

export const readableMidiName = (midi: number, preferFlats = false) => {
  const octave = Math.floor(midi / 12) - 1;
  return `${noteNameForPitch(midi, preferFlats)}${octave}`;
};

export const defaultFlatForPitch = (pitch: number) => [3, 8, 10].includes(normalizePitch(pitch));

export const chordDisplayName = (chord: ChordResult, preferFlats = false) => {
  const root = noteNameForPitch(noteToPitch(chord.root), preferFlats || defaultFlatForPitch(noteToPitch(chord.root)));
  const extension = extensionFromModifiers(chord.modifiers);
  if (chord.type === "Major") {
    if (extension === "7") return `${root}7`;
    if (extension === "Maj7") return `${root} MAJ7`;
    if (extension === "Add9") return `${root} ADD9`;
    if (extension === "6") return `${root} 6`;
    if (extension === "9") return `${root}9`;
    return `${root} MAJOR`;
  }
  if (chord.type === "Minor") {
    if (extension === "7") return `${root} MIN7`;
    if (extension === "Add9") return `${root} MIN ADD9`;
    if (extension === "6") return `${root} MIN6`;
    if (extension === "9") return `${root} MIN9`;
    if (extension === "Maj7") return `${root} MIN MAJ7`;
    return `${root} MINOR`;
  }
  const typeName: Record<ChordType, string> = {
    Major: "MAJOR",
    Minor: "MINOR",
    Sus2: "SUS2",
    Sus4: "SUS4",
    Diminished: "DIM",
    Augmented: "AUG",
    Power: "POWER",
  };
  return `${root} ${typeName[chord.type]}${extension === "None" ? "" : ` ${extension.toUpperCase()}`}`;
};

export const outputNoteText = (notes: number[], preferFlats = false) =>
  notes.map((note) => readableMidiName(note, preferFlats)).join(" ");

export const getDegreeInfos = (key: FoundationKey): DegreeInfo[] => {
  const rootPitch = noteToPitch(key.root);
  const intervals = key.quality === "Major" ? majorIntervals : minorIntervals;
  const romans = key.quality === "Major" ? majorRomans : minorRomans;
  const types = key.quality === "Major" ? majorTypes : minorTypes;
  return intervals.map((interval, index) => {
    const pitch = normalizePitch(rootPitch + interval);
    return {
      pitch,
      noteName: key.scaleNames?.[index] ?? noteNameForPitch(pitch, key.preferFlats),
      degree: index + 1,
      roman: romans[index],
      chordType: types[index],
    };
  });
};

export const degreeForRoot = (root: NoteName, key: FoundationKey) =>
  getDegreeInfos(key).find((degree) => degree.pitch === noteToPitch(root));

export const cadenceSuggestionsForDegree = (key: FoundationKey, degree?: DegreeInfo, phraseStep = 1): CadenceSuggestion[] => {
  if (!degree) return [];
  const degrees = getDegreeInfos(key);
  if (phraseStep >= 4) return [];
  if (phraseStep === 3) {
    return [{ degree: degrees[0], strength: "primary" }];
  }
  const paths = key.quality === "Major" ? majorCadences : minorCadences;
  const nextIndexes = paths[degree.degree - 1] ?? [];
  return nextIndexes.slice(0, 4).map((index, order) => ({
    degree: degrees[index],
    strength: order === 0 ? "primary" : "secondary",
  }));
};

export const phraseStepFromDegrees = (degreeHistory: DegreeInfo[]) =>
  degreeHistory.length === 0 ? 0 : ((degreeHistory.length - 1) % 4) + 1;

export const chromaticKeyLabel = (note: NoteName, preferFlats = false) => {
  const pitch = noteToPitch(note);
  if ([1, 3, 6, 8, 10].includes(pitch)) {
    const sharp = sharpNames[pitch];
    const flat = flatNames[pitch];
    return preferFlats ? flat : sharp;
  }
  return pitchToNote(pitch);
};

export const setEquals = (actual: string[], expected: string[]) =>
  actual.length === expected.length && actual.every((item, index) => item === expected[index]);

export const formatPitchList = (midiNotes: number[], preferFlats = false) =>
  midiNotes.map((midi) => noteNameForPitch(midi, preferFlats));
