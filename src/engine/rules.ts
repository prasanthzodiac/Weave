// Owner rules: which areas a change touches, how big it is, and where it goes.
// Levels: Notify (applied, owner told), Limits (proposed: small changes go in, major ones wait for the owner),
// Strict (block before edit: every change waits as a suggestion; plan 4.3/4.4).
import { Range, rangesOf } from './fingerprint';

export type PersonId = 'anu' | 'ravi' | 'kiran' | 'meera';
export type Level = 'notify' | 'limits' | 'strict';
export type Route = 'own' | 'open' | 'notify' | 'approval' | 'suggestion';

export interface Area {
  id: string; name: string; kind: 'page' | 'api' | 'data' | 'core' | 'decision';
  owner: PersonId | null; paths: string[]; level: Level;
  summary: string; links: string[]; decisions?: string[];
}

/** Small = at most this many logic lines in the area. Text, comment and format changes count 0. */
export const SMALL_MAX = 2;

export function areaOf(path: string, areas: Area[]): Area | null {
  return areas.find((a) => a.paths.some((p) => p === path || (p.endsWith('/**') && path.startsWith(p.slice(0, -2))))) || null;
}

export interface RangeReview extends Range { area: Area | null; authors: (PersonId | null)[]; route: Route }
export interface AreaReview { area: Area | null; ranges: RangeReview[]; logic: number; size: 'small' | 'major' }

export interface FileInput { path: string; base: string; head: string; authors: (r: Range) => (PersonId | null)[] }

export function reviewFiles(files: FileInput[], areas: Area[]): AreaReview[] {
  const byArea = new Map<string, AreaReview>();
  for (const f of files) {
    if (f.base === f.head) continue;
    const area = areaOf(f.path, areas);
    for (const r of rangesOf(f.path, f.base, f.head)) {
      const authors = f.authors(r);
      const key = area ? area.id : '(open)';
      if (!byArea.has(key)) byArea.set(key, { area, ranges: [], logic: 0, size: 'small' });
      byArea.get(key)!.ranges.push({ ...r, area, authors, route: 'own' });
    }
  }
  for (const ar of byArea.values()) {
    const owner = ar.area?.owner ?? null;
    // A range made only by the owner (or the owner's own agent) needs nothing. Unknown author (null) is never the owner.
    const foreign = ar.ranges.filter((r) => owner && !(r.authors.length > 0 && r.authors.every((a) => a === owner)));
    ar.logic = foreign.reduce((n, r) => n + r.logic, 0);
    ar.size = ar.logic <= SMALL_MAX ? 'small' : 'major';
    for (const r of ar.ranges) {
      if (!owner) { r.route = 'open'; continue; }
      if (!foreign.includes(r)) { r.route = 'own'; continue; }
      const level = ar.area!.level;
      r.route = level === 'notify' ? 'notify'
        : level === 'strict' ? 'suggestion'
        : ar.size === 'major' && r.logic > 0 ? 'approval' : 'notify';
    }
  }
  return [...byArea.values()];
}

export const needsYes = (r: RangeReview) => r.route === 'approval' || r.route === 'suggestion';
