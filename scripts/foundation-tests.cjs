const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const outDir = path.join(os.tmpdir(), `waveforge-foundation-tests-${Date.now()}`);

execFileSync(
  path.join(projectRoot, "node_modules", ".bin", "tsc"),
  [
    "--target",
    "ES2020",
    "--module",
    "commonjs",
    "--moduleResolution",
    "node",
    "--esModuleInterop",
    "--skipLibCheck",
    "--strict",
    "--outDir",
    outDir,
    path.join(projectRoot, "src/types.ts"),
    path.join(projectRoot, "src/lib/export.ts"),
    path.join(projectRoot, "src/lib/musicTheory.ts"),
    path.join(projectRoot, "src/lib/foundationTheory.ts"),
    path.join(projectRoot, "src/lib/harmonySuggestions.ts"),
  ],
  { cwd: projectRoot, stdio: "inherit" },
);

const music = require(path.join(outDir, "lib/musicTheory.js"));
const foundation = require(path.join(outDir, "lib/foundationTheory.js"));
const harmony = require(path.join(outDir, "lib/harmonySuggestions.js"));
const dreamLoops = require(path.join(outDir, "lib/dreamLoopTemplates.js"));
const midiExport = require(path.join(outDir, "lib/export.js"));

const chordNotes = ({ root, type, extension = "None", keyMode = false, keyRoot = "C", scaleMode = "Major", flats = false, spread = 0 }) => {
  const chord = music.buildChord({
    inputRoot: root,
    chordType: type,
    modifiers: foundation.extensionToModifiers(extension),
    keyRoot,
    scaleMode,
    keyModeEnabled: keyMode,
    spread,
    motion: 0,
  });
  return foundation.formatPitchList(chord.midiNotes, flats);
};

const chordMidiNames = ({ root, type, extension = "None", flats = false, spread = 0 }) => {
  const chord = music.buildChord({
    inputRoot: root,
    chordType: type,
    modifiers: foundation.extensionToModifiers(extension),
    keyRoot: "C",
    scaleMode: "Major",
    keyModeEnabled: false,
    spread,
    motion: 0,
  });
  return chord.midiNotes.map((midi) => foundation.readableMidiName(midi, flats));
};

const stageSpread = (index) => index / 6;

const testChord = (label, options, expected) => {
  assert.deepEqual(chordNotes(options), expected, label);
};

testChord("C Major", { root: "C", type: "Major" }, ["C", "E", "G"]);
testChord("C Minor", { root: "C", type: "Minor", flats: true }, ["C", "Eb", "G"]);
testChord("C7", { root: "C", type: "Major", extension: "7", flats: true }, ["C", "E", "G", "Bb"]);
testChord("Cmaj7", { root: "C", type: "Major", extension: "Maj7" }, ["C", "E", "G", "B"]);
testChord("Cadd9", { root: "C", type: "Major", extension: "Add9" }, ["C", "E", "G", "D"]);
testChord("Cm7", { root: "C", type: "Minor", extension: "7", flats: true }, ["C", "Eb", "G", "Bb"]);
testChord("Cmadd9", { root: "C", type: "Minor", extension: "Add9", flats: true }, ["C", "Eb", "G", "D"]);

assert.deepEqual(chordMidiNames({ root: "C", type: "Major", spread: stageSpread(0) }), ["C3", "E3", "G3"], "C Major CLOSE voicing");
assert.deepEqual(chordMidiNames({ root: "C", type: "Minor", spread: stageSpread(0), flats: true }), ["C3", "Eb3", "G3"], "C Minor CLOSE voicing");
assert.deepEqual(chordMidiNames({ root: "C", type: "Major", spread: stageSpread(3) }), ["C3", "G3", "E4"], "C Major OPEN voicing");
assert.deepEqual(chordMidiNames({ root: "C", type: "Minor", spread: stageSpread(3), flats: true }), ["C3", "G3", "Eb4"], "C Minor OPEN voicing");
assert.deepEqual(chordMidiNames({ root: "C", type: "Major", spread: stageSpread(4) }), ["C2", "G2", "E3", "C4"], "C Major WIDE voicing");
assert.deepEqual(chordMidiNames({ root: "C", type: "Major", extension: "Maj7", spread: stageSpread(6) }), ["C3", "G3", "E4", "G4", "B4"], "Cmaj7 AIR preserves upper colour");
assert.deepEqual(chordMidiNames({ root: "C", type: "Major", extension: "Add9", spread: stageSpread(6) }), ["C3", "G3", "E4", "G4", "D5"], "Cadd9 AIR preserves upper colour");

