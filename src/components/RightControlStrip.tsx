import { ArpeggiatorPanel } from "./ArpeggiatorPanel";
import { FxPanel } from "./FxPanel";

export function RightControlStrip() {
  return (
    <aside className="control-strip">
      <FxPanel />
      <ArpeggiatorPanel />
    </aside>
  );
}
