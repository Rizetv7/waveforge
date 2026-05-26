import type {
  ChordModifier,
  ChordResult,
  ChordType,
  HarmonyAlternative,
  HarmonyPathMode,
  HarmonySuggestion,
  NoteName,
  PhraseStatus,
  PhraseStep,
  ScaleMode,
} from "../types";
import { CURATED_LOOP_TEMPLATES, type DreamLoopChordTemplate, type DreamLoopTemplate } from "./dreamLoopTemplates";
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

interface PhraseContext {
  currentStep: PhraseStep;
  chords: Array<ChordResult | null>;
  status?: PhraseStatus;
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

const chordPitch = (chord: ChordResult | null | undefined) => (chord ? noteToPitch(chord.root) : -1);

const includesColourTone = (variant: CandidateVariant) =>
  variant.modifiers.includes("Maj7") || variant.modifiers.includes("7") || variant.modifiers.includes("Add9");

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

const loopReturnFit = (rootPitch: number, variant: CandidateVariant, firstChord: ChordResult | null, minorContext: boolean) => {
  if (!firstChord) return 0;
  const targetInterval = normalizePitch(chordPitch(firstChord) - rootPitch);
  const dominantColour = variant.modifiers.includes("7") || variant.roman.includes("V");
  const firstIsMinor = firstChord.type === "Minor" || minorContext;

  if (targetInterval === 5) return dominantColour ? 1 : 0.86;
  if (targetInterval === 0) return 0.82;
  if (targetInterval === 7) return firstIsMinor ? 0.58 : 0.66;
  if (targetInterval === 2) return 0.56;
  if (targetInterval === 10) return 0.48;
  return variant.role === "experimental" ? 0.36 : 0.22;
};

type LoopChordSpec = DreamLoopChordTemplate;
type LoopTemplate = DreamLoopTemplate;

interface ResolvedLoopChord {
  rootPitch: number;
  rootName: NoteName;
  variant: CandidateVariant;
}

interface LoopScoreBreakdown {
  score: number;
  completeTemplateFit: number;
  transitionQuality: number;
  loopClosureQuality: number;
  voiceLeadingQuality: number;
  dreamColourQuality: number;
}

interface CompleteLoopScoreOptions {
  keyRoot: NoteName;
  scaleMode: ScaleMode;
  keyModeEnabled?: boolean;
  pathMode: HarmonyPathMode;
  spread?: number;
}

const majorLoopTemplates = [
  {
    id: "dream-I-IV-vi-V",
    modes: ["DREAM", "EXPLORE"],
    minor: false,
    weight: 1,
    chords: [
      { degreeIndex: 0, chordType: "Major", modifiers: ["Maj7"], roman: "Imaj7", role: "resolution" },
      { degreeIndex: 3, chordType: "Major", modifiers: ["Maj7"], roman: "IVmaj7", role: "colour" },
      { degreeIndex: 5, chordType: "Minor", modifiers: ["7"], roman: "vi7", role: "colour" },
      { degreeIndex: 4, chordType: "Major", modifiers: ["7"], roman: "V7", role: "tension" },
    ],
  },
  {
    id: "dream-Iadd9-vi-IV-Vsus",
    modes: ["DREAM", "EXPLORE"],
    minor: false,
    weight: 0.93,
    chords: [
      { degreeIndex: 0, chordType: "Major", modifiers: ["Add9"], roman: "Iadd9", role: "resolution" },
      { degreeIndex: 5, chordType: "Minor", modifiers: ["7"], roman: "vi7", role: "colour" },
      { degreeIndex: 3, chordType: "Major", modifiers: ["Maj7"], roman: "IVmaj7", role: "colour" },
      { degreeIndex: 4, chordType: "Sus4", modifiers: [], roman: "Vsus4", role: "tension" },
    ],
  },
  {
    id: "dream-vi-ii-IV-I",
    modes: ["DREAM", "EXPLORE"],
    minor: false,
    weight: 0.88,
    chords: [
      { degreeIndex: 5, chordType: "Minor", modifiers: ["7"], roman: "vi7", role: "colour" },
      { degreeIndex: 1, chordType: "Minor", modifiers: ["7"], roman: "ii7", role: "movement" },
      { degreeIndex: 3, chordType: "Major", modifiers: ["Maj7"], roman: "IVmaj7", role: "colour" },
      { degreeIndex: 0, chordType: "Major", modifiers: ["Maj7"], roman: "Imaj7", role: "resolution" },
    ],
  },
  {
    id: "dream-I-IV-iv-I",
    modes: ["DREAM", "EXPLORE"],
    minor: false,
    weight: 0.9,
    chords: [
      { degreeIndex: 0, chordType: "Major", modifiers: ["Maj7"], roman: "Imaj7", role: "resolution" },
      { degreeIndex: 3, chordType: "Major", modifiers: ["Maj7"], roman: "IVmaj7", role: "colour" },
      { degreeIndex: 3, chordType: "Minor", modifiers: [], roman: "iv borrowed", role: "experimental" },
      { degreeIndex: 0, chordType: "Major", modifiers: ["Maj7"], roman: "Imaj7", role: "resolution" },
    ],
  },
  {
    id: "dream-I-vi-IV-V",
    modes: ["DREAM", "EXPLORE"],
    minor: false,
    weight: 0.9,
    chords: [
      { degreeIndex: 0, chordType: "Major", modifiers: ["Maj7"], roman: "Imaj7", role: "resolution" },
      { degreeIndex: 5, chordType: "Minor", modifiers: ["7"], roman: "vi7", role: "colour" },
      { degreeIndex: 3, chordType: "Major", modifiers: ["Maj7"], roman: "IVmaj7", role: "colour" },
      { degreeIndex: 4, chordType: "Major", modifiers: ["7"], roman: "V7", role: "tension" },
    ],
  },
  {
    id: "dream-I-iii-IV-iv",
    modes: ["DREAM", "EXPLORE"],
    minor: false,
    weight: 0.86,
    chords: [
      { degreeIndex: 0, chordType: "Major", modifiers: ["Maj7"], roman: "Imaj7", role: "resolution" },
      { degreeIndex: 2, chordType: "Minor", modifiers: ["7"], roman: "iii7", role: "colour" },
      { degreeIndex: 3, chordType: "Major", modifiers: ["Maj7"], roman: "IVmaj7", role: "colour" },
      { degreeIndex: 3, chordType: "Minor", modifiers: [], roman: "iv borrowed", role: "experimental" },
    ],
  },
  {
    id: "dream-vi-IV-I-V",
    modes: ["DREAM", "EXPLORE"],
    minor: false,
    weight: 0.87,
    chords: [
      { degreeIndex: 5, chordType: "Minor", modifiers: ["7"], roman: "vi7", role: "colour" },
      { degreeIndex: 3, chordType: "Major", modifiers: ["Maj7"], roman: "IVmaj7", role: "colour" },
      { degreeIndex: 0, chordType: "Major", modifiers: ["Maj7"], roman: "Imaj7", role: "resolution" },
      { degreeIndex: 4, chordType: "Major", modifiers: ["7"], roman: "V7", role: "tension" },
    ],
  },
  {
    id: "safe-I-IV-vi-V",
    modes: ["SAFE"],
    minor: false,
    weight: 0.96,
    chords: [
      { degreeIndex: 0, chordType: "Major", modifiers: [], roman: "I", role: "resolution" },
      { degreeIndex: 3, chordType: "Major", modifiers: [], roman: "IV", role: "movement" },
      { degreeIndex: 5, chordType: "Minor", modifiers: [], roman: "vi", role: "colour" },
      { degreeIndex: 4, chordType: "Major", modifiers: [], roman: "V", role: "tension" },
    ],
  },
  {
    id: "safe-I-V-vi-IV",
    modes: ["SAFE"],
    minor: false,
    weight: 0.91,
    chords: [
      { degreeIndex: 0, chordType: "Major", modifiers: [], roman: "I", role: "resolution" },
      { degreeIndex: 4, chordType: "Major", modifiers: [], roman: "V", role: "tension" },
      { degreeIndex: 5, chordType: "Minor", modifiers: [], roman: "vi", role: "colour" },
      { degreeIndex: 3, chordType: "Major", modifiers: [], roman: "IV", role: "movement" },
    ],
  },
  {
    id: "safe-vi-IV-I-V",
    modes: ["SAFE"],
    minor: false,
    weight: 0.88,
    chords: [
      { degreeIndex: 5, chordType: "Minor", modifiers: [], roman: "vi", role: "colour" },
      { degreeIndex: 3, chordType: "Major", modifiers: [], roman: "IV", role: "movement" },
      { degreeIndex: 0, chordType: "Major", modifiers: [], roman: "I", role: "resolution" },
      { degreeIndex: 4, chordType: "Major", modifiers: [], roman: "V", role: "tension" },
    ],
  },
  {
    id: "safe-I-IV-V-I",
    modes: ["SAFE"],
    minor: false,
    weight: 0.78,
    chords: [
      { degreeIndex: 0, chordType: "Major", modifiers: [], roman: "I", role: "resolution" },
      { degreeIndex: 3, chordType: "Major", modifiers: [], roman: "IV", role: "movement" },
      { degreeIndex: 4, chordType: "Major", modifiers: ["7"], roman: "V7", role: "tension" },
      { degreeIndex: 0, chordType: "Major", modifiers: [], roman: "I", role: "resolution" },
    ],
  },
  {
    id: "explore-I-bVII-iv-I",
    modes: ["EXPLORE"],
    minor: false,
    weight: 0.76,
    chords: [
      { degreeIndex: 0, chordType: "Major", modifiers: ["Maj7"], roman: "Imaj7", role: "resolution" },
      { interval: 10, chordType: "Major", modifiers: ["Maj7"], roman: "bVIImaj7", role: "experimental" },
      { degreeIndex: 3, chordType: "Minor", modifiers: [], roman: "iv borrowed", role: "experimental" },
      { degreeIndex: 0, chordType: "Major", modifiers: ["Maj7"], roman: "Imaj7", role: "resolution" },
    ],
  },
  {
    id: "explore-I-bVII-IV-iv",
    modes: ["EXPLORE"],
    minor: false,
    weight: 0.74,
    chords: [
      { degreeIndex: 0, chordType: "Major", modifiers: ["Maj7"], roman: "Imaj7", role: "resolution" },
      { interval: 10, chordType: "Major", modifiers: ["Maj7"], roman: "bVIImaj7", role: "experimental" },
      { degreeIndex: 3, chordType: "Major", modifiers: ["Maj7"], roman: "IVmaj7", role: "colour" },
      { degreeIndex: 3, chordType: "Minor", modifiers: [], roman: "iv borrowed", role: "experimental" },
    ],
  },
  {
    id: "explore-I-III7-vi-iv",
    modes: ["EXPLORE"],
    minor: false,
    weight: 0.73,
    chords: [
      { degreeIndex: 0, chordType: "Major", modifiers: ["Maj7"], roman: "Imaj7", role: "resolution" },
      { degreeIndex: 2, chordType: "Major", modifiers: ["7"], roman: "III7", role: "tension" },
      { degreeIndex: 5, chordType: "Minor", modifiers: ["7"], roman: "vi7", role: "colour" },
      { degreeIndex: 3, chordType: "Minor", modifiers: [], roman: "iv borrowed", role: "experimental" },
    ],
  },
  {
    id: "explore-vi-bVI-IV-V",
    modes: ["EXPLORE"],
    minor: false,
    weight: 0.7,
    chords: [
      { degreeIndex: 5, chordType: "Minor", modifiers: ["7"], roman: "vi7", role: "colour" },
      { interval: 8, chordType: "Major", modifiers: ["Maj7"], roman: "bVImaj7", role: "experimental" },
      { degreeIndex: 3, chordType: "Major", modifiers: ["Maj7"], roman: "IVmaj7", role: "colour" },
      { degreeIndex: 4, chordType: "Major", modifiers: ["7"], roman: "V7", role: "tension" },
    ],
  },
];

const minorLoopTemplates = [
  {
    id: "minor-i-iv-V-i",
    modes: ["SAFE", "DREAM", "EXPLORE"],
    minor: true,
    weight: 0.92,
    chords: [
      { degreeIndex: 0, chordType: "Minor", modifiers: ["7"], roman: "i7", role: "resolution" },
      { degreeIndex: 3, chordType: "Minor", modifiers: ["7"], roman: "iv7", role: "colour" },
      { degreeIndex: 4, chordType: "Major", modifiers: ["7"], roman: "V7", role: "tension" },
      { degreeIndex: 0, chordType: "Minor", modifiers: ["7"], roman: "i7", role: "resolution" },
    ],
  },
  {
    id: "minor-i-VI-III-V",
    modes: ["DREAM", "EXPLORE"],
    minor: true,
    weight: 0.84,
    chords: [
      { degreeIndex: 0, chordType: "Minor", modifiers: ["7"], roman: "i7", role: "resolution" },
      { degreeIndex: 5, chordType: "Major", modifiers: ["Maj7"], roman: "VImaj7", role: "colour" },
      { degreeIndex: 2, chordType: "Major", modifiers: ["Maj7"], roman: "IIImaj7", role: "colour" },
      { degreeIndex: 4, chordType: "Major", modifiers: ["7"], roman: "V7", role: "tension" },
    ],
  },
  {
    id: "minor-i-III-VI-V",
    modes: ["DREAM", "EXPLORE"],
    minor: true,
    weight: 0.82,
    chords: [
      { degreeIndex: 0, chordType: "Minor", modifiers: ["7"], roman: "i7", role: "resolution" },
      { degreeIndex: 2, chordType: "Major", modifiers: ["Maj7"], roman: "IIImaj7", role: "colour" },
      { degreeIndex: 5, chordType: "Major", modifiers: ["Maj7"], roman: "VImaj7", role: "colour" },
      { degreeIndex: 4, chordType: "Major", modifiers: ["7"], roman: "V7", role: "tension" },
    ],
  },
];

const sameModifierSet = (a: ChordModifier[], b: ChordModifier[]) =>
  a.length === b.length && a.every((modifier) => b.includes(modifier));

const chordIdentityScore = (chord: ChordResult, resolved: ResolvedLoopChord) => {
  if (noteToPitch(chord.root) !== resolved.rootPitch) return 0;
  let score = 0.62;
  if (chord.type === resolved.variant.chordType) score += 0.24;
  if (sameModifierSet(chord.modifiers, resolved.variant.modifiers)) score += 0.14;
  return clamp01(score);
};

const majorDegreeIntervals: Record<string, number> = {
  I: 0,
  i: 0,
  ii: 2,
  II: 2,
  iii: 4,
  III: 4,
  IV: 5,
  iv: 5,
  V: 7,
  v: 7,
  vi: 9,
  VI: 9,
  vii: 11,
  "vii°": 11,
  bII: 1,
  bVI: 8,
  bVII: 10,
};

const minorDegreeIntervals: Record<string, number> = {
  i: 0,
  I: 0,
  ii: 2,
  "ii°": 2,
  II: 2,
  III: 3,
  iii: 3,
  iv: 5,
  IV: 5,
  V: 7,
  v: 7,
  VI: 8,
  vi: 8,
  VII: 10,
  vii: 10,
  bII: 1,
  bVI: 8,
  bVII: 10,
};

const degreeIntervalFor = (degree: string, minorContext: boolean) => {
  const lookup = minorContext ? minorDegreeIntervals : majorDegreeIntervals;
  return lookup[degree] ?? lookup[degree.replace(/maj7|add9|sus4|sus2|7|6|°/gi, "")] ?? 0;
};

const resolveLoopSpec = (spec: LoopChordSpec, keyPitch: number, degrees: DegreeTemplate[]): ResolvedLoopChord => {
  const minorContext = degrees === minorDegrees;
  const interval = degreeIntervalFor(spec.degree, minorContext);
  const rootPitch = normalizePitch(keyPitch + interval);
  const rootName = pitchToNote(rootPitch);
  return {
    rootPitch,
    rootName,
    variant: {
      chordType: spec.chordType,
      modifiers: spec.modifiers,
      roman: spec.roman,
      role: spec.role,
      keyFit: spec.degree.startsWith("b") ? 0.22 : 1,
      cadence: spec.role === "tension" ? 0.86 : spec.role === "resolution" ? 0.82 : 0.62,
      colour: spec.modifiers.length ? 0.76 : 0.36,
      borrowed: spec.degree.startsWith("b") || spec.roman.includes("iv") && spec.chordType === "Minor" ? 0.72 : 0,
      reason: "Four-step loop family",
    },
  };
};

const transitionQuality = (from: ResolvedLoopChord, to: ResolvedLoopChord, minorContext: boolean) => {
  const interval = normalizePitch(to.rootPitch - from.rootPitch);
  if (interval === 5 || interval === 7) return 0.86;
  if ([2, 3, 4, 9, 10].includes(interval)) return 0.74;
  if (interval === 0) return 0.52;
  if (minorContext && interval === 8) return 0.7;
  return 0.44;
};

const availableLoopTemplates = (pathMode: HarmonyPathMode, minorContext: boolean) =>
  CURATED_LOOP_TEMPLATES.filter((template) => {
    const contextMatches = minorContext ? template.scaleContext === "minor" : template.scaleContext === "major";
    if (!contextMatches) return false;
    if (template.modes.includes(pathMode)) return true;
    return pathMode === "EXPLORE" && template.modes.includes("DREAM");
  });

const variantFromChord = (chord: ChordResult): CandidateVariant => {
  const role: HarmonySuggestion["role"] = chord.modifiers.includes("7")
    ? "tension"
    : chord.modifiers.includes("Maj7") || chord.modifiers.includes("Add9")
      ? "colour"
      : chord.type === "Diminished"
        ? "tension"
        : "movement";
  return {
    chordType: chord.type,
    modifiers: chord.modifiers,
    roman: "",
    role,
    keyFit: 0.72,
    cadence: role === "tension" ? 0.78 : role === "colour" ? 0.66 : 0.52,
    colour: includesColourTone({ modifiers: chord.modifiers } as CandidateVariant) ? 0.82 : chord.type === "Sus4" || chord.type === "Sus2" ? 0.7 : 0.42,
    borrowed: 0,
    reason: "Played chord",
  };
};

const resolvedToChord = (
  resolved: ResolvedLoopChord,
  keyRoot: NoteName,
  scaleMode: ScaleMode,
  spread: number,
) => buildChord({
  inputRoot: resolved.rootName,
  chordType: resolved.variant.chordType,
  modifiers: resolved.variant.modifiers,
  keyRoot,
  scaleMode,
  keyModeEnabled: false,
  spread,
  motion: 0,
});

const voiceLeadingBetween = (from: ChordResult, to: ChordResult) => {
  const fromPitches = from.midiNotes.map((midi) => normalizePitch(midi));
  const toPitches = to.midiNotes.map((midi) => normalizePitch(midi));
  const shared = toPitches.filter((pitch) => fromPitches.includes(pitch)).length / Math.max(1, toPitches.length);
  const movement = toPitches.reduce((sum, pitch) => {
    const closest = Math.min(...fromPitches.map((fromPitch) => {
      const distance = Math.abs(pitch - fromPitch);
      return Math.min(distance, 12 - distance);
    }));
    return sum + closest;
  }, 0) / Math.max(1, toPitches.length);
  const movementScore = 1 - Math.min(1, movement / 6);
  const fromCenter = from.midiNotes.reduce((sum, midi) => sum + midi, 0) / from.midiNotes.length;
  const toCenter = to.midiNotes.reduce((sum, midi) => sum + midi, 0) / to.midiNotes.length;
  const centerScore = 1 - Math.min(1, Math.abs(toCenter - fromCenter) / 18);
  return clamp01(shared * 0.42 + movementScore * 0.38 + centerScore * 0.2);
};

const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

const dreamColourScore = (resolved: [ResolvedLoopChord, ResolvedLoopChord, ResolvedLoopChord, ResolvedLoopChord], pathMode: HarmonyPathMode) => {
  const scores = resolved.map((item, index) => {
    const { chordType, modifiers, roman } = item.variant;
    if (pathMode === "SAFE") return item.variant.borrowed > 0 ? 0.12 : modifiers.length ? 0.46 : 0.74;
    if (roman.includes("iv borrowed")) return index >= 2 ? 0.86 : 0.46;
    if (modifiers.includes("Maj7")) return 0.95;
    if (chordType === "Minor" && modifiers.includes("7")) return 0.9;
    if (modifiers.includes("Add9")) return 0.92;
    if (chordType === "Sus2" || chordType === "Sus4") return 0.78;
    if (modifiers.includes("7")) return index === 3 ? 0.84 : 0.58;
    return pathMode === "EXPLORE" ? 0.56 : 0.42;
  });
  return clamp01(average(scores));
};

const scoreResolvedLoop = ({
  resolved,
  templateWeight,
  keyRoot,
  scaleMode,
  pathMode,
  spread,
  minorContext,
  templateMatch = 1,
}: {
  resolved: [ResolvedLoopChord, ResolvedLoopChord, ResolvedLoopChord, ResolvedLoopChord];
  templateWeight: number;
  keyRoot: NoteName;
  scaleMode: ScaleMode;
  pathMode: HarmonyPathMode;
  spread: number;
  minorContext: boolean;
  templateMatch?: number;
}): LoopScoreBreakdown => {
  const chords = resolved.map((item) => resolvedToChord(item, keyRoot, scaleMode, spread)) as [ChordResult, ChordResult, ChordResult, ChordResult];
  const completeTemplateFit = clamp01(templateWeight * templateMatch);
  const transitionValues = [
    transitionQuality(resolved[0], resolved[1], minorContext),
    transitionQuality(resolved[1], resolved[2], minorContext),
    transitionQuality(resolved[2], resolved[3], minorContext),
  ];
  const transitionScore = clamp01(average(transitionValues));
  const returnFit = loopReturnFit(resolved[3].rootPitch, resolved[3].variant, chords[0], minorContext);
  const returnTransition = transitionQuality(resolved[3], resolved[0], minorContext);
  const loopClosureQuality = clamp01(returnFit * 0.62 + returnTransition * 0.38);
  const voiceLeadingQuality = clamp01(average([
    voiceLeadingBetween(chords[0], chords[1]),
    voiceLeadingBetween(chords[1], chords[2]),
    voiceLeadingBetween(chords[2], chords[3]),
    voiceLeadingBetween(chords[3], chords[0]),
  ]));
  const colourQuality = dreamColourScore(resolved, pathMode);
  const score = clamp01(
    completeTemplateFit * 0.4 +
    transitionScore * 0.18 +
    loopClosureQuality * 0.2 +
    voiceLeadingQuality * 0.12 +
    colourQuality * 0.1,
  );
  return {
    score,
    completeTemplateFit,
    transitionQuality: transitionScore,
    loopClosureQuality,
    voiceLeadingQuality,
    dreamColourQuality: colourQuality,
  };
};

export function scoreCompleteFourChordLoop(
  chords: [ChordResult, ChordResult, ChordResult, ChordResult],
  {
    keyRoot,
    scaleMode,
    keyModeEnabled = true,
    pathMode,
    spread = 0,
  }: CompleteLoopScoreOptions,
) {
  const keyPitch = inferKeyPitch(chords[0], chords, keyRoot, keyModeEnabled);
  const minorContext = scaleMode.includes("Minor");
  const degrees = minorContext ? minorDegrees : majorDegrees;
  const resolved = chords.map((chord) => ({
    rootPitch: noteToPitch(chord.root),
    rootName: chord.root,
    variant: variantFromChord(chord),
  })) as [ResolvedLoopChord, ResolvedLoopChord, ResolvedLoopChord, ResolvedLoopChord];
  const templates = availableLoopTemplates(pathMode, minorContext);
  const templateMatch = templates.length
    ? Math.max(...templates.map((template) => {
        const templateResolved = template.chords.map((spec) => resolveLoopSpec(spec, keyPitch, degrees)) as [
          ResolvedLoopChord,
          ResolvedLoopChord,
          ResolvedLoopChord,
          ResolvedLoopChord,
        ];
        const identity = average(chords.map((chord, index) => chordIdentityScore(chord, templateResolved[index])));
        return identity * template.weight * template.quality;
      }))
    : 0.34;
  return scoreResolvedLoop({
    resolved,
    templateWeight: Math.max(0.34, templateMatch),
    keyRoot,
    scaleMode,
    pathMode,
    spread,
    minorContext,
    templateMatch: 1,
  }).score;
}

export function resolveCuratedLoopTemplate(
  template: DreamLoopTemplate,
  {
    keyRoot,
    scaleMode,
    spread = 0,
  }: {
    keyRoot: NoteName;
    scaleMode: ScaleMode;
    spread?: number;
  },
): [ChordResult, ChordResult, ChordResult, ChordResult] {
  const keyPitch = noteToPitch(keyRoot);
  const minorContext = scaleMode.includes("Minor");
  const degrees = minorContext ? minorDegrees : majorDegrees;
  return template.chords
    .map((spec) => resolvedToChord(resolveLoopSpec(spec, keyPitch, degrees), keyRoot, scaleMode, spread)) as [
      ChordResult,
      ChordResult,
      ChordResult,
      ChordResult,
    ];
}

const completeLoopFits = ({
  phrase,
  rootPitch,
  keyPitch,
  degrees,
  pathMode,
  minorContext,
  keyRoot,
  scaleMode,
  spread,
}: {
  phrase?: PhraseContext;
  rootPitch: number;
  keyPitch: number;
  degrees: DegreeTemplate[];
  pathMode: HarmonyPathMode;
  minorContext: boolean;
  keyRoot: NoteName;
  scaleMode: ScaleMode;
  spread: number;
}) => {
  if (!phrase || phrase.status === "LOOP_FOLLOW") return [];
  const targetIndex = phrase.currentStep - 1;
  return availableLoopTemplates(pathMode, minorContext).flatMap((template) => {
    const resolved = template.chords.map((spec) => resolveLoopSpec(spec, keyPitch, degrees)) as [
      ResolvedLoopChord,
      ResolvedLoopChord,
      ResolvedLoopChord,
      ResolvedLoopChord,
    ];
    const target = resolved[targetIndex];
    if (target.rootPitch !== rootPitch) return [];

    let filledScore = 1;
    const minimumSlotMatch = pathMode === "DREAM" ? 0.74 : pathMode === "SAFE" ? 0.8 : 0.62;
    for (let index = 0; index < phrase.chords.length; index += 1) {
      const chord = phrase.chords[index];
      if (!chord || index === targetIndex) continue;
      const match = chordIdentityScore(chord, resolved[index]);
      if (match < minimumSlotMatch) return [];
      filledScore *= match;
    }

    const previous = resolved[(targetIndex + 3) % 4];
    const next = resolved[(targetIndex + 1) % 4];
    const transition = phrase.currentStep === 1 && phrase.chords.every((chord) => !chord)
      ? 0.76
      : transitionQuality(previous, target, minorContext);
    const loopScore = scoreResolvedLoop({
      resolved,
      templateWeight: template.weight * template.quality,
      keyRoot,
      scaleMode,
      pathMode,
      spread,
      minorContext,
      templateMatch: filledScore,
    });
    const returnScore = loopScore.loopClosureQuality;
    const completionContinuity = transitionQuality(target, next, minorContext);
    const style = template.weight * template.quality;
    const completeQuality = clamp01(loopScore.score * 0.84 + transition * 0.08 + completionContinuity * 0.04 + returnScore * 0.04);

    return [{
      template,
      target,
      completeQuality,
      style,
      transition,
      returnScore,
    }];
  }).sort((a, b) => b.completeQuality - a.completeQuality);
};

const lockedLoopSuggestions = ({
  phrase,
  pathMode,
}: {
  phrase: PhraseContext;
  pathMode: HarmonyPathMode;
}) => {
  const target = phrase.chords[phrase.currentStep - 1];
  if (!target) return [];
  const targetPitch = noteToPitch(target.root);
  return NOTE_NAMES.map((_, rootPitch) => {
    const rootName = pitchToNote(rootPitch);
    const isTarget = rootPitch === targetPitch;
    const modifiers = isTarget ? target.modifiers : [];
    const chordType = isTarget ? target.type : "Major";
    return {
      id: `${pathMode}:locked:${phrase.currentStep}:${rootPitch}`,
      rootMidiClass: rootPitch,
      rootName,
      chordType,
      modifiers,
      displayName: displayNameFor(rootName, chordType, modifiers),
      romanNumeral: isTarget ? undefined : "",
      role: isTarget ? "resolution" : "movement",
      confidence: isTarget ? 1 : 0.04,
      reason: isTarget ? "Locked four-step loop" : "Loop locked: inactive alternative",
      alternatives: isTarget ? [makeAlternative(rootName, chordType, modifiers)] : [makeAlternative(rootName, "Major", [])],
    } satisfies HarmonySuggestion;
  }).sort((a, b) => b.confidence - a.confidence);
};

const lowVisibilitySuggestion = (pathMode: HarmonyPathMode, rootPitch: number): HarmonySuggestion => {
  const rootName = pitchToNote(rootPitch);
  return {
    id: `${pathMode}:quiet:${rootPitch}`,
    rootMidiClass: rootPitch,
    rootName,
    chordType: "Major",
    modifiers: [],
    displayName: displayNameFor(rootName, "Major", []),
    romanNumeral: "",
    role: "movement",
    confidence: 0.02,
    reason: `${pathMode} hides candidates without a complete curated loop`,
    alternatives: [makeAlternative(rootName, "Major", [])],
  };
};

const createCuratedLoopSuggestions = ({
  currentChord,
  history,
  keyRoot,
  scaleMode,
  keyModeEnabled,
  pathMode,
  spread,
  phrase,
}: {
  currentChord: ChordResult | null;
  history: ChordResult[];
  keyRoot: NoteName;
  scaleMode: ScaleMode;
  keyModeEnabled: boolean;
  pathMode: HarmonyPathMode;
  spread: number;
  phrase?: PhraseContext;
}): HarmonySuggestion[] => {
  const keyPitch = inferKeyPitch(currentChord, history, keyRoot, keyModeEnabled);
  const minorContext = scaleMode.includes("Minor");
  const degrees = minorContext ? minorDegrees : majorDegrees;
  const effectivePhrase = phrase ?? {
    currentStep: 1 as PhraseStep,
    chords: [currentChord, null, null, null],
    status: "BUILDING_PHRASE" as PhraseStatus,
  };

  if (effectivePhrase.status === "LOOP_FOLLOW" && effectivePhrase.chords.every(Boolean)) {
    return lockedLoopSuggestions({ phrase: effectivePhrase, pathMode });
  }

  return NOTE_NAMES.map((_, rootPitch) => {
    const rootName = pitchToNote(rootPitch);
    const loopFits = completeLoopFits({
      phrase: effectivePhrase,
      rootPitch,
      keyPitch,
      degrees,
      pathMode,
      minorContext,
      keyRoot,
      scaleMode,
      spread,
    });
    const strongFits = loopFits.filter((fit) => fit.completeQuality >= (pathMode === "DREAM" ? 0.52 : 0.46));
    const best = strongFits[0];
    if (!best) return lowVisibilitySuggestion(pathMode, rootPitch);

    const alternatives = strongFits
      .map((fit) => makeAlternative(rootName, fit.target.variant.chordType, fit.target.variant.modifiers))
      .filter((item, index, list) => list.findIndex((candidate) => candidate.displayName === item.displayName) === index);
    const primary = best.target.variant;
    if (!alternatives.length) alternatives.push(makeAlternative(rootName, primary.chordType, primary.modifiers));

    return {
      id: `${pathMode}:curated:${effectivePhrase.currentStep}:${rootPitch}:${primary.roman}`,
      rootMidiClass: rootPitch,
      rootName,
      chordType: primary.chordType,
      modifiers: primary.modifiers,
      displayName: displayNameFor(rootName, primary.chordType, primary.modifiers),
      romanNumeral: primary.roman,
      role: primary.role,
      confidence: clamp01(best.completeQuality),
      reason: `${best.template.name}: ${best.template.mood}`,
      alternatives,
    } satisfies HarmonySuggestion;
  }).sort((a, b) => b.confidence - a.confidence);
};

const phrasePositionFit = ({
  phrase,
  rootPitch,
  degreeIndex,
  variant,
  currentDegree,
  keyPitch,
  minorContext,
  cadenceValue,
}: {
  phrase?: PhraseContext;
  rootPitch: number;
  degreeIndex: number;
  variant: CandidateVariant;
  currentDegree: number;
  keyPitch: number;
  minorContext: boolean;
  cadenceValue: number;
}) => {
  if (!phrase) return cadenceValue;
  const interval = normalizePitch(rootPitch - keyPitch);
  const firstChord = phrase.chords[0];

  if (phrase.currentStep === 1) {
    if (degreeIndex === 0) return 0.96;
    if (!minorContext && degreeIndex === 5) return 0.76;
    if (!minorContext && degreeIndex === 3) return 0.72;
    if (minorContext && degreeIndex === 0) return 0.96;
    if (minorContext && degreeIndex === 5) return 0.78;
    if (minorContext && degreeIndex === 2) return 0.7;
    return variant.borrowed > 0 ? 0.24 : 0.42;
  }

  if (phrase.currentStep === 2) {
    if (!minorContext && currentDegree === 0 && [3, 5, 1].includes(degreeIndex)) return degreeIndex === 3 ? 1 : 0.84;
    if (!minorContext && currentDegree === 5 && [3, 1, 4, 0].includes(degreeIndex)) return 0.86;
    if (minorContext && currentDegree === 0 && [3, 4, 5, 2].includes(degreeIndex)) return degreeIndex === 3 || degreeIndex === 4 ? 0.94 : 0.74;
    return Math.max(cadenceValue, variant.keyFit * 0.56 + (includesColourTone(variant) ? 0.18 : 0));
  }

  if (phrase.currentStep === 3) {
    const firstPitch = chordPitch(firstChord);
    const isBorrowedIvFromMajorStart = !minorContext && firstPitch === keyPitch && interval === 5 && variant.chordType === "Minor";
    if (isBorrowedIvFromMajorStart) return 0.92;
    if (!minorContext && [5, 1, 3, 4].includes(degreeIndex)) return degreeIndex === 5 || degreeIndex === 1 ? 0.88 : 0.72;
    if (minorContext && [5, 2, 3, 4].includes(degreeIndex)) return degreeIndex === 5 || degreeIndex === 3 ? 0.86 : 0.72;
    return Math.max(cadenceValue * 0.88, variant.borrowed > 0 ? 0.58 : 0.34);
  }

  const returnFit = loopReturnFit(rootPitch, variant, firstChord, minorContext);
  if (returnFit >= 0.8) return returnFit;
  if (!minorContext && [4, 0, 3].includes(degreeIndex)) return Math.max(returnFit, degreeIndex === 4 ? 0.9 : 0.68);
  if (minorContext && [4, 0, 5].includes(degreeIndex)) return Math.max(returnFit, degreeIndex === 4 ? 0.92 : 0.7);
  return Math.max(returnFit, cadenceValue * 0.72);
};

export const getSuggestionVariant = (suggestion: HarmonySuggestion, altIndex = 0): HarmonyAlternative => {
  const variants = suggestion.alternatives.length
    ? suggestion.alternatives
    : [makeAlternative(suggestion.rootName, suggestion.chordType, suggestion.modifiers)];
  return variants[altIndex % variants.length] ?? variants[0];
};

export function hasCuratedLoopContinuation({
  chord,
  phrase,
  keyRoot,
  scaleMode,
  keyModeEnabled,
  pathMode,
  spread = 0,
}: {
  chord: ChordResult;
  phrase: PhraseContext;
  keyRoot: NoteName;
  scaleMode: ScaleMode;
  keyModeEnabled: boolean;
  pathMode: HarmonyPathMode;
  spread?: number;
}) {
  if (pathMode === "EXPLORE" || phrase.status === "LOOP_FOLLOW") return true;
  const history = phrase.chords.filter(Boolean) as ChordResult[];
  const keyPitch = inferKeyPitch(chord, history, keyRoot, keyModeEnabled);
  const minorContext = scaleMode.includes("Minor");
  const degrees = minorContext ? minorDegrees : majorDegrees;
  const fits = completeLoopFits({
    phrase,
    rootPitch: noteToPitch(chord.root),
    keyPitch,
    degrees,
    pathMode,
    minorContext,
    keyRoot,
    scaleMode,
    spread,
  });
  const minimumSlotMatch = pathMode === "DREAM" ? 0.74 : 0.8;
  return fits.some((fit) => chordIdentityScore(chord, fit.target) >= minimumSlotMatch && fit.completeQuality >= 0.46);
}

export function createHarmonySuggestions({
  currentChord,
  history,
  keyRoot,
  scaleMode,
  keyModeEnabled,
  pathMode,
  spread = 0,
  phrase,
}: {
  currentChord: ChordResult | null;
  history: ChordResult[];
  keyRoot: NoteName;
  scaleMode: ScaleMode;
  keyModeEnabled: boolean;
  pathMode: HarmonyPathMode;
  spread?: number;
  phrase?: PhraseContext;
}): HarmonySuggestion[] {
  if (pathMode === "DREAM" || pathMode === "SAFE") {
    return createCuratedLoopSuggestions({
      currentChord,
      history,
      keyRoot,
      scaleMode,
      keyModeEnabled,
      pathMode,
      spread,
      phrase,
    });
  }
  if (!currentChord) return [];
  const keyPitch = inferKeyPitch(currentChord, history, keyRoot, keyModeEnabled);
  const minorContext = scaleMode.includes("Minor");
  const degrees = minorContext ? minorDegrees : majorDegrees;
  if (phrase?.status === "LOOP_FOLLOW" && phrase.chords.every(Boolean)) {
    return lockedLoopSuggestions({ phrase, pathMode });
  }
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
    const loopFits = completeLoopFits({ phrase, rootPitch, keyPitch, degrees, pathMode, minorContext, keyRoot, scaleMode, spread });
    loopFits.forEach((fit) => {
      if (!variants.some((variant) =>
        variant.chordType === fit.target.variant.chordType && sameModifierSet(variant.modifiers, fit.target.variant.modifiers)
      )) {
        variants.push(fit.target.variant);
      }
    });

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
      const loopFit = loopFits.find((fit) =>
        fit.target.variant.chordType === variant.chordType && sameModifierSet(fit.target.variant.modifiers, variant.modifiers)
      );
      const repetitionPenalty = recentRoots.includes(rootPitch) ? (phrase ? 0.018 : 0.06) : 0;
      const sameRootPenalty = rootPitch === noteToPitch(currentChord.root) ? 0.18 : 0;
      const pathScale = variant.borrowed > 0 ? 1.16 : 1;
      const cadenceValue = currentCadences[degreeIndex] ?? 0.18;
      const phraseFit = phrasePositionFit({
        phrase,
        rootPitch,
        degreeIndex,
        variant,
        currentDegree,
        keyPitch,
        minorContext,
        cadenceValue,
      });
      const returnFit = phrase?.currentStep === 4 ? loopReturnFit(rootPitch, variant, phrase.chords[0], minorContext) : 0;
      const dreamBoost = 0;
      const localRaw =
        variant.keyFit * 0.2 +
        variant.cadence * 0.18 +
        phraseFit * 0.28 +
        returnFit * 0.2 +
        voice * 0.14 +
        variant.colour * 0.1 +
        variant.borrowed * 0.16 +
        dreamBoost -
        repetitionPenalty -
        sameRootPenalty;
      const nonLoopCap = 0.31;
      const guidedRaw = loopFit
        ? loopFit.completeQuality -
          repetitionPenalty * 0.25 -
          sameRootPenalty * 0.16
        : phrase
          ? Math.min(localRaw * 0.42, nonLoopCap)
          : localRaw;
      return { ...variant, score: clamp01(guidedRaw * pathScale) };
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
