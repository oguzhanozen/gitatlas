import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LessonWorkspace } from "./LessonWorkspace";
import { workspaceLesson, stagingLesson, commitLesson } from "@/content/lessons/beginner-lessons";
import { chapters } from "@/content/lessons";
import { firstFeatureBranchLesson } from "@/content/lessons/first-feature-branch";
import { makeCommit, type RepositoryState } from "@/domain/git/models";
import type { LessonDefinition } from "@/domain/lessons/models";

const dismissBriefing = () => {
    const btn = screen.queryByRole("button", { name: /Öğrendim/i });
    if (btn) fireEvent.click(btn);
};

const run = (command: string) => {
    dismissBriefing();
    const input = screen.getByLabelText("Git komutu");
    fireEvent.change(input, { target: { value: command } });
    fireEvent.submit(input.closest("form")!)
};

describe("lesson vertical slices", () => {
    afterEach(() => vi.restoreAllMocks());
    it("workspace dersini korur (git status)", () => { render(<LessonWorkspace lesson={workspaceLesson} />); run("git status"); expect(screen.getByText("Görev tamamlandı.")).toBeInTheDocument() });
    it("git add staging panelini günceller", () => { render(<LessonWorkspace lesson={stagingLesson} />); run("git add merhaba.txt"); expect(screen.getByText("STAGED NEW")).toBeInTheDocument(); expect(screen.getByText("Görev tamamlandı.")).toBeInTheDocument() });
    it("commit graph node sayısını, HEAD ve branch'i ilerletir", () => { render(<LessonWorkspace lesson={commitLesson} />); run('git commit -m "ilk commit"'); expect(screen.getByText(/1 commit · 1 branch/)).toBeInTheDocument(); expect(screen.getAllByText(/HEAD → main/).length).toBeGreaterThan(0) });
    it("hatalı commit state'i değiştirmez", () => { render(<LessonWorkspace lesson={stagingLesson} />); run('git commit -m "boş"'); expect(screen.getByText(/0 commit · 1 branch/)).toBeInTheDocument(); expect(screen.getByText(/staging area boş/)).toBeInTheDocument() });
    it("undo commit öncesi tam state'i getirir", () => { render(<LessonWorkspace lesson={commitLesson} />); run('git commit -m "belge"'); run("undo"); expect(screen.getByText(/0 commit · 1 branch/)).toBeInTheDocument(); expect(screen.getByText("STAGED NEW")).toBeInTheDocument() })
    it("her seviye girişinde net görev açıklamasını onaylatır", () => { const lesson = chapters[0].lessons[0]; render(<LessonWorkspace lesson={lesson} />); expect(screen.getByRole("dialog", { name: lesson.title })).toBeInTheDocument(); expect(screen.getByText("Bu seviyede senden beklenen")).toBeInTheDocument(); expect(screen.getAllByText(lesson.goalDescription).length).toBeGreaterThan(0); fireEvent.click(screen.getByRole("button", { name: /Seviye 1.1 görevine başla/ })); expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(screen.getByLabelText("Kavram etkileşimi")).toBeInTheDocument() });
    it("alt seviye için de kendi numarasıyla açıklama gösterir", () => { const lesson = chapters[0].lessons[1]; render(<LessonWorkspace lesson={lesson} />); expect(screen.getByRole("dialog", { name: lesson.title })).toBeInTheDocument(); expect(screen.getByText("Seviye 1.2")).toBeInTheDocument(); expect(screen.getByRole("button", { name: /Seviye 1.2 görevine başla/ })).toBeInTheDocument(); });
    it("seviye dialogunda ilk odağı kurar, Escape ile kapatır ve odağı açana döndürür", () => { const lesson = chapters[0].lessons[0]; render(<LessonWorkspace lesson={lesson} />); const confirm = screen.getByRole("button", { name: /görevine başla/ }); expect(confirm).toHaveFocus(); fireEvent.click(confirm); const opener = screen.getByRole("button", { name: "Seviye açıklamasını tekrar aç" }); opener.focus(); fireEvent.click(opener); expect(screen.getByRole("button", { name: /görevine başla/ })).toHaveFocus(); fireEvent.keyDown(document, { key: "Escape" }); expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(opener).toHaveFocus(); });
    it("oluşturulan branch'i commit graph üzerinde gösterir", () => { render(<LessonWorkspace lesson={firstFeatureBranchLesson} />); run("git switch -c feature/login"); expect(screen.getByText("HEAD → feature/login")).toBeInTheDocument(); });
    it("ilerleme yazılamadığında kullanıcıyı uyarır", async () => { vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("blocked"); }); render(<LessonWorkspace lesson={workspaceLesson} />); expect(await screen.findByRole("alert")).toHaveTextContent("İlerleme tarayıcıya kaydedilemedi"); });
    it("terminalde görünür Çalıştır kontrolü ve Enter ipucu sunar", () => { render(<LessonWorkspace lesson={workspaceLesson} />); dismissBriefing(); expect(screen.getByRole("button", { name: "Çalıştır" })).toBeInTheDocument(); expect(screen.getByText(/Enter tuşuna basabilir/)).toBeInTheDocument(); });
    it("conflict editöründeki çalışma kopyasını engine'e bağlar ve git add ile resolved yapar", () => {
        const baseCommit = makeCommit("C0", "base", [], { "app.ts": "base" }, "init"); const ours = makeCommit("C1", "ours", ["C0"], { "app.ts": "ours" }); const theirs = makeCommit("C2", "theirs", ["C0"], { "app.ts": "theirs" });
        const repository: RepositoryState = { initialized: true, commits: { C0: baseCommit, C1: ours, C2: theirs }, branches: { main: { name: "main", target: "C1" }, feature: { name: "feature", target: "C2" } }, head: { kind: "branch", name: "main" }, workingTree: { "app.ts": "<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> feature" }, index: { entries: {} }, tags: {}, stashes: [], remotes: {}, reflog: [], nextCommitNumber: 3, merge: { targetBranch: "main", sourceName: "feature", mergeBase: "C0", ours: "C1", theirs: "C2", preMergeWorkingTree: { "app.ts": "ours" }, preMergeIndex: { entries: {} }, conflicts: { "app.ts": { path: "app.ts", base: "base", ours: "ours", theirs: "theirs", resolved: false } } } };
        const lesson: LessonDefinition = { id: "conflict-ui-test", title: "Conflict", story: "test", goalDescription: "çöz", estimatedMinutes: 1, allowedCommands: ["git add"], hints: [], initialRepositoryState: repository, successConditions: [{ type: "file-staged", path: "app.ts" }], explanationAfterSuccess: "ok" };
        render(<LessonWorkspace lesson={lesson} />); const editor = screen.getByLabelText("Birleştirilmiş çalışma kopyası"); fireEvent.change(editor, { target: { value: "birleşmiş içerik" } }); expect(editor).toHaveValue("birleşmiş içerik"); run("git add app.ts"); expect(screen.getByText("ÇÖZÜLDÜ VE STAGE EDİLDİ")).toBeInTheDocument();
    });
});
