import { useRef, useState } from "react";

interface RotaryKnobProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  onChange: (value: number) => void;
  learnId?: string;
  onLearn?: (id: string) => void;
  accent?: "orange" | "mint" | "sky";
  size?: "md" | "lg";
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const snap = (value: number, step: number) => Math.round(value / step) * step;

export function RotaryKnob({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  defaultValue = (min + max) / 2,
  onChange,
  learnId,
  onLearn,
  accent = "orange",
  size = "md",
}: RotaryKnobProps) {
  const drag = useRef<{ startX: number; startY: number; startValue: number; pointerId: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const normalized = clamp((value - min) / (max - min), 0, 1);
  const rotation = -135 + normalized * 270;
  const color = accent === "mint" ? "#d8c660" : accent === "sky" ? "#9fb98e" : "#d96932";

  const commit = (next: number) => onChange(clamp(snap(next, step), min, max));

  return (
    <div className={`knob-block rotary-${size}`}>
      <div
        className={`knob-shell rotary-control ${dragging ? "is-dragging" : ""}`}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        tabIndex={0}
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { startX: event.clientX, startY: event.clientY, startValue: value, pointerId: event.pointerId };
          setDragging(true);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          event.preventDefault();
          const distance = drag.current.startY - event.clientY + (event.clientX - drag.current.startX) * 0.35;
          const sensitivity = event.shiftKey ? 0.0022 : 0.008;
          commit(drag.current.startValue + distance * sensitivity * (max - min));
        }}
        onPointerUp={(event) => {
          if (drag.current?.pointerId === event.pointerId) {
            event.currentTarget.releasePointerCapture(event.pointerId);
            drag.current = null;
            setDragging(false);
          }
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
        }}
        onWheel={(event) => {
          event.preventDefault();
          const fine = event.shiftKey ? 0.25 : 1;
          commit(value + (event.deltaY < 0 ? step : -step) * fine * 5);
        }}
        onDoubleClick={() => commit(defaultValue)}
        onKeyDown={(event) => {
          if (event.key !== "ArrowUp" && event.key !== "ArrowRight" && event.key !== "ArrowDown" && event.key !== "ArrowLeft") return;
          event.preventDefault();
          const direction = event.key === "ArrowUp" || event.key === "ArrowRight" ? 1 : -1;
          commit(value + direction * step * (event.shiftKey ? 1 : 5));
        }}
      >
        <div className="knob-track" style={{ background: `conic-gradient(from 225deg, ${color} ${normalized * 75}%, rgba(10,8,7,.44) 0 75%, transparent 0)` }} />
        <div className="knob-cap" style={{ transform: `rotate(${rotation}deg)` }}>
          <span />
        </div>
      </div>
      <div className="knob-label-row">
        <span>{label}</span>
        {learnId && onLearn ? (
          <button className="learn-dot" type="button" title={`MIDI Learn fuer ${label}`} onClick={() => onLearn(learnId)}>
            L
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function Knob(props: RotaryKnobProps) {
  return <RotaryKnob {...props} />;
}
