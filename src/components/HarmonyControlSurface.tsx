import type { ChordType, HarmonyPathMode } from "../types";
import type { FoundationExtension } from "../lib/foundationTheory";

type HarmonyControlSurfaceProps = {
  keyModeEnabled: boolean;
  setFoundationKeyMode: (enabled: boolean) => void;
  keyLabel: string;
  stepKey: (direction: -1 | 1) => void;
  chordType: ChordType;
  chordTypes: ChordType[];
  setChordType: (type: ChordType) => void;
  chordDisabled: boolean;
  extension: FoundationExtension;
  extensions: FoundationExtension[];
  setChordExtension: (extension: FoundationExtension) => void;
  extensionDisabled: boolean;
  harmonyPath: HarmonyPathMode;
  pathModes: HarmonyPathMode[];
  setHarmonyPath: (mode: HarmonyPathMode) => void;
  pathDisabled: boolean;
  manualLock: boolean;
  setManualLock: (locked: boolean) => void;
  cycleHarmonyAlternative: () => void;
  altDisabled: boolean;
  newPhrase: () => void;
  clearPhrase: () => void;
  newPhraseDisabled: boolean;
};

const chordLabel: Record<ChordType, string> = {
  Major: "MAJOR",
  Minor: "MINOR",
  Sus2: "SUS2",
  Sus4: "SUS4",
  Diminished: "DIM",
  Augmented: "AUG",
  Power: "POWER",
};

const extensionLabel: Record<FoundationExtension, string> = {
  None: "NONE",
  "6": "6",
  "7": "7",
  Maj7: "MAJ7",
  Add9: "ADD9",
  "9": "9",
};

const PRIMARY_EXTENSIONS: FoundationExtension[] = ["None", "7", "Maj7", "Add9"];
const SECONDARY_EXTENSIONS: FoundationExtension[] = ["6", "9"];

export function HarmonyControlSurface({
  keyModeEnabled,
  setFoundationKeyMode,
  keyLabel,
  stepKey,
  chordType,
  chordTypes,
  setChordType,
  chordDisabled,
  extension,
  extensions,
  setChordExtension,
  extensionDisabled,
  harmonyPath,
  pathModes,
  setHarmonyPath,
  pathDisabled,
  manualLock,
  setManualLock,
  cycleHarmonyAlternative,
  altDisabled,
  newPhrase,
  clearPhrase,
  newPhraseDisabled,
}: HarmonyControlSurfaceProps) {
  const primaryChords = chordTypes.slice(0, 4);
  const secondaryChords = chordTypes.slice(4);
  const primaryExtensions = PRIMARY_EXTENSIONS.filter((item) => extensions.includes(item));
  const secondaryExtensions = SECONDARY_EXTENSIONS.filter((item) => extensions.includes(item));

  return (
    <section className="harmony-control-surface" aria-label="Harmony Control Surface">
      <div className="harmony-surface-grain" aria-hidden="true" />

      <div className="hcs-zone hcs-setup">
        <div className="hcs-label">MODE</div>
        <div className="hcs-mode-switch" aria-label="Mode">
          <button className={!keyModeEnabled ? "active" : ""} type="button" aria-pressed={!keyModeEnabled} onClick={() => setFoundationKeyMode(false)}>
            FREE
          </button>
          <button className={keyModeEnabled ? "active" : ""} type="button" aria-pressed={keyModeEnabled} onClick={() => setFoundationKeyMode(true)}>
            GUIDED
          </button>
        </div>

        <div className="hcs-label hcs-key-label">KEY</div>
        <div className="hcs-key-selector" aria-label="Tonart">
          <button type="button" onClick={() => stepKey(-1)} aria-label="Vorherige Tonart">‹</button>
          <strong>{keyLabel}</strong>
          <button type="button" onClick={() => stepKey(1)} aria-label="Naechste Tonart">›</button>
        </div>
      </div>

      <div className="hcs-zone hcs-chord">
        <div className="hcs-label">CHORD</div>
        <div className="hcs-button-bank hcs-primary-bank">
          {primaryChords.map((type) => (
            <button key={type} className={chordType === type ? "active" : ""} type="button" aria-pressed={chordType === type} onClick={() => setChordType(type)} disabled={chordDisabled}>
              {chordLabel[type]}
            </button>
          ))}
        </div>
        <div className="hcs-button-bank hcs-secondary-bank">
          {secondaryChords.map((type) => (
            <button key={type} className={chordType === type ? "active" : ""} type="button" aria-pressed={chordType === type} onClick={() => setChordType(type)} disabled={chordDisabled}>
              {chordLabel[type]}
            </button>
          ))}
        </div>
      </div>

      <div className="hcs-zone hcs-extension">
        <div className="hcs-label">EXTENSION</div>
        <div className="hcs-button-bank hcs-primary-bank">
          {primaryExtensions.map((item) => (
            <button key={item} className={extension === item ? "active" : ""} type="button" aria-pressed={extension === item} onClick={() => setChordExtension(item)} disabled={extensionDisabled}>
              {extensionLabel[item]}
            </button>
          ))}
        </div>
        <div className="hcs-button-bank hcs-secondary-bank hcs-extension-secondary">
          {secondaryExtensions.map((item) => (
            <button key={item} className={extension === item ? "active" : ""} type="button" aria-pressed={extension === item} onClick={() => setChordExtension(item)} disabled={extensionDisabled}>
              {extensionLabel[item]}
            </button>
          ))}
        </div>
      </div>

      <div className="hcs-zone hcs-guidance">
        <div className="hcs-guidance-row">
          <div className="hcs-label">PATH</div>
          <div className="hcs-path-switch" aria-label="Heatmap Path">
            {pathModes.map((mode) => (
              <button key={mode} className={harmonyPath === mode ? "active" : ""} type="button" aria-pressed={harmonyPath === mode} onClick={() => setHarmonyPath(mode)} disabled={pathDisabled}>
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="hcs-guidance-row">
          <div className="hcs-label">CONTROL</div>
          <div className="hcs-control-switch" aria-label="Smart Control">
            <button className={!manualLock ? "active" : ""} type="button" aria-pressed={!manualLock} onClick={() => setManualLock(false)} disabled={pathDisabled}>AUTO</button>
            <button className={manualLock ? "active" : ""} type="button" aria-pressed={manualLock} onClick={() => setManualLock(true)} disabled={pathDisabled}>MANUAL</button>
            <button type="button" onClick={cycleHarmonyAlternative} disabled={altDisabled}>ALT</button>
          </div>
        </div>

        <div className="hcs-guidance-row hcs-phrase-row">
          <div className="hcs-label">PHRASE</div>
          <div className="hcs-phrase-actions" aria-label="Phrase Control">
            <button type="button" onClick={newPhrase} disabled={newPhraseDisabled}>NEW</button>
            <button type="button" onClick={clearPhrase}>CLEAR</button>
          </div>
        </div>
      </div>
    </section>
  );
}
