import assert from 'node:assert/strict';
import {
  deriveClips, isClipWorthy, matchesFilters, DEFAULT_CLIP_WINDOW,
  type DerivedClip, type ClipFilter,
} from '../lib/handball/clips';
import { EventType, ShotOutcome, ShotOrigin, type UiEvent, type UiTeam } from '../lib/handball/mapping';

const home: UiTeam = { name: 'Local FC', players: [{ number: 7, name: 'Central' }] };
const away: UiTeam = { name: 'Rival CB', players: [{ number: 9, name: 'Pivote' }] };

let id = 0;
const ev = (patch: Partial<UiEvent>): UiEvent => ({
  id: ++id, t: 100, period: 1, side: 'HOME', playerNumber: 7,
  type: EventType.SHOT, outcome: ShotOutcome.GOAL, zone: null, ...patch,
});

let pass = 0, fail = 0;
const check = (name: string, fn: () => void) => {
  try { fn(); console.log(`  \u2713 ${name}`); pass++; }
  catch (err) { console.log(`  \u2717 ${name}`); console.log(`      ${(err as Error).message}`); fail++; }
};

check('acciones de juego generan clip; administrativas y pase a 10 m no', () => {
  assert.equal(isClipWorthy(ev({ type: EventType.SHOT })), true);
  assert.equal(isClipWorthy(ev({ type: EventType.TURNOVER })), true);
  assert.equal(isClipWorthy(ev({ type: EventType.STEAL })), true);
  assert.equal(isClipWorthy(ev({ type: EventType.FOUL })), true);
  assert.equal(isClipWorthy(ev({ type: EventType.TWO_MINUTES })), true);
  assert.equal(isClipWorthy(ev({ type: EventType.YELLOW_CARD })), true);
  assert.equal(isClipWorthy(ev({ type: EventType.RED_CARD })), true);
  // Excluidos:
  assert.equal(isClipWorthy(ev({ type: EventType.NEAR_PASS, playerNumber: null })), false);
  assert.equal(isClipWorthy(ev({ type: EventType.TIMEOUT, playerNumber: null })), false);
  assert.equal(isClipWorthy(ev({ type: EventType.SUBSTITUTION })), false);
  assert.equal(isClipWorthy(ev({ type: EventType.GOALKEEPER_CHANGE })), false);
});

check('ventana por defecto 8 s antes / 4 s después, recortada a [0, duración]', () => {
  const clips = deriveClips([ev({ t: 100 })], home, away, 600, DEFAULT_CLIP_WINDOW);
  assert.equal(clips.length, 1);
  assert.equal(clips[0].in, 92);
  assert.equal(clips[0].out, 104);
});

check('recorta al inicio: in nunca es negativo', () => {
  const clips = deriveClips([ev({ t: 3 })], home, away, 600, DEFAULT_CLIP_WINDOW);
  assert.equal(clips[0].in, 0);
  assert.equal(clips[0].out, 7);
});

check('recorta al final: out nunca supera la duración', () => {
  const clips = deriveClips([ev({ t: 599 })], home, away, 600, DEFAULT_CLIP_WINDOW);
  assert.equal(clips[0].out, 600);
  assert.equal(clips[0].in, 591);
});

check('override manual de in/out gana a la ventana y marca edited', () => {
  const clips = deriveClips([ev({ id: 42, t: 100 })], home, away, 600, DEFAULT_CLIP_WINDOW, { 42: { in: 90, out: 110 } });
  assert.equal(clips[0].in, 90);
  assert.equal(clips[0].out, 110);
  assert.equal(clips[0].edited, true);
});

check('etiqueta con jugador para acciones individuales, con equipo si no hay dorsal', () => {
  const goal = deriveClips([ev({ t: 100, playerNumber: 7, type: EventType.SHOT, outcome: ShotOutcome.GOAL })], home, away, 600, DEFAULT_CLIP_WINDOW)[0];
  assert.ok(goal.label.includes('Gol'));
  assert.ok(goal.label.includes('#7'));
  assert.ok(goal.label.includes('01:40'));
});

check('quedan ordenados por tiempo', () => {
  const clips = deriveClips(
    [ev({ t: 300 }), ev({ t: 50 }), ev({ t: 120 })],
    home, away, 600, DEFAULT_CLIP_WINDOW,
  );
  assert.deepEqual(clips.map((c) => c.in), [42, 112, 292]);
});

// ── Filtros ────────────────────────────────────────────────────────────────
const clip = (patch: Partial<DerivedClip>): DerivedClip => ({
  eventId: 1, in: 0, out: 10, label: '', side: 'HOME',
  type: EventType.SHOT, outcome: ShotOutcome.GOAL, isGoal: true, isTurnover: false, edited: false, ...patch,
});
const F = (...f: ClipFilter[]) => new Set<ClipFilter>(f);

check('sin filtros pasa todo', () => {
  assert.equal(matchesFilters(clip({}), F()), true);
});

check('LOCAL/VISITANTE filtran por equipo', () => {
  assert.equal(matchesFilters(clip({ side: 'HOME' }), F('HOME')), true);
  assert.equal(matchesFilters(clip({ side: 'AWAY' }), F('HOME')), false);
  assert.equal(matchesFilters(clip({ side: 'AWAY' }), F('AWAY')), true);
});

check('GOLES/PÉRDIDAS filtran por tipo', () => {
  assert.equal(matchesFilters(clip({ isGoal: true, isTurnover: false }), F('GOALS')), true);
  assert.equal(matchesFilters(clip({ isGoal: false, isTurnover: true }), F('GOALS')), false);
  assert.equal(matchesFilters(clip({ isGoal: false, isTurnover: true }), F('TURNOVERS')), true);
});

check('dimensiones se cruzan (AND): LOCAL + GOLES = gol local', () => {
  assert.equal(matchesFilters(clip({ side: 'HOME', isGoal: true }), F('HOME', 'GOALS')), true);
  assert.equal(matchesFilters(clip({ side: 'AWAY', isGoal: true }), F('HOME', 'GOALS')), false);
  assert.equal(matchesFilters(clip({ side: 'HOME', isGoal: false, isTurnover: true }), F('HOME', 'GOALS')), false);
});

check('dentro de una dimensión suman (OR): GOLES + PÉRDIDAS = gol o pérdida', () => {
  assert.equal(matchesFilters(clip({ isGoal: true, isTurnover: false }), F('GOALS', 'TURNOVERS')), true);
  assert.equal(matchesFilters(clip({ isGoal: false, isTurnover: true }), F('GOALS', 'TURNOVERS')), true);
  assert.equal(matchesFilters(clip({ isGoal: false, isTurnover: false }), F('GOALS', 'TURNOVERS')), false);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
