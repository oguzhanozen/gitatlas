import { makeCommit, type RepositoryState } from "@/domain/git/models";
import type { ChapterDefinition, LessonDefinition, SuccessCondition } from "@/domain/lessons/models";
import { workspaceLesson, stagingLesson, commitLesson, logLesson, diffLesson } from "./beginner-lessons";

const repository = (options: Partial<RepositoryState> = {}): RepositoryState => ({
  initialized: true,
  commits: { C0: makeCommit("C0", "Proje başlangıcı", [], { "README.md": "# Pusula" }, "init") },
  branches: { main: { name: "main", target: "C0" } },
  head: { kind: "branch", name: "main" },
  workingTree: { "README.md": "# Pusula" },
  index: { entries: {} },
  tags: {}, stashes: [], remotes: {}, reflog: [], nextCommitNumber: 1,
  ...options,
});

const uninitialized = repository({ initialized: false, commits: {}, branches: { main: { name: "main", target: null } }, workingTree: { "README.md": "# Yeni proje" } });
const changed = repository({ workingTree: { "README.md": "# Pusula\nYeni özellik" } });
const twoCommits = repository({
  commits: {
    C0: makeCommit("C0", "Proje başlangıcı", [], { "README.md": "# Pusula" }, "init"),
    C1: makeCommit("C1", "Kurulum notu", ["C0"], { "README.md": "# Pusula\nKurulum" }),
  },
  branches: { main: { name: "main", target: "C1" } },
  workingTree: { "README.md": "# Pusula\nKurulum" }, nextCommitNumber: 2,
});
const fastForward = repository({
  commits: { ...twoCommits.commits, C2: makeCommit("C2", "Muz özelliği", ["C1"], { "README.md": "# Pusula\nKurulum", "banana.ts": "export const banana = true;" }) },
  branches: { main: { name: "main", target: "C1" }, banana: { name: "banana", target: "C2" } },
  workingTree: { ...twoCommits.commits.C1.snapshot }, nextCommitNumber: 3,
});
const diverged = repository({
  commits: {
    ...fastForward.commits,
    C3: makeCommit("C3", "Ana dal notu", ["C1"], { "README.md": "# Pusula\nAna dal" }),
  },
  branches: { main: { name: "main", target: "C3" }, banana: { name: "banana", target: "C2" } },
  workingTree: { "README.md": "# Pusula\nAna dal" }, nextCommitNumber: 4,
});
const conflictDiverged = repository({
  commits: {
    C0: makeCommit("C0", "Ortak README", [], { "README.md": "# Pusula\nOrtak" }, "init"),
    C1: makeCommit("C1", "Ana dal README", ["C0"], { "README.md": "# Pusula\nAna dal" }),
    C2: makeCommit("C2", "Banana README", ["C0"], { "README.md": "# Pusula\nBanana dalı", "banana.ts": "banana" }),
  },
  branches: { main: { name: "main", target: "C1" }, banana: { name: "banana", target: "C2" } },
  workingTree: { "README.md": "# Pusula\nAna dal" }, nextCommitNumber: 3,
});
const remoteRepo = repository({ remotes: { origin: { name: "origin", url: "https://example.com/pusula.git", branches: { main: "C0" } } } });
const remoteAhead = repository({
  remotes: { origin: { name: "origin", url: "https://example.com/pusula.git", branches: { main: "R1" }, commits: {
    C0: makeCommit("C0", "Proje başlangıcı", [], { "README.md": "# Pusula" }, "init"),
    R1: makeCommit("R1", "Takım kurulum notu", ["C0"], { "README.md": "# Pusula\nTakım kurulumu" }),
  } } },
});

