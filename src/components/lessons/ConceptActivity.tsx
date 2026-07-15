"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { RepositoryState } from "@/domain/git/models";
import type { ConceptActivity as Activity } from "@/domain/lessons/models";
import { buildConceptPreview, type ConceptPreview } from "@/domain/lessons/concept-previews";

const card = "rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-4";

interface ActivityProps {
  readonly initialState: RepositoryState;
  readonly onPreviewChange: (preview: ConceptPreview) => void;
  readonly onComplete: () => void;
}

function CompleteButton({ enabled, onComplete }: { readonly enabled: boolean; readonly onComplete: () => void }) {
  return <button type="button" disabled={!enabled} onClick={onComplete} className="mt-5 w-full rounded-xl bg-[var(--success)] px-5 py-3 font-bold text-[var(--bg)] transition-transform enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-35">Görevi tamamla</button>;
}

function TimelineActivity({ initialState, onPreviewChange, onComplete }: ActivityProps) {
  const versions = [
    { id: 2, name: "odev_final_SON_gercek.docx", note: "En son düzeltme" },
    { id: 0, name: "odev_final.docx", note: "İlk taslak" },
    { id: 1, name: "odev_final_SON.docx", note: "İkinci sürüm" },
  ];
  const [ordered, setOrdered] = useState<typeof versions>([]);
  const [message, setMessage] = useState("Dosyaları eskiden yeniye doğru seç.");

  useEffect(() => onPreviewChange(buildConceptPreview("timeline", 0, initialState)), [initialState, onPreviewChange]);

  function choose(version: typeof versions[number]) {
    if (version.id !== ordered.length) {
      setMessage("Bu sürüm sıradaki değil. Dosya adlarındaki ipucunu tekrar incele.");
      return;
    }
    const next = [...ordered, version];
    setOrdered(next);
    onPreviewChange(buildConceptPreview("timeline", next.length, initialState));
    setMessage(version.id === 2 ? "Dosya kopyaları artık parent bağları olan tek bir Git geçmişi." : "Doğru. Commit grafiğine eklenen düğümü bul, sonra sıradaki sürümü seç.");
  }

  return <ActivityShell title="Kopya karmaşasını commit geçmişine dönüştür" instruction="Her doğru sürüm grafiğe yeni bir commit ekler. Düğümlerin dosya kopyası değil, birbirine bağlı snapshot'lar olduğunu gözlemle.">
    <div className="grid gap-2">{versions.map(version => <button key={version.id} type="button" disabled={ordered.some(item => item.id === version.id)} onClick={() => choose(version)} className={`${card} text-left transition-colors enabled:hover:border-[var(--accent)] disabled:opacity-35`}><code className="text-xs font-bold">{version.name}</code><p className="mt-1 text-xs text-[var(--text-2)]">{version.note}</p></button>)}</div>
    <p aria-live="polite" className="mt-4 rounded-xl bg-[var(--bg)] p-3 text-sm leading-6 text-[var(--text-2)]">{message}</p>
    <CompleteButton enabled={ordered.length === versions.length} onComplete={onComplete} />
  </ActivityShell>;
}

function TimeMachineActivity({ initialState, onPreviewChange, onComplete }: ActivityProps) {
  const snapshots = [
    { commit: "C0", label: "İlk kayıt", content: "Başlık: Ödev" },
    { commit: "C1", label: "Geliştirme", content: "Başlık: Ödev\nGiriş paragrafı" },
    { commit: "C2", label: "Bugün", content: "Başlık: Git Ödevi\nGiriş paragrafı\nSonuç" },
  ];
  const [position, setPosition] = useState(2);
  const [visited, setVisited] = useState(() => new Set([2]));

  useEffect(() => onPreviewChange(buildConceptPreview("time-machine", 2, initialState)), [initialState, onPreviewChange]);

  function travel(next: number) {
    setPosition(next);
    setVisited(items => new Set([...items, next]));
    onPreviewChange(buildConceptPreview("time-machine", next, initialState));
  }

  const current = snapshots[position];
  return <ActivityShell title="HEAD ile commit'ler arasında zaman yolculuğu yap" instruction="Üç snapshot'ı ziyaret et. Grafikte commit'lerin yerinde kaldığını, yalnız detached HEAD etiketinin taşındığını doğrula.">
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--terminal)] p-5 text-white"><div className="flex items-center justify-between"><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">{current.commit}</span><span className="text-xs text-white/60">{current.label}</span></div><pre className="mt-5 min-h-28 whitespace-pre-wrap text-sm leading-7 text-[#d9e9e3]">{current.content}</pre></div>
    <div className="mt-5"><input aria-label="Commit zaman çizgisi" type="range" min="0" max="2" value={position} onChange={event => travel(Number(event.target.value))} className="w-full accent-[var(--accent)]"/><div className="mt-2 flex justify-between text-xs font-bold text-[var(--text-2)]">{snapshots.map((snapshot, index) => <span key={snapshot.commit} className={visited.has(index) ? "text-[var(--success)]" : ""}>{snapshot.commit}</span>)}</div></div>
    <p className="mt-4 rounded-xl bg-[var(--bg)] p-3 text-sm leading-6 text-[var(--text-2)]" aria-live="polite">{visited.size === 3 ? "Üç snapshot'ı da gördün. main C2'de kaldı; sadece HEAD ile baktığın commit değişti." : `${visited.size}/3 kayıt noktası ziyaret edildi.`}</p>
    <CompleteButton enabled={visited.size === 3} onComplete={onComplete} />
  </ActivityShell>;
}

