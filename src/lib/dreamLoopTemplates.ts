import type { ChordModifier, ChordType, HarmonyPathMode, HarmonySuggestionRole, ScaleMode, VoicingStage } from "../types";

export interface DreamLoopChordTemplate {
  degree: string;
  chordType: ChordType;
  modifiers: ChordModifier[];
  roman: string;
  role: HarmonySuggestionRole;
  preferredVoicing?: VoicingStage;
}

export interface DreamLoopTemplate {
  id: string;
  name: string;
  mood: string;
  scaleContext: "major" | "minor";
  modes: HarmonyPathMode[];
  weight: number;
  quality: number;
  suggestedPreset?: string;
  suggestedArp?: string;
  chords: [DreamLoopChordTemplate, DreamLoopChordTemplate, DreamLoopChordTemplate, DreamLoopChordTemplate];
}

const chord = (
  degree: string,
  chordType: ChordType,
  modifiers: ChordModifier[],
  roman: string,
  role: HarmonySuggestionRole,
  preferredVoicing?: VoicingStage,
): DreamLoopChordTemplate => ({ degree, chordType, modifiers, roman, role, preferredVoicing });

export const SAFE_LOOP_TEMPLATES: DreamLoopTemplate[] = [
  {
    id: "safe-major-axis",
    name: "Simple Axis",
    mood: "stable pop cadence",
    scaleContext: "major",
    modes: ["SAFE"],
    weight: 0.95,
    quality: 0.9,
    chords: [
      chord("I", "Major", [], "I", "resolution", "CLOSE"),
      chord("V", "Major", [], "V", "tension", "CLOSE"),
      chord("vi", "Minor", [], "vi", "colour", "CLOSE"),
      chord("IV", "Major", [], "IV", "movement", "CLOSE"),
    ],
  },
  {
    id: "safe-major-plagal",
    name: "Plain Return",
    mood: "clear home movement",
    scaleContext: "major",
    modes: ["SAFE"],
    weight: 0.88,
    quality: 0.86,
    chords: [
      chord("I", "Major", [], "I", "resolution", "CLOSE"),
      chord("IV", "Major", [], "IV", "movement", "CLOSE"),
      chord("V", "Major", [], "V", "tension", "CLOSE"),
      chord("I", "Major", [], "I", "resolution", "CLOSE"),
    ],
  },
  {
    id: "safe-minor-home",
    name: "Minor Home",
    mood: "simple minor cadence",
    scaleContext: "minor",
    modes: ["SAFE"],
    weight: 0.9,
    quality: 0.86,
    chords: [
      chord("i", "Minor", [], "i", "resolution", "CLOSE"),
      chord("iv", "Minor", [], "iv", "movement", "CLOSE"),
      chord("V", "Major", [], "V", "tension", "CLOSE"),
      chord("i", "Minor", [], "i", "resolution", "CLOSE"),
    ],
  },
  {
    id: "safe-minor-lift",
    name: "Minor Lift",
    mood: "minor to relative major",
    scaleContext: "minor",
    modes: ["SAFE"],
    weight: 0.84,
    quality: 0.82,
    chords: [
      chord("i", "Minor", [], "i", "resolution", "CLOSE"),
      chord("VI", "Major", [], "VI", "colour", "CLOSE"),
      chord("III", "Major", [], "III", "movement", "CLOSE"),
      chord("V", "Major", [], "V", "tension", "CLOSE"),
    ],
  },
];

