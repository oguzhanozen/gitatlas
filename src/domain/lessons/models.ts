import type { ReactNode } from "react";
import { headCommitId, headSnapshot, type RepositoryState } from "../git/models";
import { isIndexClean, isWorkingTreeClean, stagedChanges, workingChanges } from "../git/files";

export type CommandFamily = "init" | "status" | "log" | "diff-working" | "diff-staged" | "diff-head" | "add" | "commit" | "branch" | "switch" | "restore" | "restore-staged" | "reset" | "revert" | "reflog" | "show" | "merge" | "merge-abort" | "remote" | "clone" | "push" | "fetch" | "pull" | "stash" | "amend" | "rebase" | "cherry-pick" | "config" | "blame";
export interface LessonEvent { readonly family?: CommandFamily; readonly input: string; readonly ok: boolean; readonly at: string; }
export interface LessonSession { readonly executedCommands: readonly CommandFamily[]; readonly events?: readonly LessonEvent[]; readonly errorCount?: number; readonly hintCount?: number; }
export const emptySession = (): LessonSession => ({ executedCommands: [], events: [], errorCount: 0, hintCount: 0 });

export type SuccessCondition =
    | { readonly type: "branch-exists"; readonly name: string } | { readonly type: "head-on-branch"; readonly name: string } | { readonly type: "branch-points-to-head"; readonly name: string }
    | { readonly type: "file-untracked"; readonly path: string } | { readonly type: "file-modified"; readonly path: string } | { readonly type: "file-staged"; readonly path: string } | { readonly type: "file-not-staged"; readonly path: string } | { readonly type: "file-has-no-unstaged-change"; readonly path: string }
    | { readonly type: "working-tree-clean" } | { readonly type: "index-clean" } | { readonly type: "commit-count"; readonly count: number } | { readonly type: "commit-count-increased"; readonly value: number }
    | { readonly type: "commit-snapshot-contains"; readonly path: string; readonly content?: string } | { readonly type: "command-executed"; readonly family: CommandFamily }
    | { readonly type: "reflog-has-entries"; readonly minCount: number } | { readonly type: "head-points-to-commit"; readonly commitId: string }
    | { readonly type: "repository-initialized" } | { readonly type: "remote-exists"; readonly name: string } | { readonly type: "stash-count"; readonly minCount: number }
    | { readonly type: "commands-in-order"; readonly families: readonly CommandFamily[] }
    | { readonly type: "command-failed"; readonly family: CommandFamily }
    | { readonly type: "remote-tracking-points-to"; readonly name: string; readonly commitId: string }
    | { readonly type: "remote-branch-points-to-head"; readonly remote: string; readonly branch: string }
    | { readonly type: "branch-has-upstream"; readonly branch: string; readonly upstream: string }
    | { readonly type: "merge-in-progress"; readonly value: boolean }
    | { readonly type: "head-is-merge-commit" };

export type ConceptActivity = "timeline" | "time-machine" | "three-areas" | "branch-metaphor" | "remote-flow" | "collaboration-flow";
export interface LessonDefinition { readonly id: string; readonly title: string; readonly briefing?: readonly ReactNode[]; readonly story: string; readonly goalDescription: string; readonly concept?: string; readonly estimatedMinutes: number; readonly allowedCommands: readonly string[]; readonly hints: readonly string[]; readonly commonMistakes?: readonly string[]; readonly initialRepositoryState: RepositoryState; readonly successConditions: readonly SuccessCondition[]; readonly explanationAfterSuccess: string; readonly chapterId?: string; readonly level?: string; readonly activity?: ConceptActivity; readonly reward?: string; }
export interface ChapterDefinition { readonly id: string; readonly number: number; readonly title: string; readonly description: string; readonly difficulty: 1 | 2 | 3 | 4 | 5; readonly prerequisites?: readonly string[]; readonly badge: string; readonly lessons: readonly LessonDefinition[]; readonly bonus?: boolean; }

export function commandFamily(kind: string, mode?: string): CommandFamily | undefined {
    if (kind === "diff") return mode === "staged" ? "diff-staged" : mode === "head" ? "diff-head" : "diff-working";
    if (kind === "restore") return mode === "staged" ? "restore-staged" : "restore";
    if ((["init", "status", "log", "add", "commit", "reset", "revert", "reflog", "show", "merge", "merge-abort", "clone", "push", "fetch", "pull", "stash", "amend", "rebase", "cherry-pick", "config", "blame"] as const).includes(kind as "status")) return kind as CommandFamily;
    if (kind === "branch-list" || kind === "branch-create" || kind === "branch-delete") return "branch";
    if (kind === "remote-add") return "remote";
    if (kind === "switch") return "switch";
    return undefined;
}

export function evaluateConditions(state: RepositoryState, conditions: readonly SuccessCondition[], session: LessonSession = emptySession(), initial: RepositoryState = state): boolean {
    const working = workingChanges(state); const staged = stagedChanges(state); const snapshot = headSnapshot(state);
    return session.executedCommands.length > 0 && conditions.every(c => {
        switch (c.type) {
            case "branch-exists": return Boolean(state.branches[c.name]); case "head-on-branch": return state.head.kind === "branch" && state.head.name === c.name; case "branch-points-to-head": return state.branches[c.name]?.target === headCommitId(state);
            case "file-untracked": return working.some(x => x.path === c.path && x.status === "untracked"); case "file-modified": return working.some(x => x.path === c.path && x.status === "modified"); case "file-staged": return staged.some(x => x.path === c.path); case "file-not-staged": return !staged.some(x => x.path === c.path); case "file-has-no-unstaged-change": return !working.some(x => x.path === c.path);
            case "working-tree-clean": return isWorkingTreeClean(state); case "index-clean": return isIndexClean(state); case "commit-count": return Object.keys(state.commits).length === c.count; case "commit-count-increased": return Object.keys(state.commits).length === Object.keys(initial.commits).length + c.value;
            case "commit-snapshot-contains": return c.path in snapshot && (c.content === undefined || snapshot[c.path] === c.content); case "command-executed": return session.executedCommands.includes(c.family);
            case "reflog-has-entries": return state.reflog.length >= c.minCount; case "head-points-to-commit": return headCommitId(state) === c.commitId;
            case "repository-initialized": return state.initialized; case "remote-exists": return Boolean(state.remotes[c.name]); case "stash-count": return state.stashes.length >= c.minCount;
            case "commands-in-order": { let cursor = 0; for (const family of session.executedCommands) if (family === c.families[cursor]) cursor += 1; return cursor === c.families.length; }
            case "command-failed": return Boolean(session.events?.some(event => !event.ok && event.family === c.family));
            case "remote-tracking-points-to": return state.remoteTracking?.[c.name] === c.commitId;
            case "remote-branch-points-to-head": return state.remotes[c.remote]?.branches[c.branch] === headCommitId(state);
            case "branch-has-upstream": return state.branches[c.branch]?.upstream === c.upstream;
            case "merge-in-progress": return Boolean(state.merge) === c.value;
            case "head-is-merge-commit": { const id = headCommitId(state); return Boolean(id && state.commits[id]?.parents.length === 2); }
        }
    });
}
