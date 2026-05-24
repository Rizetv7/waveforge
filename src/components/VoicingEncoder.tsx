import { useRef, useState } from "react";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

interface VoicingEncoderProps {
  value: number;
  stages: string[];
  onChange: (value: number) => void;
}

export function VoicingEncoder({ value, stages, onChange }: VoicingEncoderProps) {
  const dragRef = useRef<{ startX: number; startY: number; startValue: number; pointerId: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const max = Math.max(0, stages.length - 1);
  const stageName = stages[value] ?? stages[0] ?? "CLOSE";
  const rotation = -135 + (max ? (value / max) * 270 : 0);

  const commit = (next: number) => {
    const snapped = clamp(Math.round(next), 0, max);
    if (snapped !== value) onChange(snapped);
  };

  return (
    <div className="voicing-encoder">
      <div className="voicing-title">VOICING</div>
      <div
        className={`voicing-dial ${dragging ? "is-dragging" : ""}`}
        role="slider"
        aria-label="VOICING"
        aria-valuemin={1}
        aria-valuemax={stages.length}
        aria-valuenow={value + 1}
        aria-valuetext={stageName}
        tabIndex={0}
        onPointerDown={(event) => {
          event.preventDefault();
          dragRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            startValue: value,
            pointerId: event.pointerId,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          event.preventDefault();
          const distance = drag.startY - event.clientY + (event.clientX - drag.startX) * 0.35;
          const stepSize = event.shiftKey ? 58 : 32;
          commit(drag.startValue + distance / stepSize);
        }}
        onPointerUp={(event) => {
          if (dragRef.current?.pointerId === event.pointerId) {
            event.currentTarget.releasePointerCapture(event.pointerId);
            dragRef.current = null;
            setDragging(false);
          }
        }}
        onPointerCancel={(event) => {
          if (dragRef.current?.pointerId === event.pointerId) {
            dragRef.current = null;
            setDragging(false);
          }
        }}
        onWheel={(event) => {
          event.preventDefault();
          commit(value + (event.deltaY < 0 ? 1 : -1));
        }}
        onDoubleClick={() => onChange(0)}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowRight") {
            event.preventDefault();
            commit(value + 1);
          }
          if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
            event.preventDefault();
            commit(value - 1);
          }
          if (event.key === "Home") {
            event.preventDefault();
            onChange(0);
          }
          if (event.key === "End") {
            event.preventDefault();
            onChange(max);
          }
        }}
      >
        <div className="voicing-tick-ring">
          {stages.map((stage, index) => (
            <span
              key={stage}
              className={index <= value ? "lit" : ""}
              style={{ transform: `rotate(${-135 + (max ? (index / max) * 270 : 0)}deg)` }}
            />
          ))}
        </div>
        <div className="voicing-cap" style={{ transform: `rotate(${rotation}deg)` }}>
          <span />
        </div>
        <div className="voicing-index">{value + 1}/7</div>
      </div>
      <div className="voicing-stage-name">{stageName}</div>
    </div>
  );
}
