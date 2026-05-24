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
    path.join(projectRoot, "src/lib/musicTheory.ts"),
    path.join(projectRoot, "src/lib/foundationTheory.ts"),
    path.join(projectRoot, "src/lib/harmonySuggestions.ts"),
  ],
  { cwd: projectRoot, stdio: "inherit" },
);

const music = require(path.join(outDir, "lib/musicTheory.js"));
const foundation = require(path.join(outDir, "lib/foundationTheory.js"));
const harmony = require(path.join(outDir, "lib/harmonySuggestions.js"));

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

const suggestionsFor = ({ chord, keyRoot = "C", scaleMode = "Major", pathMode = "COLOUR", spread = 0 }) =>
  harmony.createHarmonySuggestions({
    currentChord: chord,
    history: [chord],
    keyRoot,
    scaleMode,
    keyModeEnabled: true,
    pathMode,
    spread,
  });

const byRoot = (suggestions) => new Map(suggestions.map((suggestion) => [suggestion.rootName, suggestion]));

const cMajorHeat = byRoot(suggestionsFor({ chord: build({ root: "C" }) }));
assert.equal(cMajorHeat.get("G").displayName, "G7", "C Major heatmap suggests G7");
assert.equal(cMajorHeat.get("F").displayName, "Fmaj7", "C Major heatmap suggests Fmaj7");
assert.equal(cMajorHeat.get("A").displayName, "Am7", "C Major heatmap suggests Am7");
assert.equal(cMajorHeat.get("D").displayName, "Dm7", "C Major heatmap suggests Dm7");
assert(cMajorHeat.get("G").confidence > cMajorHeat.get("C#").confidence, "G7 outranks chromatic low-fit option");

const cExplore = byRoot(suggestionsFor({ chord: build({ root: "C" }), pathMode: "EXPLORE" }));
assert(cExplore.get("F").alternatives.some((item) => item.displayName === "Fm"), "Explore offers borrowed Fm alternative");
assert.equal(cExplore.get("A#").displayName, "A#maj7", "Explore offers bVIImaj7 colour");

const gSevenHeat = byRoot(suggestionsFor({ chord: build({ root: "G", extension: "7" }) }));
assert(gSevenHeat.get("C").confidence > 0.7, "G7 resolves strongly to C");
assert(gSevenHeat.get("C").confidence > gSevenHeat.get("D").confidence, "C outranks D after G7");

const aMinorSevenHeat = byRoot(suggestionsFor({ chord: build({ root: "A", type: "Minor", extension: "7" }) }));
assert.equal(aMinorSevenHeat.get("F").displayName, "Fmaj7", "Am7 suggests Fmaj7");
assert.equal(aMinorSevenHeat.get("D").displayName, "Dm7", "Am7 suggests Dm7");
assert.equal(aMinorSevenHeat.get("G").displayName, "G7", "Am7 suggests G7");
assert.equal(aMinorSevenHeat.get("C").displayName, "Cmaj7", "Am7 suggests Cmaj7");

const fSharpMajorHeat = byRoot(suggestionsFor({ chord: build({ root: "F#", keyRoot: "F#", scaleMode: "Major", keyModeEnabled: true }), keyRoot: "F#", scaleMode: "Major" }));
assert.equal(fSharpMajorHeat.get("C#").displayName, "C#7", "F# Major heatmap keeps black-key dominant");
assert.equal(fSharpMajorHeat.get("B").displayName, "Bmaj7", "F# Major heatmap keeps IV on B");
assert.equal(fSharpMajorHeat.get("D#").displayName, "D#m7", "F# Major heatmap keeps vi on D#");

const ebMinorHeat = byRoot(suggestionsFor({ chord: build({ root: "D#", keyRoot: "D#", scaleMode: "Natural Minor", keyModeEnabled: true }), keyRoot: "D#", scaleMode: "Natural Minor" }));
assert.equal(ebMinorHeat.get("A#").displayName, "A#7", "Eb Minor heatmap uses major dominant V");
assert.equal(ebMinorHeat.get("G#").displayName, "G#m7", "Eb Minor heatmap keeps iv minor");

fs.rmSync(outDir, { recursive: true, force: true });
console.log("Foundation theory tests passed.");
