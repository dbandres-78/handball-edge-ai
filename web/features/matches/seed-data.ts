import { EventType, ShotOutcome, UiEvent, UiTeam } from '../../lib/handball/mapping';
import type { LoadedMatch } from './types';

const team = (name: string, players: UiTeam['players']): UiTeam => ({ name, players });

const HOME_J24 = team('BM Ejemplo', [
  { number: 1, name: 'A. Portero', gk: true }, { number: 7, name: 'B. Lateral' },
  { number: 4, name: 'C. Central' }, { number: 10, name: 'D. Extremo' },
  { number: 9, name: 'E. Pivote' }, { number: 3, name: 'F. Suplente' },
]);
const AWAY_J24 = team('Club Balonmano Muestra', [
  { number: 12, name: 'G. Portero', gk: true }, { number: 5, name: 'H. Lateral' },
  { number: 8, name: 'I. Central' }, { number: 11, name: 'J. Extremo' },
  { number: 6, name: 'K. Pivote' }, { number: 2, name: 'L. Suplente' },
]);

const ev = (id: number, t: number, period: number, side: 'HOME' | 'AWAY', num: number | null,
  type: EventType, outcome: ShotOutcome | null = null, zone: number | null = null): UiEvent =>
  ({ id, t, period, side, playerNumber: num, type, outcome, zone });

const J24_EVENTS: UiEvent[] = [
  ev(0, 130, 1, 'HOME', 7, EventType.SHOT, ShotOutcome.GOAL, 3),
  ev(1, 185, 1, 'AWAY', 11, EventType.SHOT, ShotOutcome.SAVED),
  ev(2, 320, 1, 'HOME', 10, EventType.SHOT, ShotOutcome.GOAL, 1),
  ev(3, 360, 1, 'AWAY', 5, EventType.SHOT, ShotOutcome.GOAL, 9),
  ev(4, 510, 1, 'HOME', 7, EventType.TURNOVER),
  ev(5, 555, 1, 'AWAY', 8, EventType.STEAL),
  ev(6, 640, 1, 'HOME', 9, EventType.SHOT, ShotOutcome.GOAL, 6),
  ev(7, 720, 1, 'AWAY', 11, EventType.SHOT, ShotOutcome.GOAL, 2),
];

const genericRoster = (): UiTeam['players'] => [
  { number: 1, name: 'Portero', gk: true }, { number: 4, name: 'Lateral' },
  { number: 7, name: 'Central' }, { number: 9, name: 'Extremo' }, { number: 10, name: 'Pivote' },
];

export const SEED_MATCHES: LoadedMatch[] = [
  {
    matchId: 'J24', competition: 'Liga ASOBAL', matchday: 24, playedAt: '2025-03-15T17:00:00.000Z',
    home: HOME_J24, away: AWAY_J24, events: J24_EVENTS, status: 'tagging', mode: 'video', videoRef: null,
  },
  {
    matchId: 'M2', competition: 'Liga ASOBAL', matchday: 25, playedAt: '2025-03-22T18:00:00.000Z',
    home: team('CD Norte', genericRoster()), away: team('Balonmano Sur', genericRoster()),
    events: [], status: 'new', mode: 'video', videoRef: null,
  },
  {
    matchId: 'M3', competition: 'Copa del Rey', matchday: undefined, playedAt: '2025-04-02T20:00:00.000Z',
    home: team('Atlético Handball', genericRoster()), away: team('CB Litoral', genericRoster()),
    events: [], status: 'new', mode: 'video', videoRef: null,
  },
];

/** Copia profunda de los partidos de seed (para no mutar las plantillas). */
export const cloneSeed = (): LoadedMatch[] => JSON.parse(JSON.stringify(SEED_MATCHES));