testChord("C# Major", { root: "C#", type: "Major" }, ["C#", "F", "G#"]);
testChord("C# Minor", { root: "C#", type: "Minor" }, ["C#", "E", "G#"]);
testChord("Eb Major", { root: "D#", type: "Major", flats: true }, ["Eb", "G", "Bb"]);
testChord("Eb Minor", { root: "D#", type: "Minor", flats: true }, ["Eb", "Gb", "Bb"]);
testChord("F# Major", { root: "F#", type: "Major" }, ["F#", "A#", "C#"]);
testChord("F# Minor", { root: "F#", type: "Minor" }, ["F#", "A", "C#"]);
testChord("Bb Major", { root: "A#", type: "Major", flats: true }, ["Bb", "D", "F"]);
testChord("Bb Minor", { root: "A#", type: "Minor", flats: true }, ["Bb", "Db", "F"]);

const keyById = (id) => foundation.foundationKeys.find((key) => key.id === id);
const degreeRomans = (id) => foundation.getDegreeInfos(keyById(id)).map((degree) => degree.roman);
assert.deepEqual(degreeRomans("C-Major"), ["I", "ii", "iii", "IV", "V", "vi", "vii°"], "C Major degree labels");
assert.deepEqual(degreeRomans("A-Minor"), ["i", "ii°", "III", "iv", "V", "VI", "VII"], "A Minor degree labels");
assert.deepEqual(degreeRomans("F#-Major"), ["I", "ii", "iii", "IV", "V", "vi", "vii°"], "F# Major degree labels");
assert.deepEqual(degreeRomans("Eb-Minor"), ["i", "ii°", "III", "iv", "V", "VI", "VII"], "Eb Minor degree labels");

const testKeyDegree = (label, keyId, inputRoot, expectedRoman, expectedType) => {
  const key = keyById(keyId);
  const chord = music.buildChord({
    inputRoot,
    chordType: "Major",
    modifiers: [],
    keyRoot: key.root,
    scaleMode: key.scaleMode,
    keyModeEnabled: true,
    spread: 0,
    motion: 0,
  });
  const degree = foundation.degreeForRoot(chord.root, key);
  assert.equal(degree.roman, expectedRoman, `${label} roman`);
  assert.equal(chord.type, expectedType, `${label} chord type`);
};

["C", "D", "E", "F", "G", "A", "B"].forEach((root, index) => {
  testKeyDegree(`C Major degree ${index + 1}`, "C-Major", root, ["I", "ii", "iii", "IV", "V", "vi", "vii°"][index], ["Major", "Minor", "Minor", "Major", "Major", "Minor", "Diminished"][index]);
});
["A", "B", "C", "D", "E", "F", "G"].forEach((root, index) => {
  testKeyDegree(`A Minor degree ${index + 1}`, "A-Minor", root, ["i", "ii°", "III", "iv", "V", "VI", "VII"][index], ["Minor", "Diminished", "Major", "Minor", "Major", "Major", "Major"][index]);
});
["F#", "G#", "A#", "B", "C#", "D#", "F"].forEach((root, index) => {
  testKeyDegree(`F# Major degree ${index + 1}`, "F#-Major", root, ["I", "ii", "iii", "IV", "V", "vi", "vii°"][index], ["Major", "Minor", "Minor", "Major", "Major", "Minor", "Diminished"][index]);
});
["D#", "F", "F#", "G#", "A#", "B", "C#"].forEach((root, index) => {
  testKeyDegree(`Eb Minor degree ${index + 1}`, "Eb-Minor", root, ["i", "ii°", "III", "iv", "V", "VI", "VII"][index], ["Minor", "Diminished", "Major", "Minor", "Major", "Major", "Major"][index]);
});

const testCadence = (label, keyId, degreeIndex, expected) => {
  const key = keyById(keyId);
  const degree = foundation.getDegreeInfos(key)[degreeIndex];
  const actual = foundation.cadenceSuggestionsForDegree(key, degree, 1).map((suggestion) => suggestion.degree.roman);
  assert.deepEqual(actual, expected, label);
};

