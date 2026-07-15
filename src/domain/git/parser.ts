export type DiffMode = "working" | "staged" | "head";
export type ResetMode = "soft" | "mixed" | "hard";
export type ParsedCommand =
  | { readonly kind: "init" }
  | { readonly kind: "branch-list" } | { readonly kind: "branch-create"; readonly name: string }
  | { readonly kind: "branch-delete"; readonly name: string; readonly force: boolean }
  | { readonly kind: "switch"; readonly name: string; readonly create: boolean }
  | { readonly kind: "status" } | { readonly kind: "log" }
  | { readonly kind: "add"; readonly path: string }
  | { readonly kind: "commit"; readonly message: string }
  | { readonly kind: "diff"; readonly mode: DiffMode }
  | { readonly kind: "restore"; readonly path: string; readonly staged: boolean }
  | { readonly kind: "reset"; readonly mode: ResetMode; readonly target: string }
  | { readonly kind: "reflog" }
  | { readonly kind: "show"; readonly target: string }
  | { readonly kind: "merge"; readonly branch: string; readonly squash: boolean }
  | { readonly kind: "merge-abort" }
  | { readonly kind: "remote-add"; readonly name: string; readonly url: string }
  | { readonly kind: "clone"; readonly url: string }
  | { readonly kind: "push"; readonly remote: string; readonly branch: string; readonly upstream: boolean }
  | { readonly kind: "fetch"; readonly remote: string; readonly branch?: string }
  | { readonly kind: "pull"; readonly remote: string; readonly branch: string; readonly rebase: boolean }
  | { readonly kind: "stash"; readonly action?: "save" | "apply" | "pop" }
  | { readonly kind: "revert"; readonly target: string }
  | { readonly kind: "amend"; readonly message?: string }
  | { readonly kind: "rebase"; readonly branch: string }
  | { readonly kind: "cherry-pick"; readonly target: string }
  | { readonly kind: "config"; readonly key: string; readonly value?: string }
  | { readonly kind: "blame"; readonly path: string }
  | { readonly kind: "help" } | { readonly kind: "show-state" } | { readonly kind: "undo" };

export type ParseFailure = { readonly ok: false; readonly type: "parse" | "invalid-argument" | "unsupported"; readonly message: string; readonly suggestion?: string };
export type ParseResult = { readonly ok: true; readonly command: ParsedCommand } | ParseFailure;

export function tokenize(input: string): readonly string[] {
  const tokens: string[] = []; const pattern = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|(\S+)/g;
  for (const match of input.matchAll(pattern)) tokens.push(match[1] ?? match[2] ?? match[3]); return tokens;
}

