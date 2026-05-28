import type { DrumPattern, LoopLayer, MidiTake, MidiTakeExportKind, RecordedMidiNote } from "../types";

const ticksPerQuarter = 480;

const writeVarLen = (value: number) => {
  let buffer = value & 0x7f;
  const bytes = [];
  while ((value >>= 7)) {
    buffer <<= 8;
    buffer |= (value & 0x7f) | 0x80;
  }
  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) buffer >>= 8;
    else break;
  }
  return bytes;
};

const textMeta = (type: number, text: string) => {
  const bytes = Array.from(new TextEncoder().encode(text));
  return [0x00, 0xff, type, ...writeVarLen(bytes.length), ...bytes];
};

const headerChunk = () => [
  0x4d,
  0x54,
  0x68,
  0x64,
  0x00,
  0x00,
  0x00,
  0x06,
  0x00,
  0x01,
  0x00,
  0x03,
  (ticksPerQuarter >> 8) & 0xff,
  ticksPerQuarter & 0xff,
];

const headerChunkFor = (trackCount: number) => [
  0x4d,
  0x54,
  0x68,
  0x64,
  0x00,
  0x00,
  0x00,
  0x06,
  0x00,
  0x01,
  (trackCount >> 8) & 0xff,
  trackCount & 0xff,
  (ticksPerQuarter >> 8) & 0xff,
  ticksPerQuarter & 0xff,
];

const makeTrack = (events: number[]) => {
  const data = [...events, 0x00, 0xff, 0x2f, 0x00];
  const length = data.length;
  return [
    0x4d,
    0x54,
    0x72,
    0x6b,
    (length >> 24) & 0xff,
    (length >> 16) & 0xff,
    (length >> 8) & 0xff,
    length & 0xff,
    ...data,
  ];
};

const noteEvents = (timeTicks: number, note: number, velocity: number, durationTicks: number, channel: number) => [
  { tick: timeTicks, data: [0x90 + channel, note, velocity] },
  { tick: timeTicks + durationTicks, data: [0x80 + channel, note, 0] },
];

const noteTakeEvents = (note: RecordedMidiNote) => {
  const tick = Math.max(0, Math.round(note.startBeats * ticksPerQuarter));
  const duration = Math.max(1, Math.round(note.durationBeats * ticksPerQuarter));
  const velocity = Math.max(1, Math.min(127, Math.round(note.velocity * 127)));
  const channel = Math.max(0, Math.min(15, note.channel));
  return noteEvents(tick, Math.max(0, Math.min(127, Math.round(note.midiNote))), velocity, duration, channel);
};

const flattenTimedEvents = (items: { tick: number; data: number[] }[]) => {
  const sorted = items.sort((a, b) => a.tick - b.tick || a.data[0] - b.data[0]);
  let last = 0;
  return sorted.flatMap((event) => {
    const delta = Math.max(0, event.tick - last);
    last = event.tick;
    return [...writeVarLen(delta), ...event.data];
  });
};

