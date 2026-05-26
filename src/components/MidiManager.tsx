import { useEffect, useRef } from "react";
import { auraAudio } from "../lib/audioEngine";
import { midiToNoteName } from "../lib/musicTheory";
import { useAuraStore } from "../store/useAuraStore";
import type { MidiDeviceInfo } from "../types";

const deviceName = (port: MIDIPort) => port.name || port.manufacturer || "Unbenanntes MIDI-Geraet";

export function MidiManager() {
  const selectedInputId = useAuraStore((state) => state.selectedMidiInputId);
  const midiReconnectToken = useAuraStore((state) => state.midiReconnectToken);
  const setMidiSupported = useAuraStore((state) => state.setMidiSupported);
  const setMidiDevices = useAuraStore((state) => state.setMidiDevices);
  const setMidiPermission = useAuraStore((state) => state.setMidiPermission);
  const selectMidiInput = useAuraStore((state) => state.selectMidiInput);
  const registerMidiEvent = useAuraStore((state) => state.registerMidiEvent);
  const playMidiNote = useAuraStore((state) => state.playMidiNote);
  const releaseMidiNote = useAuraStore((state) => state.releaseMidiNote);
  const setSustain = useAuraStore((state) => state.setSustain);
  const setPitchBend = useAuraStore((state) => state.setPitchBend);
  const handleMidiCc = useAuraStore((state) => state.handleMidiCc);
  const accessRef = useRef<MIDIAccess | null>(null);
  const selectedInputRef = useRef(selectedInputId);

  useEffect(() => {
    selectedInputRef.current = selectedInputId;
  }, [selectedInputId]);

  const attachHandlers = (access: MIDIAccess) => {
    Array.from(access.inputs.values()).forEach((input) => {
      input.onmidimessage = null;
      if (input.state !== "connected") return;
      void input.open?.();
      input.onmidimessage = (event) => {
        if (!event.data) return;
        const source = event.currentTarget as MIDIInput | null;
        if (source?.id && selectedInputRef.current && selectedInputRef.current !== source.id) return;
        if (source?.id && !selectedInputRef.current) {
          selectedInputRef.current = source.id;
          selectMidiInput(source.id);
        }
        const [statusByte, data1, data2] = Array.from(event.data);
        const status = statusByte & 0xf0;
        const velocity = data2 / 127;
        if (status === 0x90 && data2 > 0) {
          registerMidiEvent(`NOTE ON: ${midiToNoteName(data1)} / velocity ${data2}`);
          playMidiNote(data1, velocity);
        }
        if (status === 0x80 || (status === 0x90 && data2 === 0)) {
          registerMidiEvent(`NOTE OFF: ${midiToNoteName(data1)}`);
          releaseMidiNote(data1);
        }
        if (status === 0xb0) {
          if (data1 === 64) setSustain(data2 >= 64);
          if (data1 === 1) auraAudio.setModWheel(data2);
          registerMidiEvent(`CC ${data1}: ${data2}`);
          handleMidiCc(data1, data2);
        }
        if (status === 0xe0) {
          registerMidiEvent(`PITCH BEND: ${(data2 << 7) + data1}`);
          setPitchBend((data2 << 7) + data1);
        }
      };
    });
  };

  useEffect(() => {
    if (!navigator.requestMIDIAccess) {
      setMidiSupported(false);
      return;
    }

    let cancelled = false;
    const refreshDevices = (access: MIDIAccess) => {
      const inputs = Array.from(access.inputs.values()).filter((input) => input.state === "connected");
      const outputs = Array.from(access.outputs.values()).filter((output) => output.state === "connected");
      const inputDevices: MidiDeviceInfo[] = inputs.map((input) => ({ id: input.id, name: deviceName(input), manufacturer: input.manufacturer ?? undefined }));
      const outputDevices: MidiDeviceInfo[] = outputs.map((output) => ({ id: output.id, name: deviceName(output), manufacturer: output.manufacturer ?? undefined }));
      const current = useAuraStore.getState().selectedMidiInputId;
      const selected = inputs.find((input) => input.id === current) ?? inputs[0];
      if (selected?.id && !selectedInputRef.current) selectedInputRef.current = selected.id;
      attachHandlers(access);
      setMidiDevices(inputDevices, outputDevices);
    };

    navigator
      .requestMIDIAccess({ sysex: false })
      .then((access) => {
        if (cancelled) return;
        accessRef.current = access;
        setMidiSupported(true);
        setMidiPermission("granted");
        refreshDevices(access);
        access.onstatechange = () => refreshDevices(access);
      })
      .catch(() => {
        setMidiPermission("denied");
        setMidiSupported(false);
      });

    return () => {
      cancelled = true;
      if (accessRef.current) accessRef.current.onstatechange = null;
    };
  }, [handleMidiCc, midiReconnectToken, playMidiNote, registerMidiEvent, releaseMidiNote, selectMidiInput, setMidiDevices, setMidiPermission, setMidiSupported, setPitchBend, setSustain]);

  useEffect(() => {
    const access = accessRef.current;
    if (!access) return;
    attachHandlers(access);
  }, [selectedInputId]);

  return null;
}
