import type { CompletePreset, MidiMapping, SavedLoop } from "../types";

const USER_PRESETS_KEY = "waveforge:user-presets";
const SAVED_LOOPS_KEY = "waveforge:loops";
const MIDI_MAPPINGS_KEY = "waveforge:midi-mappings";

const readJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = <T>(key: string, value: T) => {
  window.localStorage.setItem(key, JSON.stringify(value));
};

export const loadUserPresets = () => readJson<CompletePreset[]>(USER_PRESETS_KEY, []);
export const saveUserPresets = (presets: CompletePreset[]) => writeJson(USER_PRESETS_KEY, presets);

export const loadSavedLoops = () => readJson<SavedLoop[]>(SAVED_LOOPS_KEY, []);
export const saveSavedLoops = (loops: SavedLoop[]) => writeJson(SAVED_LOOPS_KEY, loops);

export const loadMidiMappings = () => readJson<MidiMapping[]>(MIDI_MAPPINGS_KEY, []);
export const saveMidiMappings = (mappings: MidiMapping[]) => writeJson(MIDI_MAPPINGS_KEY, mappings);
