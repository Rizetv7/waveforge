import { useAuraStore } from "../store/useAuraStore";
import { Knob } from "./Knob";

export function VoicingControls() {
  const spread = useAuraStore((state) => state.spread);
  const motion = useAuraStore((state) => state.motion);
  const setSpread = useAuraStore((state) => state.setSpread);
  const setMotion = useAuraStore((state) => state.setMotion);
  const setMidiLearnTarget = useAuraStore((state) => state.setMidiLearnTarget);

  return (
    <section className="grid grid-cols-2 gap-5 rounded-2xl bg-aura-ink/10 p-5 shadow-insetSoft md:max-w-sm">
      <Knob label="SPREAD" value={spread} onChange={setSpread} learnId="spread" onLearn={setMidiLearnTarget} />
      <Knob label="MOTION" value={motion} onChange={setMotion} learnId="motion" onLearn={setMidiLearnTarget} accent="sky" />
    </section>
  );
}
