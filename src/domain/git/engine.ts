import { effectiveIndexSnapshot, headCommitId, headSnapshot, makeCommit, type CommandResult, type CommitId, type RepositoryState } from "./models";
import { formatDiff, headChanges, isIndexClean, isWorkingTreeClean, stagedChanges, workingChanges } from "./files";
import type { ParsedCommand } from "./parser";
import { findMergeBase, hasConflictMarkers, isAncestor, snapshotDelta, threeWayMergeSnapshots } from "./merge";

const result = (state: RepositoryState, previousState: RepositoryState, output: readonly string[], extra: Partial<CommandResult> = {}): CommandResult => ({ state, previousState, output, warnings: [], animations: [], ...extra });
const stateError = (state: RepositoryState, message: string): CommandResult => result(state, state, [], { error: { type: "repository-state", message } });

function resolveTarget(state: RepositoryState, target: string): CommitId | null {
  const reflogMatch = target.match(/^HEAD@\{(\d+)\}$/);
  if (reflogMatch) { const position=Number(reflogMatch[1]);return position===0?headCommitId(state):state.reflog.at(-position)?.from??null; }
  const headMatch = target.match(/^HEAD~(\d+)$/);
  if (headMatch) { let id = headCommitId(state); const n = Number(headMatch[1]); for (let i = 0; i < n; i++) { if (!id) return null; const node = state.commits[id]; if (!node || !node.parents[0]) return i === n - 1 ? id : null; id = node.parents[0] } return id; }
  if (state.commits[target]) return target;
  return null;
}

function statusLines(state: RepositoryState): readonly string[] {
  const branch = state.head.kind === "branch" ? state.head.name : "detached HEAD"; const staged = stagedChanges(state); const working = workingChanges(state);
  if (state.merge) {
    const unresolved = Object.values(state.merge.conflicts).filter(conflict => !conflict.resolved);
    const resolved = Object.values(state.merge.conflicts).filter(conflict => conflict.resolved);
    return [
      `On branch ${branch}`,
      `You are merging '${state.merge.sourceName}' (MERGE_HEAD ${state.merge.theirs}).`,
      ...(unresolved.length ? ["", "Unmerged paths:", ...unresolved.map(conflict => `  both modified: ${conflict.path}`)] : []),
      ...(resolved.length ? ["", "Conflicts resolved and staged:", ...resolved.map(conflict => `  modified: ${conflict.path}`)] : []),
      unresolved.length ? "Fix conflicts and run git add <file>." : "All conflicts fixed; run git commit to conclude the merge.",
    ];
  }
  if (isWorkingTreeClean(state)) return [`On branch ${branch}`, "Working tree clean"];
  const lines: string[] = [`On branch ${branch}`];
  if (staged.length) lines.push("", "Changes to be committed:", ...staged.map(c => `  ${c.status.replace("staged-", "")}: ${c.path}`));
  const tracked = working.filter(c => c.status !== "untracked"); if (tracked.length) lines.push("", "Changes not staged for commit:", ...tracked.map(c => `  ${c.status}: ${c.path}`));
  const untracked = working.filter(c => c.status === "untracked"); if (untracked.length) lines.push("", "Untracked files:", ...untracked.map(c => `  ${c.path}`)); return lines;
}

function addFiles(current: RepositoryState, path: string): CommandResult {
  const head = headSnapshot(current); const candidates = path === "." ? Array.from(new Set([...Object.keys(current.workingTree), ...Object.keys(head)])).sort() : [path];
  if (path !== "." && !(path in current.workingTree) && !(path in head)) return stateError(current, `'${path}' working directory veya HEAD içinde bulunamadı.`);
  const entries = { ...current.index.entries }; let changed = false;
  const conflicts = current.merge ? { ...current.merge.conflicts } : undefined;
  for (const file of candidates) {
    const content = current.workingTree[file] ?? null;
    if (conflicts?.[file] && hasConflictMarkers(content)) return stateError(current, `'${file}' hâlâ conflict marker'ları içeriyor. Dosyayı düzenleyip marker'ları kaldır.`);
    if (content === (head[file] ?? null)) delete entries[file]; else entries[file] = content;
    if (conflicts?.[file]) conflicts[file] = { ...conflicts[file], resolved: true };
    if (current.index.entries[file] !== entries[file] || Boolean(current.merge?.conflicts[file] && !current.merge.conflicts[file].resolved)) changed = true;
  }
  if (!changed) return result(current, current, ["Stage edilecek yeni değişiklik yok."]);
  const next = { ...current, index: { entries }, ...(current.merge && conflicts ? { merge: { ...current.merge, conflicts } } : {}) }; return result(next, current, [path === "." ? "Tüm değişikliklerin güncel sürümü index'e kopyalandı." : `${path} dosyasının güncel sürümü index'e kopyalandı.`]);
}