function ThreeAreasActivity({ initialState, onPreviewChange, onComplete }: ActivityProps) {
  const [stage, setStage] = useState(0);
  const areas = ["WORKING DIRECTORY", "STAGING AREA", "COMMIT C1"];
  const descriptions = ["Dosya değişti; commit grafiği değişmez çünkü henüz snapshot yok.", "git add içeriği seçti; commit grafiği yine değişmez.", "git commit seçili içeriği C1 snapshot'ına dönüştürdü."];

  useEffect(() => onPreviewChange(buildConceptPreview("three-areas", 0, initialState)), [initialState, onPreviewChange]);

  function move(next: number) {
    setStage(next);
    onPreviewChange(buildConceptPreview("three-areas", next, initialState));
  }

  return <ActivityShell title="Bir dosyanın üç alandaki yolculuğunu commit grafiğiyle karşılaştır" instruction="Önce git add, sonra git commit etkisini simüle et. Her adımda depo paneli ile commit grafiği arasındaki farkı oku.">
    <div className="grid gap-3 md:grid-cols-3">{areas.map((area, index) => <div key={area} className={`${card} min-h-36 ${stage === index ? "border-[var(--accent)] shadow-[0_0_0_2px_var(--accent-soft)]" : "opacity-55"}`}><p className="text-xs font-black tracking-wider">{area}</p>{stage === index && <div className="mt-5 rounded-lg bg-[var(--accent-soft)] p-3"><code className="text-xs font-bold">odev.docx</code><p className="mt-2 text-xs leading-5 text-[var(--text-2)]">{descriptions[index]}</p></div>}</div>)}</div>
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"><button type="button" disabled={stage !== 0} onClick={() => move(1)} className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-3 font-bold disabled:opacity-35"><code>git add odev.docx</code></button><button type="button" disabled={stage !== 1} onClick={() => move(2)} className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-3 font-bold disabled:opacity-35"><code>git commit</code></button></div>
    <p className="mt-4 text-sm leading-6 text-[var(--text-2)]" aria-live="polite">{descriptions[stage]}</p>
    <CompleteButton enabled={stage === 2} onComplete={onComplete} />
  </ActivityShell>;
}

interface FlowStep {
  readonly title: string;
  readonly action: string;
  readonly detail: string;
  readonly graphTask: string;
}

const flowContent: Record<Exclude<Activity, "timeline" | "time-machine" | "three-areas">, { readonly title: string; readonly instruction: string; readonly steps: readonly FlowStep[] }> = {
  "branch-metaphor": {
    title: "Branch işaretçilerini commit grafiğinde hareket ettir",
    instruction: "Üç adımı sırayla uygula. Her adım yeni bir proje kopyası mı oluşturuyor, yoksa yalnızca bir işaretçiyi mi değiştiriyor?",
    steps: [
      { title: "Başlangıç noktasını oku", action: "main → C0 durumunu göster", detail: "main, C0 commit kimliğini tutan hareketli bir referanstır.", graphTask: "C0 üzerinde HEAD → main etiketini bul." },
      { title: "feature branch oluştur", action: "feature işaretçisini ekle", detail: "Yeni branch commit veya dosya kopyası oluşturmaz. main ve feature aynı C0'ı gösterir.", graphTask: "Tek commit üzerinde iki branch etiketi olduğunu doğrula." },
      { title: "feature üzerinde commit oluştur", action: "C1 snapshot'ını kaydet", detail: "HEAD feature üzerinde olduğu için C1 yalnız feature işaretçisini ilerletir; main C0'da kalır.", graphTask: "main'i C0'da, HEAD → feature'ı C1'de bul." },
    ],
  },
  "remote-flow": {
    title: "Yerel ve remote işaretçilerini commit grafiğinde karşılaştır",
    instruction: "origin'in sihirli bir sunucu değil, başka repository'yi adlandıran remote olduğunu işaretçiler üzerinden gör.",
    steps: [
      { title: "Yerel repository", action: "yerel main'i göster", detail: "Commit ve branch'lerin önce kendi repository'nde yaşar.", graphTask: "HEAD → main etiketini bul." },
      { title: "origin bağlantısı", action: "origin/main'i ekle", detail: "Remote-tracking işaretçisi yerel main'den farklı bir commit'i gösterebilir.", graphTask: "main ile origin/main etiketlerinin farklı düğümlerde olduğunu gör." },
      { title: "fetch ve pull sonucu", action: "işaretçileri eşitle", detail: "Fetch remote bilgisini günceller; pull ayrıca yerel branch'e uygular.", graphTask: "İki işaretçinin C1 üzerinde buluştuğunu doğrula." },
    ],
  },
  "collaboration-flow": {
    title: "Pull Request akışını commit grafiğinde kur",
    instruction: "PR'ın tek bir Git komutu değil; branch, push, inceleme ve merge aşamalarından oluşan işbirliği süreci olduğunu gör.",
    steps: [
      { title: "Fork ve clone", action: "başlangıç geçmişini al", detail: "Çalışma kopyası mevcut commit geçmişi ve remote bağlantısıyla kurulur.", graphTask: "main ile origin/main'in C0'da başladığını gör." },
      { title: "Branch, commit ve push", action: "feature çizgisini yayınla", detail: "Değişiklik main'den ayrı C1 commit'inde paylaşılır.", graphTask: "feature işaretçilerini C1'de, main'i C0'da bul." },
      { title: "Review ve merge", action: "PR'ı birleştir", detail: "İnceleme sonrası iki parent'lı C2 merge commit'i ana çizgiye eklenir.", graphTask: "C2'nin iki parent bağlantısını say." },
    ],
  },
};