type LessonInput = Omit<LessonDefinition, "initialRepositoryState" | "allowedCommands" | "hints" | "successConditions" | "explanationAfterSuccess"> & {
  initialRepositoryState?: RepositoryState;
  allowedCommands?: readonly string[];
  hints?: readonly string[];
  successConditions?: readonly SuccessCondition[];
  explanationAfterSuccess: string;
};
const define = (input: LessonInput): LessonDefinition => ({
  initialRepositoryState: repository(), allowedCommands: [], hints: [], successConditions: [], ...input,
});
const commandLesson = (id: string, level: string, chapterId: string, title: string, concept: string, goal: string, commands: readonly string[], family: SuccessCondition, state: RepositoryState = repository(), extra: Partial<LessonDefinition> = {}): LessonDefinition => define({
  id, level, chapterId, title, concept, story: `${concept} kavramını güvenli bir örnek repository üzerinde deneyeceksin.`, goalDescription: goal,
  estimatedMinutes: 4, allowedCommands: commands, hints: [`Önce git status ile mevcut durumu oku.`, `İlgili komut ailesi: ${commands[0]}.`, commands.at(-1) ?? commands[0]],
  initialRepositoryState: state, successConditions: [family], explanationAfterSuccess: `${concept} işlemini uyguladın ve repository modelindeki etkisini gördün.`, ...extra,
});
const conceptLesson = (id: string, level: string, chapterId: string, title: string, concept: string, activity: NonNullable<LessonDefinition["activity"]>, explanation: string, reward?: string, extra: Partial<LessonDefinition> = {}): LessonDefinition => define({
  id, level, chapterId, title, concept, activity, story: concept, goalDescription: "Adımları sırayla uygula; her seçimden sonra commit grafiğinde değişen commit ve işaretçileri açıkla.", estimatedMinutes: 3,
  explanationAfterSuccess: explanation, reward, ...extra,
});
const withMeta = (lesson: LessonDefinition, chapterId: string, level: string, concept: string, reward?: string): LessonDefinition => ({ ...lesson, chapterId, level, concept, reward });

const chapter1 = [
  conceptLesson("concepts/1-1-version-control", "1.1", "concepts", "Versiyon Kontrolü Nedir?", "Dağınık dosya kopyalarını tek bir güvenilir zaman çizgisine dönüştür.", "timeline", "Versiyon kontrolü ayrı dosya kopyaları yerine tek proje ve izlenebilir bir geçmiş sunar.", "Kaostan Kurtulan"),
  conceptLesson("concepts/1-2-time-machine", "1.2", "concepts", "Git Bir Zaman Makinesidir", "Commit'ler oyundaki kayıt noktaları gibi projenin geri dönülebilir anlarıdır.", "time-machine", "Zaman çizgisinde her commit bağımsız ve geri dönülebilir bir snapshot'tır."),
  conceptLesson("concepts/1-3-three-areas", "1.3", "concepts", "Repo, Commit ve Working Directory", "Repository geçmişi, working directory bugünü, commit ise kayıtlı bir anı temsil eder.", "three-areas", "Üç temel alanın görevlerini ayırdın; artık komutların hangi katmanı değiştirdiğini okuyabilirsin.", "Kavram Ustası"),
];

const initLesson = commandLesson("local/2-1-init", "2.1", "local", "Repo Oluştur: git init", "Repository başlatma", "Klasörü bir Git repository'sine dönüştür.", ["git init"], { type: "repository-initialized" }, uninitialized, { commonMistakes: ["Yanlış klasörde init çalıştırmak"] });
const chapter2 = [
  initLesson,
  withMeta(workspaceLesson, "local", "2.2", "Dosya durumlarını git status ile okuma"),
  withMeta(stagingLesson, "local", "2.3", "Staging area ile commit kapsamını seçme"),
  withMeta(commitLesson, "local", "2.4", "Anlamlı mesaj taşıyan bir snapshot oluşturma", "İlk Commit"),
  withMeta(logLesson, "local", "2.5", "Commit geçmişini ve kimliklerini okuma", "Yerel Git Kaşifi"),
];

const chapter3 = [
  withMeta(diffLesson, "history", "3.1", "Working tree farklarını satır satır inceleme"),
  commandLesson("history/3-2-restore", "3.2", "history", "Bir Hatayı Geri Al: git restore", "Kaydedilmemiş değişikliği geri alma", "README.md dosyasını son güvenli sürüme döndür.", ["git diff", "git restore README.md"], { type: "working-tree-clean" }, changed, { commonMistakes: ["Restore'un kaydedilmemiş değişiklikleri sildiğini unutmak"] }),
  commandLesson("history/3-3-show", "3.3", "history", "Zaman Makinesi: Eski Bir Sürüme Bak", "HEAD ve commit referansları", "HEAD commit'inin ayrıntısını görüntüle.", ["git log", "git show HEAD"], { type: "command-executed", family: "show" }, twoCommits, { reward: "Zaman Yolcusu" }),
];

