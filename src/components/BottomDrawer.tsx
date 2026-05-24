import { DrumMachine } from "./DrumMachine";
import { ExportPanel } from "./ExportPanel";
import { LooperPanel } from "./LooperPanel";

export function BottomDrawer() {
  return (
    <div className="bottom-drawer">
      <LooperPanel />
      <DrumMachine />
      <ExportPanel />
    </div>
  );
}
