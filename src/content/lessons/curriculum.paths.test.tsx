import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConceptActivity } from "@/components/lessons/ConceptActivity";
import { executeCommand, updateWorkingFile } from "@/domain/git/engine";
import { headCommitId } from "@/domain/git/models";
import { parseCommand } from "@/domain/git/parser";
import { commandFamily, emptySession, evaluateConditions, type LessonSession } from "@/domain/lessons/models";
import { curriculumLessons } from "./curriculum";

const lessonIds = [
  "concepts/1-1-version-control",
  "concepts/1-2-time-machine",
  "concepts/1-3-three-areas",
  "local/2-1-init",
  "basics/01-workspace",
  "basics/02-staging",
  "basics/03-commit",
  "basics/04-log",
  "basics/05-diff",
  "history/3-2-restore",
  "history/3-3-show",
  "branching/4-1-concept",
  "branching/4-2-create-switch",
  "branching/4-3-isolation",
  "merging/5-1-fast-forward",
  "merging/5-2-three-way",
  "merging/5-3-conflict",
  "remotes/6-1-concept",
  "remotes/6-2-push",
  "remotes/6-3-fetch-pull",
  "collaboration/7-1-pr",
  "collaboration/7-2-sync",
  "collaboration/7-3-final",
  "advanced/8-1-stash",
  "advanced/8-2-edit-history",
  "advanced/8-3-rebase",
  "advanced/8-4-cherry-pick",
  "advanced/8-5-archaeology",
  "advanced/8-6-config",
] as const;

const commandPaths: Readonly<Record<string, readonly string[]>> = {
  "local/2-1-init": ["git init"],
  "basics/01-workspace": ["git status"],
  "basics/02-staging": ["git add merhaba.txt"],
  "basics/03-commit": ['git commit -m "ilk commit"'],
  "basics/04-log": ["git log"],
  "basics/05-diff": ["git status", "git diff"],
  "history/3-2-restore": ["git diff", "git restore README.md"],
  "history/3-3-show": ["git log", "git show HEAD"],
  "branching/4-2-create-switch": ["git branch", "git switch -c deneme"],
  "branching/4-3-isolation": ["git status", "git switch main"],
  "merging/5-1-fast-forward": ["git switch main", "git merge banana"],
  "merging/5-2-three-way": ["git log --graph", "git merge banana"],
  "merging/5-3-conflict": ["git merge banana", "git status", "git add README.md", 'git commit -m "conflict çözüldü"'],
  "remotes/6-2-push": ["git push -u origin main"],
  "remotes/6-3-fetch-pull": ["git fetch origin main", "git pull origin main"],
  "collaboration/7-2-sync": ["git fetch origin", "git pull origin main"],
  "collaboration/7-3-final": ["git switch -c feature/final", "git add .", 'git commit -m "özelliği tamamla"', "git push -u origin feature/final"],
  "advanced/8-1-stash": ["git stash", "git status", "git stash apply"],
  "advanced/8-2-edit-history": ['git commit --amend -m "daha iyi mesaj"', "git reflog"],
  "advanced/8-3-rebase": ["git rebase main"],
  "advanced/8-4-cherry-pick": ["git cherry-pick C2"],
  "advanced/8-5-archaeology": ["git log README.md", "git blame README.md"],
  "advanced/8-6-config": ['git config --global user.name "Örnek Kullanıcı"', 'git config --global user.email "kullanici@example.invalid"'],
};

const conceptActivities = {
  "concepts/1-1-version-control": "timeline",
  "concepts/1-2-time-machine": "time-machine",
  "concepts/1-3-three-areas": "three-areas",
  "branching/4-1-concept": "branch-metaphor",
  "remotes/6-1-concept": "remote-flow",
  "collaboration/7-1-pr": "collaboration-flow",
} as const;

function runCommandPath(lessonId: string) {
  const lesson = curriculumLessons.find(item => item.id === lessonId);
  if (!lesson) throw new Error(`Ders bulunamadı: ${lessonId}`);
  const commands = commandPaths[lessonId];
  let state = lesson.initialRepositoryState;
  let session: LessonSession = emptySession();

  expect(evaluateConditions(state, lesson.successConditions, session, lesson.initialRepositoryState)).toBe(false);

  commands.forEach((text, index) => {
    if (lessonId === "merging/5-3-conflict" && text === "git add README.md") state = updateWorkingFile(state, "README.md", "# Pusula\nAna dal ve banana birlikte");
    const parsed = parseCommand(text);
    expect(parsed, `${lessonId}: ${text} parse edilemedi`).toMatchObject({ ok: true });
    if (!parsed.ok) return;

    const outcome = executeCommand(state, parsed.command);
    expect(outcome.error, `${lessonId}: ${text} engine hatası`).toBeUndefined();
    if (outcome.error) return;

    state = outcome.state;
    const mode = parsed.command.kind === "diff" ? parsed.command.mode : parsed.command.kind === "restore" ? (parsed.command.staged ? "staged" : undefined) : undefined;
    const family = commandFamily(parsed.command.kind, mode);
    if (family) session = { executedCommands: [...session.executedCommands, family] };

    const isCriticalPrefix = index < commands.length - 1 && lessonId !== "advanced/8-2-edit-history";
    if (isCriticalPrefix) {
      expect(evaluateConditions(state, lesson.successConditions, session, lesson.initialRepositoryState), `${lessonId}: ${index + 1}. adımda erken tamamlandı`).toBe(false);
    }
  });

  expect(evaluateConditions(state, lesson.successConditions, session, lesson.initialRepositoryState), `${lessonId}: geçerli yol sonunda tamamlanmadı`).toBe(true);
  return { lesson, state, session };
}