testCadence("C Major I next", "C-Major", 0, ["IV", "V", "vi", "ii"]);
testCadence("C Major V next", "C-Major", 4, ["I", "vi"]);
testCadence("A Minor i next", "A-Minor", 0, ["iv", "V", "VI", "III"]);
testCadence("A Minor V next", "A-Minor", 4, ["i", "VI"]);
testCadence("F# Major I next", "F#-Major", 0, ["IV", "V", "vi", "ii"]);
testCadence("Eb Minor i next", "Eb-Minor", 0, ["iv", "V", "VI", "III"]);

const testPhraseCadence = (label, keyId, degreeIndex, phraseStep, expected) => {
  const key = keyById(keyId);
  const degree = foundation.getDegreeInfos(key)[degreeIndex];
  const actual = foundation.cadenceSuggestionsForDegree(key, degree, phraseStep).map((suggestion) => suggestion.degree.roman);
  assert.deepEqual(actual, expected, label);
};

testPhraseCadence("Major phrase step 3 resolves to I", "C-Major", 4, 3, ["I"]);
testPhraseCadence("Major phrase step 4 complete", "C-Major", 0, 4, []);
testPhraseCadence("Minor phrase step 3 resolves to i", "A-Minor", 4, 3, ["i"]);
testPhraseCadence("Minor phrase step 4 complete", "A-Minor", 0, 4, []);
assert.equal(foundation.phraseStepFromDegrees([]), 0, "empty phrase");
assert.equal(foundation.phraseStepFromDegrees([foundation.getDegreeInfos(keyById("C-Major"))[0]]), 1, "phrase step one");
assert.equal(foundation.phraseStepFromDegrees(foundation.getDegreeInfos(keyById("C-Major")).slice(0, 4)), 4, "phrase step four");
assert.equal(foundation.phraseStepFromDegrees(foundation.getDegreeInfos(keyById("C-Major")).slice(0, 5)), 1, "phrase restarts after four");

const build = ({ root, type = "Major", extension = "None", keyRoot = "C", scaleMode = "Major", keyModeEnabled = false, spread = 0 }) =>
  music.buildChord({
    inputRoot: root,
    chordType: type,
    modifiers: foundation.extensionToModifiers(extension),
    keyRoot,
    scaleMode,
    keyModeEnabled,
    spread,
    motion: 0,
  });

const suggestionsFor = ({ chord = null, keyRoot = "C", scaleMode = "Major", pathMode = "DREAM", spread = 0, history, phrase }) =>
  harmony.createHarmonySuggestions({
    currentChord: chord,
    history: history ?? (chord ? [chord] : []),
    keyRoot,
    scaleMode,
    keyModeEnabled: true,
    pathMode,
    spread,
    phrase,
  });

const byRoot = (suggestions) => new Map(suggestions.map((suggestion) => [suggestion.rootName, suggestion]));

assert(dreamLoops.dreamTemplateCountByContext.major >= 12, "DREAM contains at least 12 major loop families");
assert(dreamLoops.dreamTemplateCountByContext.minor >= 8, "DREAM contains at least 8 minor loop families");

const startHeat = byRoot(suggestionsFor({ chord: null, phrase: { currentStep: 1, chords: [null, null, null, null] } }));
assert.equal(startHeat.get("C").displayName, "Cmaj7", "Empty DREAM phrase offers Cmaj7 as a curated start");
assert(startHeat.get("C").confidence > 0.7, "Curated DREAM start is strongly visible");
assert(startHeat.get("C#").confidence < 0.16, "Non-curated chromatic starts stay hidden in DREAM");

const cMajorHeat = byRoot(suggestionsFor({ chord: build({ root: "C", extension: "Maj7" }), phrase: { currentStep: 2, chords: [build({ root: "C", extension: "Maj7" }), null, null, null] } }));
assert.equal(cMajorHeat.get("F").displayName, "Fmaj7", "DREAM after Cmaj7 suggests Fmaj7 from a complete loop");
assert.equal(cMajorHeat.get("A").displayName, "Am7", "DREAM after Cmaj7 suggests Am7 from a complete loop");
assert(["G7", "Gsus4"].includes(cMajorHeat.get("G").displayName), "DREAM can offer dominant/suspended G only when it belongs to a curated loop");
assert(cMajorHeat.get("F").confidence > cMajorHeat.get("G").confidence, "DREAM prefers IVmaj7 loop-building over early dominant movement");
assert(cMajorHeat.get("C#").confidence < 0.16, "DREAM does not light roots without a complete curated loop");