const branchWork = repository({ branches: { main: { name: "main", target: "C0" }, deneme: { name: "deneme", target: "C0" } }, head: { kind: "branch", name: "deneme" } });
const chapter4 = [
  conceptLesson("branching/4-1-concept", "4.1", "branching", "Branch Nedir?", "Branch, commit'e işaret eden hafif bir paralel çalışma çizgisidir.", "branch-metaphor", "Branch'in proje kopyası değil, hareket eden bir commit işaretçisi olduğunu gördün.", undefined, { goalDescription: "Commit grafiğinde önce main → C0 durumunu oku; sonra feature branch'inin yeni commit oluşturmadan C0'a eklendiğini ve feature üzerindeki C1 commit'inin yalnız aktif branch'i ilerlettiğini göster." }),
  commandLesson("branching/4-2-create-switch", "4.2", "branching", "Dal Oluştur ve Geç", "branch ve HEAD işaretçileri", "deneme adlı branch'i oluştur ve ona geç.", ["git branch", "git switch -c deneme"], { type: "head-on-branch", name: "deneme" }, repository()),
  commandLesson("branching/4-3-isolation", "4.3", "branching", "Daldan Ana Dala Dön", "Branch izolasyonu", "Önce aktif dalı status ile doğrula, sonra deneme dalından main dalına dön.", ["git status", "git switch main"], { type: "head-on-branch", name: "main" }, branchWork, { successConditions: [{ type: "command-executed", family: "status" }, { type: "command-executed", family: "switch" }, { type: "head-on-branch", name: "main" }], reward: "Paralel Evren Gezgini" }),
];

const chapter5 = [
  commandLesson("merging/5-1-fast-forward", "5.1", "merging", "Fast-forward Merge", "İşaretçiyi ileri taşıyan merge", "banana dalını main ile birleştir.", ["git switch main", "git merge banana"], { type: "head-points-to-commit", commitId: "C2" }, fastForward),
  commandLesson("merging/5-2-three-way", "5.2", "merging", "İki Parent'lı Merge Commit", "Ortak ata, ours ve theirs sürümlerini dosya bazında karşılaştırma", "Önce ayrışmış geçmişi grafik log ile incele, sonra çakışmayan dosyaları banana dalından main'e birleştir.", ["git log --graph", "git merge banana"], { type: "commit-count-increased", value: 1 }, repository({
    commits: { C0: makeCommit("C0", "Ortak ata", [], { "README.md": "# Pusula" }, "init"), C1: makeCommit("C1", "Ana dal", ["C0"], { "README.md": "# Pusula", "main.txt": "ana" }), C2: makeCommit("C2", "Banana dalı", ["C0"], { "README.md": "# Pusula", "banana.ts": "banana" }) },
    branches: { main: { name: "main", target: "C1" }, banana: { name: "banana", target: "C2" } }, workingTree: { "README.md": "# Pusula", "main.txt": "ana" }, nextCommitNumber: 3,
  }), { successConditions: [{ type: "commands-in-order", families: ["log", "merge"] }, { type: "head-is-merge-commit" }, { type: "commit-count-increased", value: 1 }], explanationAfterSuccess: "Git ortak atayı, mevcut dalı (ours) ve birleştirilen dalı (theirs) karşılaştırdı; çakışmayan dosyaları iki parent'lı committe kaydetti." }),
  commandLesson("merging/5-3-conflict", "5.3", "merging", "Merge Conflict'i Çöz", "Aynı dosyanın base, ours ve theirs sürümlerini bilinçli biçimde uzlaştırma", "banana dalını birleştir; status ile conflict'i teşhis et, güvenli editörde marker'ları kaldır, README.md sürümünü index'e kopyala ve iki parent'lı merge commit oluştur.", ["git merge banana", "git status", "git add README.md", "git commit -m \"conflict çözüldü\"", "git merge --abort"], { type: "head-is-merge-commit" }, conflictDiverged, { successConditions: [{ type: "commands-in-order", families: ["merge", "status", "add", "commit"] }, { type: "merge-in-progress", value: false }, { type: "head-is-merge-commit" }, { type: "commit-count-increased", value: 1 }], reward: "Birleştirme Ustası", commonMistakes: ["Conflict marker'larını kaldırmadan git add çalıştırmak", "Dosyayı düzenledikten sonra git add ile çözüldü işareti vermeyi unutmak", "İptal etmek istediğinde dosyaları elle silmek yerine git merge --abort kullan"] }),
];

