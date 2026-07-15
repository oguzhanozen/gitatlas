import { makeCommit, type RepositoryState } from "@/domain/git/models";
import type { LessonDefinition } from "@/domain/lessons/models";

const twoCommitBase = (workingTree: Readonly<Record<string, string>>, index: Readonly<Record<string, string | null>> = {}): RepositoryState => ({
    initialized: true,
    commits: {
        C0: makeCommit("C0", "Proje iskeleti", [], { "README.md": "# Pusula\nKurulum yakında.", "config.ts": "export const port = 3000;" }, "init"),
        C1: makeCommit("C1", "Port güncelleme", ["C0"], { "README.md": "# Pusula\nKurulum yakında.", "config.ts": "export const port = 4000;" }),
    },
    branches: { main: { name: "main", target: "C1" } },
    head: { kind: "branch", name: "main" },
    workingTree,
    index: { entries: index },
    tags: {}, stashes: [], remotes: {}, reflog: [], nextCommitNumber: 2,
});

export const unstageFileLesson: LessonDefinition = {
    id: "basics/unstage-file",
    title: "Staged Değişikliği Geri Al",
    story: "İki dosyayı aynı anda stage ettin ama config.ts sonraki commit'e kalmalıydı. Yalnızca config.ts'yi unstage et.",
    goalDescription: "git restore --staged ile config.ts'yi staging area'dan çıkar. README.md staged kalsın.",
    estimatedMinutes: 4,
    allowedCommands: ["git status", "git diff --staged", "git restore --staged"],
    hints: [
        "Staging area'dan çıkarmak için restore komutunun --staged seçeneğini kullan.",
        "git restore --staged config.ts",
    ],
    initialRepositoryState: twoCommitBase(
        { "README.md": "# Pusula\nKurulum: npm install", "config.ts": "export const port = 5000;" },
        { "README.md": "# Pusula\nKurulum: npm install", "config.ts": "export const port = 5000;" },
    ),
    successConditions: [
        { type: "file-not-staged", path: "config.ts" },
        { type: "file-staged", path: "README.md" },
        { type: "head-on-branch", name: "main" },
    ],
    explanationAfterSuccess: "restore --staged, config.ts'nin index entry'sini sildi. Working directory'deki 5000 değeri korunuyor; istediğinde tekrar stage edebilirsin.",
};

export const restoreWorkingLesson: LessonDefinition = {
    id: "basics/restore-working",
    title: "Working Tree Değişikliğini Geri Al",
    story: "config.ts dosyasında port değerini değiştirdin ama bu değişiklikten vazgeçtin. Dosyayı index sürümüne geri döndür.",
    goalDescription: "git restore ile config.ts'yi index sürümüne geri yükle.",
    estimatedMinutes: 4,
    allowedCommands: ["git status", "git diff", "git restore"],
    hints: [
        "Working directory değişikliğini geri almak için git restore komutunu kullan.",
        "git restore config.ts",
    ],
    initialRepositoryState: twoCommitBase(
        { "README.md": "# Pusula\nKurulum yakında.", "config.ts": "export const port = 9999;" },
    ),
    successConditions: [
        { type: "file-has-no-unstaged-change", path: "config.ts" },
        { type: "index-clean" },
        { type: "head-on-branch", name: "main" },
    ],
    explanationAfterSuccess: "restore, working directory'deki config.ts'yi index (HEAD) sürümüne geri döndürdü. Dosya artık port = 4000 değerinde.",
};

export const resetModesLesson: LessonDefinition = {
    id: "basics/reset-modes",
    title: "Reset Modları",
    story: "Son commit hatalı bir port değeri içeriyor. HEAD'i bir commit geri alarak düzelteceksin.",
    goalDescription: "git reset ile HEAD'i C0 commit'ine geri taşı. İstediğin modu kullanabilirsin.",
    estimatedMinutes: 6,
    allowedCommands: ["git status", "git log", "git reflog", "git reset", "git diff"],
    hints: [
        "Commit'i geri almak için git reset komutunu kullan.",
        "Deneyebileceğin modlar: --soft (index korunur), --mixed (index sıfırlanır), --hard (her şey sıfırlanır).",
        "git reset --mixed HEAD~1",
    ],
    initialRepositoryState: twoCommitBase(
        { "README.md": "# Pusula\nKurulum yakında.", "config.ts": "export const port = 4000;" },
    ),
    successConditions: [
        { type: "head-points-to-commit", commitId: "C0" },
        { type: "head-on-branch", name: "main" },
        { type: "reflog-has-entries", minCount: 1 },
    ],
    explanationAfterSuccess: "HEAD ve main artık C0'ı gösteriyor. Reset modu ne seçilirse seçilsin, reflog bu hareketi kaydetti. git reflog ile geçmişi inceleyebilirsin.",
};