const cExplore = byRoot(suggestionsFor({ chord: build({ root: "C" }), pathMode: "EXPLORE" }));
assert(cExplore.get("F").alternatives.some((item) => item.displayName === "Fm"), "Explore offers borrowed Fm alternative");
assert.equal(cExplore.get("A#").displayName, "A#maj7", "Explore offers bVIImaj7 colour");

const cMaj7 = build({ root: "C", extension: "Maj7" });
const fMaj7 = build({ root: "F", extension: "Maj7" });
const aMin7 = build({ root: "A", type: "Minor", extension: "7" });
const aMinorSevenHeat = byRoot(suggestionsFor({
  chord: aMin7,
  history: [aMin7],
  phrase: { currentStep: 2, chords: [aMin7, null, null, null] },
}));
assert.equal(aMinorSevenHeat.get("F").displayName, "Fmaj7", "Am7 starts curated loops toward Fmaj7");
assert.equal(aMinorSevenHeat.get("D").displayName, "Dm7", "Am7 starts curated loops toward Dm7");
assert(aMinorSevenHeat.get("C#").confidence < 0.16, "Am7 DREAM does not show roots without loop completion");

const fSharpMaj7 = build({ root: "F#", extension: "Maj7", keyRoot: "F#", scaleMode: "Major", keyModeEnabled: true });
const fSharpMajorHeat = byRoot(suggestionsFor({
  chord: fSharpMaj7,
  keyRoot: "F#",
  scaleMode: "Major",
  history: [fSharpMaj7],
  phrase: { currentStep: 2, chords: [fSharpMaj7, null, null, null] },
}));
assert.equal(fSharpMajorHeat.get("B").displayName, "Bmaj7", "F# Major DREAM keeps IV on B");
assert.equal(fSharpMajorHeat.get("D#").displayName, "D#m7", "F# Major DREAM keeps vi on D#");
assert(fSharpMajorHeat.get("F").confidence < 0.16, "F# Major DREAM keeps unrelated black/white roots dark");

const ebMin7 = build({ root: "D#", type: "Minor", extension: "7", keyRoot: "D#", scaleMode: "Natural Minor", keyModeEnabled: true });
const ebMinorHeat = byRoot(suggestionsFor({
  chord: ebMin7,
  keyRoot: "D#",
  scaleMode: "Natural Minor",
  history: [ebMin7],
  phrase: { currentStep: 2, chords: [ebMin7, null, null, null] },
}));
assert.equal(ebMinorHeat.get("B").displayName, "Bmaj7", "Eb Minor DREAM keeps VI colour on Cb/B");
assert.equal(ebMinorHeat.get("G#").displayName, "G#m7", "Eb Minor DREAM keeps iv minor");
assert(ebMinorHeat.get("C").confidence < 0.16, "Eb Minor DREAM hides roots without curated minor-loop completion");
const phraseStep2 = byRoot(suggestionsFor({
  chord: cMaj7,
  history: [cMaj7],
  phrase: { currentStep: 2, chords: [cMaj7, null, null, null] },
}));
assert.equal(phraseStep2.get("F").displayName, "Fmaj7", "Four-step DREAM step 2 suggests Fmaj7 after Cmaj7");
assert(phraseStep2.get("F").confidence > phraseStep2.get("C#").confidence, "Four-step step 2 rejects low-fit chromatic roots");
assert(phraseStep2.get("F").confidence >= 0.72, "Four-step DREAM step 2 gives Fmaj7 a strong complete-loop score");
assert(phraseStep2.get("F").confidence > phraseStep2.get("G").confidence + 0.08, "Four-step DREAM step 2 clearly prefers IVmaj7 loop-building over early G7");

const phraseStep3 = byRoot(suggestionsFor({
  chord: fMaj7,
  history: [cMaj7, fMaj7],
  phrase: { currentStep: 3, chords: [cMaj7, fMaj7, null, null] },
}));
assert(phraseStep3.get("A").confidence > 0.55, "Four-step step 3 keeps Am7 as a strong colour move");
assert.equal(phraseStep3.get("F").displayName, "Fm", "Four-step DREAM step 3 promotes borrowed Fm only when it resolves inside a complete loop");
assert(phraseStep3.get("F").confidence > 0.58, "Borrowed Fm receives a strong score through Imaj7-IVmaj7-iv-Imaj7");

