export type CommitId = string;
export type FileStatus = "untracked" | "modified" | "deleted" | "staged-new" | "staged-modified" | "staged-deleted";

export interface WorkingFile { readonly path: string; readonly content: string; }
export interface IndexEntry { readonly path: string; readonly content: string | null; }

export interface CommitNode {
  readonly id: CommitId;
  readonly shortHash: string;
  readonly message: string;
  readonly parents: readonly CommitId[];
  readonly snapshot: Readonly<Record<string, string>>;
  readonly createdBy: "init" | "commit" | "merge" | "rebase" | "cherry-pick" | "revert";
}

export interface BranchRef { readonly name: string; readonly target: CommitId | null; readonly upstream?: string; }
export interface IndexState { readonly entries: Readonly<Record<string, string | null>>; }
export interface StashEntry { readonly id: string; readonly message: string; readonly files: Readonly<Record<string, string>>; readonly index?: IndexState; }
export interface ReflogEntry { readonly id: number; readonly from: CommitId | null; readonly to: CommitId | null; readonly action: string; }
export interface RemoteState {
  readonly name: string;
  readonly url: string;
  readonly branches: Readonly<Record<string, CommitId | null>>;
  /** Uzak depoda bulunan ve fetch ile yerel object store'a kopyalanabilen commitler. */
  readonly commits?: Readonly<Record<CommitId, CommitNode>>;
}

export interface MergeConflict {
  readonly path: string;
  readonly base: string | null;
  readonly ours: string | null;
  readonly theirs: string | null;
  readonly resolved: boolean;
}

export interface MergeOperation {
  readonly targetBranch: string;
  readonly sourceName: string;
  readonly mergeBase: CommitId | null;
  /** MERGE_HEAD eşdeğeri. */
  readonly theirs: CommitId;
  readonly ours: CommitId;
  readonly preMergeWorkingTree: Readonly<Record<string, string>>;
  readonly preMergeIndex: IndexState;
  readonly conflicts: Readonly<Record<string, MergeConflict>>;
}

export interface RepositoryState {
  readonly initialized: boolean;
  readonly commits: Readonly<Record<CommitId, CommitNode>>;
  readonly branches: Readonly<Record<string, BranchRef>>;
  readonly head: { readonly kind: "branch"; readonly name: string } | { readonly kind: "detached"; readonly target: CommitId };
  readonly workingTree: Readonly<Record<string, string>>;
  readonly index: IndexState;
  readonly tags: Readonly<Record<string, CommitId>>;
  readonly stashes: readonly StashEntry[];
  readonly remotes: Readonly<Record<string, RemoteState>>;
  /** Fetch ile güncellenen yerel origin/main benzeri ref'ler; aktif local branch değildir. */
  readonly remoteTracking?: Readonly<Record<string, CommitId | null>>;
  readonly merge?: MergeOperation;
  readonly reflog: readonly ReflogEntry[];
  readonly nextCommitNumber: number;
}

export type AnimationEvent =
  | { readonly type: "branch-created"; readonly branch: string; readonly target: CommitId | null }
  | { readonly type: "head-moved"; readonly from: string; readonly to: string }
  | { readonly type: "commit-created"; readonly commit: CommitId; readonly parent: CommitId | null };

export type CommandError =
  | { readonly type: "parse"; readonly message: string; readonly suggestion?: string }
  | { readonly type: "invalid-argument"; readonly message: string; readonly suggestion?: string }
  | { readonly type: "repository-state"; readonly message: string }
  | { readonly type: "unsupported"; readonly message: string; readonly suggestion?: string };

export interface CommandResult {
  readonly state: RepositoryState;
  readonly previousState: RepositoryState;
  readonly output: readonly string[];
  readonly warnings: readonly string[];
  readonly error?: CommandError;
  readonly animations: readonly AnimationEvent[];
  readonly teachingMessage?: string;
}

export const makeCommit = (id: string, message: string, parents: readonly string[], snapshot: Readonly<Record<string, string>>, createdBy: CommitNode["createdBy"] = "commit"): CommitNode => ({
  id, shortHash: `${(id.charCodeAt(0) * 2654435761 + Number(id.replace(/\D/g, "")) * 97 >>> 0).toString(16).padStart(7, "0")}`.slice(0, 7), message, parents, snapshot, createdBy,
});

export const createLessonRepository = (): RepositoryState => ({
  initialized: true,
  commits: {
    C0: makeCommit("C0", "Proje iskeleti", [], { "README.md": "# Pusula API" }, "init"),
    C1: makeCommit("C1", "Kimlik doğrulama taslağı", ["C0"], { "README.md": "# Pusula API", "auth.ts": "export const login = () => true;" }),
  },
  branches: { main: { name: "main", target: "C1" } }, head: { kind: "branch", name: "main" },
  workingTree: { "README.md": "# Pusula API", "auth.ts": "export const login = () => true;" }, index: { entries: {} },
  tags: {}, stashes: [], remotes: {}, reflog: [], nextCommitNumber: 2,
});

export const headCommitId = (state: RepositoryState): CommitId | null => state.head.kind === "detached" ? state.head.target : state.branches[state.head.name]?.target ?? null;
export const headSnapshot = (state: RepositoryState): Readonly<Record<string, string>> => { const id = headCommitId(state); return id ? state.commits[id]?.snapshot ?? {} : {}; };
export const effectiveIndexSnapshot = (state: RepositoryState): Readonly<Record<string, string>> => {
  const snapshot: Record<string, string> = { ...headSnapshot(state) };
  for (const [path, content] of Object.entries(state.index.entries)) {
    if (content === null) delete snapshot[path]; else snapshot[path] = content;
  }
  return snapshot;
};
