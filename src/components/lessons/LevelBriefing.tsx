"use client";
import { useEffect, useRef } from "react";
import type { ChapterDefinition, LessonDefinition } from "@/domain/lessons/models";

function expectedVisual(lesson: LessonDefinition): string {
    if (lesson.activity === "timeline") return "Dağınık dosyalar, sıralı commit noktalarından oluşan tek bir zaman çizgisine dönüşecek.";
    if (lesson.activity === "time-machine") return "Seçtiğin commit'e göre dosya snapshot'ı ve zaman çizgisi anında değişecek.";
    if (lesson.activity === "three-areas") return "Dosya önce Working Directory'den Staging Area'ya, ardından commit snapshot'ına taşınacak.";
    const commands = lesson.allowedCommands.join(" ");
    if (/branch|switch|checkout/.test(commands)) return "Commit grafiğinde branch etiketi ve HEAD işaretçisi yeni konumuna taşınacak.";
    if (/merge|rebase|cherry-pick/.test(commands)) return "Commit grafiğinde parent bağlantıları ve branch çizgileri güncellenecek.";
    if (/commit/.test(commands)) return "Commit grafiğinde yeni bir commit düğümü oluşacak ve aktif branch ilerleyecek.";
    if (/add|restore|reset/.test(commands)) return "Depo panelindeki Working Directory, Staging Area ve HEAD alanları güncellenecek.";
    if (/push|pull|fetch|remote|clone/.test(commands)) return "Yerel ve remote branch durumunu açıklayan terminal çıktısı oluşacak.";
    return "Terminal çıktısı ve ilgili depo görünümü yaptığın işleme göre güncellenecek.";
}

export function LevelBriefing({ chapter, lesson, onConfirm }: { readonly chapter: ChapterDefinition; readonly lesson: LessonDefinition; readonly onConfirm: () => void }) {
    const dialogRef = useRef<HTMLDivElement>(null);
    const level = lesson.level ?? `${chapter.number}.1`;
    const steps = lesson.activity
        ? ["Etkileşim alanındaki yönergeyi oku.", "Görsel modelde istenen adımları doğru sırayla tamamla.", "Görevi tamamla düğmesi etkinleştiğinde sonucu onayla."]
        : ["Repository ve commit grafiğinin başlangıç durumunu incele.", `Terminalde ${lesson.allowedCommands.at(-1) ?? "istenen Git komutunu"} komutunu uygula.`, "Hedef kartındaki durum oluşana kadar commit grafiğini ve depo panelini takip et."];

    useEffect(() => {
        const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const dialog = dialogRef.current;
        const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []).filter(element => !element.hasAttribute("disabled"));
        focusable()[0]?.focus();
        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") { event.preventDefault(); onConfirm(); return; }
            if (event.key !== "Tab") return;
            const items = focusable(); if (!items.length) return;
            const first = items[0], last = items.at(-1)!;
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
        document.addEventListener("keydown", handleKeyDown);
        return () => { document.removeEventListener("keydown", handleKeyDown); returnFocus?.focus(); };
    }, [onConfirm]);

    return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#07100c]/80 p-3 backdrop-blur-md md:p-6" role="dialog" aria-modal="true" aria-labelledby="level-briefing-title">
        <div ref={dialogRef} className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-[1.75rem] border border-white/10 bg-[var(--surface)] shadow-[0_32px_100px_rgba(0,0,0,.45)]">
            <header className="border-b border-[var(--border)] bg-[var(--bg)] p-5 md:p-7"><div className="flex flex-wrap items-center gap-3"><span className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-black uppercase tracking-wider text-white">Seviye {level}</span><span className="text-xs font-bold tracking-widest text-[var(--text-2)]">Bölüm {chapter.number} · {chapter.title}</span></div><h2 id="level-briefing-title" className="mt-4 text-3xl font-black tracking-tight md:text-4xl">{lesson.title}</h2><p className="mt-3 max-w-2xl leading-7 text-[var(--text-2)]">{lesson.story}</p></header>
            <div className="grid gap-5 p-5 md:grid-cols-[1.15fr_.85fr] md:p-7">
                <section><p className="text-xs font-black uppercase tracking-[.16em] text-[var(--accent)]">Bu seviyede senden beklenen</p><div className="mt-3 rounded-2xl border-2 border-[var(--accent)] bg-[var(--accent-soft)] p-5"><p className="text-lg font-black leading-7">{lesson.goalDescription}</p></div><p className="mt-5 text-xs font-black uppercase tracking-[.16em]">İzlenecek yol</p><ol className="mt-3 space-y-3">{steps.map((step, index) => <li key={step} className="flex gap-3 text-sm leading-6"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--text)] text-xs font-black text-[var(--bg)]">{index + 1}</span><span>{step}</span></li>)}</ol></section>
                <aside className="space-y-3"><div className="rounded-xl border border-[var(--border)] p-4"><p className="text-xs font-black uppercase tracking-wider text-[var(--success)]">Yeni kavram</p><p className="mt-2 text-sm font-bold leading-6">{lesson.concept ?? lesson.title}</p></div><div className="rounded-xl border border-[var(--border)] p-4"><p className="text-xs font-black uppercase tracking-wider">Beklenen görsel değişim</p><p className="mt-2 text-sm leading-6 text-[var(--text-2)]">{expectedVisual(lesson)}</p></div>{lesson.allowedCommands.length > 0 && <div className="rounded-xl border border-[var(--border)] p-4"><p className="text-xs font-black uppercase tracking-wider">Kullanılabilecek komutlar</p><div className="mt-2 flex flex-wrap gap-2">{lesson.allowedCommands.map(command => <code key={command} className="rounded-md bg-[var(--bg)] px-2 py-1 text-xs">{command}</code>)}</div></div>}{lesson.commonMistakes?.[0] && <div className="rounded-xl border border-[var(--warning)]/50 p-4"><p className="text-xs font-black uppercase tracking-wider text-[var(--warning)]">Dikkat</p><p className="mt-2 text-sm text-[var(--text-2)]">{lesson.commonMistakes[0]}</p></div>}</aside>
            </div>
            <footer className="sticky bottom-0 flex flex-col gap-3 border-t border-[var(--border)] bg-[var(--surface)] p-5 sm:flex-row sm:items-center sm:justify-between md:px-7">{lesson.reward ? <p className="text-xs text-[var(--text-2)]">Kazanılacak rozet: <b>{lesson.reward}</b></p> : <span aria-hidden="true" />}<button type="button" onClick={onConfirm} className="min-h-12 rounded-xl bg-[var(--accent)] px-6 py-3 font-black text-white shadow-[0_8px_24px_rgba(231,91,50,.25)] transition hover:-translate-y-0.5 hover:brightness-105">Seviye {level} görevine başla</button></footer>
        </div>
    </div>;
}