function commit(current: RepositoryState, message: string): CommandResult {
  const unresolved = current.merge ? Object.values(current.merge.conflicts).filter(conflict => !conflict.resolved) : [];
  if (unresolved.length) return stateError(current, `Commit oluşturulamadı: ${unresolved.length} çözülmemiş conflict var. Dosyaları düzenleyip git add çalıştır.`);
  if (isIndexClean(current) && !current.merge) return stateError(current, "Commit oluşturulamadı: staging area boş.");
  if (current.head.kind !== "branch") return stateError(current, "Bu dilimde detached HEAD üzerinde commit desteklenmiyor.");
  const parent = headCommitId(current); const id = `C${current.nextCommitNumber}`; const snapshot = effectiveIndexSnapshot(current);
  const parents = current.merge ? [current.merge.ours, current.merge.theirs] : parent ? [parent] : [];
  const node = makeCommit(id, message, parents, snapshot, current.merge ? "merge" : "commit");
  const next: RepositoryState = { ...current, commits: { ...current.commits, [id]: node }, branches: { ...current.branches, [current.head.name]: { ...current.branches[current.head.name], name: current.head.name, target: id } }, workingTree: current.workingTree, index: { entries: {} }, merge: undefined, nextCommitNumber: current.nextCommitNumber + 1, reflog: [...current.reflog, { id: current.reflog.length, from: parent, to: id, action: `${current.merge ? "merge" : "commit"}: ${message}` }] };
  return result(next, current, [`[${current.head.name} ${id}] ${message}`], { animations: [{ type: "commit-created", commit: id, parent }], teachingMessage: "Commit, yalnızca index snapshot'ını kaydetti; unstaged working directory değişiklikleri korunur." });
}

function restoreFile(current: RepositoryState, path: string, staged: boolean): CommandResult {
  if (staged) {
    if (!(path in current.index.entries)) return stateError(current, `'${path}' staging area'da değil.`);
    const entries = { ...current.index.entries }; delete entries[path];
    const next = { ...current, index: { entries } };
    return result(next, current, [`'${path}' staging area'dan çıkarıldı (unstaged).`], { teachingMessage: "restore --staged, index entry'yi sildi; working directory değişikliği korunuyor." });
  }
  const indexSnapshot = effectiveIndexSnapshot(current);
  if (!(path in indexSnapshot) && !(path in current.workingTree)) return stateError(current, `'${path}' index veya working directory'de bulunamadı.`);
  if (current.workingTree[path] === indexSnapshot[path]) return result(current, current, [`'${path}' zaten index sürümüyle aynı.`]);
  const workingTree = { ...current.workingTree };
  if (path in indexSnapshot) workingTree[path] = indexSnapshot[path]; else delete workingTree[path];
  const next = { ...current, workingTree };
  return result(next, current, [`'${path}' index sürümüne geri yüklendi.`], { teachingMessage: "restore, working directory dosyasını index (staging area) sürümüne geri döndürdü." });
}

