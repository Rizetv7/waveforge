import type {
  ChordModifier,
  ChordResult,
  ChordType,
  HarmonyAlternative,
  HarmonyPathMode,
  HarmonySuggestion,
  NoteName,
  ScaleMode,
} from "../types";
import { buildChord, NOTE_NAMES, normalizePitch, noteToPitch, pitchToNote } from "./musicTheory";

const majorScale = [0, 2, 4, 5, 7, 9, 11];
const minorScale = [0, 2, 3, 5, 7, 8, 10];

interface DegreeTemplate {
  interval: number;
  roman: string;
  type: ChordType;
}

interface CandidateVariant {
  chordType: ChordType;
  modifiers: ChordModifier[];
  roman: string;
  role: HarmonySuggestion["role"];
  keyFit: number;
  cadence: number;
  colour: number;
  borrowed: number;
  reason: string;
}

const majorDegrees: DegreeTemplate[] = [
  { interval: 0, roman: "I", type: "Major" },
  { interval: 2, roman: "ii", type: "Minor" },
  { interval: 4, roman: "iii", type: "Minor" },
  { interval: 5, roman: "IV", type: "Major" },
  { interval: 7, roman: "V", type: "Major" },
  { interval: 9, roman: "vi", type: "Minor" },
  { interval: 11, roman: "vii°", type: "Diminished" },
];

const minorDegrees: DegreeTemplate[] = [
  { interval: 0, roman: "i", type: "Minor" },
  { interval: 2, roman: "ii°", type: "Diminished" },
  { interval: 3, roman: "III", type: "Major" },
  { interval: 5, roman: "iv", type: "Minor" },
  { interval: 7, roman: "V", type: "Major" },
  { interval: 8, roman: "VI", type: "Major" },
  { interval: 10, roman: "VII", type: "Major" },
];

const majorCadence: Record<number, Record<number, number>> = {
  0: { 4: 1, 3: 0.92, 5: 0.82, 1: 0.72 },
  1: { 4: 0.98, 3: 0.7, 6: 0.52, 0: 0.62 },
  2: { 5: 0.86, 3: 0.68, 4: 0.58 },
  3: { 4: 0.94, 0: 0.86, 1: 0.68 },
  4: { 0: 1, 5: 0.66, 3: 0.56 },
  5: { 3: 0.94, 1: 0.84, 4: 0.82, 0: 0.72 },
  6: { 0: 0.98, 4: 0.58 },
};

