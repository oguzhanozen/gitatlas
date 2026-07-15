import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createLessonRepository } from "@/domain/git/models";
import { RepositoryPanel } from "./RepositoryPanel";

describe("repository panel", () => {
  it("değişiklik olmasa da Working Directory içindeki dosyaları gösterir", () => {
    render(<RepositoryPanel state={createLessonRepository()} />);

    expect(screen.getByText("WORKING DIRECTORY")).toBeInTheDocument();
    expect(screen.getAllByText("README.md").length).toBeGreaterThan(0);
    expect(screen.getAllByText("auth.ts").length).toBeGreaterThan(0);
    expect(screen.getAllByText("TRACKED")).toHaveLength(2);
  });
  it("conflict sürümlerini güvenli metin alanında gösterir ve düzenlemeyi üst katmana iletir", () => {
    const onChange = vi.fn();
    const base = createLessonRepository();
    const state = { ...base, workingTree: { ...base.workingTree, "auth.ts": "<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> feature" }, merge: { targetBranch: "main", sourceName: "feature", mergeBase: "C0", ours: "C1", theirs: "C0", preMergeWorkingTree: base.workingTree, preMergeIndex: base.index, conflicts: { "auth.ts": { path: "auth.ts", base: "base", ours: "ours", theirs: "theirs", resolved: false } } } };
    render(<RepositoryPanel state={state} onWorkingFileChange={onChange} />);
    expect(screen.getByRole("region", { name: "Merge conflict çözümü" })).toBeInTheDocument();
    expect(screen.getByText("Base · ortak ata")).toBeInTheDocument();
    const editor = screen.getByLabelText("Birleştirilmiş çalışma kopyası");
    expect((editor as HTMLTextAreaElement).value).toContain("<<<<<<< HEAD");
    fireEvent.change(editor, { target: { value: "birleşmiş içerik" } });
    expect(onChange).toHaveBeenCalledWith("auth.ts", "birleşmiş içerik");
  });
});