export const buildMidiFile = ({
  bpm,
  bars,
  layers,
  drumPattern,
}: {
  bpm: number;
  bars: number;
  layers: LoopLayer[];
  drumPattern?: DrumPattern;
}) => {
  const microsPerQuarter = Math.round(60_000_000 / bpm);
  const metaTrack = makeTrack([
    ...textMeta(0x03, "WAVEFORGE Export"),
    0x00,
    0xff,
    0x51,
    0x03,
    (microsPerQuarter >> 16) & 0xff,
    (microsPerQuarter >> 8) & 0xff,
    microsPerQuarter & 0xff,
    0x00,
    0xff,
    0x58,
    0x04,
    0x04,
    0x02,
    0x18,
    0x08,
  ]);

  const loopSeconds = (60 / bpm) * 4 * bars;
  const chordTimed: { tick: number; data: number[] }[] = [];
  const bassTimed: { tick: number; data: number[] }[] = [];

  layers.forEach((layer) => {
    layer.events.forEach((event) => {
      if (event.type !== "chord-on") return;
      const at = Number(event.at || 0);
      const tick = Math.round((at / loopSeconds) * bars * 4 * ticksPerQuarter);
      const midiNotes = (event.payload.midiNotes as number[] | undefined) ?? [];
      const bassMidi = Number(event.payload.bassMidi ?? midiNotes[0] - 12);
      const velocity = Math.round(Number(event.payload.velocity ?? 0.75) * 110);
      const duration = Math.round(ticksPerQuarter * 1.8);
      midiNotes.forEach((note) => chordTimed.push(...noteEvents(tick, note, velocity, duration, 0)));
      if (Number.isFinite(bassMidi)) bassTimed.push(...noteEvents(tick, bassMidi, Math.min(120, velocity + 8), duration, 1));
    });
  });

  const chordTrack = makeTrack([...textMeta(0x03, "Chords"), ...flattenTimedEvents(chordTimed)]);
  const bassAndDrums: { tick: number; data: number[] }[] = [...bassTimed];
  if (drumPattern) {
    const drumMap = { kick: 36, snare: 38, hat: 42, perc: 76 } as const;
    const totalSteps = bars * 16;
    for (let step = 0; step < totalSteps; step += 1) {
      const patternIndex = step % 16;
      const tick = Math.round(step * (ticksPerQuarter / 4));
      Object.entries(drumMap).forEach(([voice, note]) => {
        if (drumPattern.steps[voice as keyof typeof drumMap][patternIndex]) {
          bassAndDrums.push(...noteEvents(tick, note, voice === "hat" ? 62 : 104, Math.round(ticksPerQuarter / 8), 9));
        }
      });
    }
  }
  const bassTrack = makeTrack([...textMeta(0x03, "Bass + Drums"), ...flattenTimedEvents(bassAndDrums)]);

  return new Blob([new Uint8Array([...headerChunk(), ...metaTrack, ...chordTrack, ...bassTrack])], {
    type: "audio/midi",
  });
};

export const buildMidiTakeFile = (take: MidiTake, kind: MidiTakeExportKind = "CHORDS") => {
  const microsPerQuarter = Math.round(60_000_000 / take.bpm);
  const sourceEvents = kind === "ARP" ? take.arpEvents : take.chordEvents;
  const endTick = Math.max(
    take.bars * 4 * ticksPerQuarter,
    ...sourceEvents.map((event) => Math.round((event.startBeats + event.durationBeats) * ticksPerQuarter)),
  );
  const metaTrack = makeTrack([
    ...textMeta(0x03, `WAVEFORGE ${kind}`),
    ...textMeta(0x01, take.name),
    0x00,
    0xff,
    0x51,
    0x03,
    (microsPerQuarter >> 16) & 0xff,
    (microsPerQuarter >> 8) & 0xff,
    microsPerQuarter & 0xff,
    0x00,
    0xff,
    0x58,
    0x04,
    take.timeSignature.numerator,
    0x02,
    0x18,
    0x08,
  ]);

  const trackName = kind === "ARP" ? "WAVEFORGE ARP MIDI" : "WAVEFORGE CHORD MIDI";
  const noteTrackEvents = [
    ...sourceEvents.flatMap(noteTakeEvents),
    { tick: endTick, data: [0xb0, 0x7b, 0x00] },
  ];
  const noteTrack = makeTrack([...textMeta(0x03, trackName), ...flattenTimedEvents(noteTrackEvents)]);

  return new Blob([new Uint8Array([...headerChunkFor(2), ...metaTrack, ...noteTrack])], {
    type: "audio/midi",
  });
};

export const midiTakeFilename = (take: MidiTake, kind: MidiTakeExportKind = "CHORDS") => {
  const takeNumber = String(take.number).padStart(2, "0");
  const kindSuffix = kind === "ARP"
    ? `_ARP-${take.arpName ?? "Pattern"}`
    : take.arpEvents.length
      ? "_CHORD"
      : "";
  const safe = `TAKE${takeNumber}_${take.bpm}BPM${kindSuffix}`
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9#_\-.]/g, "");
  return `WAVEFORGE_${safe}.mid`;
};

export const inspectMidiFile = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const text = (start: number, length: number) => String.fromCharCode(...bytes.slice(start, start + length));
  const trackCount = (bytes[10] << 8) | bytes[11];
  let tracks = 0;
  for (let index = 14; index < bytes.length - 8; index += 1) {
    if (text(index, 4) === "MTrk") tracks += 1;
  }
  return {
    validHeader: text(0, 4) === "MThd",
    ticksPerQuarter: (bytes[12] << 8) | bytes[13],
    declaredTracks: trackCount,
    actualTracks: tracks,
    byteLength: bytes.length,
  };
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 3000);
};
