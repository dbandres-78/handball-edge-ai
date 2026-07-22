export const fmt = (t: number): string => {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const clockToSeconds = (clock: string): number => {
  const [mm, ss] = clock.split(':').map(Number);
  return (mm ?? 0) * 60 + (ss ?? 0);
};
