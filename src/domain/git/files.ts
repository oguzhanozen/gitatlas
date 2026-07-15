import { effectiveIndexSnapshot, headSnapshot, type FileStatus, type RepositoryState } from "./models";

export interface FileChange { readonly path: string; readonly status: FileStatus; readonly before: string | null; readonly after: string | null; }

const compare = (before: Readonly<Record<string,string>>, after: Readonly<Record<string,string>>, staged: boolean): readonly FileChange[] =>
  Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort().flatMap((path) => {
    const oldValue = before[path] ?? null; const newValue = after[path] ?? null;
    if (oldValue === newValue) return [];
    const status: FileStatus = staged
      ? oldValue === null ? "staged-new" : newValue === null ? "staged-deleted" : "staged-modified"
      : oldValue === null ? "untracked" : newValue === null ? "deleted" : "modified";
    return [{ path, status, before: oldValue, after: newValue }];
  });

export const stagedChanges = (state: RepositoryState): readonly FileChange[] => compare(headSnapshot(state), effectiveIndexSnapshot(state), true);
export const workingChanges = (state: RepositoryState): readonly FileChange[] => compare(effectiveIndexSnapshot(state), state.workingTree, false);
export const headChanges = (state: RepositoryState): readonly FileChange[] => compare(headSnapshot(state), state.workingTree, false);
export const isIndexClean = (state: RepositoryState): boolean => stagedChanges(state).length === 0;
export const isWorkingTreeClean = (state: RepositoryState): boolean => stagedChanges(state).length === 0 && workingChanges(state).length === 0;

const lines = (value: string | null): readonly string[] => value?.split("\n") ?? [];
export function formatDiff(changes: readonly FileChange[]): readonly string[] {
  if (changes.length === 0) return ["Fark yok."];
  return changes.flatMap((change) => {
    const removed = lines(change.before).filter((line) => !lines(change.after).includes(line));
    const added = lines(change.after).filter((line) => !lines(change.before).includes(line));
    return [`--- ${change.path}`, `durum: ${change.status.replace("staged-", "")}`, ...removed.map((line) => `- ${line}`), ...added.map((line) => `+ ${line}`)];
  });
}