function resetCommand(current: RepositoryState, mode: "soft" | "mixed" | "hard", target: string): CommandResult {
  if (current.head.kind !== "branch") return stateError(current, "Bu dilimde detached HEAD üzerinde reset desteklenmiyor.");
  const targetId = resolveTarget(current, target);
  if (!targetId) return stateError(current, `'${target}' geçerli bir commit referansı değil.`);
  const from = headCommitId(current);
  if (from === targetId && mode !== "hard") return result(current, current, [`HEAD zaten ${targetId} üzerinde.`]);
  const targetCommit = current.commits[targetId];
  const branchName = current.head.name;
  const reflogEntry = { id: current.reflog.length, from, to: targetId, action: `reset: moving to ${targetId}` };
  if (mode === "soft") {
    /* Soft reset: index'in etkili içeriğini koru. Index delta'ları HEAD'e göre olduğundan, HEAD taşındığında yeni HEAD'e göre yeniden hesaplanmalı. */
    const oldEffective = effectiveIndexSnapshot(current); const newHeadSnapshot = targetCommit.snapshot;
    const newEntries: Record<string, string | null> = {};
    const allPaths = new Set([...Object.keys(oldEffective), ...Object.keys(newHeadSnapshot)]);
    for (const p of allPaths) { const eff = oldEffective[p] ?? null; const nh = newHeadSnapshot[p] ?? null; if (eff !== nh) newEntries[p] = eff; }
    const next: RepositoryState = { ...current, branches: { ...current.branches, [branchName]: { ...current.branches[branchName], target: targetId } }, index: { entries: newEntries }, reflog: [...current.reflog, reflogEntry] };
    return result(next, current, [`HEAD → ${targetId} (soft reset)`], { teachingMessage: "Soft reset yalnızca branch pointer'ını taşıdı. Index ve working directory değişmedi; önceki commit'in farkları staged olarak göründü." });
  }
  if (mode === "mixed") {
    const next: RepositoryState = { ...current, branches: { ...current.branches, [branchName]: { ...current.branches[branchName], target: targetId } }, index: { entries: {} }, reflog: [...current.reflog, reflogEntry] };
    return result(next, current, [`HEAD → ${targetId} (mixed reset)`], { teachingMessage: "Mixed reset branch pointer'ını taşıdı ve index'i temizledi. Working directory korundu; farklar unstaged olarak göründü." });
  }
  /* hard */
  const next: RepositoryState = { ...current, branches: { ...current.branches, [branchName]: { ...current.branches[branchName], target: targetId } }, index: { entries: {} }, workingTree: { ...targetCommit.snapshot }, reflog: [...current.reflog, reflogEntry] };
  return result(next, current, [`HEAD → ${targetId} (hard reset)`], { warnings: ["⚠ Hard reset working directory değişikliklerini geri dönüşümsüz siler!"], teachingMessage: "Hard reset her üç katmanı da hedef commit'e döndürdü. Kaybedilen working directory değişiklikleri geri alınamaz." });
}

function mergeTarget(current: RepositoryState, source: CommitId, sourceName: string, squash: boolean): CommandResult {
  if (current.head.kind !== "branch") return stateError(current, "Detached HEAD üzerinde merge desteklenmiyor.");
  if (current.merge) return stateError(current, "Önce devam eden merge'i tamamla veya git merge --abort çalıştır.");
  if (!isWorkingTreeClean(current)) return stateError(current, "Merge öncesinde working tree ve index temiz olmalı.");
  const target = headCommitId(current);
  if (source === target) return result(current, current, ["Already up to date."]);
  if (target && isAncestor(current, source, target)) return result(current, current, ["Already up to date."]);
  if (squash) {
    if (!target) return stateError(current, "Boş branch üzerinde squash merge desteklenmiyor.");
    const baseId = findMergeBase(current, target, source);
    const targetSnapshot = headSnapshot(current);
    const merged = threeWayMergeSnapshots(baseId ? current.commits[baseId]?.snapshot ?? {} : {}, targetSnapshot, current.commits[source].snapshot, sourceName);
    if (Object.keys(merged.conflicts).length) return stateError(current, "Squash merge conflict oluşturdu. Conflict çözme dersi normal git merge akışını kullanır; squash conflict bu simülasyonda kavramsal sınırdır.");
    const entries = snapshotDelta(targetSnapshot, merged.snapshot);
    return result({ ...current, workingTree: { ...merged.snapshot }, index: { entries } }, current, [`Squash merge '${sourceName}' değişikliklerinin birleşmiş sürümünü index'e kopyaladı.`], { teachingMessage: "Squash merge ortak ataya göre değişiklikleri birleştirdi fakat merge commit oluşturmadı; sonraki commit tek parent taşır." });
  }
  if (isAncestor(current, target, source)) {
    const snapshot = current.commits[source].snapshot;
    const next: RepositoryState = { ...current, branches: { ...current.branches, [current.head.name]: { ...current.branches[current.head.name], target: source } }, workingTree: { ...snapshot }, reflog: [...current.reflog, { id: current.reflog.length, from: target, to: source, action: `merge ${sourceName}: Fast-forward` }] };
    return result(next, current, [`Updating ${target ?? "boş"}..${source}`, "Fast-forward"], { animations: [{ type: "head-moved", from: target ?? "boş", to: source }], teachingMessage: "main ilerlemediği için yeni merge commit gerekmedi; branch işaretçisi ileri taşındı." });
  }
  if (!target) return stateError(current, "Boş branch üzerinde ayrışmış merge desteklenmiyor.");
  const baseId = findMergeBase(current, target, source);
  const baseSnapshot = baseId ? current.commits[baseId]?.snapshot ?? {} : {};
  const ours = headSnapshot(current);
  const theirs = current.commits[source].snapshot;
  const merged = threeWayMergeSnapshots(baseSnapshot, ours, theirs, sourceName);
  const conflictPaths = new Set(Object.keys(merged.conflicts));
  const entries = snapshotDelta(ours, merged.snapshot, conflictPaths);
  if (conflictPaths.size) {
    const next: RepositoryState = {
      ...current,
      workingTree: { ...merged.snapshot },
      index: { entries },
      merge: {
        targetBranch: current.head.name,
        sourceName,
        mergeBase: baseId,
        ours: target,
        theirs: source,
        preMergeWorkingTree: { ...current.workingTree },
        preMergeIndex: { entries: { ...current.index.entries } },
        conflicts: merged.conflicts,
      },
    };
    return result(next, current, [
      `Auto-merging ${[...conflictPaths].join(", ")}`,
      "CONFLICT (content): Merge conflict oluştu.",
      "Automatic merge failed; fix conflicts and then commit the result.",
    ], { teachingMessage: "Git merge-base, ours ve theirs sürümlerini karşılaştırdı. Çakışmayan dosyaları otomatik birleştirdi; çakışan dosyalar çözüm bekliyor." });
  }
  const id = `C${current.nextCommitNumber}`;
  const node = makeCommit(id, `Merge branch '${sourceName}'`, [target, source], merged.snapshot, "merge");
  const next: RepositoryState = { ...current, commits: { ...current.commits, [id]: node }, branches: { ...current.branches, [current.head.name]: { ...current.branches[current.head.name], target: id } }, workingTree: { ...merged.snapshot }, nextCommitNumber: current.nextCommitNumber + 1, reflog: [...current.reflog, { id: current.reflog.length, from: target, to: id, action: `merge ${sourceName}` }] };
  return result(next, current, [`Merge made by the three-way strategy.`, `[${current.head.name} ${id}] Merge branch '${sourceName}'`], { animations: [{ type: "commit-created", commit: id, parent: target }], teachingMessage: "Merge-base, ours ve theirs karşılaştırıldı; iki parent'lı merge commit çakışmayan dosya sonuçlarını kaydetti." });
}

