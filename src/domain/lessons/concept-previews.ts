import { makeCommit, type RepositoryState } from "@/domain/git/models";
import type { ConceptActivity } from "@/domain/lessons/models";

export interface ConceptGraphFocus {
  readonly title: string;
  readonly detail: string;
  readonly observation: string;
  readonly commitIds: readonly string[];
}

export interface ConceptPreview {
  readonly state: RepositoryState;
  readonly focus: ConceptGraphFocus;
}

const snapshots = [
  { "odev.docx": "Başlık: Ödev" },
  { "odev.docx": "Başlık: Ödev\nGiriş paragrafı" },
  { "odev.docx": "Başlık: Git Ödevi\nGiriş paragrafı\nSonuç" },
] as const;

function stateFrom(
  base: RepositoryState,
  changes: Partial<RepositoryState>,
): RepositoryState {
  return {
    ...base,
    index: { entries: {} },
    remotes: {},
    reflog: [],
    ...changes,
  };
}

function timelinePreview(base: RepositoryState, stage: number): ConceptPreview {
  const count = Math.max(0, Math.min(3, stage));
  const commits = Object.fromEntries(
    snapshots.slice(0, count).map((snapshot, index) => [
      `C${index}`,
      makeCommit(`C${index}`, ["İlk taslak", "Giriş eklendi", "Son düzenleme"][index], index ? [`C${index - 1}`] : [], snapshot, index ? "commit" : "init"),
    ]),
  );
  const target = count ? `C${count - 1}` : null;
  return {
    state: stateFrom(base, {
      commits,
      branches: { main: { name: "main", target } },
      head: { kind: "branch", name: "main" },
      workingTree: count ? snapshots[count - 1] : { "odev_final.docx": "Başlık: Ödev" },
      nextCommitNumber: count,
    }),
    focus: count === 0
      ? { title: "Henüz kayıt noktası yok", detail: "Dağınık dosya adları bir geçmiş oluşturmaz.", observation: "İlk doğru sürümü seçtiğinde grafikte C0 düğümü oluşmalı.", commitIds: [] }
      : { title: `${target} grafiğe eklendi`, detail: `main işaretçisi artık en yeni kayıt noktası ${target}'ı gösteriyor.`, observation: count === 3 ? "Üç ayrı dosya yerine birbirine parent bağıyla bağlı üç commit görmelisin." : "Yeni düğümün bir önceki commit'e bağlandığını kontrol et.", commitIds: [target!] },
  };
}

function timeMachinePreview(base: RepositoryState, stage: number): ConceptPreview {
  const position = Math.max(0, Math.min(2, stage));
  const commits = Object.fromEntries(snapshots.map((snapshot, index) => [
    `C${index}`,
    makeCommit(`C${index}`, ["İlk kayıt", "Geliştirme", "Bugün"][index], index ? [`C${index - 1}`] : [], snapshot, index ? "commit" : "init"),
  ]));
  return {
    state: stateFrom(base, {
      commits,
      branches: { main: { name: "main", target: "C2" } },
      head: { kind: "detached", target: `C${position}` },
      workingTree: snapshots[position],
      nextCommitNumber: 3,
    }),
    focus: {
      title: `HEAD şimdi C${position} snapshot'ını gösteriyor`,
      detail: "Commit'ler silinmedi ve main yerinden oynamadı; yalnızca baktığın kayıt noktası değişti.",
      observation: `Grafikte “HEAD (detached)” etiketini C${position} üzerinde bul.`,
      commitIds: [`C${position}`],
    },
  };
}

