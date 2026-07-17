"use client";

import { useCallback, useEffect, useRef } from "react";

function afterNextPaint(callback: () => void) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(callback);
  });
}

export function useStepFormScroll(step: number) {
  const stepStartRef = useRef<HTMLElement | null>(null);
  const errorRef = useRef<HTMLParagraphElement | null>(null);
  const previousStepRef = useRef(step);

  useEffect(() => {
    if (previousStepRef.current === step) return;

    previousStepRef.current = step;
    afterNextPaint(() => {
      stepStartRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [step]);

  const scrollToError = useCallback(() => {
    afterNextPaint(() => {
      const firstInvalidField =
        document.querySelector<HTMLElement>('[aria-invalid="true"]');
      const target = firstInvalidField ?? errorRef.current;

      target?.scrollIntoView({
        behavior: "smooth",
        block: firstInvalidField ? "center" : "start",
      });

      if (
        firstInvalidField instanceof HTMLInputElement ||
        firstInvalidField instanceof HTMLTextAreaElement ||
        firstInvalidField instanceof HTMLSelectElement
      ) {
        firstInvalidField.focus({ preventScroll: true });
      }
    });
  }, []);

  return { errorRef, scrollToError, stepStartRef };
}