const phraseStep3Safe = byRoot(suggestionsFor({
  chord: fMaj7,
  history: [cMaj7, fMaj7],
  pathMode: "SAFE",
  phrase: { currentStep: 3, chords: [cMaj7, fMaj7, null, null] },
}));
assert.notEqual(phraseStep3Safe.get("F").displayName, "Fm", "SAFE does not promote borrowed Fm");

const phraseStep4 = byRoot(suggestionsFor({
  chord: aMin7,
  history: [cMaj7, fMaj7, aMin7],
  phrase: { currentStep: 4, chords: [cMaj7, fMaj7, aMin7, null] },
}));
assert.equal(phraseStep4.get("G").displayName, "G7", "Four-step step 4 suggests G7 turnaround");
assert(phraseStep4.get("G").confidence >= 0.74, "Four-step step 4 gives G7 a strong loop-closure score");
assert(phraseStep4.get("G").confidence > phraseStep4.get("A").confidence, "Four-step step 4 ranks loop return above repeating vi");

const gSeven = build({ root: "G", extension: "7" });
const dreamLoopScore = harmony.scoreCompleteFourChordLoop([cMaj7, fMaj7, aMin7, gSeven], {
  keyRoot: "C",
  scaleMode: "Major",
  keyModeEnabled: true,
  pathMode: "DREAM",
  spread: 0,
});
const localButWeakLoopScore = harmony.scoreCompleteFourChordLoop([cMaj7, gSeven, fMaj7, aMin7], {
  keyRoot: "C",
  scaleMode: "Major",
  keyModeEnabled: true,
  pathMode: "DREAM",
  spread: 0,
});
assert(dreamLoopScore > 0.78, "Curated DREAM loop receives a high complete-loop score");
assert(dreamLoopScore > localButWeakLoopScore + 0.12, "Complete-loop score prefers coherent four-chord loop over local next-chord movement");

const allRoots = music.NOTE_NAMES;
const requiredDreamLoops = [
  "dream-warm-open",
  "dream-soft-sunset",
  "dream-floating-home",
  "dream-emotional-return",
  "dream-psychedelic-lift",
  "dream-dark-warm-turn",
  "dream-minor-bloom",
];
requiredDreamLoops.forEach((templateId) => {
  const template = dreamLoops.DREAM_LOOP_TEMPLATES.find((item) => item.id === templateId);
  assert(template, `DREAM loop template exists: ${templateId}`);
  const scaleMode = template.scaleContext === "minor" ? "Natural Minor" : "Major";
  allRoots.forEach((keyRoot) => {
    const resolved = harmony.resolveCuratedLoopTemplate(template, { keyRoot, scaleMode, spread: 0 });
    assert.equal(resolved.length, 4, `${templateId} resolves to four chords in ${keyRoot}`);
    resolved.forEach((chord, index) => {
      assert(chord.midiNotes.length >= 3, `${templateId} slot ${index + 1} has playable notes in ${keyRoot}`);
    });
    const score = harmony.scoreCompleteFourChordLoop(resolved, {
      keyRoot,
      scaleMode,
      keyModeEnabled: true,
      pathMode: "DREAM",
      spread: 0,
    });
    assert(score > 0.68, `${templateId} stays loopable when transposed to ${keyRoot} ${scaleMode}`);
  });
});

const lockedLoop = [cMaj7, fMaj7, aMin7, gSeven];
const lockedStep1 = byRoot(suggestionsFor({
  chord: lockedLoop[3],
  history: lockedLoop,
  phrase: { currentStep: 1, status: "LOOP_FOLLOW", chords: lockedLoop },
}));
assert.equal(lockedStep1.get("C").displayName, "Cmaj7", "Locked loop returns to slot 1 Cmaj7");
assert.equal(lockedStep1.get("C").confidence, 1, "Locked loop gives the stored next slot maximum confidence");
assert(lockedStep1.get("C").confidence > lockedStep1.get("F").confidence, "Locked loop disables repetition penalties and local re-ranking");

