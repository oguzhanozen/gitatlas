"use client";
import { useState } from "react";
import { CommitGraph } from "@/components/graph/CommitGraph";
import { RepositoryPanel } from "@/components/repository/RepositoryPanel";
import { Terminal, type TerminalEntry } from "@/components/terminal/Terminal";
import { executeCommand, updateWorkingFile } from "@/domain/git/engine";
import { parseCommand } from "@/domain/git/parser";
import type { RepositoryState } from "@/domain/git/models";
import { commandFamily, emptySession, evaluateConditions, type LessonSession } from "@/domain/lessons/models";
import type { AssessmentDefinition } from "@/content/assessments";
import { recordMastery } from "@/persistence/progress";

export function createReviewVariant(source: RepositoryState, variant: number): RepositoryState {
  const path = ".gitatlas-scenario.txt"; const content = `Yeni değerlendirme bağlamı ${variant}`;
  const commits = Object.fromEntries(Object.entries(source.commits).map(([id, commit]) => [id, { ...commit, snapshot: { ...commit.snapshot, [path]: content } }]));
  const remotes = Object.fromEntries(Object.entries(source.remotes).map(([name, remote]) => [name, { ...remote, commits: remote.commits ? Object.fromEntries(Object.entries(remote.commits).map(([id, commit]) => [id, { ...commit, snapshot: { ...commit.snapshot, [path]: content } }])) : undefined }]));
  return { ...source, commits, remotes, workingTree: { ...source.workingTree, [path]: content } };
}

const intro: readonly TerminalEntry[] = [{ command: "", lines: ["Bu değerlendirme ipucusuzdur. Önce state'i ve hedefi oku; yanlış deneme çözümü göstermez."], kind: "info" }];

export function AssessmentLab({ assessment }: { readonly assessment: AssessmentDefinition }) {
  const [variant, setVariant] = useState(1);
  const [initialState, setInitialState] = useState(() => createReviewVariant(assessment.initialRepositoryState, 1));
  const [state, setState] = useState(initialState);
  const [session, setSession] = useState<LessonSession>(emptySession());
  const [entries, setEntries] = useState<readonly TerminalEntry[]>(intro);
  const [complete, setComplete] = useState(false);
  const [saved, setSaved] = useState(true);

  function reset() {
    const nextVariant = variant + 1; const nextInitial = createReviewVariant(assessment.initialRepositoryState, nextVariant);
    setVariant(nextVariant); setInitialState(nextInitial); setState(nextInitial); setSession(emptySession()); setEntries(intro); setComplete(false); setSaved(true);
  }

  function run(text: string) {
    if (text === "__clear__") { setEntries([]); return; }
    const parsed = parseCommand(text);
    if (!parsed.ok) {
      setSession(current => ({ ...current, errorCount: (current.errorCount ?? 0) + 1, events: [...(current.events ?? []), { input: text, ok: false, at: new Date().toISOString() }] }));
      setEntries(items => [...items, { command: text, lines: [parsed.message], kind: "error" }]); return;
    }
    const outcome = executeCommand(state, parsed.command);
    const mode = parsed.command.kind === "diff" ? parsed.command.mode : parsed.command.kind === "restore" ? (parsed.command.staged ? "staged" : undefined) : undefined;
    const family = commandFamily(parsed.command.kind, mode); const failed = Boolean(outcome.error);
    const nextSession: LessonSession = { executedCommands: family && !failed ? [...session.executedCommands, family] : session.executedCommands, errorCount: (session.errorCount ?? 0) + (failed ? 1 : 0), hintCount: 0, events: [...(session.events ?? []), { family, input: text, ok: !failed, at: new Date().toISOString() }] };
    setSession(nextSession); setState(outcome.state);
    setEntries(items => [...items, { command: text, lines: failed ? [outcome.error!.message] : outcome.output, kind: failed ? "error" : "success" }]);
    if (!complete && !failed && evaluateConditions(outcome.state, assessment.successConditions, nextSession, initialState)) {
      setComplete(true); setSaved(recordMastery(assessment.id, { errors: nextSession.errorCount ?? 0, recovered: (nextSession.errorCount ?? 0) > 0 }));
    }
  }

  return <article className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-6"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-[var(--success)]">{assessment.chapter} · ipucusuz mastery · varyant {variant}</p><h2 className="mt-2 text-2xl font-black">{assessment.title}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-2)]">{assessment.story}</p><p className="mt-3 font-bold">Hedef: {assessment.goal}</p></div><button onClick={reset} className="min-h-11 rounded-lg border border-[var(--border)] px-4 font-bold">Yeni state ile tekrarla</button></div><div className="mt-5 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_400px]"><section className="min-w-0 space-y-4"><CommitGraph state={state}/><RepositoryPanel state={state} onWorkingFileChange={(path,content)=>setState(current=>updateWorkingFile(current,path,content))}/></section><Terminal entries={entries} onCommand={run}/></div>{complete&&<p role="status" className="mt-4 rounded-xl border border-[var(--success)] p-4 font-bold">Mastery kanıtlandı: state ve gerekli davranış sırası birlikte doğrulandı.{!saved&&" Sonuç tarayıcıya yazılamadı."}</p>}</article>;
}
