import { describe, expect, it } from "vitest";
import { executeCommand, updateWorkingFile } from "./engine";
import { findMergeBase, hasConflictMarkers, isAncestor, snapshotDelta, threeWayMergeSnapshots } from "./merge";
import { headCommitId, makeCommit, type RepositoryState } from "./models";

const repository = (overrides: Partial<RepositoryState> = {}): RepositoryState => {
  const c0 = makeCommit("C0", "base", [], { "app.ts": "base", "README.md": "base" }, "init");
  return { initialized: true, commits: { C0: c0 }, branches: { main: { name: "main", target: "C0" } }, head: { kind: "branch", name: "main" }, workingTree: { ...c0.snapshot }, index: { entries: {} }, tags: {}, stashes: [], remotes: {}, reflog: [], nextCommitNumber: 1, ...overrides };
};

describe("three-way merge yardımcıları", () => {
  it("ancestor ve en yakın ortak atayı çok parent'lı grafikte bulur", () => {
    const state = repository();
    const commits = { ...state.commits, C1: makeCommit("C1", "left", ["C0"], { "app.ts": "left" }), C2: makeCommit("C2", "right", ["C0"], { "app.ts": "right" }), C3: makeCommit("C3", "merge", ["C1", "C2"], { "app.ts": "merged" }, "merge") };
    const graph = { ...state, commits };
    expect(isAncestor(graph, "C0", "C3")).toBe(true);
    expect(isAncestor(graph, "C2", "C1")).toBe(false);
    expect(findMergeBase(graph, "C3", "C2")).toBe("C2");
  });

  it("ayrı dosya değişikliklerini otomatik birleştirir", () => {
    const result = threeWayMergeSnapshots({ a: "base", b: "base" }, { a: "ours", b: "base" }, { a: "base", b: "theirs" }, "feature");
    expect(result.snapshot).toEqual({ a: "ours", b: "theirs" });
    expect(result.conflicts).toEqual({});
  });

  it("iki tarafın farklı değişikliğini base/ours/theirs ile conflict yapar", () => {
    const result = threeWayMergeSnapshots({ "app.ts": "base" }, { "app.ts": "ours" }, { "app.ts": "theirs" }, "feature");
    expect(result.conflicts["app.ts"]).toMatchObject({ base: "base", ours: "ours", theirs: "theirs", resolved: false });
    expect(hasConflictMarkers(result.snapshot["app.ts"])).toBe(true);
    expect(snapshotDelta({ a: "1", b: "2" }, { a: "1", c: "3" })).toEqual({ b: null, c: "3" });
  });
});

describe("merge conflict yaşam döngüsü", () => {
  const divergent = () => {
    const base = repository();
    const c1 = makeCommit("C1", "ours", ["C0"], { "app.ts": "ours", "README.md": "base" });
    const c2 = makeCommit("C2", "theirs", ["C0"], { "app.ts": "theirs", "README.md": "base" });
    return { ...base, commits: { ...base.commits, C1: c1, C2: c2 }, branches: { main: { name: "main", target: "C1" }, feature: { name: "feature", target: "C2" } }, workingTree: { ...c1.snapshot }, nextCommitNumber: 3 } satisfies RepositoryState;
  };

  it("conflict başlatır, status gösterir, marker varken add ve unresolved iken commit'i engeller", () => {
    const merged = executeCommand(divergent(), { kind: "merge", branch: "feature", squash: false });
    expect(merged.state.merge).toMatchObject({ mergeBase: "C0", ours: "C1", theirs: "C2" });
    expect(executeCommand(merged.state, { kind: "status" }).output).toContain("Unmerged paths:");
    expect(executeCommand(merged.state, { kind: "add", path: "app.ts" }).error?.message).toContain("marker");
    expect(executeCommand(merged.state, { kind: "commit", message: "merge" }).error?.message).toContain("çözülmemiş conflict");
  });

  it("edit + add sonrasında iki parent'lı merge commit oluşturur", () => {
    const started = executeCommand(divergent(), { kind: "merge", branch: "feature", squash: false }).state;
    const edited = updateWorkingFile(started, "app.ts", "resolved");
    const staged = executeCommand(edited, { kind: "add", path: "app.ts" });
    expect(staged.state.merge?.conflicts["app.ts"].resolved).toBe(true);
    const committed = executeCommand(staged.state, { kind: "commit", message: "Resolve conflict" });
    const id = headCommitId(committed.state)!;
    expect(committed.state.commits[id].parents).toEqual(["C1", "C2"]);
    expect(committed.state.commits[id].snapshot["app.ts"]).toBe("resolved");
    expect(committed.state.merge).toBeUndefined();
  });

  it("merge --abort working tree ve index'i başlangıca döndürür", () => {
    const original = divergent();
    const started = executeCommand(original, { kind: "merge", branch: "feature", squash: false }).state;
    const aborted = executeCommand(updateWorkingFile(started, "app.ts", "draft"), { kind: "merge-abort" });
    expect(aborted.state.workingTree).toEqual(original.workingTree);
    expect(aborted.state.index).toEqual(original.index);
    expect(aborted.state.branches.main.target).toBe("C1");
    expect(aborted.state.merge).toBeUndefined();
  });
});

