'use client';
import { useEffect, useState, useRef, useCallback } from 'react';

/**
 * Reloj de partido en directo ("reloj corrido"): corre solo y solo se para si el anotador
 * lo para (tiempo muerto, lesión, descanso). Es la característica que define el balonmano.
 *
 * No acumula con setInterval (derivaría varios segundos en 60 minutos): guarda el instante
 * de arranque y el tiempo acumulado, y el tick solo refresca la pantalla. Recalcula siempre
 * contra Date.now(), así que también aguanta que la pestaña se quede en segundo plano.
 */
export function useMatchClock(initialSeconds = 0) {
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(initialSeconds);
  const startedAt = useRef<number | null>(null);
  const accumulated = useRef(initialSeconds * 1000);

  const read = useCallback(() => {
    const base = accumulated.current;
    const extra = startedAt.current != null ? Date.now() - startedAt.current : 0;
    return (base + extra) / 1000;
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds(read()), 200);
    return () => clearInterval(id);
  }, [running, read]);

  const start = useCallback(() => {
    if (startedAt.current != null) return;
    startedAt.current = Date.now();
    setRunning(true);
  }, []);

  const pause = useCallback(() => {
    if (startedAt.current == null) return;
    accumulated.current += Date.now() - startedAt.current;
    startedAt.current = null;
    setSeconds(accumulated.current / 1000);
    setRunning(false);
  }, []);

  const toggle = useCallback(() => { if (startedAt.current == null) start(); else pause(); }, [start, pause]);

  const set = useCallback((s: number) => {
    accumulated.current = Math.max(0, s) * 1000;
    if (startedAt.current != null) startedAt.current = Date.now();
    setSeconds(Math.max(0, s));
  }, []);

  const adjust = useCallback((delta: number) => set(read() + delta), [set, read]);

  /** Instante exacto en el que se marca una acción (no el del último tick). */
  const now = read;

  return { running, seconds, start, pause, toggle, set, adjust, now };
}