export const DREAM_LOOP_TEMPLATES: DreamLoopTemplate[] = [
  {
    id: "dream-warm-open",
    name: "Warm Open",
    mood: "open, warm, immediately melodic",
    scaleContext: "major",
    modes: ["DREAM"],
    weight: 1,
    quality: 1,
    suggestedPreset: "WARM POLY",
    suggestedArp: "OFF",
    chords: [
      chord("I", "Major", ["Maj7"], "Imaj7", "resolution", "OPEN"),
      chord("IV", "Major", ["Maj7"], "IVmaj7", "colour", "OPEN"),
      chord("vi", "Minor", ["7"], "vi7", "colour", "AIR"),
      chord("V", "Major", ["7"], "V7", "tension", "CLOSE"),
    ],
  },
  {
    id: "dream-soft-sunset",
    name: "Soft Sunset",
    mood: "gentle descending glow",
    scaleContext: "major",
    modes: ["DREAM"],
    weight: 0.96,
    quality: 0.96,
    suggestedPreset: "TAPE KEYS",
    suggestedArp: "SOFT PULSE",
    chords: [
      chord("I", "Major", ["Add9"], "Iadd9", "resolution", "OPEN"),
      chord("vi", "Minor", ["7"], "vi7", "colour", "OPEN"),
      chord("IV", "Major", ["Maj7"], "IVmaj7", "colour", "AIR"),
      chord("V", "Sus4", [], "Vsus4", "tension", "CLOSE"),
    ],
  },
  {
    id: "dream-floating-home",
    name: "Floating Home",
    mood: "minor-relative lift into home",
    scaleContext: "major",
    modes: ["DREAM"],
    weight: 0.94,
    quality: 0.94,
    suggestedPreset: "DREAM PAD",
    suggestedArp: "DREAM CASCADE",
    chords: [
      chord("vi", "Minor", ["7"], "vi7", "colour", "OPEN"),
      chord("IV", "Major", ["Maj7"], "IVmaj7", "colour", "AIR"),
      chord("I", "Major", ["Maj7"], "Imaj7", "resolution", "WIDE"),
      chord("V", "Major", ["7"], "V7", "tension", "OPEN"),
    ],
  },
  {
    id: "dream-descent",
    name: "Dream Descent",
    mood: "soft inward fall",
    scaleContext: "major",
    modes: ["DREAM"],
    weight: 0.9,
    quality: 0.91,
    suggestedPreset: "WARM POLY",
    suggestedArp: "OFF",
    chords: [
      chord("I", "Major", ["Maj7"], "Imaj7", "resolution", "OPEN"),
      chord("iii", "Minor", ["7"], "iii7", "colour", "OPEN"),
      chord("vi", "Minor", ["7"], "vi7", "colour", "AIR"),
      chord("IV", "Major", ["Maj7"], "IVmaj7", "movement", "OPEN"),
    ],
  },
  {
    id: "dream-emotional-return",
    name: "Emotional Return",
    mood: "borrowed minor iv release",
    scaleContext: "major",
    modes: ["DREAM"],
    weight: 0.92,
    quality: 0.95,
    suggestedPreset: "DREAM PAD",
    suggestedArp: "SLOW STRUM",
    chords: [
      chord("I", "Major", ["Maj7"], "Imaj7", "resolution", "OPEN"),
      chord("IV", "Major", ["Maj7"], "IVmaj7", "colour", "AIR"),
      chord("iv", "Minor", [], "iv", "experimental", "CLOSE"),
      chord("I", "Major", ["Maj7"], "Imaj7", "resolution", "OPEN"),
    ],
  },
  {
    id: "dream-psychedelic-lift",
    name: "Psychedelic Lift",
    mood: "secondary dominant into relative minor",
    scaleContext: "major",
    modes: ["DREAM"],
    weight: 0.84,
    quality: 0.89,
    suggestedPreset: "TAPE KEYS",
    suggestedArp: "SOFT PULSE",
    chords: [
      chord("I", "Major", ["Add9"], "Iadd9", "resolution", "OPEN"),
      chord("III", "Major", ["7"], "III7", "tension", "CLOSE"),
      chord("vi", "Minor", ["7"], "vi7", "colour", "OPEN"),
      chord("IV", "Major", ["Maj7"], "IVmaj7", "colour", "AIR"),
    ],
  },
  {
    id: "dream-late-night",
    name: "Late Night",
    mood: "quiet, circular, late-night harmony",
    scaleContext: "major",
    modes: ["DREAM"],
    weight: 0.88,
    quality: 0.9,
    suggestedPreset: "DREAM PAD",
    suggestedArp: "OFF",
    chords: [
      chord("vi", "Minor", ["7"], "vi7", "colour", "OPEN"),
      chord("ii", "Minor", ["7"], "ii7", "movement", "OPEN"),
      chord("IV", "Major", ["Maj7"], "IVmaj7", "colour", "AIR"),
      chord("I", "Major", ["Maj7"], "Imaj7", "resolution", "WIDE"),
    ],
  },
  {
    id: "dream-suspended-loop",
    name: "Suspended Loop",
    mood: "weightless suspended pop",
    scaleContext: "major",
    modes: ["DREAM"],
    weight: 0.88,
    quality: 0.9,
    suggestedPreset: "WARM POLY",
    suggestedArp: "SOFT PULSE",
    chords: [
      chord("I", "Major", ["Maj7"], "Imaj7", "resolution", "OPEN"),
      chord("V", "Sus4", [], "Vsus4", "tension", "OPEN"),
      chord("vi", "Minor", ["7"], "vi7", "colour", "AIR"),
      chord("IV", "Major", ["Add9"], "IVadd9", "colour", "OPEN"),
    ],
  },
  {
    id: "dream-golden-drift",
    name: "Golden Drift",
    mood: "diatonic, soft forward motion",
    scaleContext: "major",
    modes: ["DREAM"],
    weight: 0.86,
    quality: 0.88,
    chords: [
      chord("I", "Major", ["Maj7"], "Imaj7", "resolution", "OPEN"),
      chord("vi", "Minor", ["7"], "vi7", "colour", "AIR"),
      chord("ii", "Minor", ["7"], "ii7", "movement", "OPEN"),
      chord("V", "Major", ["7"], "V7", "tension", "CLOSE"),
    ],
  },
  {
    id: "dream-plagal-haze",
    name: "Plagal Haze",
    mood: "soft plagal wash",
    scaleContext: "major",
    modes: ["DREAM"],
    weight: 0.86,
    quality: 0.87,
    chords: [
      chord("I", "Major", ["Add9"], "Iadd9", "resolution", "OPEN"),
      chord("IV", "Major", ["Maj7"], "IVmaj7", "colour", "AIR"),
      chord("ii", "Minor", ["7"], "ii7", "movement", "OPEN"),
      chord("V", "Major", ["7"], "V7", "tension", "CLOSE"),
    ],
  },
  {
    id: "dream-cinema-porch",
    name: "Cinema Porch",
    mood: "starts away from home, lands bright",
    scaleContext: "major",
    modes: ["DREAM"],
    weight: 0.82,
    quality: 0.84,
    chords: [
      chord("IV", "Major", ["Maj7"], "IVmaj7", "colour", "OPEN"),
      chord("I", "Major", ["Maj7"], "Imaj7", "resolution", "AIR"),
      chord("V", "Major", ["7"], "V7", "tension", "CLOSE"),
      chord("vi", "Minor", ["7"], "vi7", "colour", "OPEN"),
    ],
  },
  {
    id: "dream-gentle-turn",
    name: "Gentle Turn",
    mood: "intimate circular movement",
    scaleContext: "major",
    modes: ["DREAM"],
    weight: 0.84,
    quality: 0.86,
    chords: [
      chord("I", "Major", ["Maj7"], "Imaj7", "resolution", "OPEN"),
      chord("ii", "Minor", ["7"], "ii7", "movement", "OPEN"),
      chord("vi", "Minor", ["7"], "vi7", "colour", "AIR"),
      chord("IV", "Major", ["Add9"], "IVadd9", "colour", "OPEN"),
    ],
  },
  {
    id: "dream-subtle-rise",
    name: "Subtle Rise",
    mood: "slow lift through colour tones",
    scaleContext: "major",
    modes: ["DREAM"],
    weight: 0.82,
    quality: 0.84,
    chords: [
      chord("ii", "Minor", ["7"], "ii7", "movement", "OPEN"),
      chord("V", "Sus4", [], "Vsus4", "tension", "CLOSE"),
      chord("I", "Major", ["Maj7"], "Imaj7", "resolution", "AIR"),
      chord("IV", "Major", ["Maj7"], "IVmaj7", "colour", "OPEN"),
    ],
  },
  {
    id: "dream-amber-axis",
    name: "Amber Axis",
    mood: "classic axis with softer colour",
    scaleContext: "major",
    modes: ["DREAM"],
    weight: 0.85,
    quality: 0.87,
    chords: [
      chord("I", "Major", ["Maj7"], "Imaj7", "resolution", "OPEN"),
      chord("V", "Major", ["7"], "V7", "tension", "CLOSE"),
      chord("vi", "Minor", ["7"], "vi7", "colour", "AIR"),
      chord("IV", "Major", ["Maj7"], "IVmaj7", "movement", "OPEN"),
    ],
  },
  {
    id: "dream-dark-warm-turn",
    name: "Dark Warm Turn",
    mood: "minor, cinematic, warm return",
    scaleContext: "minor",
    modes: ["DREAM"],
    weight: 0.95,
    quality: 0.94,
    suggestedPreset: "DREAM PAD",
    suggestedArp: "DREAM CASCADE",
    chords: [
      chord("i", "Minor", ["7"], "i7", "resolution", "OPEN"),
      chord("VI", "Major", ["Maj7"], "VImaj7", "colour", "AIR"),
      chord("III", "Major", ["Maj7"], "IIImaj7", "colour", "WIDE"),
      chord("VII", "Major", ["Add9"], "VIIadd9", "movement", "OPEN"),
    ],
  },
  {
    id: "dream-minor-bloom",
    name: "Minor Bloom",
    mood: "melancholic bloom into dominant",
    scaleContext: "minor",
    modes: ["DREAM"],
    weight: 0.96,
    quality: 0.95,
    suggestedPreset: "WARM POLY",
    suggestedArp: "SOFT PULSE",
    chords: [
      chord("i", "Minor", ["7"], "i7", "resolution", "OPEN"),
      chord("iv", "Minor", ["7"], "iv7", "colour", "OPEN"),
      chord("VI", "Major", ["Maj7"], "VImaj7", "colour", "AIR"),
      chord("V", "Major", ["7"], "V7", "tension", "CLOSE"),
    ],
  },
  {
    id: "dream-moon-return",
    name: "Moon Return",
    mood: "minor descent with a clear return",
    scaleContext: "minor",
    modes: ["DREAM"],
    weight: 0.88,
    quality: 0.88,
    chords: [
      chord("i", "Minor", ["7"], "i7", "resolution", "OPEN"),
      chord("VII", "Major", ["Add9"], "VIIadd9", "movement", "OPEN"),
      chord("VI", "Major", ["Maj7"], "VImaj7", "colour", "AIR"),
      chord("V", "Major", ["7"], "V7", "tension", "CLOSE"),
    ],
  },
  {
    id: "dream-velvet-minor",
    name: "Velvet Minor",
    mood: "soft minor add9 colour",
    scaleContext: "minor",
    modes: ["DREAM"],
    weight: 0.87,
    quality: 0.87,
    chords: [
      chord("i", "Minor", ["Add9"], "iadd9", "resolution", "OPEN"),
      chord("VI", "Major", ["Maj7"], "VImaj7", "colour", "AIR"),
      chord("iv", "Minor", ["7"], "iv7", "movement", "OPEN"),
      chord("V", "Major", ["7"], "V7", "tension", "CLOSE"),
    ],
  },
  {
    id: "dream-low-bloom",
    name: "Low Bloom",
    mood: "minor to relative major bloom",
    scaleContext: "minor",
    modes: ["DREAM"],
    weight: 0.86,
    quality: 0.86,
    chords: [
      chord("i", "Minor", ["7"], "i7", "resolution", "OPEN"),
      chord("iv", "Minor", ["7"], "iv7", "colour", "OPEN"),
      chord("VII", "Major", ["Add9"], "VIIadd9", "movement", "AIR"),
      chord("III", "Major", ["Maj7"], "IIImaj7", "colour", "WIDE"),
    ],
  },
  {
    id: "dream-quiet-ache",
    name: "Quiet Ache",
    mood: "aching minor to bright VI",
    scaleContext: "minor",
    modes: ["DREAM"],
    weight: 0.84,
    quality: 0.85,
    chords: [
      chord("i", "Minor", ["7"], "i7", "resolution", "OPEN"),
      chord("III", "Major", ["Maj7"], "IIImaj7", "colour", "AIR"),
      chord("VI", "Major", ["Maj7"], "VImaj7", "colour", "OPEN"),
      chord("iv", "Minor", ["7"], "iv7", "movement", "CLOSE"),
    ],
  },
  {
    id: "dream-midnight-resolve",
    name: "Midnight Resolve",
    mood: "starts lifted, resolves through dominant",
    scaleContext: "minor",
    modes: ["DREAM"],
    weight: 0.82,
    quality: 0.84,
    chords: [
      chord("VI", "Major", ["Maj7"], "VImaj7", "colour", "OPEN"),
      chord("III", "Major", ["Maj7"], "IIImaj7", "colour", "AIR"),
      chord("iv", "Minor", ["7"], "iv7", "movement", "OPEN"),
      chord("V", "Major", ["7"], "V7", "tension", "CLOSE"),
    ],
  },
  {
    id: "dream-dust-lantern",
    name: "Dust Lantern",
    mood: "minor plagal warmth",
    scaleContext: "minor",
    modes: ["DREAM"],
    weight: 0.83,
    quality: 0.85,
    chords: [
      chord("i", "Minor", ["7"], "i7", "resolution", "OPEN"),
      chord("VI", "Major", ["Maj7"], "VImaj7", "colour", "AIR"),
      chord("iv", "Minor", ["7"], "iv7", "movement", "OPEN"),
      chord("V", "Major", ["7"], "V7", "tension", "CLOSE"),
    ],
  },
];

