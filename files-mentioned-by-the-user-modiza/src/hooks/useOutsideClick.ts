"use client";
import { type RefObject, useEffect } from "react";

export function useOutsideClick<T extends HTMLElement>(ref: RefObject<T | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const pointer = (event: PointerEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) close(); };
    const keyboard = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("pointerdown", pointer);
    document.addEventListener("keydown", keyboard);
    return () => { document.removeEventListener("pointerdown", pointer); document.removeEventListener("keydown", keyboard); };
  }, [close, open, ref]);
}
