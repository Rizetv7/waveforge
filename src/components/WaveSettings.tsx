import { factoryPresets } from "../data/presets";
import { useAuraStore } from "../store/useAuraStore";

export function WaveSettings() {
  const settingsOpen = useAuraStore((state) => state.settingsOpen);
  const toggleSettings = useAuraStore((state) => state.toggleSettings);
  const midiDiagnosticsOpen = useAuraStore((state) => state.midiDiagnosticsOpen);
  const toggleMidiDiagnostics = useAuraStore((state) => state.toggleMidiDiagnostics);
  const midiSupported = useAuraStore((state) => state.midiSupported);
  const midiPermission = useAuraStore((state) => state.midiPermission);
  const midiDevices = useAuraStore((state) => state.midiDevices);
  const selectedMidiInputId = useAuraStore((state) => state.selectedMidiInputId);
  const selectMidiInput = useAuraStore((state) => state.selectMidiInput);
  const requestMidiReconnect = useAuraStore((state) => state.requestMidiReconnect);
  const clearMidiLog = useAuraStore((state) => state.clearMidiLog);
  const lastMidiEvent = useAuraStore((state) => state.lastMidiEvent);
  const lastMidiAt = useAuraStore((state) => state.lastMidiAt);
  const lastNoteOn = useAuraStore((state) => state.lastNoteOn);
  const lastNoteOff = useAuraStore((state) => state.lastNoteOff);
  const lastVelocity = useAuraStore((state) => state.lastVelocity);
  const sustain = useAuraStore((state) => state.sustain);
  const setSustain = useAuraStore((state) => state.setSustain);
  const setSpread = useAuraStore((state) => state.setSpread);
  const activeRoots = useAuraStore((state) => state.activeRoots);
  const currentlySoundingNotes = useAuraStore((state) => state.currentlySoundingNotes);
  const activeTriggers = useAuraStore((state) => state.activeTriggers);
  const playRoot = useAuraStore((state) => state.playRoot);
  const releaseRoot = useAuraStore((state) => state.releaseRoot);
  const allNotesOff = useAuraStore((state) => state.allNotesOff);
  const resetAudioEngine = useAuraStore((state) => state.resetAudioEngine);
  const midiPlayMode = useAuraStore((state) => state.midiPlayMode);
  const setMidiPlayMode = useAuraStore((state) => state.setMidiPlayMode);
  const developerTestMode = useAuraStore((state) => state.developerTestMode);
  const fps = useAuraStore((state) => state.fps);
  const toggleDeveloperTestMode = useAuraStore((state) => state.toggleDeveloperTestMode);
  const chordSelfTests = useAuraStore((state) => state.chordSelfTests);
  const runChordSelfTest = useAuraStore((state) => state.runChordSelfTest);
  const playTestChord = useAuraStore((state) => state.playTestChord);
  const runSoundAudit = useAuraStore((state) => state.runSoundAudit);
  const soundAudit = useAuraStore((state) => state.soundAudit);
  const bassMode = useAuraStore((state) => state.bassMode);
  const arp = useAuraStore((state) => state.arp);
  const activeArpNote = useAuraStore((state) => state.activeArpNote);
  const drumsPlaying = useAuraStore((state) => state.drumsPlaying);
  const fx = useAuraStore((state) => state.fx);
  const looperRecording = useAuraStore((state) => state.looperRecording);
  const looperPlaying = useAuraStore((state) => state.looperPlaying);
  const ideaRecording = useAuraStore((state) => state.ideaRecording);
  const ideaPlaying = useAuraStore((state) => state.ideaPlaying);
  const ideaEvents = useAuraStore((state) => state.ideaEvents);
  const smartEnabled = useAuraStore((state) => state.smartEnabled);
  const harmonyPath = useAuraStore((state) => state.harmonyPath);
  const manualLock = useAuraStore((state) => state.manualLock);
  const harmonySuggestions = useAuraStore((state) => state.harmonySuggestions);
  const startIdeaRecording = useAuraStore((state) => state.startIdeaRecording);
  const stopIdeaRecording = useAuraStore((state) => state.stopIdeaRecording);
  const playIdeaRecording = useAuraStore((state) => state.playIdeaRecording);
  const clearIdeaRecording = useAuraStore((state) => state.clearIdeaRecording);
  const audioReady = useAuraStore((state) => state.audioReady);
  const randomizeIdea = useAuraStore((state) => state.randomizeIdea);
  const saveUserPreset = useAuraStore((state) => state.saveUserPreset);
  const userPresets = useAuraStore((state) => state.userPresets);
  const applyPreset = useAuraStore((state) => state.applyPreset);
  const exportIdea = useAuraStore((state) => state.exportIdea);
  const audioStatus = useAuraStore((state) => state.audioStatus);
  const startAudioCapture = useAuraStore((state) => state.startAudioCapture);
  const stopAudioCapture = useAuraStore((state) => state.stopAudioCapture);
  const waitingForMidi = midiDevices.length > 0 && (!lastMidiAt || Date.now() - lastMidiAt > 5000);

  if (!settingsOpen) {
    return (
      <button className="settings-button" type="button" onClick={toggleSettings} aria-label="Settings">
        SET
      </button>
    );
  }

  return (
    <section className="wave-settings">
      <div className="settings-head">
        <span>DEEP SETTINGS</span>
        <button type="button" onClick={toggleSettings}>CLOSE</button>
      </div>
      <div className="settings-grid">
        <div className="settings-cell">
          <button className="settings-toggle" type="button" onClick={toggleMidiDiagnostics}>
            MIDI DIAGNOSTICS {midiDiagnosticsOpen ? "ON" : "OFF"}
          </button>
          {midiDiagnosticsOpen ? (
            <div className="midi-diagnostics">
              <div>WEB MIDI: {midiSupported ? "JA" : "NEIN"}</div>
              <div>PERMISSION: {midiPermission.toUpperCase()}</div>
              <div>INPUTS: {midiDevices.length ? midiDevices.map((device) => device.name).join(" / ") : "KEINE"}</div>
              <label>
                ACTIVE INPUT
                <select className="wave-select" value={selectedMidiInputId} onChange={(event) => selectMidiInput(event.target.value)}>
                  {midiDevices.length ? midiDevices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>) : <option>Kein Input</option>}
                </select>
              </label>
              <div>LAST EVENT: {lastMidiEvent}</div>
              <div>LAST NOTE ON: {lastNoteOn}</div>
              <div>LAST NOTE OFF: {lastNoteOff}</div>
              <div>LAST VELOCITY: {Math.round(lastVelocity * 127)}</div>
              <div>SUSTAIN: {sustain ? "ON" : "OFF"}</div>
              <div>GEHALTENE ROOTS: {activeRoots.length ? activeRoots.join(" / ") : "KEINE"}</div>
              <div>OUTPUT NOTES: {currentlySoundingNotes.length ? currentlySoundingNotes.join(" / ") : "KEINE"}</div>
              {waitingForMidi ? <div>Geraet erkannt. Warte auf Tastensignal.</div> : null}
              {!midiSupported ? <div>Externes MIDI benoetigt Chrome oder Edge auf einem Computer.</div> : null}
              <div className="settings-actions">
                <button type="button" onClick={requestMidiReconnect}>MIDI ERNEUT VERBINDEN</button>
                <button type="button" onClick={clearMidiLog}>MIDI LOG LEEREN</button>
                <button
                  type="button"
                  onClick={() => {
                    playRoot("C", 0.78, "screen");
                    window.setTimeout(() => releaseRoot("C", "screen"), 500);
                  }}
                >
                  TESTTON ABSPIELEN
                </button>
              </div>
            </div>
          ) : null}
        </div>
        <div className="settings-cell">
          <span className="settings-label">PLAYING MODE</span>
          <select className="wave-select" value={midiPlayMode} onChange={(event) => setMidiPlayMode(event.target.value as typeof midiPlayMode)}>
            <option>Chord Trigger</option>
            <option>Normal Piano</option>
            <option>Solo Bass</option>
          </select>
          <div className="settings-actions">
            <button type="button" onClick={randomizeIdea}>RANDOMIZE IDEA</button>
            <button type="button" onClick={() => saveUserPreset()}>SAVE PRESET</button>
                <button type="button" onClick={allNotesOff}>PANIC ALL NOTES OFF</button>
          </div>
        </div>
        <div className="settings-cell">
          <span className="settings-label">PRESETS</span>
          <select className="wave-select" defaultValue="" onChange={(event) => {
            const preset = [...factoryPresets, ...userPresets].find((item) => item.id === event.target.value);
            if (preset) applyPreset(preset);
          }}>
            <option value="" disabled>Load preset</option>
            {[...factoryPresets, ...userPresets].map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
          </select>
        </div>
        <div className="settings-cell">
          <span className="settings-label">EXPORT</span>
          <div className="settings-actions">
            <button type="button" onClick={audioStatus === "recording" ? stopAudioCapture : startAudioCapture}>{audioStatus === "recording" ? "STOP AUDIO" : "REC AUDIO"}</button>
            <button type="button" onClick={exportIdea}>EXPORT IDEA</button>
          </div>
        </div>
        <div className="settings-cell settings-cell-wide">
          <button className="settings-toggle" type="button" onClick={toggleDeveloperTestMode}>
            FOUNDATION TEST MODE {developerTestMode ? "ON" : "OFF"}
          </button>
          {developerTestMode ? (
            <div className="midi-diagnostics">
              <div>AUDIO CONTEXT: {audioReady ? "READY" : "SLEEPING"} / {audioStatus.toUpperCase()}</div>
              <div>FPS: {fps ? Math.round(fps) : "MESSUNG AKTIV"}</div>
              <div>MODE: {midiPlayMode}</div>
              <div>AKTIVE TRIGGER: {Object.keys(activeTriggers).length}</div>
              <div>OUTPUT NOTES: {currentlySoundingNotes.length ? currentlySoundingNotes.join(" / ") : "KEINE"}</div>
              <div>BASS: {bassMode}</div>
              <div>ARP: {arp.enabled ? `${arp.direction} ${arp.rate} / NOTE ${activeArpNote ?? "-"}` : "OFF"}</div>
              <div>BEAT: {drumsPlaying ? "ON" : "OFF"}</div>
              <div>FX: {fx.bypass ? "BYPASS" : "ON"}</div>
              <div>LOOP: {looperRecording ? "REC" : looperPlaying ? "PLAY" : "OFF"}</div>
              <div>RECORDER: {ideaRecording ? "REC" : ideaPlaying ? "PLAY" : "OFF"} / EVENTS {ideaEvents.length}</div>
              <div>SMART: {smartEnabled ? `${harmonyPath}${manualLock ? " / MANUAL LOCK" : " / PLAY"}` : "OFF"}</div>
              <div>SUGGESTIONS: {harmonySuggestions.length ? harmonySuggestions.map((item) => `${item.romanNumeral ?? "?"}:${item.displayName}`).join(" / ") : "KEINE"}</div>
              <div className="settings-actions">
                <button type="button" onClick={() => playTestChord("Major")}>PLAY C MAJOR</button>
                <button type="button" onClick={() => playTestChord("Minor")}>PLAY C MINOR</button>
                <button type="button" onClick={() => playTestChord("Major", ["Maj7"])}>PLAY Cmaj7</button>
                <button type="button" onClick={() => playTestChord("Major", ["Add9"])}>PLAY Cadd9</button>
                <button type="button" onClick={allNotesOff}>RELEASE ALL</button>
                <button type="button" onClick={runChordSelfTest}>TEST CHORDS</button>
                <button type="button" onClick={runSoundAudit}>TEST EVERY SOUND</button>
                <button
                  type="button"
                  onClick={() => {
                    setSustain(true);
                    playRoot("C", 0.76, "test");
                    window.setTimeout(() => releaseRoot("C", "test"), 240);
                    window.setTimeout(() => setSustain(false), 1200);
                  }}
                >
                  TEST SUSTAIN
                </button>
                <button
                  type="button"
                  onClick={() => {
                    [0, 0.18, 0.34, 0.52, 0.68, 0.84, 1].forEach((value, index) => {
                      window.setTimeout(() => setSpread(value), index * 260);
                    });
                  }}
                >
                  TEST VOICING STEPS
                </button>
                <button type="button" onClick={requestMidiReconnect}>TEST MIDI INPUT</button>
                <button type="button" onClick={startIdeaRecording}>TEST REC START</button>
                <button type="button" onClick={stopIdeaRecording}>TEST REC STOP</button>
                <button type="button" onClick={playIdeaRecording}>TEST REC PLAYBACK</button>
                <button type="button" onClick={clearIdeaRecording}>CLEAR REC</button>
                <button type="button" onClick={allNotesOff}>PANIC ALL NOTES OFF</button>
                <button type="button" onClick={resetAudioEngine}>RESET AUDIO ENGINE</button>
              </div>
              {chordSelfTests.length ? (
                <div className="test-table">
                  {chordSelfTests.map((test) => (
                    <div key={test.label} className={test.passed ? "is-pass" : "is-fail"}>
                      {test.label}: {test.actual} / EXPECTED {test.expected}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        {developerTestMode ? (
          <div className="settings-cell settings-cell-wide">
            <span className="settings-label">SOUND AUDIT</span>
            <div className="sound-audit">
              {soundAudit.map((item) => (
                <div key={`${item.category}-${item.name}`}>
                  <strong>{item.category}</strong> / {item.name}: {item.status} - {item.notes}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