describe("29 derslik müfredat sözleşmesi", () => {
  it("exact lesson ID fixture seti ile birebir eşleşir", () => {
    expect(curriculumLessons.map(lesson => lesson.id)).toEqual(lessonIds);
    expect(new Set(curriculumLessons.map(lesson => lesson.id)).size).toBe(29);
  });

  it("6 kavram ve 23 terminal dersini eksiksiz sınıflandırır", () => {
    expect(Object.keys(conceptActivities)).toHaveLength(6);
    expect(Object.keys(commandPaths)).toHaveLength(23);
    expect([...Object.keys(conceptActivities), ...Object.keys(commandPaths)].sort()).toEqual([...lessonIds].sort());
    for (const [id, activity] of Object.entries(conceptActivities)) {
      expect(curriculumLessons.find(lesson => lesson.id === id)?.activity).toBe(activity);
    }
  });

  it.each(Object.keys(commandPaths))("%s prescribed terminal yoluyla tamamlanır", lessonId => {
    runCommandPath(lessonId);
  });

  it("final takım yolunda branch, HEAD, commit ve remote aynı sonucu gösterir", () => {
    const { lesson, state } = runCommandPath("collaboration/7-3-final");
    const target = headCommitId(state);

    expect(state.head).toEqual({ kind: "branch", name: "feature/final" });
    expect(target).not.toBeNull();
    expect(target).not.toBe(headCommitId(lesson.initialRepositoryState));
    expect(Object.keys(state.commits)).toHaveLength(Object.keys(lesson.initialRepositoryState.commits).length + 1);
    expect(state.branches["feature/final"].target).toBe(target);
    expect(state.branches["feature/final"].upstream).toBe("origin/feature/final");
    expect(state.remotes.origin.branches["feature/final"]).toBe(target);
  });

  it("ayrışmış merge ortak ata tabanlı three-way sonucu ve iki parent üretir", () => {
    const lesson = curriculumLessons.find(item => item.id === "merging/5-2-three-way")!;
    const outcome = executeCommand(lesson.initialRepositoryState, { kind: "merge", branch: "banana", squash: false });

    expect(outcome.error).toBeUndefined();
    expect(outcome.output.join(" ")).toContain("three-way");
    const head = headCommitId(outcome.state)!;
    expect(outcome.state.commits[head].parents).toHaveLength(2);
  });

  it("final takım dersi yalnız komut-family session'ı ile, repository değişmeden tamamlanmamalı", () => {
    const lesson = curriculumLessons.find(item => item.id === "collaboration/7-3-final")!;
    const forgedSession: LessonSession = { executedCommands: ["switch", "add", "commit", "push"] };

    expect(evaluateConditions(lesson.initialRepositoryState, lesson.successConditions, forgedSession, lesson.initialRepositoryState)).toBe(false);
  });
});

describe("6 kavram dersinin gerçek etkileşim tamamlanma yolları", () => {
  it.each(Object.entries(conceptActivities))("%s (%s) etkileşimleri bitirilmeden tamamlanmaz ve doğru yol sonunda tamamlanır", (lessonId, activity) => {
    const lesson = curriculumLessons.find(item => item.id === lessonId)!;
    const complete = vi.fn();
    const preview = vi.fn();
    render(<ConceptActivity activity={activity} initialState={lesson.initialRepositoryState} onPreviewChange={preview} onComplete={complete} />);

    const finish = screen.getByRole("button", { name: "Görevi tamamla" });
    expect(finish).toBeDisabled();

    if (activity === "timeline") {
      ["odev_final.docx", "odev_final_SON.docx", "odev_final_SON_gercek.docx"].forEach(name => fireEvent.click(screen.getByText(name).closest("button")!));
    } else if (activity === "time-machine") {
      const slider = screen.getByLabelText("Commit zaman çizgisi");
      fireEvent.change(slider, { target: { value: "0" } });
      fireEvent.change(slider, { target: { value: "1" } });
    } else if (activity === "three-areas") {
      fireEvent.click(screen.getByRole("button", { name: /git add/ }));
      expect(finish).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: /git commit/ }));
    } else {
      const steps = screen.getAllByRole("button").filter(button => button !== finish);
      expect(steps).toHaveLength(3);
      steps.forEach((button, index) => {
        expect(button, `${lessonId}: ${index + 1}. akış adımı erişilebilir değil`).toBeEnabled();
        fireEvent.click(button);
      });
    }

    expect(preview).toHaveBeenCalled();
    expect(finish).toBeEnabled();
    fireEvent.click(finish);
    expect(complete).toHaveBeenCalledOnce();
  });
});