const lockedStep2 = byRoot(suggestionsFor({
  chord: lockedLoop[0],
  history: [...lockedLoop, lockedLoop[0]],
  phrase: { currentStep: 2, status: "LOOP_FOLLOW", chords: lockedLoop },
}));
assert.equal(lockedStep2.get("F").displayName, "Fmaj7", "Locked loop step 2 follows the stored phrase");
assert.equal(lockedStep2.get("F").confidence, 1, "Locked loop keeps the stored second chord stable");
assert(lockedStep2.get("F").confidence > 0.9, "Locked loop expected chord is the only strong main path");
assert(lockedStep2.get("G").confidence < 0.08, "Locked loop suppresses competing alternate heatmap paths");

const countBytes = (bytes, sequence) => {
  let count = 0;
  for (let index = 0; index <= bytes.length - sequence.length; index += 1) {
    if (sequence.every((byte, offset) => bytes[index + offset] === byte)) count += 1;
  }
  return count;
};

const testMidiTakeExport = async () => {
  const take = {
    id: "test-midi-take",
    number: 1,
    name: "TAKE 01",
    bpm: 90,
    timeSignature: { numerator: 4, denominator: 4 },
    bars: 4,
    key: "C Major",
    phraseChords: ["Cmaj7", "Fmaj7", "Am7", "G7"],
    soundName: "WARM POLY",
    arpName: "DREAM CASCADE",
    voicing: "OPEN",
    createdAt: Date.now(),
    chordEvents: [
      { midiNote: 48, velocity: 0.82, startBeats: 0, durationBeats: 4, channel: 0, source: "chord" },
      { midiNote: 55, velocity: 0.82, startBeats: 0, durationBeats: 4, channel: 0, source: "chord" },
      { midiNote: 64, velocity: 0.82, startBeats: 0, durationBeats: 4, channel: 0, source: "chord" },
      { midiNote: 53, velocity: 0.82, startBeats: 4, durationBeats: 4, channel: 0, source: "chord" },
      { midiNote: 60, velocity: 0.82, startBeats: 4, durationBeats: 4, channel: 0, source: "chord" },
      { midiNote: 64, velocity: 0.82, startBeats: 4, durationBeats: 4, channel: 0, source: "chord" },
    ],
    arpEvents: [
      { midiNote: 48, velocity: 0.62, startBeats: 0, durationBeats: 0.25, channel: 0, source: "arp" },
      { midiNote: 55, velocity: 0.62, startBeats: 0.25, durationBeats: 0.25, channel: 0, source: "arp" },
      { midiNote: 64, velocity: 0.62, startBeats: 0.5, durationBeats: 0.25, channel: 0, source: "arp" },
    ],
  };

  const chordBlob = midiExport.buildMidiTakeFile(take, "CHORDS");
  const chordInfo = await midiExport.inspectMidiFile(chordBlob);
  assert.equal(chordInfo.validHeader, true, "Chord MIDI export writes an MThd header");
  assert.equal(chordInfo.declaredTracks, 2, "Chord MIDI export uses format 1 with a meta and note track");
  assert.equal(chordInfo.actualTracks, 2, "Chord MIDI export writes two MTrk chunks");
  assert.equal(chordInfo.ticksPerQuarter, 480, "Chord MIDI export uses 480 PPQ");
  assert(chordInfo.byteLength > 80, "Chord MIDI export is not empty");

  const arpBlob = midiExport.buildMidiTakeFile(take, "ARP");
  const arpInfo = await midiExport.inspectMidiFile(arpBlob);
  assert.equal(arpInfo.validHeader, true, "ARP MIDI export writes an MThd header");
  assert.equal(arpInfo.declaredTracks, 2, "ARP MIDI export uses two tracks");
  const arpBytes = new Uint8Array(await arpBlob.arrayBuffer());
  assert(countBytes(arpBytes, [0x90]) >= take.arpEvents.length, "ARP MIDI export contains note-on events for arp notes");
  assert(midiExport.midiTakeFilename(take, "ARP").endsWith(".mid"), "MIDI take filename has .mid extension");
};

testMidiTakeExport()
  .then(() => {
    fs.rmSync(outDir, { recursive: true, force: true });
    console.log("Foundation theory tests passed.");
  })
  .catch((error) => {
    fs.rmSync(outDir, { recursive: true, force: true });
    console.error(error);
    process.exitCode = 1;
  });