const chapter6 = [
  conceptLesson("remotes/6-1-concept", "6.1", "remotes", "Remote Nedir? ve git clone", "Remote, repository'nin ağ üzerindeki başka bir kopyasıdır; origin yalnızca geleneksel bir addır.", "remote-flow", "Yerel ve uzak repository'nin ayrı işaretçiler taşıdığını gördün."),
  commandLesson("remotes/6-2-push", "6.2", "remotes", "Değişiklikleri Gönder: git push", "Yerel branch'i remote'a fast-forward yayınlama ve upstream kurma", "main dalını origin'e gönder ve upstream ayarla.", ["git push -u origin main"], { type: "remote-branch-points-to-head", remote: "origin", branch: "main" }, repository({ remotes: { origin: { name: "origin", url: "https://example.com/pusula.git", branches: {} } } }), { successConditions: [{ type: "command-executed", family: "push" }, { type: "remote-branch-points-to-head", remote: "origin", branch: "main" }, { type: "branch-has-upstream", branch: "main", upstream: "origin/main" }] }),
  commandLesson("remotes/6-3-fetch-pull", "6.3", "remotes", "fetch ve pull Farkı", "Remote-tracking ref'i güncellemek ile fetch sonrası yerel dalı entegre etmek arasındaki fark", "Önce fetch ile origin/main izleme ref'ini güncelle; local main ve dosyaların değişmediğini gözle. Sonra pull ile fetch + fast-forward entegrasyonunu tamamla.", ["git fetch origin main", "git pull origin main"], { type: "head-points-to-commit", commitId: "R1" }, remoteAhead, { successConditions: [{ type: "commands-in-order", families: ["fetch", "pull"] }, { type: "remote-tracking-points-to", name: "origin/main", commitId: "R1" }, { type: "head-points-to-commit", commitId: "R1" }], reward: "Bulut Kaptanı" }),
];

const chapter7 = [
  conceptLesson("collaboration/7-1-pr", "7.1", "collaboration", "Fork ve Pull Request Akışı", "Fork → clone → branch → commit → push → PR → review → merge.", "collaboration-flow", "Pull Request'in bir Git komutu değil, paylaşım ve inceleme akışı olduğunu öğrendin."),
  commandLesson("collaboration/7-2-sync", "7.2", "collaboration", "Takımla Senkron Kal", "Remote güncellemelerini önce izleme ref'ine, sonra yerel dala güvenle entegre etme", "origin'i fetch et ve main'i pull ile güncelle.", ["git fetch origin", "git pull origin main"], { type: "head-points-to-commit", commitId: "R1" }, remoteAhead, { successConditions: [{ type: "commands-in-order", families: ["fetch", "pull"] }, { type: "remote-tracking-points-to", name: "origin/main", commitId: "R1" }, { type: "head-points-to-commit", commitId: "R1" }] }),
  commandLesson("collaboration/7-3-final", "7.3", "collaboration", "Final Görevi: Takım Senaryosu", "Yerel Git, branch ve remote akışını birleştirme", "Bir özellik branch'i aç, değişikliği stage edip commit oluştur ve origin'e gönder.", ["git switch -c feature/final", "git add .", "git commit -m \"özelliği tamamla\"", "git push -u origin feature/final"], { type: "command-executed", family: "push" }, { ...remoteRepo, workingTree: { "README.md": "# Pusula\nFinal özellik" } }, { successConditions: [{ type: "command-executed", family: "switch" }, { type: "command-executed", family: "add" }, { type: "command-executed", family: "commit" }, { type: "command-executed", family: "push" }, { type: "head-on-branch", name: "feature/final" }, { type: "commit-count-increased", value: 1 }], reward: "Git Ustası" }),
];