function mergeBranch(current: RepositoryState, branch: string, squash: boolean): CommandResult {
  const source = current.branches[branch]?.target;
  if (!source) return stateError(current, `'${branch}' adlı branch bulunamadı veya commit içermiyor.`);
  return mergeTarget(current, source, branch, squash);
}

export function updateWorkingFile(current: RepositoryState, path: string, content: string): RepositoryState {
  if (!current.merge?.conflicts[path]) return current;
  return { ...current, workingTree: { ...current.workingTree, [path]: content } };
}

function fetchRemote(current: RepositoryState, remoteName: string, branch?: string): CommandResult {
  const remote = current.remotes[remoteName];
  if (!remote) return stateError(current, `'${remoteName}' remote'u bulunamadı.`);
  const names = branch ? [branch] : Object.keys(remote.branches);
  const remoteTracking = { ...(current.remoteTracking ?? {}) };
  const commits = { ...current.commits, ...(remote.commits ?? {}) };
  const output: string[] = [];
  for (const name of names) {
    if (!(name in remote.branches)) return stateError(current, `'${remoteName}/${name}' uzak dalı bulunamadı.`);
    const key = `${remoteName}/${name}`;
    const before = remoteTracking[key] ?? null;
    const after = remote.branches[name] ?? null;
    remoteTracking[key] = after;
    output.push(before === after ? `${key}: up to date.` : `${key}: ${before ?? "boş"} -> ${after ?? "boş"}`);
  }
  const next: RepositoryState = { ...current, commits, remoteTracking };
  return result(next, current, output.length ? output : ["Yeni remote değişikliği yok."], { teachingMessage: "Fetch uzak commit nesnelerini ve yerel remote-tracking ref'leri güncelledi; aktif branch, index ve working tree değişmedi." });
}