export function parseCommand(input: string): ParseResult {
  const tokens = tokenize(input.trim());
  if (!tokens.length) return { ok: false, type: "parse", message: "Bir komut yazmalısın." };
  if (tokens[0] === "help") return { ok: true, command: { kind: "help" } };
  if (tokens[0] === "undo") return { ok: true, command: { kind: "undo" } };
  if (tokens[0] === "show" && tokens[1] === "state") return { ok: true, command: { kind: "show-state" } };
  if (tokens[0] !== "git") return { ok: false, type: "unsupported", message: "Bu terminal yalnızca Git ve eğitim komutlarını çalıştırır.", suggestion: "git status" };
  const sub = tokens[1];
  if (!sub) return { ok: false, type: "parse", message: "Git alt komutu eksik.", suggestion: "git status" };
  if (sub === "swtich") return { ok: false, type: "unsupported", message: "'swtich' isimli bir Git alt komutu yok.", suggestion: `git switch${tokens[2] ? ` ${tokens[2]}` : ""}` };
  if (sub === "init") return tokens.length === 2 ? { ok: true, command: { kind: "init" } } : { ok: false, type: "invalid-argument", message: "git init bu simülasyonda argüman kabul etmiyor." };
  if (sub === "branch") { if (!tokens[2] || tokens[2] === "--sort=-committerdate") return { ok: true, command: { kind: "branch-list" } }; const force = tokens[2] === "-D"; const remove = force || tokens[2] === "-d"; const name = tokens[remove ? 3 : 2]; if (!name || tokens.length > (remove ? 4 : 3)) return { ok: false, type: "invalid-argument", message: "Branch adı tek bir argüman olmalı." }; return { ok: true, command: remove ? { kind: "branch-delete", name, force } : { kind: "branch-create", name } }; }
  if (sub === "switch" || sub === "checkout") { const flag = sub === "switch" ? "-c" : "-b"; const create = tokens[2] === flag; const name = tokens[create ? 3 : 2]; if (!name) return { ok: false, type: "invalid-argument", message: "Geçilecek branch adı eksik.", suggestion: `git ${sub} ${flag} feature` }; return { ok: true, command: { kind: "switch", name, create } }; }
  if (sub === "status") return tokens.length === 2 ? { ok: true, command: { kind: "status" } } : { ok: false, type: "invalid-argument", message: "git status bu simülasyonda seçenek kabul etmiyor." };
  if (sub === "log") return { ok: true, command: { kind: "log" } };
  if (sub === "add") { if (!tokens[2]) return { ok: false, type: "invalid-argument", message: "Stage edilecek dosya eksik.", suggestion: "git add <dosya>" }; if (tokens.length > 3) return { ok: false, type: "invalid-argument", message: "Bu dilimde dosyaları tek tek veya git add . ile ekleyebilirsin." }; return { ok: true, command: { kind: "add", path: tokens[2] } }; }
  if (sub === "commit" && tokens[2] === "--amend") return { ok: true, command: { kind: "amend", message: tokens[3] === "-m" ? tokens[4] : undefined } };
  if (sub === "commit") { if (tokens[2] !== "-m") return { ok: false, type: "invalid-argument", message: "Commit mesajı -m seçeneğiyle verilmelidir.", suggestion: 'git commit -m "mesaj"' }; if (tokens.length < 4 || tokens[3].trim() === "") return { ok: false, type: "invalid-argument", message: "Commit mesajı boş olamaz.", suggestion: 'git commit -m "anlamlı mesaj"' }; if (tokens.length > 4) return { ok: false, type: "invalid-argument", message: "Commit mesajını tırnak içine al." }; return { ok: true, command: { kind: "commit", message: tokens[3] } }; }
  if (sub === "diff") { const option = tokens[2]; if (tokens.length > 3) return { ok: false, type: "invalid-argument", message: "git diff için fazla argüman var." }; if (!option) return { ok: true, command: { kind: "diff", mode: "working" } }; if (option === "--staged" || option === "--cached") return { ok: true, command: { kind: "diff", mode: "staged" } }; if (option === "HEAD") return { ok: true, command: { kind: "diff", mode: "head" } }; return { ok: false, type: "invalid-argument", message: `'${option}' diff seçeneği desteklenmiyor.`, suggestion: "git diff --staged" }; }
  if (sub === "restore") { const staged = tokens[2] === "--staged"; const path = tokens[staged ? 3 : 2]; if (!path) return { ok: false, type: "invalid-argument", message: "Geri yüklenecek dosya adı eksik.", suggestion: "git restore <dosya>" }; if (tokens.length > (staged ? 4 : 3)) return { ok: false, type: "invalid-argument", message: "git restore tek bir dosya argümanı bekler." }; return { ok: true, command: { kind: "restore", path, staged } }; }
  if (sub === "reset") { let mode: ResetMode = "mixed"; let target = "HEAD~1"; const args = tokens.slice(2); for (const arg of args) { if (arg === "--soft") mode = "soft"; else if (arg === "--mixed") mode = "mixed"; else if (arg === "--hard") mode = "hard"; else if (arg.startsWith("--")) return { ok: false, type: "invalid-argument", message: `'${arg}' reset seçeneği desteklenmiyor.`, suggestion: "git reset --soft HEAD~1" }; else target = arg; } return { ok: true, command: { kind: "reset", mode, target } }; }
  if (sub === "reflog") return tokens.length === 2 ? { ok: true, command: { kind: "reflog" } } : { ok: false, type: "invalid-argument", message: "git reflog bu simülasyonda seçenek kabul etmiyor." };
  if (sub === "show") return tokens[2] ? { ok: true, command: { kind: "show", target: tokens[2] } } : { ok: false, type: "invalid-argument", message: "Gösterilecek commit eksik.", suggestion: "git show HEAD" };
  if (sub === "merge" && tokens[2] === "--abort") return tokens.length === 3 ? { ok: true, command: { kind: "merge-abort" } } : { ok: false, type: "invalid-argument", message: "git merge --abort ek argüman kabul etmez." };
  if (sub === "merge") { const squash = tokens[2] === "--squash"; const branch = tokens[squash ? 3 : 2]; return branch ? { ok: true, command: { kind: "merge", branch, squash } } : { ok: false, type: "invalid-argument", message: "Birleştirilecek branch eksik." }; }
  if (sub === "remote" && tokens[2] === "add") return tokens[3] && tokens[4] ? { ok: true, command: { kind: "remote-add", name: tokens[3], url: tokens[4] } } : { ok: false, type: "invalid-argument", message: "Remote adı ve URL gerekli.", suggestion: "git remote add origin https://ornek/repo.git" };
  if (sub === "clone") return tokens[2] ? { ok: true, command: { kind: "clone", url: tokens[2] } } : { ok: false, type: "invalid-argument", message: "Clone URL'si eksik." };
  if (sub === "push") { const upstream = tokens[2] === "-u"; const offset = upstream ? 1 : 0; return { ok: true, command: { kind: "push", remote: tokens[2 + offset] ?? "origin", branch: tokens[3 + offset] ?? "main", upstream } }; }
  if (sub === "fetch") return { ok: true, command: { kind: "fetch", remote: tokens[2] ?? "origin", branch: tokens[3] } };
  if (sub === "pull") { const rebase = tokens[2] === "--rebase"; const offset = rebase ? 1 : 0; return { ok: true, command: { kind: "pull", remote: tokens[2 + offset] ?? "origin", branch: tokens[3 + offset] ?? "main", rebase } }; }
  if (sub === "stash") { const action = tokens[2]; if (!action || action === "push") return { ok: true, command: { kind: "stash" } }; if (action === "apply" || action === "pop") return { ok: true, command: { kind: "stash", action } }; return { ok: false, type: "invalid-argument", message: `git stash ${action} bu simülasyonda desteklenmiyor.`, suggestion: "git stash apply" }; }
  if (sub === "revert") return tokens[2] ? { ok: true, command: { kind: "revert", target: tokens[2] } } : { ok: false, type: "invalid-argument", message: "Geri alınacak commit eksik.", suggestion: "git revert HEAD" };
  if (sub === "rebase") return tokens[2] && tokens[2] !== "-i" ? { ok: true, command: { kind: "rebase", branch: tokens[2] } } : { ok: false, type: "unsupported", message: "Etkileşimli rebase terminal editörü gerektirdiği için bu simülasyonda gösterim amaçlıdır.", suggestion: "git rebase main" };
  if (sub === "cherry-pick") return tokens[2] ? { ok: true, command: { kind: "cherry-pick", target: tokens[2] } } : { ok: false, type: "invalid-argument", message: "Taşınacak commit eksik." };
  if (sub === "config") return tokens[2] ? { ok: true, command: { kind: "config", key: tokens[2] === "--global" ? tokens[3] : tokens[2], value: tokens[2] === "--global" ? tokens[4] : tokens[3] } } : { ok: false, type: "invalid-argument", message: "Config anahtarı eksik." };
  if (sub === "blame") return tokens[2] ? { ok: true, command: { kind: "blame", path: tokens[2] } } : { ok: false, type: "invalid-argument", message: "İncelenecek dosya eksik." };
  return { ok: false, type: "unsupported", message: `'${sub}' bu eğitim diliminde desteklenmiyor.`, suggestion: "help" };
}