const minorCadence: Record<number, Record<number, number>> = {
  0: { 3: 0.95, 4: 1, 5: 0.82, 2: 0.68 },
  1: { 4: 0.98, 0: 0.78 },
  2: { 5: 0.88, 3: 0.76, 6: 0.66 },
  3: { 4: 0.96, 0: 0.86, 5: 0.64 },
  4: { 0: 1, 5: 0.68 },
  5: { 3: 0.86, 4: 0.76, 2: 0.62 },
  6: { 2: 0.84, 0: 0.72 },
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const displayNameFor = (root: NoteName, chordType: ChordType, modifiers: ChordModifier[]) => {
  const has = (modifier: ChordModifier) => modifiers.includes(modifier);
  if (chordType === "Minor") {
    if (has("7")) return `${root}m7`;
    if (has("Add9")) return `${root}m add9`;
    return `${root}m`;
  }
  if (chordType === "Diminished") return `${root}dim`;
  if (chordType === "Sus2") return `${root}sus2`;
  if (chordType === "Sus4") return `${root}sus4`;
  if (chordType === "Augmented") return `${root}aug`;
  if (chordType === "Power") return `${root}5`;
  if (has("7")) return `${root}7`;
  if (has("Maj7")) return `${root}maj7`;
  if (has("Add9")) return `${root}add9`;
  if (has("6")) return `${root}6`;
  return root;
};

const makeAlternative = (root: NoteName, chordType: ChordType, modifiers: ChordModifier[]): HarmonyAlternative => ({
  chordType,
  modifiers,
  displayName: displayNameFor(root, chordType, modifiers),
});

const inferKeyPitch = (current: ChordResult | null, history: ChordResult[], keyRoot: NoteName, keyModeEnabled: boolean) => {
  if (keyModeEnabled) return noteToPitch(keyRoot);
  const recent = [...history.slice(-4), ...(current ? [current] : [])];
  if (!recent.length) return noteToPitch(keyRoot);

  const scores = NOTE_NAMES.map((_, keyPitch) => {
    let score = 0;
    recent.forEach((chord, index) => {
      const interval = normalizePitch(noteToPitch(chord.root) - keyPitch);
      const weight = index + 1;
      if (majorScale.includes(interval)) score += weight * 1.8;
      if ([0, 5, 7, 9].includes(interval)) score += weight;
      if (interval === 0) score += weight * 1.3;
    });
    return score;
  });
  return scores.reduce((best, score, index) => (score > scores[best] ? index : best), 0);
};

const degreeIndexForPitch = (pitch: number, keyPitch: number, minorContext: boolean) => {
  const scale = minorContext ? minorScale : majorScale;
  return scale.indexOf(normalizePitch(pitch - keyPitch));
};

const voiceScore = (
  currentChord: ChordResult | null,
  rootName: NoteName,
  chordType: ChordType,
  modifiers: ChordModifier[],
  keyRoot: NoteName,
  scaleMode: ScaleMode,
  keyModeEnabled: boolean,
  spread: number,
) => {
  if (!currentChord) return 0.5;
  const candidateChord = buildChord({
    inputRoot: rootName,
    chordType,
    modifiers,
    keyRoot,
    scaleMode,
    keyModeEnabled,
    spread,
    motion: 0,
  });
  const currentPitches = new Set(currentChord.midiNotes.map((midi) => normalizePitch(midi)));
  const candidatePitches = candidateChord.midiNotes.map((midi) => normalizePitch(midi));
  const shared = candidatePitches.filter((pitch) => currentPitches.has(pitch)).length / Math.max(1, candidatePitches.length);
  const currentCenter = currentChord.midiNotes.reduce((sum, midi) => sum + midi, 0) / currentChord.midiNotes.length;
  const candidateCenter = candidateChord.midiNotes.reduce((sum, midi) => sum + midi, 0) / candidateChord.midiNotes.length;
  const centerScore = 1 - Math.min(1, Math.abs(candidateCenter - currentCenter) / 18);
  return clamp01(shared * 0.58 + centerScore * 0.42);
};

const preferredDiatonicVariant = (degreeIndex: number, degree: DegreeTemplate, pathMode: HarmonyPathMode, minorContext: boolean): CandidateVariant => {
  const isDominant = degreeIndex === 4;
  const modifiers: ChordModifier[] = [];
  let chordType = degree.type;

  if (isDominant) {
    chordType = "Major";
    modifiers.push("7");
  } else if (pathMode !== "SAFE") {
    if (chordType === "Major") modifiers.push("Maj7");
    if (chordType === "Minor") modifiers.push("7");
  }

  const romanSuffix = modifiers.includes("Maj7")
    ? "maj7"
    : modifiers.includes("7")
      ? "7"
      : modifiers.includes("Add9")
        ? "add9"
        : "";

  return {
    chordType,
    modifiers,
    roman: `${degree.roman}${romanSuffix}`,
    role: isDominant ? "tension" : degreeIndex === 0 ? "resolution" : pathMode === "SAFE" ? "movement" : "colour",
    keyFit: 1,
    cadence: 0.22,
    colour: pathMode === "SAFE" ? 0.18 : modifiers.length ? 0.72 : 0.34,
    borrowed: 0,
    reason: minorContext ? "Minor key degree" : "Major key degree",
  };
};

const alternativesFor = (root: NoteName, primary: CandidateVariant): HarmonyAlternative[] => {
  const alternatives = [makeAlternative(root, primary.chordType, primary.modifiers)];
  if (primary.chordType === "Major") {
    alternatives.push(makeAlternative(root, "Major", ["Add9"]));
    alternatives.push(makeAlternative(root, "Sus2", []));
    alternatives.push(makeAlternative(root, "Major", []));
    alternatives.push(makeAlternative(root, "Minor", []));
  } else if (primary.chordType === "Minor") {
    alternatives.push(makeAlternative(root, "Minor", ["Add9"]));
    alternatives.push(makeAlternative(root, "Sus4", []));
    alternatives.push(makeAlternative(root, "Minor", []));
  } else {
    alternatives.push(makeAlternative(root, primary.chordType, []));
    alternatives.push(makeAlternative(root, "Minor", ["7"]));
  }
  return alternatives.filter((item, index, list) => list.findIndex((candidate) => candidate.displayName === item.displayName) === index);
};

const borrowedVariants = (rootPitch: number, keyPitch: number, minorContext: boolean, pathMode: HarmonyPathMode): CandidateVariant[] => {
  if (pathMode === "SAFE") return [];
  const interval = normalizePitch(rootPitch - keyPitch);
  const variants: CandidateVariant[] = [];

  if (!minorContext && interval === 5) {
    variants.push({
      chordType: "Minor",
      modifiers: [],
      roman: "iv borrowed",
      role: "experimental",
      keyFit: 0.22,
      cadence: 0.54,
      colour: 0.68,
      borrowed: pathMode === "EXPLORE" ? 0.94 : 0.48,
      reason: "Borrowed minor iv",
    });
  }
  if (!minorContext && interval === 10) {
    variants.push({
      chordType: "Major",
      modifiers: ["Maj7"],
      roman: "bVIImaj7",
      role: "experimental",
      keyFit: 0.18,
      cadence: 0.38,
      colour: 0.7,
      borrowed: pathMode === "EXPLORE" ? 0.84 : 0.34,
      reason: "Modal bVII colour",
    });
  }
  if (!minorContext && interval === 4) {
    variants.push({
      chordType: "Major",
      modifiers: ["7"],
      roman: "III7",
      role: "tension",
      keyFit: 0.24,
      cadence: 0.62,
      colour: 0.42,
      borrowed: pathMode === "EXPLORE" ? 0.72 : 0.28,
      reason: "Secondary dominant",
    });
  }
  if (minorContext && interval === 1) {
    variants.push({
      chordType: "Major",
      modifiers: ["Maj7"],
      roman: "bIImaj7",
      role: "experimental",
      keyFit: 0.16,
      cadence: 0.46,
      colour: 0.74,
      borrowed: pathMode === "EXPLORE" ? 0.82 : 0.3,
      reason: "Neapolitan colour",
    });
  }
  return variants;
};

export const getSuggestionVariant = (suggestion: HarmonySuggestion, altIndex = 0): HarmonyAlternative => {
  const variants = suggestion.alternatives.length
    ? suggestion.alternatives
    : [makeAlternative(suggestion.rootName, suggestion.chordType, suggestion.modifiers)];
  return variants[altIndex % variants.length] ?? variants[0];
};

export function createHarmonySuggestions({
  currentChord,
  history,
  keyRoot,
  scaleMode,
  keyModeEnabled,
  pathMode,
  spread = 0,
}: {
  currentChord: ChordResult | null;
  history: ChordResult[];
  keyRoot: NoteName;
  scaleMode: ScaleMode;
  keyModeEnabled: boolean;
  pathMode: HarmonyPathMode;
  spread?: number;
}): HarmonySuggestion[] {
  if (!currentChord) return [];
  const keyPitch = inferKeyPitch(currentChord, history, keyRoot, keyModeEnabled);
  const minorContext = scaleMode.includes("Minor");
  const degrees = minorContext ? minorDegrees : majorDegrees;
  const currentDegree = degreeIndexForPitch(noteToPitch(currentChord.root), keyPitch, minorContext);
  const cadenceTable = minorContext ? minorCadence : majorCadence;
  const currentCadences = currentDegree >= 0 ? cadenceTable[currentDegree] ?? {} : {};
  const recentRoots = history.slice(-4).map((chord) => noteToPitch(chord.root));

  return NOTE_NAMES.map((_, rootPitch) => {
    const rootName = pitchToNote(rootPitch);
    const degreeIndex = degreeIndexForPitch(rootPitch, keyPitch, minorContext);
    const variants: CandidateVariant[] = [];

    if (degreeIndex >= 0) {
      const primary = preferredDiatonicVariant(degreeIndex, degrees[degreeIndex], pathMode, minorContext);
      primary.cadence = Math.max(primary.cadence, currentCadences[degreeIndex] ?? 0.18);
      variants.push(primary);
    }

    variants.push(...borrowedVariants(rootPitch, keyPitch, minorContext, pathMode));

    if (!variants.length) {
      variants.push({
        chordType: "Major",
        modifiers: [],
        roman: "",
        role: "experimental",
        keyFit: pathMode === "EXPLORE" ? 0.16 : 0.04,
        cadence: 0.04,
        colour: 0.08,
        borrowed: pathMode === "EXPLORE" ? 0.12 : 0.02,
        reason: "Low-fit chromatic option",
      });
    }

    const scored = variants.map((variant) => {
      const voice = voiceScore(currentChord, rootName, variant.chordType, variant.modifiers, keyRoot, scaleMode, false, spread);
      const repetitionPenalty = recentRoots.includes(rootPitch) ? 0.14 : 0;
      const sameRootPenalty = rootPitch === noteToPitch(currentChord.root) ? 0.18 : 0;
      const pathScale = pathMode === "SAFE" && variant.borrowed > 0 ? 0.55 : pathMode === "EXPLORE" && variant.borrowed > 0 ? 1.16 : 1;
      const raw =
        variant.keyFit * 0.28 +
        variant.cadence * 0.34 +
        voice * 0.18 +
        variant.colour * 0.12 +
        variant.borrowed * 0.18 -
        repetitionPenalty -
        sameRootPenalty;
      return { ...variant, score: clamp01(raw * pathScale) };
    });

    const best = scored.reduce((winner, item) => (item.score > winner.score ? item : winner), scored[0]);
    const alternatives = alternativesFor(rootName, best);
    variants
      .filter((variant) => variant !== best)
      .forEach((variant) => alternatives.push(makeAlternative(rootName, variant.chordType, variant.modifiers)));

    return {
      id: `${pathMode}:${rootPitch}:${best.roman || "chromatic"}`,
      rootMidiClass: rootPitch,
      rootName,
      chordType: best.chordType,
      modifiers: best.modifiers,
      displayName: displayNameFor(rootName, best.chordType, best.modifiers),
      romanNumeral: best.roman,
      role: best.role,
      confidence: best.score,
      reason: best.reason,
      alternatives: alternatives.filter((item, index, list) => list.findIndex((candidate) => candidate.displayName === item.displayName) === index),
    };
  }).sort((a, b) => b.confidence - a.confidence);
}
