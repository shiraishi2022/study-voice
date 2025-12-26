"use client";
import React from "react";

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 16,
        padding: 16,
        boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
      }}
    >
      {children}
    </div>
  );
}

export function Btn(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }
) {
  const { variant = "primary", style, ...rest } = props;
  return (
    <button
      {...rest}
      style={{
        borderRadius: 12,
        padding: "10px 14px",
        border: "1px solid rgba(255,255,255,0.14)",
        cursor: rest.disabled ? "not-allowed" : "pointer",
        opacity: rest.disabled ? 0.6 : 1,
        background: variant === "primary" ? "rgba(99,102,241,0.9)" : "rgba(255,255,255,0.06)",
        color: "#fff",
        fontWeight: 900,
        ...style,
      }}
    />
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        borderRadius: 12,
        padding: "10px 12px",
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.14)",
        color: "#fff",
        outline: "none",
      }}
    />
  );
}

function IconMic({ off }: { off?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      {off ? (
        <>
          <path d="M9 9v3a3 3 0 0 0 5.2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M15 9V7a3 3 0 0 0-6 0v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M4 4l16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M19 11a7 7 0 0 1-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M12 18v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M8 20h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v4a3 3 0 0 0 3 3Z" stroke="currentColor" strokeWidth="2" />
          <path d="M19 11a7 7 0 0 1-14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M12 18v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M8 20h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function IconVideo({ off }: { off?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      {off ? (
        <>
          <path d="M4 7h9a3 3 0 0 1 3 3v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M16 13v1a3 3 0 0 1-3 3H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M16 10l4-3v10l-4-3" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M4 4l16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M4 7h9a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H4V7Z" stroke="currentColor" strokeWidth="2" />
          <path d="M16 10l4-3v10l-4-3" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

function IconScreen({ on }: { on?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 5h16v10H4V5Z"
        stroke="currentColor"
        strokeWidth="2"
        opacity={on ? 1 : 0.9}
      />
      <path d="M8 19h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 15v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function ToggleIconButton(props: {
  label: string;
  state: "on" | "off";
  kind: "mic" | "video" | "screen";
  onClick: () => void;
  disabled?: boolean;
}) {
  const { label, state, kind, onClick, disabled } = props;
  const isOn = state === "on";

  const Icon =
    kind === "mic" ? <IconMic off={!isOn} /> :
    kind === "video" ? <IconVideo off={!isOn} /> :
    <IconScreen on={isOn} />;

  // big, hard-to-misclick
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      style={{
        width: 132,
        height: 54,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.14)",
        background: isOn ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.06)",
        color: "#fff",
        fontWeight: 900,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        userSelect: "none",
      }}
    >
      <span style={{ display:"grid", placeItems:"center" }}>{Icon}</span>
      <span style={{ lineHeight: 1.1 }}>
        <span style={{ display:"block", fontSize: 12, opacity: 0.85 }}>{label}</span>
        <span style={{ display:"block", fontSize: 13 }}>{isOn ? "ON" : "OFF"}</span>
      </span>
    </button>
  );
}
