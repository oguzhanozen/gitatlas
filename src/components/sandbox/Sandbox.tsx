"use client";
import { useMemo, useState } from "react";
import { CommitGraph } from "@/components/graph/CommitGraph";
import { RepositoryPanel } from "@/components/repository/RepositoryPanel";
import { Terminal, type TerminalEntry } from "@/components/terminal/Terminal";
import { executeCommand, updateWorkingFile } from "@/domain/git/engine";
import { parseCommand } from "@/domain/git/parser";
import { lessonById } from "@/content/lessons";

const presets = [
  ["basic", "Temel çalışma ağacı", "basics/02-staging"],
  ["branch", "Branch ve fast-forward", "merging/5-1-fast-forward"],
  ["remote", "Remote ahead", "remotes/6-3-fetch-pull"],
  ["conflict", "Ayrışmış conflict", "merging/5-3-conflict"],
] as const;

export function Sandbox() {
  const initialStates = useMemo(() => Object.fromEntries(presets.map(([key,,lessonId]) => [key, lessonById(lessonId)!.initialRepositoryState])), []);
  const [preset, setPreset] = useState<keyof typeof initialStates>("basic");
  const [state, setState] = useState(initialStates.basic);
  const [entries, setEntries] = useState<readonly TerminalEntry[]>([{ command: "", lines: ["Bağımsız pratik alanı: burada hiçbir ders tamamlanmaz ve ilerleme yazılmaz."], kind: "info" }]);
  const reset = (key = preset) => { setPreset(key); setState(initialStates[key]); setEntries([]); };
  const run = (text: string) => {
    if (text === "__clear__") { setEntries([]); return; }
    if (text === "undo") { setEntries(items => [...items, { command: text, lines: ["Sandbox'ta hızlı reset için 'Preset'i sıfırla düğmesini kullan."], kind: "info" }]); return; }
    const parsed = parseCommand(text);
    if (!parsed.ok) { setEntries(items => [...items, { command: text, lines: [parsed.message, ...(parsed.suggestion ? [`Öneri: ${parsed.suggestion}`] : [])], kind: "error" }]); return; }
    const outcome = executeCommand(state, parsed.command); setState(outcome.state);
    setEntries(items => [...items, { command: text, lines: outcome.error ? [outcome.error.message] : [...outcome.output, ...(outcome.teachingMessage ? [outcome.teachingMessage] : [])], kind: outcome.error ? "error" : "success" }]);
  };
  return <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_400px]"><section className="min-w-0 space-y-4"><div className="flex min-w-0 flex-wrap items-end gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"><label className="min-w-0 flex-1 text-sm font-bold">Başlangıç state&apos;i<select value={preset} onChange={event => reset(event.target.value as keyof typeof initialStates)} className="mt-1 block min-h-11 w-full min-w-0 max-w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3">{presets.map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label><button type="button" onClick={() => reset()} className="min-h-11 max-w-full rounded-lg border border-[var(--border)] px-4 font-bold">Preset&apos;i sıfırla</button></div><CommitGraph state={state}/><RepositoryPanel state={state} onWorkingFileChange={(path,content)=>setState(current=>updateWorkingFile(current,path,content))}/></section><Terminal entries={entries} onCommand={run}/></div>;
}
