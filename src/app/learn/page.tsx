"use client";
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { chapters, lessons } from "@/content/lessons";
import { loadProgress } from "@/persistence/progress";

const subscribe = (listener: () => void) => {
    window.addEventListener("storage", listener);
    window.addEventListener("gitatlas:progress", listener);
    return () => { window.removeEventListener("storage", listener); window.removeEventListener("gitatlas:progress", listener); };
};
const snapshot = () => { try { return localStorage.getItem("gitatlas:progress") ?? ""; } catch { return ""; } };
const serverSnapshot = () => "";

export default function LearnPage() {
    const version = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
    const progressState = useMemo(() => version ? loadProgress() : null, [version]);
    const completed = progressState?.completedLessons ?? [];
    const progress = lessons.length > 0 ? Math.round((completed.length / lessons.length) * 100) : 0;
    const completedChapters = new Set(chapters.filter(chapter => chapter.lessons.every(lesson => completed.includes(lesson.id))).map(chapter => chapter.id));
    const earnedBadges = chapters.filter(chapter => completedChapters.has(chapter.id));

    return <main className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
        <Link href="/" className="text-sm font-bold text-[var(--text-2)]">← GitAtlas</Link>
        <div className="mt-8 grid gap-6 rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-6 md:grid-cols-[1fr_auto] md:p-8">
            <div><p className="text-xs font-black uppercase tracking-[.2em] text-[var(--success)]">{chapters.length} bölüm · {lessons.length} seviye</p><h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">Git öğrenme haritası</h1><p className="mt-3 max-w-2xl leading-7 text-[var(--text-2)]">Önce zihinsel modeli kur, sonra yerel Git&apos;ten takım akışına kadar her kavramı canlı repository üzerinde uygula.</p><nav aria-label="Bağımsız öğrenme araçları" className="mt-4 flex flex-wrap gap-2"><Link href="/assessments" className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-bold">Mastery değerlendirmeleri</Link><Link href="/sandbox" className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-bold">Sandbox</Link><Link href="/glossary" className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-bold">Sözlük</Link><Link href="/stats" className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-bold">Yerel istatistikler</Link><Link href="/real-terminal" className="rounded-lg border border-[var(--accent)] px-3 py-2 text-sm font-bold text-[var(--accent)]">Gerçek terminale geçiş</Link></nav></div>
            <div className="flex min-w-44 flex-col justify-center rounded-2xl bg-[var(--bg)] p-5"><span className="text-4xl font-black text-[var(--accent)]">%{progress}</span><span className="mt-1 text-xs font-bold uppercase tracking-wider text-[var(--text-2)]">Genel ilerleme</span></div>
            <div className="md:col-span-2"><div className="h-3 overflow-hidden rounded-full bg-[var(--border)]"><div className="h-full rounded-full bg-[var(--success)] transition-[width] duration-700" style={{ width: `${progress}%` }} /></div><div className="mt-2 flex justify-between text-xs font-bold text-[var(--text-2)]"><span>{completed.length} tamamlandı</span><span>{lessons.length - completed.length} kaldı</span></div></div>
        </div>

        {earnedBadges.length > 0 && <section className="mt-8"><h2 className="text-sm font-black uppercase tracking-widest">Kazanılan rozetler</h2><div className="mt-3 flex flex-wrap gap-2">{earnedBadges.map(chapter => <span key={chapter.id} className="rounded-full border border-[var(--success)] bg-[var(--surface-raised)] px-4 py-2 text-sm font-bold text-[var(--success)]">{chapter.badge}</span>)}</div></section>}

        <div className="mt-10 space-y-8">{chapters.map(chapter => {
            const unlocked = (chapter.prerequisites ?? []).every(prerequisite => completedChapters.has(prerequisite));
            const chapterDone = completedChapters.has(chapter.id);
            const missingPrerequisites = (chapter.prerequisites ?? []).filter(prerequisite => !completedChapters.has(prerequisite)).map(prerequisite => chapters.find(item => item.id === prerequisite)?.title ?? prerequisite);
            const doneCount = chapter.lessons.filter(lesson => completed.includes(lesson.id)).length;
            return <section key={chapter.id} className={`overflow-hidden rounded-[1.75rem] border bg-[var(--surface)] ${chapterDone ? "border-[var(--success)]" : "border-[var(--border)]"}`}>
                <header className="grid gap-4 border-b border-[var(--border)] p-5 md:grid-cols-[auto_1fr_auto] md:items-center md:p-6">
                    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-black ${unlocked ? "bg-[var(--text)] text-[var(--bg)]" : "bg-[var(--border)] text-[var(--text-2)]"}`}>{chapter.number}</div>
                    <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-black">{chapter.title}</h2>{chapter.bonus && <span className="rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[10px] font-black uppercase text-[var(--accent)]">Bonus</span>}{!unlocked && <span className="rounded-full border border-[var(--border)] px-2 py-1 text-[10px] font-black uppercase text-[var(--text-2)]">Kilitli</span>}</div><p className="mt-1 text-sm text-[var(--text-2)]">{chapter.description}</p>{!unlocked&&<p className="mt-2 text-xs font-bold text-[var(--warning)]">Önce tamamla: {missingPrerequisites.join(", ")}</p>}</div>
                    <div className="text-right"><p className="font-black">{doneCount}/{chapter.lessons.length}</p><p className="text-xs text-[var(--text-2)]">{"★".repeat(chapter.difficulty)}{"☆".repeat(5 - chapter.difficulty)}</p></div>
                </header>
                <div className="grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-3">{chapter.lessons.map(lesson => {
                    const done = completed.includes(lesson.id);
                    const card = <><div><span className={`text-xs font-black uppercase tracking-wider ${done ? "text-[var(--success)]" : "text-[var(--accent)]"}`}>{done ? "Tamamlandı" : `Seviye ${lesson.level}`}</span></div><h3 className="mt-5 text-lg font-black">{lesson.title}</h3><p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--text-2)]">{lesson.goalDescription}</p>{lesson.reward && <p className="mt-4 text-xs font-bold text-[var(--success)]">Rozet · {lesson.reward}</p>}</>;
                    return unlocked ? <Link key={lesson.id} href={`/learn/${encodeURIComponent(lesson.id)}`} className={`group rounded-2xl border p-5 transition-transform hover:-translate-y-0.5 ${done ? "border-[var(--success)] bg-[var(--surface-raised)]" : "border-[var(--border)] bg-[var(--bg)] hover:border-[var(--accent)]"}`}>{card}</Link> : <div key={lesson.id} aria-disabled="true" className="cursor-not-allowed rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-5 opacity-45">{card}</div>;
                })}</div>
                {chapterDone && <div className="border-t border-[var(--success)] bg-[var(--surface-raised)] px-6 py-4 text-sm font-black text-[var(--success)]">Bölüm tamamlandı · {chapter.badge} rozeti kazanıldı</div>}
            </section>;
        })}</div>
    </main>;
}
