import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeCommit, type RepositoryState } from "@/domain/git/models";
import { buildGraphLayout, CommitGraph } from "./CommitGraph";

const base: RepositoryState = {
    initialized: true, commits: { C0: makeCommit("C0", "başlangıç", [], { "README.md": "# Proje" }, "init") },
    branches: { main: { name: "main", target: "C0" }, feature: { name: "feature", target: "C0" } }, head: { kind: "branch", name: "feature" },
    workingTree: { "README.md": "# Proje" }, index: { entries: {} }, tags: {}, stashes: [], remotes: {}, reflog: [], nextCommitNumber: 1,
};

describe("commit graph", () => {
    it("aynı commit üzerinde yeni branch ve aktif HEAD etiketini gösterir", () => { render(<CommitGraph state={base} />); expect(screen.getByText("main")).toBeInTheDocument(); expect(screen.getByText("HEAD → feature")).toBeInTheDocument(); });
    it("branch üzerinde oluşan commit'i ayrı lane'e yerleştirir", () => {
        const state: RepositoryState = { ...base, commits: { ...base.commits, C1: makeCommit("C1", "özellik", ["C0"], { "README.md": "# Proje", "feature.ts": "ok" }) }, branches: { ...base.branches, feature: { name: "feature", target: "C1" } } };
        const layout = buildGraphLayout(state); const root = layout.find(node => node.commit.id === "C0")!; const feature = layout.find(node => node.commit.id === "C1")!;
        expect(feature.depth).toBeGreaterThan(root.depth); expect(feature.lane).not.toBe(root.lane); expect(feature.y).not.toBe(root.y);
    });
    it("remote ve detached HEAD işaretçilerini commit üzerinde gösterir", () => {
        const state: RepositoryState = { ...base, head: { kind: "detached", target: "C0" }, remotes: { origin: { name: "origin", url: "https://example.com/repo.git", branches: { main: "C0" } } }, remoteTracking: { "origin/main": "C0" } };
        render(<CommitGraph state={state} />);
        expect(screen.getByText("origin/main")).toBeInTheDocument();
        expect(screen.getByText("HEAD (detached)")).toBeInTheDocument();
    });
    it("parent, HEAD, ref ve devam eden merge için metinsel eşdeğer sunar", () => {
        const state: RepositoryState = { ...base, head: { kind: "branch", name: "main" }, merge: { targetBranch: "main", sourceName: "feature", mergeBase: "C0", ours: "C0", theirs: "C0", preMergeWorkingTree: base.workingTree, preMergeIndex: base.index, conflicts: {} } };
        render(<CommitGraph state={state} />);
        expect(screen.getByRole("status")).toHaveTextContent("Henüz merge commit oluşmadı");
        expect(screen.getByText("Grafiğin metinsel eşdeğeri")).toBeInTheDocument();
        expect(screen.getByText(/HEAD: main branch'i → C0/)).toBeInTheDocument();
        expect(screen.getByText(/Devam eden merge: feature → main/)).toBeInTheDocument();
    });
});