function FlowActivity({ activity, initialState, onPreviewChange, onComplete }: ActivityProps & { readonly activity: keyof typeof flowContent }) {
  const [step, setStep] = useState(0);
  const content = flowContent[activity];

  useEffect(() => onPreviewChange(buildConceptPreview(activity, 0, initialState)), [activity, initialState, onPreviewChange]);

  function advance(index: number) {
    const next = Math.max(step, index + 1);
    setStep(next);
    onPreviewChange(buildConceptPreview(activity, next, initialState));
  }

  return <ActivityShell title={content.title} instruction={content.instruction}>
    <div className="space-y-3">{content.steps.map((item, index) => <button key={item.title} type="button" disabled={index > step} onClick={() => advance(index)} className={`${card} w-full text-left transition-colors ${index < step ? "border-[var(--success)]" : index === step ? "border-[var(--accent)]" : "opacity-35"}`}><div className="flex items-start justify-between gap-3"><span><span className="text-xs font-black text-[var(--text-2)]">0{index + 1}</span><strong className="ml-3">{item.title}</strong></span><span className="rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[10px] font-black text-[var(--accent)]">{index < step ? "GÖZLEMLENDİ" : "UYGULA"}</span></div><p className="mt-2 text-xs font-bold text-[var(--accent)]">{item.action}</p>{index < step && <div className="mt-3 border-t border-[var(--border)] pt-3"><p className="text-sm leading-6 text-[var(--text-2)]">{item.detail}</p><p className="mt-2 text-xs font-bold text-[var(--success)]">Grafik kontrolü: {item.graphTask}</p></div>}</button>)}</div>
    <div className="mt-4 rounded-xl border border-[var(--accent)]/35 bg-[var(--accent-soft)] p-3 text-sm leading-6"><b>Şimdi commit grafiğine bak:</b> {step === 0 ? "İlk adımı uygula; merkezdeki grafik bu keşfe göre değişecek." : content.steps[Math.min(step, content.steps.length) - 1].graphTask}</div>
    <CompleteButton enabled={step >= content.steps.length} onComplete={onComplete} />
  </ActivityShell>;
}

function ActivityShell({ title, instruction, children }: { readonly title: string; readonly instruction: string; readonly children: ReactNode }) {
  return <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5" aria-label="Kavram etkileşimi"><div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-widest text-[var(--success)]">Uygulamalı keşif</p><span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[10px] font-black text-[var(--text-2)]">COMMIT GRAFİĞİYLE BAĞLANTILI</span></div><h2 className="mt-2 text-xl font-black">{title}</h2><p className="mt-2 text-sm leading-6 text-[var(--text-2)]">{instruction}</p><p className="mt-3 rounded-lg bg-[var(--bg)] px-3 py-2 text-xs font-bold text-[var(--text-2)]">Her etkileşim merkezdeki commit grafiğini ve depo görünümünü günceller.</p><div className="mt-5">{children}</div></section>;
}

export function ConceptActivity({ activity, initialState, onPreviewChange, onComplete }: ActivityProps & { readonly activity: Activity }) {
  if (activity === "timeline") return <TimelineActivity initialState={initialState} onPreviewChange={onPreviewChange} onComplete={onComplete} />;
  if (activity === "time-machine") return <TimeMachineActivity initialState={initialState} onPreviewChange={onPreviewChange} onComplete={onComplete} />;
  if (activity === "three-areas") return <ThreeAreasActivity initialState={initialState} onPreviewChange={onPreviewChange} onComplete={onComplete} />;
  return <FlowActivity activity={activity} initialState={initialState} onPreviewChange={onPreviewChange} onComplete={onComplete} />;
}