describe("remote fetch, pull ve push semantiği", () => {
  const withRemoteAhead = () => {
    const base = repository(); const c1 = makeCommit("C1", "remote", ["C0"], { "app.ts": "remote", "README.md": "base" });
    return { ...base, remotes: { origin: { name: "origin", url: "https://example.com/repo.git", branches: { main: "C1" }, commits: { C0: base.commits.C0, C1: c1 } } } } satisfies RepositoryState;
  };

  it("fetch yalnız object store ve remote-tracking ref'i günceller", () => {
    const before = withRemoteAhead(); const fetched = executeCommand(before, { kind: "fetch", remote: "origin", branch: "main" });
    expect(fetched.state.remoteTracking?.["origin/main"]).toBe("C1");
    expect(fetched.state.commits.C1).toBeDefined();
    expect(fetched.state.branches.main.target).toBe("C0");
    expect(fetched.state.workingTree).toEqual(before.workingTree);
  });

  it("pull fetch ardından fast-forward entegrasyonu yapar", () => {
    const pulled = executeCommand(withRemoteAhead(), { kind: "pull", remote: "origin", branch: "main", rebase: false });
    expect(pulled.error).toBeUndefined();
    expect(pulled.state.remoteTracking?.["origin/main"]).toBe("C1");
    expect(pulled.state.branches.main.target).toBe("C1");
    expect(pulled.state.workingTree["app.ts"]).toBe("remote");
    expect(pulled.teachingMessage).toContain("Pull = fetch + entegrasyon");
  });

  it("ayrışmış pull aynı dosyada conflict yaşam döngüsünü başlatır", () => {
    const base = repository(); const local = makeCommit("C1", "local", ["C0"], { "app.ts": "local", "README.md": "base" }); const remote = makeCommit("C2", "remote", ["C0"], { "app.ts": "remote", "README.md": "base" });
    const state: RepositoryState = { ...base, commits: { ...base.commits, C1: local }, branches: { main: { name: "main", target: "C1" } }, workingTree: { ...local.snapshot }, nextCommitNumber: 3, remotes: { origin: { name: "origin", url: "https://example.com/repo.git", branches: { main: "C2" }, commits: { C0: base.commits.C0, C2: remote } } } };
    const pulled = executeCommand(state, { kind: "pull", remote: "origin", branch: "main", rebase: false });
    expect(pulled.state.merge?.conflicts["app.ts"]).toBeDefined();
    expect(pulled.state.branches.main.target).toBe("C1");
  });

  it("remote yerelde olmayan commit içeriyorsa push'u reddeder", () => {
    const base = repository(); const local = makeCommit("C1", "local", ["C0"], { "app.ts": "local" }); const remote = makeCommit("C2", "remote", ["C0"], { "app.ts": "remote" });
    const state: RepositoryState = { ...base, commits: { ...base.commits, C1: local }, branches: { main: { name: "main", target: "C1" } }, workingTree: { ...local.snapshot }, remotes: { origin: { name: "origin", url: "https://example.com/repo.git", branches: { main: "C2" }, commits: { C0: base.commits.C0, C2: remote } } } };
    const pushed = executeCommand(state, { kind: "push", remote: "origin", branch: "main", upstream: false });
    expect(pushed.error?.message).toContain("Push reddedildi");
    expect(pushed.state).toBe(state);
  });
});

describe("stash ve revert yaşam döngüsü", () => {
  it("stash apply kaydı korur, pop geri getirip kaydı düşürür", () => {
    const base = repository(); const dirty = { ...base, workingTree: { ...base.workingTree, "app.ts": "draft" } };
    const saved = executeCommand(dirty, { kind: "stash" });
    const applied = executeCommand(saved.state, { kind: "stash", action: "apply" });
    expect(applied.state.workingTree["app.ts"]).toBe("draft"); expect(applied.state.stashes).toHaveLength(1);
    const popped = executeCommand(saved.state, { kind: "stash", action: "pop" });
    expect(popped.state.workingTree["app.ts"]).toBe("draft"); expect(popped.state.stashes).toHaveLength(0);
  });

  it("revert hedef değişikliği yeni commit ile tersine çevirir", () => {
    const base = repository(); const c1 = makeCommit("C1", "change", ["C0"], { "app.ts": "changed", "README.md": "base" }); const state: RepositoryState = { ...base, commits: { ...base.commits, C1: c1 }, branches: { main: { name: "main", target: "C1" } }, workingTree: { ...c1.snapshot }, nextCommitNumber: 2 };
    const reverted = executeCommand(state, { kind: "revert", target: "HEAD" }); const id = headCommitId(reverted.state)!;
    expect(reverted.state.commits[id].createdBy).toBe("revert");
    expect(reverted.state.commits[id].parents).toEqual(["C1"]);
    expect(reverted.state.commits[id].snapshot["app.ts"]).toBe("base");
  });
});