export const EXPLORE_LOOP_TEMPLATES: DreamLoopTemplate[] = [
  {
    id: "explore-bVII-iv-return",
    name: "Borrowed Violet",
    mood: "borrowed modal colour",
    scaleContext: "major",
    modes: ["EXPLORE"],
    weight: 0.78,
    quality: 0.8,
    chords: [
      chord("I", "Major", ["Maj7"], "Imaj7", "resolution", "OPEN"),
      chord("bVII", "Major", ["Maj7"], "bVIImaj7", "experimental", "OPEN"),
      chord("IV", "Major", ["Maj7"], "IVmaj7", "colour", "AIR"),
      chord("iv", "Minor", [], "iv", "experimental", "CLOSE"),
    ],
  },
  {
    id: "explore-chromatic-mirror",
    name: "Chromatic Mirror",
    mood: "surprising but loopable",
    scaleContext: "major",
    modes: ["EXPLORE"],
    weight: 0.72,
    quality: 0.74,
    chords: [
      chord("I", "Major", ["Maj7"], "Imaj7", "resolution", "OPEN"),
      chord("III", "Major", ["7"], "III7", "tension", "CLOSE"),
      chord("vi", "Minor", ["7"], "vi7", "colour", "AIR"),
      chord("iv", "Minor", [], "iv", "experimental", "CLOSE"),
    ],
  },
  {
    id: "explore-minor-neon",
    name: "Minor Neon",
    mood: "darker borrowed minor colour",
    scaleContext: "minor",
    modes: ["EXPLORE"],
    weight: 0.74,
    quality: 0.76,
    chords: [
      chord("i", "Minor", ["7"], "i7", "resolution", "OPEN"),
      chord("bII", "Major", ["Maj7"], "bIImaj7", "experimental", "CLOSE"),
      chord("VI", "Major", ["Maj7"], "VImaj7", "colour", "AIR"),
      chord("V", "Major", ["7"], "V7", "tension", "CLOSE"),
    ],
  },
];

export const CURATED_LOOP_TEMPLATES: DreamLoopTemplate[] = [
  ...SAFE_LOOP_TEMPLATES,
  ...DREAM_LOOP_TEMPLATES,
  ...EXPLORE_LOOP_TEMPLATES,
];

export const dreamTemplateCountByContext = {
  major: DREAM_LOOP_TEMPLATES.filter((template) => template.scaleContext === "major").length,
  minor: DREAM_LOOP_TEMPLATES.filter((template) => template.scaleContext === "minor").length,
};

export const auditionDreamLoopTemplates = (scaleContext?: "major" | "minor") =>
  DREAM_LOOP_TEMPLATES
    .filter((template) => !scaleContext || template.scaleContext === scaleContext)
    .map((template) => ({
      id: template.id,
      name: template.name,
      mood: template.mood,
      scaleContext: template.scaleContext,
      suggestedPreset: template.suggestedPreset,
      suggestedArp: template.suggestedArp,
      progression: template.chords.map((item) => item.roman).join(" -> "),
    }));

export const isMinorScaleContext = (scaleMode: ScaleMode) => scaleMode.includes("Minor");