function threeAreasPreview(base: RepositoryState, stage: number): ConceptPreview {
  const rootSnapshot = { "README.md": "# Pusula" };
  const changedSnapshot = { ...rootSnapshot, "odev.docx": "Başlık: Git Ödevi" };
  const committed = stage >= 2;
  const commits = {
    C0: makeCommit("C0", "Proje başlangıcı", [], rootSnapshot, "init"),
    ...(committed ? { C1: makeCommit("C1", "Ödevi kaydet", ["C0"], changedSnapshot) } : {}),
  };
  return {
    state: stateFrom(base, {
      commits,
      branches: { main: { name: "main", target: committed ? "C1" : "C0" } },
      head: { kind: "branch", name: "main" },
      workingTree: changedSnapshot,
      index: { entries: stage === 1 ? { "odev.docx": changedSnapshot["odev.docx"] } : {} },
      nextCommitNumber: committed ? 2 : 1,
    }),
    focus: stage === 0
      ? { title: "Değişiklik henüz commit değil", detail: "Dosya yalnızca working directory'de; commit grafiği bu yüzden değişmedi.", observation: "Grafikte yalnız C0 görünmeli.", commitIds: ["C0"] }
      : stage === 1
        ? { title: "git add grafiğe commit eklemez", detail: "İçerik staging area'ya seçildi, fakat kalıcı snapshot henüz oluşmadı.", observation: "Depo panelinde staged dosyayı görürken grafiğin hâlâ C0'da kaldığını karşılaştır.", commitIds: ["C0"] }
        : { title: "git commit yeni düğümü oluşturdu", detail: "Staging area'daki içerik C1 snapshot'ına dönüştü ve main ileri taşındı.", observation: "C1'in parent bağlantısını ve HEAD → main etiketini bul.", commitIds: ["C1"] },
  };
}

function branchPreview(base: RepositoryState, stage: number): ConceptPreview {
  const root = makeCommit("C0", "Proje başlangıcı", [], { "README.md": "# Pusula" }, "init");
  const feature = makeCommit("C1", "Arama özelliği", ["C0"], { "README.md": "# Pusula", "search.ts": "export const search = true;" });
  const hasBranch = stage >= 2;
  const hasFeatureCommit = stage >= 3;
  return {
    state: stateFrom(base, {
      commits: { C0: root, ...(hasFeatureCommit ? { C1: feature } : {}) },
      branches: {
        main: { name: "main", target: "C0" },
        ...(hasBranch ? { feature: { name: "feature", target: hasFeatureCommit ? "C1" : "C0" } } : {}),
      },
      head: hasBranch ? { kind: "branch", name: "feature" } : { kind: "branch", name: "main" },
      workingTree: hasFeatureCommit ? feature.snapshot : root.snapshot,
      nextCommitNumber: hasFeatureCommit ? 2 : 1,
    }),
    focus: stage < 2
      ? { title: "main yalnızca C0'ı gösteren bir işaretçi", detail: "Branch dosya kopyası değil, bir commit kimliğine bağlı hareketli referanstır.", observation: "C0 üzerinde HEAD → main etiketini bul.", commitIds: ["C0"] }
      : stage === 2
        ? { title: "Yeni branch yeni commit oluşturmadı", detail: "main ve feature aynı C0 commit'ini gösteriyor; yalnızca ikinci bir işaretçi eklendi.", observation: "Tek düğüm üzerinde hem main hem HEAD → feature etiketlerini görmelisin.", commitIds: ["C0"] }
        : { title: "Yalnız aktif branch ilerledi", detail: "C1 feature üzerinde oluştu. main güvenli C0 noktasında kaldı.", observation: "Grafikte C0 → C1 bağlantısını, main'in C0'da ve HEAD → feature'ın C1'de olduğunu doğrula.", commitIds: ["C0", "C1"] },
  };
}

