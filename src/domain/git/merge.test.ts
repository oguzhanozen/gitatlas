import { describe, expect, it } from "vitest";
import { executeCommand, updateWorkingFile } from "./engine";
import { findMergeBase, threeWayMergeSnapshots } from "./merge";
import { makeCommit, type RepositoryState } from "./models";

const conflictState = (): RepositoryState => ({
  initialized: true,
  commits: {
    C0: makeCommit("C0", "base", [], { "README.md": "base", "shared.txt": "same" }, "init"),
    C1: makeCommit("C1", "ours", ["C0"], { "README.md": "ours", "shared.txt": "same", "ours.txt": "ours" }),
    C2: makeCommit("C2", "theirs", ["C0"], { "README.md": "theirs", "shared.txt": "same", "theirs.txt": "theirs" }),
  },
  branches: { main: { name: "main", target: "C1" }, feature: { name: "feature", target: "C2" } },
  head: { kind: "branch", name: "main" },
  workingTree: { "README.md": "ours", "shared.txt": "same", "ours.txt": "ours" },
  index: { entries: {} }, tags: {}, stashes: [], remotes: {}, reflog: [], nextCommitNumber: 3,
});

describe("three-way merge", () => {
  it("ortak atayı DAG üzerinde bulur", () => expect(findMergeBase(conflictState(), "C1", "C2")).toBe("C0"));

  it("tek taraflı değişiklikleri otomatik birleştirir ve çift taraflı değişikliği conflict yapar", () => {
    const merged = threeWayMergeSnapshots(
      { "README.md": "base", "shared.txt": "same" },
      { "README.md": "ours", "shared.txt": "same", "ours.txt": "ours" },
      { "README.md": "theirs", "shared.txt": "same", "theirs.txt": "theirs" },
      "feature",
    );
    expect(merged.snapshot["ours.txt"]).toBe("ours");
    expect(merged.snapshot["theirs.txt"]).toBe("theirs");
    expect(merged.snapshot["README.md"]).toContain("<<<<<<< HEAD");
    expect(merged.conflicts["README.md"]).toMatchObject({ base: "base", ours: "ours", theirs: "theirs", resolved: false });
  });

  it("conflict lifecycle: status, edit, add ve iki parent'lı commit", () => {
    const started = executeCommand(conflictState(), { kind: "merge", branch: "feature", squash: false });
    expect(started.state.merge).toMatchObject({ mergeBase: "C0", ours: "C1", theirs: "C2" });
    expect(started.state.index.entries["theirs.txt"]).toBe("theirs");
    expect(executeCommand(started.state, { kind: "commit", message: "erken" }).error?.message).toContain("çözülmemiş");
    expect(executeCommand(started.state, { kind: "status" }).output.join(" ")).toContain("Unmerged paths");

    const edited = updateWorkingFile(started.state, "README.md", "ours + theirs");
    const staged = executeCommand(edited, { kind: "add", path: "README.md" });
    expect(staged.state.merge?.conflicts["README.md"].resolved).toBe(true);
    const committed = executeCommand(staged.state, { kind: "commit", message: "feature birleştir" });
    expect(committed.error).toBeUndefined();
    expect(committed.state.commits.C3.parents).toEqual(["C1", "C2"]);
    expect(committed.state.commits.C3.snapshot["README.md"]).toBe("ours + theirs");
    expect(committed.state.merge).toBeUndefined();
  });

  it("marker dururken add'i reddeder ve abort tam pre-merge state'i geri yükler", () => {
    const initial = conflictState();
    const started = executeCommand(initial, { kind: "merge", branch: "feature", squash: false });
    expect(executeCommand(started.state, { kind: "add", path: "README.md" }).error?.message).toContain("marker");
    const aborted = executeCommand(started.state, { kind: "merge-abort" });
    expect(aborted.state.workingTree).toEqual(initial.workingTree);
    expect(aborted.state.index).toEqual(initial.index);
    expect(aborted.state.branches).toEqual(initial.branches);
    expect(aborted.state.merge).toBeUndefined();
  });

  it("merge çözümü add sonrası yeniden düzenlenirse commit index sürümünü alır ve unstaged working sürümünü korur",()=>{const started=executeCommand(conflictState(),{kind:"merge",branch:"feature",squash:false});const resolved=updateWorkingFile(started.state,"README.md","staged çözüm");const staged=executeCommand(resolved,{kind:"add",path:"README.md"});const editedAgain=updateWorkingFile(staged.state,"README.md","commit dışı sonraki düzenleme");const committed=executeCommand(editedAgain,{kind:"commit",message:"merge"});expect(committed.state.commits.C3.snapshot["README.md"]).toBe("staged çözüm");expect(committed.state.workingTree["README.md"]).toBe("commit dışı sonraki düzenleme")});
});

describe("remote tracking and integration", () => {
  const remoteState = (): RepositoryState => {
    const local = conflictState();
    return {
      ...local,
      branches: { main: { name: "main", target: "C1" } },
      remotes: { origin: { name: "origin", url: "https://example.invalid/repo.git", branches: { main: "C2" }, commits: { C0: local.commits.C0, C2: local.commits.C2 } } },
    };
  };

  it("fetch yalnız object store ve remote-tracking ref'i günceller", () => {
    const initial = remoteState();
    const fetched = executeCommand(initial, { kind: "fetch", remote: "origin", branch: "main" });
    expect(fetched.state.remoteTracking?.["origin/main"]).toBe("C2");
    expect(fetched.state.branches).toEqual(initial.branches);
    expect(fetched.state.workingTree).toEqual(initial.workingTree);
    expect(fetched.state.index).toEqual(initial.index);
  });

  it("pull fetch sonrası divergence conflict akışını başlatır", () => {
    const pulled = executeCommand(remoteState(), { kind: "pull", remote: "origin", branch: "main", rebase: false });
    expect(pulled.state.remoteTracking?.["origin/main"]).toBe("C2");
    expect(pulled.state.merge).toMatchObject({ sourceName: "origin/main", theirs: "C2" });
  });

  it("push non-fast-forward güncellemeyi reddeder", () => {
    const pushed = executeCommand(remoteState(), { kind: "push", remote: "origin", branch: "main", upstream: false });
    expect(pushed.error?.message).toContain("Push reddedildi");
    expect(pushed.state.remotes.origin.branches.main).toBe("C2");
  });
  it("olmayan local branch için HEAD fallback ile push yapmaz",()=>{const pushed=executeCommand(remoteState(),{kind:"push",remote:"origin",branch:"yok",upstream:false});expect(pushed.error?.message).toContain("yerel branch bulunamadı");expect(pushed.state).toBe(pushed.previousState)});
});