const rebaseRepo = { ...diverged, head: { kind: "branch" as const, name: "banana" }, workingTree: { ...diverged.commits.C2.snapshot } };
const chapter8 = [
  commandLesson("advanced/8-1-stash", "8.1", "advanced", "Yarım İşi Sakla ve Geri Getir", "Working tree ve index için geçici stash snapshot'ı", "Yarım değişikliği stash'e al, temiz state'i status ile doğrula ve stash apply ile geri getir.", ["git stash", "git status", "git stash apply"], { type: "stash-count", minCount: 1 }, changed, { successConditions:[{type:"commands-in-order",families:["stash","status","stash"]},{type:"stash-count",minCount:1},{type:"file-modified",path:"README.md"}] }),
  commandLesson("advanced/8-2-edit-history", "8.2", "advanced", "Geçmişi Düzenle", "Amend'in yeni commit kimliği ve reflog güvenlik ağı", "Son commit mesajını amend ile düzelt ve ref hareketini reflog'da doğrula.", ["git commit --amend -m \"daha iyi mesaj\"", "git reflog"], { type: "reflog-has-entries", minCount: 1 }, twoCommits, { successConditions:[{type:"commands-in-order",families:["amend","reflog"]},{type:"commit-count-increased",value:1},{type:"reflog-has-entries",minCount:1}] }),
  commandLesson("advanced/8-3-rebase", "8.3", "advanced", "Rebase ile Temiz Geçmiş", "Branch'e özgü commit deltalarını yeni parent üzerinde yeniden oluşturma", "banana dalını main üzerine rebase et; commit kimliğinin değiştiğini grafikte doğrula.", ["git rebase main"], { type: "commit-count-increased", value: 1 }, rebaseRepo, { explanationAfterSuccess:"GitAtlas branch'e özgü commit değişikliğini yeni parent üzerinde yeniden oluşturdu. Normal merge conflict editörü tamamdır; rebase conflict editörü bu sürümde kavramsal sınırdır." }),
  commandLesson("advanced/8-4-cherry-pick", "8.4", "advanced", "Tek Commit Değişikliğini Uygula: cherry-pick", "Seçili commit'in parent'ına göre deltasını aktif dala uygulama", "C2 commit değişikliğini main üzerine uygula; main'e özgü dosyaların korunduğunu gözle.", ["git cherry-pick C2"], { type: "commit-count-increased", value: 1 }, diverged, { explanationAfterSuccess:"Cherry-pick kaynak commit'in tüm snapshot'ını kopyalamadı; parent'a göre değişikliği hedef snapshot üzerine uyguladı. Cherry-pick conflict editörü kavramsal sınırdır." }),
  commandLesson("advanced/8-5-archaeology", "8.5", "advanced", "Kod Arkeolojisi · Kavramsal Demo", "Dosya geçmişi ve satır sahipliği komut ailesini tanıma", "README.md için log ve blame çıktısını incele; GitAtlas çıktısının gerçek Git'in yazar/tarih/rename çözümlemesini modellemediğini açıkla.", ["git log README.md", "git blame README.md"], { type: "command-executed", family: "blame" }, twoCommits, { explanationAfterSuccess:"Bu ders kavramsal demodur: GitAtlas blame satırlarını güncel HEAD ile etiketler; gerçek Git satır kökeni, yazar, tarih ve rename geçmişini daha ayrıntılı hesaplar." }),
  commandLesson("advanced/8-6-config", "8.6", "advanced", "Gerçek Terminale Geçiş", "Global kimlik, varsayılan main, .gitignore ve ilk push kontrol listesi", "Güvenli örnek ad ve e-posta komutlarını incele; ardından Gerçek terminal sayfasındaki yeni repo ve clone kontrol listelerini uygula.", ["git config --global user.name \"Örnek Kullanıcı\"", "git config --global user.email \"kullanici@example.invalid\""], { type: "command-executed", family: "config" }, repository(), { successConditions:[{type:"commands-in-order",families:["config","config"]}],explanationAfterSuccess:"GitAtlas config değerlerini kalıcı saklamaz. Gerçek terminal köprüsü init/clone, remote add, ilk commit/push, varsayılan branch ve kimlik doğrulama sınırlarını açıklar.", reward: "Git Sihirbazı" }),
];

export const chapters: readonly ChapterDefinition[] = [
  { id: "concepts", number: 1, title: "Temel Fikir", description: "Komutlardan önce Git'in zihinsel modelini kur.", difficulty: 1, badge: "Kavram Ustası", lessons: chapter1 },
  { id: "local", number: 2, title: "Yerel Git", description: "Working directory → staging area → commit akışını tamamla.", difficulty: 2, prerequisites: ["concepts"], badge: "Yerel Git Kaşifi", lessons: chapter2 },
  { id: "history", number: 3, title: "Geçmişle Oynamak", description: "Farkları incele ve hataları güvenle geri al.", difficulty: 2, prerequisites: ["local"], badge: "Zaman Yolcusu", lessons: chapter3 },
  { id: "branching", number: 4, title: "Dallanma", description: "Paralel çalışma çizgileri oluştur ve değiştir.", difficulty: 3, prerequisites: ["local"], badge: "Paralel Evren Gezgini", lessons: chapter4 },
  { id: "merging", number: 5, title: "Birleştirme Stratejileri", description: "Dalları fast-forward, iki parent'lı commit veya squash ile buluştur.", difficulty: 4, prerequisites: ["branching"], badge: "Birleştirme Ustası", lessons: chapter5 },
  { id: "remotes", number: 6, title: "Uzak Depolar", description: "Yerel geçmişi remote kopyalarla senkronize et.", difficulty: 3, prerequisites: ["local"], badge: "Bulut Kaptanı", lessons: chapter6 },
  { id: "collaboration", number: 7, title: "İşbirliği", description: "Takım akışını uçtan uca uygula.", difficulty: 4, prerequisites: ["merging", "remotes"], badge: "Git Ustası", lessons: chapter7 },
  { id: "advanced", number: 8, title: "İleri Seviye", description: "Geçmişi düzenle, araştır ve kurtar.", difficulty: 5, prerequisites: ["collaboration"], badge: "Git Sihirbazı", lessons: chapter8, bonus: true },
];

export const curriculumLessons: readonly LessonDefinition[] = chapters.flatMap(chapter => chapter.lessons);