function remotePreview(base: RepositoryState, stage: number): ConceptPreview {
  const c0 = makeCommit("C0", "Proje başlangıcı", [], { "README.md": "# Pusula" }, "init");
  const c1 = makeCommit("C1", "Yerel geliştirme", ["C0"], { "README.md": "# Pusula\nKurulum" });
  const hasOrigin = stage >= 2;
  const synced = stage >= 3;
  return {
    state: stateFrom(base, {
      commits: { C0: c0, C1: c1 },
      branches: { main: { name: "main", target: "C1" } },
      head: { kind: "branch", name: "main" },
      workingTree: c1.snapshot,
      remotes: hasOrigin ? { origin: { name: "origin", url: "https://example.com/pusula.git", branches: { main: synced ? "C1" : "C0" } } } : {},
      nextCommitNumber: 2,
    }),
    focus: !hasOrigin
      ? { title: "Yerel geçmiş bağımsızdır", detail: "main ve commit'ler önce yalnızca bilgisayarındaki repository'de yaşar.", observation: "Grafikte yalnız yerel HEAD → main etiketini gör.", commitIds: ["C1"] }
      : synced
        ? { title: "Yerel ve remote işaretçileri aynı commit'te", detail: "Senkronizasyon sonrası main ile origin/main aynı C1'i gösteriyor.", observation: "C1 üzerinde iki ayrı etiketi bul; bunlar aynı branch değil, iki repository'nin referanslarıdır.", commitIds: ["C1"] }
        : { title: "origin/main ayrı bir işaretçidir", detail: "Remote C0'ı gösterirken yerel main C1'e ilerlemiş olabilir.", observation: "origin/main'i C0'da, HEAD → main'i C1'de karşılaştır.", commitIds: ["C0", "C1"] },
  };
}

function collaborationPreview(base: RepositoryState, stage: number): ConceptPreview {
  const c0 = makeCommit("C0", "Proje başlangıcı", [], { "README.md": "# Pusula" }, "init");
  const c1 = makeCommit("C1", "Arama özelliği", ["C0"], { "README.md": "# Pusula", "search.ts": "hazır" });
  const c2 = makeCommit("C2", "PR #12 birleştirildi", ["C0", "C1"], c1.snapshot, "merge");
  const hasFeature = stage >= 2;
  const merged = stage >= 3;
  return {
    state: stateFrom(base, {
      commits: { C0: c0, ...(hasFeature ? { C1: c1 } : {}), ...(merged ? { C2: c2 } : {}) },
      branches: {
        main: { name: "main", target: merged ? "C2" : "C0" },
        ...(hasFeature ? { "feature/search": { name: "feature/search", target: "C1" } } : {}),
      },
      head: { kind: "branch", name: "main" },
      workingTree: merged ? c2.snapshot : c0.snapshot,
      remotes: { origin: { name: "origin", url: "https://example.com/pusula.git", branches: { main: merged ? "C2" : "C0", ...(hasFeature ? { "feature/search": "C1" } : {}) } } },
      nextCommitNumber: merged ? 3 : hasFeature ? 2 : 1,
    }),
    focus: !hasFeature
      ? { title: "Çalışma C0'dan başlıyor", detail: "Clone, var olan commit geçmişi ve remote işaretçileriyle yerel kopyayı kurar.", observation: "main ile origin/main aynı başlangıç commit'ini gösteriyor.", commitIds: ["C0"] }
      : merged
        ? { title: "PR incelemesi merge commit ile sonuçlandı", detail: "C2'nin iki parent'ı ana çizgi ile feature çalışmasını bir araya getiriyor.", observation: "C2'den hem C0'a hem C1'e giden iki parent bağlantısını bul.", commitIds: ["C1", "C2"] }
        : { title: "Feature çalışması ayrı çizgide yayınlandı", detail: "Push, feature branch işaretçisini origin üzerinde görünür yaptı; main yerinden oynamadı.", observation: "C1 üzerinde feature/search ve origin/feature/search etiketlerini karşılaştır.", commitIds: ["C0", "C1"] },
  };
}

export function buildConceptPreview(activity: ConceptActivity, stage: number, base: RepositoryState): ConceptPreview {
  switch (activity) {
    case "timeline": return timelinePreview(base, stage);
    case "time-machine": return timeMachinePreview(base, stage);
    case "three-areas": return threeAreasPreview(base, stage);
    case "branch-metaphor": return branchPreview(base, stage);
    case "remote-flow": return remotePreview(base, stage);
    case "collaboration-flow": return collaborationPreview(base, stage);
  }
}
