"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CommitGraph } from "@/components/graph/CommitGraph";
import { ConceptActivity } from "@/components/lessons/ConceptActivity";
import { LevelBriefing } from "@/components/lessons/LevelBriefing";
import { RepositoryPanel } from "@/components/repository/RepositoryPanel";
import { Terminal, type TerminalEntry } from "@/components/terminal/Terminal";
import { executeCommand, updateWorkingFile } from "@/domain/git/engine";
import { parseCommand } from "@/domain/git/parser";
import type { ConceptPreview } from "@/domain/lessons/concept-previews";
import { commandFamily, emptySession, evaluateConditions, type LessonDefinition, type LessonSession } from "@/domain/lessons/models";
import { completeLesson, recordAttempt, setLastLesson } from "@/persistence/progress";
import { chapters, lessons } from "@/content/lessons";

const chapterNames: Record<string, string> = { concepts: "Temel Fikir", local: "Yerel Git", history: "Geçmiş", branching: "Dallanma", merging: "Birleştirme", remotes: "Remote", collaboration: "İşbirliği", advanced: "İleri Seviye" };

export function LessonWorkspace({ lesson }: { readonly lesson: LessonDefinition }) {
    const chapter = chapters.find(item => item.id === lesson.chapterId);
    const [showLevelIntro, setShowLevelIntro] = useState(Boolean(chapter && lesson.level));
    const [state, setState] = useState(lesson.initialRepositoryState); const [entries, setEntries] = useState<readonly TerminalEntry[]>([{ command: "", lines: ["GitAtlas terminaline hoş geldin. Kullanılabilir komutlar için help yaz."], kind: "info" }]); const [undo, setUndo] = useState<typeof state[]>([]); const [hintCount, setHintCount] = useState(0); const [session, setSession] = useState<LessonSession>(emptySession());
    const [conceptComplete, setConceptComplete] = useState(false);
    const [conceptPreview, setConceptPreview] = useState<ConceptPreview>();
    const [activityKey, setActivityKey] = useState(0);
    const [showBriefing, setShowBriefing] = useState(!chapter && Boolean(lesson.briefing && lesson.briefing.length > 0));
    const [persistenceError, setPersistenceError] = useState(false);
    const legacyDialogRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (setLastLesson(lesson.id)) return;
        const timeout = window.setTimeout(() => setPersistenceError(true), 0);
        return () => window.clearTimeout(timeout);
    }, [lesson.id]);
    useEffect(() => {
        if (!showBriefing) return;
        const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const dialog = legacyDialogRef.current;
        const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []).filter(element => !element.hasAttribute("disabled"));
        focusable()[0]?.focus();
        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") { event.preventDefault(); setShowBriefing(false); return; }
            if (event.key !== "Tab") return;
            const items = focusable(); if (!items.length) return;
            const first = items[0], last = items.at(-1)!;
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
        document.addEventListener("keydown", handleKeyDown);
        return () => { document.removeEventListener("keydown", handleKeyDown); returnFocus?.focus(); };
    }, [showBriefing]);
    const complete = useMemo(() => lesson.activity ? conceptComplete : evaluateConditions(state, lesson.successConditions, session, lesson.initialRepositoryState), [state, session, lesson, conceptComplete]);
    const chapterName = chapterNames[lesson.chapterId ?? ""] ?? "Ders";
    const currentIndex = lessons.findIndex(item => item.id === lesson.id); const nextLesson = lessons[currentIndex + 1];
    const displayedState = conceptPreview?.state ?? state;
    function append(command: string, lines: readonly string[], kind: TerminalEntry["kind"]) { setEntries(items => [...items, { command, lines, kind }]); }
    function run(text: string) {
        if (text === "__clear__") { setEntries([]); return } if (text === "undo") { const previous = undo.at(-1); if (previous) { setState(previous); setUndo(items => items.slice(0, -1)); append(text, ["Önceki repository state snapshot'ı geri yüklendi."], "success") } else append(text, ["Geri alınacak state değişikliği yok."], "error"); return }
        const parsed = parseCommand(text); if (!parsed.ok) { const nextSession={...session,errorCount:(session.errorCount??0)+1,events:[...(session.events??[]),{input:text,ok:false,at:new Date().toISOString()}]};setSession(nextSession);recordAttempt(lesson.id,{error:true});append(text, [parsed.message, ...(parsed.suggestion ? [`Öneri: ${parsed.suggestion}`] : [])], "error"); return }
        const outcome = executeCommand(state, parsed.command); if (outcome.error) { const modeHint=parsed.command.kind==="diff"?parsed.command.mode:parsed.command.kind==="restore"?(parsed.command.staged?"staged":undefined):undefined;const family=commandFamily(parsed.command.kind,modeHint);const nextSession={...session,errorCount:(session.errorCount??0)+1,events:[...(session.events??[]),{family,input:text,ok:false,at:new Date().toISOString()}]};setSession(nextSession);recordAttempt(lesson.id,{error:true});append(text, [outcome.error.message], "error"); return }
        const modeHint = parsed.command.kind === "diff" ? parsed.command.mode : parsed.command.kind === "restore" ? (parsed.command.staged ? "staged" : undefined) : undefined; const family = commandFamily(parsed.command.kind, modeHint); const nextSession:LessonSession = { ...session,executedCommands:family?[...session.executedCommands,family]:session.executedCommands,events:[...(session.events??[]),{family,input:text,ok:true,at:new Date().toISOString()}] };
        if (outcome.state !== state) { setUndo(items => [...items, state]); setState(outcome.state) } setSession(nextSession); append(text, [...outcome.output, ...(outcome.teachingMessage ? [`↳ ${outcome.teachingMessage}`] : [])], "success");
        if (!complete && evaluateConditions(outcome.state, lesson.successConditions, nextSession, lesson.initialRepositoryState) && !completeLesson(lesson.id, hintCount,(nextSession.errorCount??0)>0)) setPersistenceError(true);
    }
    function finishConcept() { setConceptComplete(true); if (!completeLesson(lesson.id, hintCount,(session.errorCount??0)>0)) setPersistenceError(true); }
    function editConflict(path: string, content: string) { setState(current => updateWorkingFile(current, path, content)); }
    function reset() { setState(lesson.initialRepositoryState); setEntries([]); setUndo([]); setHintCount(0); setSession(emptySession()); setConceptComplete(false); setConceptPreview(undefined); setActivityKey(value => value + 1); setShowLevelIntro(Boolean(chapter && lesson.level)); setShowBriefing(!chapter && Boolean(lesson.briefing && lesson.briefing.length > 0)) }
    const successHeading = "Görev tamamlandı.";
    return <main className="min-h-screen p-3 md:p-5">
        {persistenceError && <div role="alert" className="mb-4 rounded-xl border border-[var(--warning)] bg-[var(--surface-raised)] px-4 py-3 text-sm font-bold">İlerleme tarayıcıya kaydedilemedi. Storage erişimini kontrol edip dersi yeniden tamamlayın.</div>}
        {showLevelIntro && chapter && <LevelBriefing chapter={chapter} lesson={lesson} onConfirm={() => setShowLevelIntro(false)} />}
        {showBriefing && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div ref={legacyDialogRef} role="dialog" aria-modal="true" aria-labelledby="legacy-briefing-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-2xl">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-bold tracking-widest text-[var(--success)]">{lesson.level ? `Seviye ${lesson.level} · ` : ""}{chapterName}</div>
                    </div>
                    <h2 id="legacy-briefing-title" className="text-3xl font-black text-[var(--accent)] mb-6">{lesson.title}</h2>
                    <div className="text-[var(--text)] leading-7 text-[15px]">
                        {lesson.briefing}
                    </div>
                    <button
                        onClick={() => setShowBriefing(false)}
                        className="mt-8 w-full rounded-xl bg-[var(--accent)] px-6 py-4 text-center text-lg font-bold text-[#fffefa] transition-opacity hover:opacity-90"
                    >
                        Öğrendim, eğitime başla 🚀
                    </button>
                </div>
            </div>
        )}
        <header className="mb-4 flex items-center justify-between px-2"><Link href="/learn" className="font-black">Git<span className="text-[var(--accent)]">Atlas</span></Link><button onClick={reset} className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm font-bold">Dersi sıfırla</button></header><div className="grid gap-4 xl:grid-cols-[300px_minmax(560px,1fr)_400px]">
            <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><div className="text-xs font-bold tracking-widest text-[var(--success)]">{lesson.level ? `Seviye ${lesson.level} · ` : ""}{chapterName}</div><h1 className="mt-3 text-2xl font-black tracking-tight">{lesson.title}</h1>{lesson.concept && <p className="mt-2 text-xs font-bold text-[var(--accent)]">Yeni kavram · {lesson.concept}</p>}{chapter && <button onClick={() => setShowLevelIntro(true)} className="mt-4 w-full rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-left text-xs font-bold text-[var(--accent)] transition-colors hover:bg-[var(--surface-raised)]">Seviye açıklamasını tekrar aç</button>}{!chapter && lesson.briefing && lesson.briefing.length > 0 && <button onClick={() => setShowBriefing(true)} className="mt-4 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-1.5 text-left text-xs font-bold text-[var(--text-2)] transition-colors hover:text-[var(--accent)]">Ön bilgiyi tekrar oku</button>}<p className="mt-5 leading-7 text-[var(--text-2)] text-sm">{lesson.story}</p><div className="mt-6 rounded-xl bg-[var(--bg)] p-4"><div className="text-xs font-bold uppercase tracking-widest">Hedef</div><p className="mt-2 text-sm leading-6">{lesson.goalDescription}</p></div>{lesson.allowedCommands.length > 0 && <><h2 className="mt-6 font-bold text-sm">Kullanılabilir komutlar</h2><div className="mt-2 flex flex-wrap gap-2">{lesson.allowedCommands.map(cmd => <code key={cmd} className="rounded-md border border-[var(--border)] bg-[var(--surface-raised)] px-2 py-1 text-xs">{cmd}</code>)}</div></>}{lesson.hints.length > 0 && <><button onClick={() => setHintCount(c => Math.min(lesson.hints.length, c + 1))} className="mt-6 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-left text-sm font-bold">İpucu aç ({hintCount}/{lesson.hints.length})</button>{lesson.hints.slice(0, hintCount).map((hint, i) => <p key={hint} className="mt-2 rounded-lg bg-[var(--accent-soft)] p-3 text-sm"><b>{i + 1}.</b> {hint}</p>)}</>}{lesson.commonMistakes?.length ? <div className="mt-5 rounded-xl border border-[var(--warning)]/40 p-3"><p className="text-xs font-black uppercase text-[var(--warning)]">Sık hata</p><p className="mt-1 text-xs text-[var(--text-2)]">{lesson.commonMistakes[0]}</p></div> : null}</aside>
            <section className="flex min-w-0 flex-col gap-4"><CommitGraph state={displayedState} focus={conceptPreview?.focus} /><RepositoryPanel state={displayedState} onWorkingFileChange={conceptPreview ? undefined : editConflict} /></section>
            <section className="flex flex-col gap-4">{lesson.activity ? <ConceptActivity key={activityKey} activity={lesson.activity} initialState={lesson.initialRepositoryState} onPreviewChange={setConceptPreview} onComplete={finishConcept} /> : <Terminal entries={entries} onCommand={run} />}{complete && <div role="status" className="rounded-2xl border border-[var(--success)] bg-[var(--surface-raised)] p-5"><div className="text-xs font-bold uppercase tracking-widest text-[var(--success)]">Görev tamamlandı</div><h2 className="mt-2 text-2xl font-black">{successHeading}</h2>{lesson.reward && <p className="mt-2 font-black text-[var(--success)]">Rozet kazanıldı · {lesson.reward}</p>}<p className="mt-2 text-sm leading-6 text-[var(--text-2)]">{lesson.explanationAfterSuccess}</p><div className="mt-4 flex flex-wrap gap-2"><Link href="/learn" className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-bold">Haritaya dön</Link>{nextLesson && <Link href={`/learn/${encodeURIComponent(nextLesson.id)}`} className="rounded-lg bg-[var(--success)] px-4 py-2 text-sm font-bold text-[var(--bg)]">Sonraki seviye</Link>}</div></div>}</section>
        </div></main>
}
