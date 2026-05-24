/// <reference types="vite/client" />

interface Navigator {
  requestMIDIAccess?: (options?: { sysex?: boolean; software?: boolean }) => Promise<MIDIAccess>;
}

interface MIDIAccess extends EventTarget {
  inputs: MIDIInputMap;
  outputs: MIDIOutputMap;
  onstatechange: ((event: MIDIConnectionEvent) => void) | null;
}

interface MIDIInputMap {
  values(): IterableIterator<MIDIInput>;
}

interface MIDIOutputMap {
  values(): IterableIterator<MIDIOutput>;
}

interface MIDIPort extends EventTarget {
  id: string;
  manufacturer?: string;
  name?: string;
  state: "connected" | "disconnected";
  type: "input" | "output";
  open?: () => Promise<MIDIPort>;
  close?: () => Promise<MIDIPort>;
}

interface MIDIInput extends MIDIPort {
  onmidimessage: ((event: MIDIMessageEvent) => void) | null;
}

interface MIDIOutput extends MIDIPort {
  send(data: number[] | Uint8Array, timestamp?: number): void;
}

interface MIDIMessageEvent extends Event {
  data: Uint8Array;
}

interface MIDIConnectionEvent extends Event {
  port: MIDIPort;
}
