import type { ButtonHTMLAttributes, SelectHTMLAttributes } from "react";

interface LedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  tone?: "orange" | "mint" | "sky" | "berry" | "dark";
}

export function LedButton({ active = false, tone = "orange", className = "", children, ...props }: LedButtonProps) {
  return (
    <button className={`led-button ${active ? `is-active tone-${tone}` : ""} ${className}`} type="button" {...props}>
      {children}
    </button>
  );
}

export function MiniSelect({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`mini-select ${className}`} {...props} />;
}

export function PanelLabel({ children }: { children: React.ReactNode }) {
  return <div className="panel-label">{children}</div>;
}

export function ActivityLed({ active, color = "orange" }: { active: boolean; color?: "orange" | "mint" | "sky" }) {
  return <span className={`activity-led ${active ? "active" : ""} led-${color}`} />;
}
