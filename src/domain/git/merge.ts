import type { CommitId, MergeConflict, RepositoryState } from "./models";

export interface ThreeWayMergeResult {
  readonly snapshot: Readonly<Record<string, string>>;
  readonly conflicts: Readonly<Record<string, MergeConflict>>;
}

const valueAt = (snapshot: Readonly<Record<string, string>>, path: string): string | null => snapshot[path] ?? null;

export function isAncestor(state: RepositoryState, ancestor: CommitId | null, descendant: CommitId | null): boolean {
  if (ancestor === descendant) return true;
  if (!ancestor || !descendant) return false;
  const pending = [descendant];
  const visited = new Set<string>();
  while (pending.length) {
    const current = pending.pop()!;
    if (current === ancestor) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    pending.push(...(state.commits[current]?.parents ?? []));
  }
  return false;
}

export function findMergeBase(state: RepositoryState, ours: CommitId, theirs: CommitId): CommitId | null {
  const oursAncestors = new Map<CommitId, number>();
  const visit = (start: CommitId, destination: Map<CommitId, number>) => {
    const pending: Array<[CommitId, number]> = [[start, 0]];
    while (pending.length) {
      const [id, distance] = pending.shift()!;
      if ((destination.get(id) ?? Number.MAX_SAFE_INTEGER) <= distance) continue;
      destination.set(id, distance);
      for (const parent of state.commits[id]?.parents ?? []) pending.push([parent, distance + 1]);
    }
  };
  visit(ours, oursAncestors);
  const theirsAncestors = new Map<CommitId, number>();
  visit(theirs, theirsAncestors);
  return [...oursAncestors.keys()]
    .filter(id => theirsAncestors.has(id))
    .sort((a, b) => (oursAncestors.get(a)! + theirsAncestors.get(a)!) - (oursAncestors.get(b)! + theirsAncestors.get(b)!))[0] ?? null;
}

function conflictMarkers(ours: string | null, theirs: string | null, sourceName: string): string {
  return `<<<<<<< HEAD\n${ours ?? ""}\n=======\n${theirs ?? ""}\n>>>>>>> ${sourceName}`;
}

/**
 * GitAtlas başlangıç düzeyi için dosya atomikliği kullanan gerçek base/ours/theirs karar tablosu.
 * Aynı dosyanın iki tarafça farklı değiştirilmesi conflict olur; satır bazlı otomatik birleştirme yapmaz.
 */
export function threeWayMergeSnapshots(
  base: Readonly<Record<string, string>>,
  ours: Readonly<Record<string, string>>,
  theirs: Readonly<Record<string, string>>,
  sourceName: string,
): ThreeWayMergeResult {
  const snapshot: Record<string, string> = {};
  const conflicts: Record<string, MergeConflict> = {};
  const paths = new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)]);
  for (const path of [...paths].sort()) {
    const baseValue = valueAt(base, path);
    const ourValue = valueAt(ours, path);
    const theirValue = valueAt(theirs, path);
    let merged: string | null;
    if (ourValue === theirValue) merged = ourValue;
    else if (ourValue === baseValue) merged = theirValue;
    else if (theirValue === baseValue) merged = ourValue;
    else {
      merged = conflictMarkers(ourValue, theirValue, sourceName);
      conflicts[path] = { path, base: baseValue, ours: ourValue, theirs: theirValue, resolved: false };
    }
    if (merged !== null) snapshot[path] = merged;
  }
  return { snapshot, conflicts };
}

export function snapshotDelta(
  from: Readonly<Record<string, string>>,
  to: Readonly<Record<string, string>>,
  excludedPaths: ReadonlySet<string> = new Set(),
): Readonly<Record<string, string | null>> {
  const entries: Record<string, string | null> = {};
  for (const path of new Set([...Object.keys(from), ...Object.keys(to)])) {
    if (excludedPaths.has(path)) continue;
    const before = valueAt(from, path);
    const after = valueAt(to, path);
    if (before !== after) entries[path] = after;
  }
  return entries;
}

export const hasConflictMarkers = (content: string | null): boolean =>
  typeof content === "string" && /^(<<<<<<< HEAD|=======|>>>>>>> )/m.test(content);
