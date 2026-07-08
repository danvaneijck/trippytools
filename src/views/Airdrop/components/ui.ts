import type { GroupBase, StylesConfig } from "react-select";

// Shared visual primitives for the airdrop tool. Centralising the class strings
// here keeps every button/input/card on one consistent design language instead
// of the grab-bag of slate/gray shades and radii the view grew organically.

// Buttons — three intents:
//  • primary  → brand-yellow forward CTA (get info / generate list / review)
//  • secondary→ neutral action (nav links, preliminary fetches)
//  • ghost    → small inline controls (apply / reset / max / pagination)
export const btnPrimary =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-trippyYellow px-4 py-2.5 text-sm font-bold text-black shadow-lg shadow-trippyYellow/10 transition hover:brightness-105 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50";

export const btnSecondary =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50";

export const btnGhost =
    "inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

// Dark form control that reads as native to the teal page background. Inputs
// here deliberately avoid the app-wide `text-black` (white-field) treatment.
export const inputBase =
    "w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-trippyYellow/60 focus:ring-1 focus:ring-trippyYellow/40 disabled:cursor-not-allowed disabled:opacity-50";

export const cardBase =
    "rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-lg shadow-black/20";

export const labelBase = "block text-sm font-bold text-white";

// Dark theme for the inline react-select instances used in this view so they
// match the dark inputs instead of the library's default white control.
export const darkSelectStyles: StylesConfig<any, boolean, GroupBase<any>> = {
    control: (base, state) => ({
        ...base,
        backgroundColor: "rgba(2,6,23,0.6)",
        borderColor: state.isFocused ? "rgba(249,215,63,0.6)" : "rgba(255,255,255,0.1)",
        borderRadius: 10,
        minHeight: 42,
        boxShadow: state.isFocused ? "0 0 0 1px rgba(249,215,63,0.4)" : "none",
        ":hover": { borderColor: "rgba(255,255,255,0.2)" },
    }),
    menu: (base) => ({
        ...base,
        backgroundColor: "#04141b",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 10,
        overflow: "hidden",
        zIndex: 30,
    }),
    menuList: (base) => ({ ...base, padding: 4 }),
    option: (base, state) => ({
        ...base,
        backgroundColor: state.isSelected
            ? "rgba(249,215,63,0.15)"
            : state.isFocused
              ? "rgba(255,255,255,0.06)"
              : "transparent",
        color: "#fff",
        borderRadius: 8,
        cursor: "pointer",
        ":active": { backgroundColor: "rgba(249,215,63,0.2)" },
    }),
    singleValue: (base) => ({ ...base, color: "#fff" }),
    placeholder: (base) => ({ ...base, color: "#64748b" }),
    input: (base) => ({ ...base, color: "#fff" }),
    indicatorSeparator: (base) => ({ ...base, backgroundColor: "rgba(255,255,255,0.1)" }),
    dropdownIndicator: (base) => ({ ...base, color: "#64748b", ":hover": { color: "#fff" } }),
    clearIndicator: (base) => ({ ...base, color: "#64748b", ":hover": { color: "#fff" } }),
    groupHeading: (base) => ({
        ...base,
        color: "#64748b",
        textTransform: "uppercase",
        fontSize: 11,
        letterSpacing: "0.05em",
    }),
};
