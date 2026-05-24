# WAVEFORGE

WAVEFORGE ist ein spielbares Smart-Chord-Instrument fuer Songwriting, Kadenzen, Akkordfarben, Basslines, Arpeggios, Beats, Recording und schnelle Ideen.

## Installation

```bash
npm install
npm run dev
```

Danach die lokale URL aus dem Terminal im Browser oeffnen.

## MIDI-Hinweis

Externe MIDI-Keyboards funktionieren am besten in Chrome oder Edge auf Desktop. Web MIDI ist ueber `localhost` erlaubt; fuer ein Deployment wird HTTPS benoetigt. Wenn ein Browser kein Web MIDI unterstuetzt, bleibt das Bildschirm-Keyboard voll nutzbar.

## Presets und Sounds erweitern

- Gesamt-Presets, Lead-Sounds, Bass-Sounds und Drum-Patterns liegen in `src/data/presets.ts`.
- Akkordtypen, Skalen, Modifier, Voicings und Voice Leading liegen in `src/lib/musicTheory.ts`.
- Smart-Harmony-Vorschlaege, PATH-Logik, ALT-Varianten und Kadenzen liegen in `src/lib/harmonySuggestions.ts`.
- Synth-Ketten, Effekte, Drum-Synthese, Transport und Recorder liegen in `src/lib/audioEngine.ts`.
- UI-Komponenten sind in `src/components/` getrennt.
- Der temporaere Foundation-Testmodus ist ueber `SET` erreichbar und zeigt MIDI-Diagnose, aktive Trigger, Output-Noten, Chord-Selbsttests und Sound-Audit.

## Smart Harmony testen

1. Einen Akkord spielen, z. B. `C`.
2. Maximal vier Keyboard-Tasten leuchten als naechste Wege.
3. `PATH` zwischen `SAFE`, `COLOUR` und `EXPLORE` umschalten.
4. Eine vorgeschlagene Taste spielen: Im Smart Play wird die empfohlene Akkordfarbe automatisch genutzt.
5. `ALT` schaltet fuer den fokussierten Vorschlag weitere gute Farben durch.
6. `LOCK` laesst die Vorschlaege sichtbar, spielt aber die manuell gewaehlten Chord-Buttons.

Alle Samples werden synthetisch erzeugt; es werden keine kostenpflichtigen APIs oder urheberrechtlich geschuetzten Samples verwendet.