export function executeCommand(current: RepositoryState, command: ParsedCommand): CommandResult {
  const currentName = current.head.kind === "branch" ? current.head.name : "detached HEAD";
  if (command.kind === "help") return result(current, current, ["Yerel: git init, status, add, commit, log, diff, restore, reset, revert, reflog", "Dallar: git branch, switch, merge, merge --abort, rebase, cherry-pick", "Uzak: git remote add, clone, fetch, pull, push · Bonus: git stash apply, config, blame", "Eğitim: show state, undo"]);
  if (command.kind === "undo") return result(current, current, ["Geri alma lesson session undo stack'i tarafından uygulanır."]);
  if (command.kind === "show-state") return result(current, current, [`HEAD: ${currentName} @ ${headCommitId(current) ?? "boş"}`, `Index: ${stagedChanges(current).length} değişiklik`, `Working: ${workingChanges(current).length} değişiklik`]);
  if (command.kind === "merge-abort") {
    if (!current.merge) return stateError(current, "İptal edilecek bir merge yok.");
    const next: RepositoryState = { ...current, workingTree: { ...current.merge.preMergeWorkingTree }, index: { entries: { ...current.merge.preMergeIndex.entries } }, merge: undefined };
    return result(next, current, ["Merge iptal edildi; working tree ve index merge öncesi duruma döndürüldü."], { teachingMessage: "Abort yeni commit oluşturmadı ve branch işaretçisini değiştirmedi." });
  }
  if (command.kind === "init") { if (current.initialized) return result(current, current, ["Reinitialized existing Git repository."]); return result({ ...current, initialized: true }, current, ["Initialized empty Git repository."], { teachingMessage: ".git dizini oluşturuldu; bu klasör artık bir repository." }); }
  if (command.kind === "status") return result(current, current, statusLines(current));
  if (command.kind === "diff") { const changes = command.mode === "working" ? workingChanges(current) : command.mode === "staged" ? stagedChanges(current) : headChanges(current); return result(current, current, formatDiff(changes)); }
  if (command.kind === "add") return addFiles(current, command.path);
  if (command.kind === "commit") return commit(current, command.message);
  if (command.kind === "log") { const lines: string[] = []; let id = headCommitId(current); while (id) { const node = current.commits[id]; if (!node) break; lines.push(`${node.id} ${node.shortHash} ${node.message}`); id = node.parents[0] ?? null; } return result(current, current, lines); }
  if (command.kind === "branch-list") return result(current, current, Object.keys(current.branches).sort().map(name => `${current.head.kind === "branch" && current.head.name === name ? "*" : " "} ${name}`));
  if (command.kind === "branch-create") { if (current.branches[command.name]) return stateError(current, `'${command.name}' adlı branch zaten var.`); const target = headCommitId(current); const next = { ...current, branches: { ...current.branches, [command.name]: { name: command.name, target } } }; return result(next, current, [`Branch '${command.name}' oluşturuldu.`], { animations: [{ type: "branch-created", branch: command.name, target }], teachingMessage: "Branch yeni commit değil, commit işaretçisidir." }); }
  if (command.kind === "branch-delete") { const branch=current.branches[command.name]; if (!branch) return stateError(current, `'${command.name}' adlı branch bulunamadı.`); if (current.head.kind === "branch" && current.head.name === command.name) return stateError(current, "Üzerinde bulunduğun branch silinemez."); if(!command.force&&!isAncestor(current,branch.target,headCommitId(current)))return stateError(current, `'${command.name}' dalı aktif geçmişe birleştirilmedi; güvenli silme reddedildi. Eminsen git branch -D ${command.name} kullan.`); const branches = { ...current.branches }; delete branches[command.name]; return result({ ...current, branches }, current, [`Deleted branch ${command.name}.`]); }
  if (command.kind === "switch") { if (current.merge) return stateError(current, "Merge sürerken branch değiştirilemez; önce commit veya git merge --abort çalıştır."); let state = current; const from = headCommitId(current); if (command.create) { if (current.branches[command.name]) return stateError(current, `'${command.name}' adlı branch zaten var.`); state = { ...current, branches: { ...current.branches, [command.name]: { name: command.name, target: from } } }; } else if (!current.branches[command.name]) return stateError(current, `'${command.name}' adlı branch bulunamadı.`); const to = state.branches[command.name]?.target ?? null; if (!isWorkingTreeClean(current) && to !== from) return stateError(current, "Branch değişikliği yerel dosyaların üzerine yazacak; önce commit veya stash et."); const workingTree = to === from ? current.workingTree : to ? { ...state.commits[to].snapshot } : {}; const index = to === from ? current.index : { entries: {} }; const next: RepositoryState = { ...state, head: { kind: "branch" as const, name: command.name }, workingTree, index, reflog: [...state.reflog, { id: state.reflog.length, from, to, action: `checkout: moving from ${currentName} to ${command.name}` }] }; return result(next, current, [`Switched to branch '${command.name}'`], { animations: [{ type: "head-moved", from: currentName, to: command.name }] }); }
  if (command.kind === "restore") return restoreFile(current, command.path, command.staged);
  if (command.kind === "reset") return current.merge ? stateError(current, "Merge sürerken reset bu eğitimde engellenir; önce commit veya git merge --abort çalıştır.") : resetCommand(current, command.mode, command.target);
  if (command.kind === "reflog") { if (current.reflog.length === 0) return result(current, current, ["Henüz reflog kaydı yok."]); const reversed=current.reflog.slice().reverse();return result(current,current,[`${headCommitId(current)??"-"} HEAD@{0} current`,...reversed.map((entry,index)=>`${entry.from??"-"} HEAD@{${index+1}} before ${entry.action}`)]); }
  if (command.kind === "show") { const id = command.target === "HEAD" ? headCommitId(current) : resolveTarget(current, command.target); if (!id || !current.commits[id]) return stateError(current, `'${command.target}' çözümlenemedi.`); const node = current.commits[id]; return result(current, current, [`commit ${node.shortHash} (${node.id})`, `    ${node.message}`, ...formatDiff(headChanges({ ...current, head: { kind: "detached", target: id } }))]); }
  if (command.kind === "merge") return mergeBranch(current, command.branch, command.squash);
  if (command.kind === "remote-add") { if (current.remotes[command.name]) return stateError(current, `'${command.name}' remote'u zaten var.`); return result({ ...current, remotes: { ...current.remotes, [command.name]: { name: command.name, url: command.url, branches: {} } } }, current, [`Remote '${command.name}' eklendi.`]); }
  if (command.kind === "clone") { const target = headCommitId(current); const next: RepositoryState = { ...current, initialized: true, remotes: { ...current.remotes, origin: { name: "origin", url: command.url, branches: { main: target }, commits: { ...current.commits } } }, remoteTracking: { ...(current.remoteTracking ?? {}), "origin/main": target }, branches: { ...current.branches, main: { ...current.branches.main, name: "main", target, upstream: "origin/main" } } }; return result(next, current, [`GitAtlas clone simülasyonu: 'repo' oluşturuldu.`, "origin eklendi ve origin/main izleme ref'i oluşturuldu."], { teachingMessage: "Gerçek clone ağdan commit nesnelerini indirir; GitAtlas mevcut eğitim geçmişini uzak ve yerel kopya olarak kurdu." }); }
  if (command.kind === "push") {
    const remote = current.remotes[command.remote]; if (!remote) return stateError(current, `'${command.remote}' remote'u bulunamadı.`);
    const localBranch = current.branches[command.branch];
    if (!localBranch) return stateError(current, `'${command.branch}' adlı yerel branch bulunamadı; push başka bir branch için HEAD fallback kullanmaz.`);
    const target = localBranch.target;
    if (!target) return stateError(current, `'${command.branch}' gönderilecek commit içermiyor.`);
    const remoteTarget = remote.branches[command.branch] ?? null;
    const comparisonState: RepositoryState = { ...current, commits: { ...(remote.commits ?? {}), ...current.commits } };
    if (remoteTarget && !isAncestor(comparisonState, remoteTarget, target)) return stateError(current, `Push reddedildi: ${command.remote}/${command.branch} yerel dalda olmayan commitler içeriyor. Önce git fetch, ardından git pull ile ayrışmayı incele.`);
    const trackingKey = `${command.remote}/${command.branch}`;
    const remotes = { ...current.remotes, [command.remote]: { ...remote, branches: { ...remote.branches, [command.branch]: target }, commits: { ...(remote.commits ?? {}), ...current.commits } } };
    const branches = command.upstream && current.branches[command.branch] ? { ...current.branches, [command.branch]: { ...current.branches[command.branch], upstream: trackingKey } } : current.branches;
    return result({ ...current, remotes, branches, remoteTracking: { ...(current.remoteTracking ?? {}), [trackingKey]: target } }, current, [`${command.branch} -> ${trackingKey}`], { teachingMessage: "Push uzak branch ref'ini fast-forward güncelledi; -u kullanıldıysa yerel branch upstream bağlantısını da kaydetti." });
  }
  if (command.kind === "fetch") return fetchRemote(current, command.remote, command.branch);
  if (command.kind === "pull") {
    if (command.rebase) return stateError(current, "git pull --rebase bu sürümde kavramsal olarak anlatılır; engine yalnız fetch + merge entegrasyonunu uygular.");
    if (current.head.kind !== "branch") return stateError(current, "Detached HEAD üzerinde pull desteklenmiyor.");
    if (!isWorkingTreeClean(current)) return stateError(current, "Pull entegrasyonu için working tree ve index temiz olmalı; önce commit veya stash et.");
    const fetched = fetchRemote(current, command.remote, command.branch);
    if (fetched.error) return fetched;
    const key = `${command.remote}/${command.branch}`;
    const target = fetched.state.remoteTracking?.[key];
    if (!target) return result(fetched.state, current, [...fetched.output, "Already up to date."], { teachingMessage: fetched.teachingMessage });
    const integrated = mergeTarget(fetched.state, target, key, false);
    return result(integrated.state, current, [...fetched.output, ...integrated.output], { error: integrated.error, warnings: integrated.warnings, animations: integrated.animations, teachingMessage: `Pull = fetch + entegrasyon. ${integrated.teachingMessage ?? ""}`.trim() });
  }
  if (command.kind === "stash") {
    if (current.merge) return stateError(current, "Merge sürerken stash uygulanamaz; önce merge'i tamamla veya abort et.");
    if ((command.action ?? "save") === "save") { if (isWorkingTreeClean(current)) return result(current, current, ["No local changes to save"]); const stash = { id: `stash@{${current.stashes.length}}`, message: `WIP on ${currentName}`, files: { ...current.workingTree }, index: { entries: { ...current.index.entries } } }; return result({ ...current, stashes: [stash, ...current.stashes], workingTree: { ...headSnapshot(current) }, index: { entries: {} } }, current, [`Saved working directory and index state ${stash.id}`], { teachingMessage: "Stash working tree ve index snapshot'ını sakladı; çalışma alanını HEAD'e döndürdü." }); }
    const stash = current.stashes[0]; if (!stash) return stateError(current, "Uygulanacak stash kaydı yok.");
    if (!isWorkingTreeClean(current)) return stateError(current, "Stash uygulamadan önce working tree ve index temiz olmalı.");
    const stashes = command.action === "pop" ? current.stashes.slice(1) : current.stashes;
    return result({ ...current, workingTree: { ...stash.files }, index: stash.index ? { entries: { ...stash.index.entries } } : current.index, stashes }, current, [`Applied ${stash.id}${command.action === "pop" ? " and dropped it" : ""}.`], { teachingMessage: "Stash apply saklanan working tree ve index snapshot'ını geri getirdi; pop ayrıca stash kaydını listeden kaldırdı." });
  }
  if (command.kind === "revert") {
    if (current.head.kind !== "branch") return stateError(current, "Detached HEAD üzerinde revert desteklenmiyor.");
    if (!isWorkingTreeClean(current)) return stateError(current, "Revert öncesinde working tree ve index temiz olmalı.");
    const targetId = command.target === "HEAD" ? headCommitId(current) : resolveTarget(current, command.target);
    const targetCommit = targetId ? current.commits[targetId] : undefined;
    if (!targetCommit) return stateError(current, `'${command.target}' geri alınacak bir commit olarak bulunamadı.`);
    const parentSnapshot = targetCommit.parents[0] ? current.commits[targetCommit.parents[0]]?.snapshot ?? {} : {};
    const reversed = threeWayMergeSnapshots(targetCommit.snapshot, headSnapshot(current), parentSnapshot, `revert ${targetCommit.id}`);
    if (Object.keys(reversed.conflicts).length) return stateError(current, "Revert conflict oluşturdu. Bu sürüm revert conflict editörünü modellemez; git status ile durumu incele ve daha küçük bir hedef seç.");
    const parent = headCommitId(current); const id = `C${current.nextCommitNumber}`;
    const node = makeCommit(id, `Revert \"${targetCommit.message}\"`, parent ? [parent] : [], reversed.snapshot, "revert");
    const next: RepositoryState = { ...current, commits: { ...current.commits, [id]: node }, branches: { ...current.branches, [current.head.name]: { ...current.branches[current.head.name], target: id } }, workingTree: { ...reversed.snapshot }, nextCommitNumber: current.nextCommitNumber + 1, reflog: [...current.reflog, { id: current.reflog.length, from: parent, to: id, action: `revert: ${targetCommit.id}` }] };
    return result(next, current, [`[${current.head.name} ${id}] Revert \"${targetCommit.message}\"`], { teachingMessage: "Revert geçmişi taşımadı; seçilen commit değişikliğinin tersini yeni bir commit olarak kaydetti." });
  }
  if (command.kind === "amend") { const oldId = headCommitId(current); if (!oldId || current.head.kind!=="branch") return stateError(current, "Düzeltilecek commit yok."); const old = current.commits[oldId]; const snapshot = isIndexClean(current) ? old.snapshot : effectiveIndexSnapshot(current); const id=`C${current.nextCommitNumber}`; const node = makeCommit(id, command.message ?? old.message, old.parents, snapshot, "commit"); const next:RepositoryState={...current,commits:{...current.commits,[id]:node},branches:{...current.branches,[current.head.name]:{...current.branches[current.head.name],target:id}},index:{entries:{}},nextCommitNumber:current.nextCommitNumber+1,reflog:[...current.reflog,{id:current.reflog.length,from:oldId,to:id,action:`commit (amend): ${node.message}`}]};return result(next,current,[`[${currentName} ${id}] ${node.message}`],{teachingMessage:"Amend eski commit nesnesini değiştirmedi; aynı parent üzerinde yeni kimlikli bir commit oluşturup branch ref'ini ona taşıdı."}); }
  if (command.kind === "rebase") { const onto = current.branches[command.branch]?.target; const currentId = headCommitId(current); if (!onto || !currentId || current.head.kind !== "branch") return stateError(current, "Rebase hedefi bulunamadı."); if(!isWorkingTreeClean(current))return stateError(current,"Rebase öncesinde working tree ve index temiz olmalı.");if (isAncestor(current, onto, currentId)) return result(current, current, ["Current branch is up to date."]); const base=findMergeBase(current,currentId,onto);const chain=[];let cursor:CommitId|null=currentId;while(cursor&&cursor!==base){chain.push(current.commits[cursor]);cursor=current.commits[cursor]?.parents[0]??null}chain.reverse();let parent=onto;let snapshot={...current.commits[onto].snapshot};let nextNumber=current.nextCommitNumber;const commits={...current.commits};for(const old of chain){const oldBase=old.parents[0]?current.commits[old.parents[0]]?.snapshot??{}:{};const replay=threeWayMergeSnapshots(oldBase,snapshot,old.snapshot,`rebase ${old.id}`);if(Object.keys(replay.conflicts).length)return stateError(current,`Rebase ${old.id} değişikliğinde conflict oluşturdu. Bu sürüm rebase conflict editörünü modellemez; normal merge conflict dersini kullan.`);const id=`C${nextNumber++}`;commits[id]=makeCommit(id,old.message,[parent],replay.snapshot,"rebase");parent=id;snapshot={...replay.snapshot}}const next:RepositoryState={...current,commits,branches:{...current.branches,[current.head.name]:{...current.branches[current.head.name],target:parent}},workingTree:snapshot,nextCommitNumber:nextNumber,reflog:[...current.reflog,{id:current.reflog.length,from:currentId,to:parent,action:`rebase ${command.branch}`}]};return result(next,current,[`Successfully rebased ${chain.length} commit(s) onto ${command.branch}.`],{teachingMessage:"Rebase branch'e özgü commit değişikliklerini eskiden yeniye yeni parent zinciri üzerinde yeniden oluşturdu; kimlikler değişti."}); }
  if (command.kind === "cherry-pick") { const source = current.commits[command.target]; if (!source || current.head.kind !== "branch") return stateError(current, "Cherry-pick commit'i bulunamadı.");if(!isWorkingTreeClean(current))return stateError(current,"Cherry-pick öncesinde working tree ve index temiz olmalı.");const sourceBase=source.parents[0]?current.commits[source.parents[0]]?.snapshot??{}:{};const applied=threeWayMergeSnapshots(sourceBase,headSnapshot(current),source.snapshot,`cherry-pick ${source.id}`);if(Object.keys(applied.conflicts).length)return stateError(current,"Cherry-pick conflict oluşturdu. Bu sürüm cherry-pick conflict editörünü modellemez; komut kavramsal sınırda durduruldu."); const parent = headCommitId(current); const id = `C${current.nextCommitNumber}`; const node = makeCommit(id, source.message, parent ? [parent] : [], applied.snapshot, "cherry-pick"); const next:RepositoryState = { ...current, commits: { ...current.commits, [id]: node }, branches: { ...current.branches, [current.head.name]: { ...current.branches[current.head.name], target: id } }, workingTree: { ...applied.snapshot }, nextCommitNumber: current.nextCommitNumber + 1,reflog:[...current.reflog,{id:current.reflog.length,from:parent,to:id,action:`cherry-pick: ${source.id}`}]} ; return result(next, current, [`[${current.head.name} ${id}] ${source.message}`], { teachingMessage: "Cherry-pick kaynak commit'in parent'ına göre deltasını aktif snapshot üzerine uyguladı; hedefe özgü dosyaları koruyarak yeni kimlikli commit oluşturdu." }); }
  if (command.kind === "config") return result(current, current, [command.value ? `${command.key}=${command.value}` : `${command.key} yapılandırması görüntülendi.`]);
  if (command.kind === "blame") { const content = current.workingTree[command.path]; if (content === undefined) return stateError(current, `'${command.path}' bulunamadı.`); const id = headCommitId(current) ?? "0000000"; return result(current, current, content.split("\n").map((line, index) => `${id} (${index + 1}) ${line}`)); }
  const exhaustive: never = command; throw new Error(`İşlenmeyen komut: ${JSON.stringify(exhaustive)}`);
}
