import { useEffect, useState } from "react";

// Simple localStorage-backed UI preferences (member side).
const KEYS = {
  hideBrowse: "bookary.ui.hide_browse",
} as const;

function read(k: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const v = window.localStorage.getItem(k);
  if (v === null) return fallback;
  return v === "1";
}

function write(k: string, v: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(k, v ? "1" : "0");
  window.dispatchEvent(new CustomEvent("bookary:ui-prefs"));
}

function useBoolPref(k: string, fallback: boolean) {
  const [v, setV] = useState(() => read(k, fallback));
  useEffect(() => {
    const on = () => setV(read(k, fallback));
    window.addEventListener("bookary:ui-prefs", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("bookary:ui-prefs", on);
      window.removeEventListener("storage", on);
    };
  }, [k, fallback]);
  return [v, (nv: boolean) => write(k, nv)] as const;
}

// Browse section is shown by default; user can hide via sidebar gear.
export const useHideBrowse = () => useBoolPref(KEYS.hideBrowse, false);
