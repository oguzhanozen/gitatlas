import { describe, expect, it } from "vitest"; import { parseCommand, tokenize } from "./parser";
describe("command parser", () => { it("tırnakları korur", () => expect(tokenize('git commit -m "ilk commit"')).toEqual(["git", "commit", "-m", "ilk commit"])); it.each([["git add README.md", { kind: "add", path: "README.md" }], ["git add .", { kind: "add", path: "." }], ["git commit -m \"ilk commit\"", { kind: "commit", message: "ilk commit" }], ["git commit -m 'ilk commit'", { kind: "commit", message: "ilk commit" }], ["git diff --staged", { kind: "diff", mode: "staged" }], ["git diff --cached", { kind: "diff", mode: "staged" }], ["git diff HEAD", { kind: "diff", mode: "head" }]])("%s parse edilir", (input, command) => expect(parseCommand(input)).toEqual({ ok: true, command })); it.each(["git add", "git commit", "git commit -m", 'git commit -m ""', "git diff --unknown"])("%s açıklayıcı invalid argument üretir", input => expect(parseCommand(input)).toMatchObject({ ok: false, type: "invalid-argument" })); it("yazım hatasında öneri verir", () => expect(parseCommand("git swtich main")).toMatchObject({ ok: false, suggestion: "git switch main" })) });
describe("restore parser", () => { it("git restore README.md parse eder", () => expect(parseCommand("git restore README.md")).toEqual({ ok: true, command: { kind: "restore", path: "README.md", staged: false } })); it("git restore --staged README.md parse eder", () => expect(parseCommand("git restore --staged README.md")).toEqual({ ok: true, command: { kind: "restore", path: "README.md", staged: true } })); it("dosya eksik olduğunda hata verir", () => expect(parseCommand("git restore")).toMatchObject({ ok: false, type: "invalid-argument" })); it("--staged dosya eksik olduğunda hata verir", () => expect(parseCommand("git restore --staged")).toMatchObject({ ok: false, type: "invalid-argument" })); it("fazla argüman reddeder", () => expect(parseCommand("git restore a.ts b.ts")).toMatchObject({ ok: false, type: "invalid-argument" })) });
describe("reset parser", () => { it("git reset --soft HEAD~1 parse eder", () => expect(parseCommand("git reset --soft HEAD~1")).toEqual({ ok: true, command: { kind: "reset", mode: "soft", target: "HEAD~1" } })); it("git reset --hard C0 parse eder", () => expect(parseCommand("git reset --hard C0")).toEqual({ ok: true, command: { kind: "reset", mode: "hard", target: "C0" } })); it("varsayılan olarak mixed HEAD~1 kullanır", () => expect(parseCommand("git reset")).toEqual({ ok: true, command: { kind: "reset", mode: "mixed", target: "HEAD~1" } })); it("bilinmeyen seçeneği reddeder", () => expect(parseCommand("git reset --ultra")).toMatchObject({ ok: false, type: "invalid-argument" })) });
describe("reflog parser", () => { it("git reflog parse eder", () => expect(parseCommand("git reflog")).toEqual({ ok: true, command: { kind: "reflog" } })); it("fazla argüman reddeder", () => expect(parseCommand("git reflog show")).toMatchObject({ ok: false, type: "invalid-argument" })) });
describe("curriculum commands", () => {
  it.each([
    ["git init", { kind: "init" }],
    ["git merge banana", { kind: "merge", branch: "banana", squash: false }],
    ["git remote add origin https://example.com/repo.git", { kind: "remote-add", name: "origin", url: "https://example.com/repo.git" }],
    ["git push -u origin main", { kind: "push", remote: "origin", branch: "main", upstream: true }],
    ["git fetch origin main", { kind: "fetch", remote: "origin", branch: "main" }],
    ["git pull --rebase origin main", { kind: "pull", remote: "origin", branch: "main", rebase: true }],
    ["git stash", { kind: "stash" }],
    ["git rebase main", { kind: "rebase", branch: "main" }],
    ["git cherry-pick C2", { kind: "cherry-pick", target: "C2" }],
  ])("%s parse edilir", (input, command) => expect(parseCommand(input)).toEqual({ ok: true, command }));
});
describe("recovery command parser", () => {
  it.each([
    ["git merge --abort", { kind: "merge-abort" }],
    ["git stash", { kind: "stash" }],
    ["git stash push", { kind: "stash" }],
    ["git stash apply", { kind: "stash", action: "apply" }],
    ["git stash pop", { kind: "stash", action: "pop" }],
    ["git revert HEAD", { kind: "revert", target: "HEAD" }],
  ])("%s tam davranışa parse edilir", (input, command) => expect(parseCommand(input)).toEqual({ ok: true, command }));
  it.each(["git merge --abort extra", "git stash drop", "git revert"])("%s geçersiz kullanımı reddeder", input => expect(parseCommand(input)).toMatchObject({ ok: false, type: "invalid-argument" }));
});
