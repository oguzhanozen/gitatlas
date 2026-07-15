import { effectiveIndexSnapshot, headSnapshot, type MergeConflict, type RepositoryState } from "@/domain/git/models";
import { stagedChanges, workingChanges } from "@/domain/git/files";

const labels: Record<string, string> = { untracked: "UNTRACKED", modified: "MODIFIED", deleted: "DELETED", tracked: "TRACKED", committed: "COMMITTED", "staged-new": "STAGED NEW", "staged-modified": "STAGED MODIFIED", "staged-deleted": "STAGED DELETION" };
const preview = (content: string | null) => content === null ? "Dosya silindi" : content.replace(/\n/g, " ↵ ").slice(0, 72);
function FileRow({ path, status, content }: { readonly path: string; readonly status: string; readonly content: string | null }) { return <li className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-2.5"><div className="flex items-center justify-between gap-2"><code className="text-xs font-bold">{path}</code><span className="rounded bg-[var(--bg)] border border-[var(--border)] px-2 py-0.5 text-[10px] font-bold">{labels[status] ?? status}</span></div><p className="mt-1 truncate text-xs text-[var(--text-2)]">{preview(content)}</p></li> }
function ConflictVersion({ label, content }: { readonly label: string; readonly content: string | null }) {
    return <div><p className="mb-1 text-[10px] font-black uppercase tracking-wider text-[var(--text-2)]">{label}</p><pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2 text-xs">{content ?? "(dosya yok)"}</pre></div>;
}

function ConflictEditor({ conflict, content, onChange }: { readonly conflict: MergeConflict; readonly content: string; readonly onChange?: (path: string, content: string) => void }) {
    return <li className="rounded-xl border border-[var(--warning)] bg-[var(--surface-raised)] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><code className="text-sm font-black">{conflict.path}</code><span className="rounded-full border border-[var(--border)] px-2 py-1 text-[10px] font-black">{conflict.resolved ? "ÇÖZÜLDÜ VE STAGE EDİLDİ" : "ÇÖZÜM BEKLİYOR"}</span></div>
        <div className="mt-3 grid gap-2 md:grid-cols-3"><ConflictVersion label="Base · ortak ata" content={conflict.base} /><ConflictVersion label="Ours · mevcut branch" content={conflict.ours} /><ConflictVersion label="Theirs · birleştirilen branch" content={conflict.theirs} /></div>
        <label className="mt-3 block text-xs font-black" htmlFor={`conflict-${conflict.path}`}>Birleştirilmiş çalışma kopyası</label>
        <textarea id={`conflict-${conflict.path}`} value={content} onChange={event => onChange?.(conflict.path, event.target.value)} readOnly={!onChange} rows={8} spellCheck={false} className="mt-1 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 font-mono text-xs leading-5 outline-none focus:border-[var(--accent)]" />
        <p className="mt-2 text-xs leading-5 text-[var(--text-2)]">Marker satırlarını kaldır, kalmasını istediğin içeriği yaz ve terminalde <code>git add {conflict.path}</code> çalıştır. Stage etmek dosyayı çözülmüş olarak işaretler.</p>
    </li>;
}

export function RepositoryPanel({ state, onWorkingFileChange }: { readonly state: RepositoryState; readonly onWorkingFileChange?: (path: string, content: string) => void }) {
    const working = workingChanges(state), staged = stagedChanges(state), head = headSnapshot(state), index = effectiveIndexSnapshot(state);
    const changesByPath = new Map(working.map(change => [change.path, change]));
    const workingFiles = Object.entries(state.workingTree).sort().map(([path, content]) => ({ path, content, status: changesByPath.get(path)?.status ?? "tracked" }));
    const deletedFiles = working.filter(change => change.status === "deleted").map(change => ({ path: change.path, content: null, status: change.status }));
    const rows = [...workingFiles, ...deletedFiles];
    return <div className="space-y-3">
      {state.merge && <section aria-label="Merge conflict çözümü" className="rounded-xl border border-[var(--warning)] bg-[var(--surface)] p-3"><h3 className="font-black">Merge devam ediyor</h3><p className="mt-1 text-xs leading-5 text-[var(--text-2)]"><code>{state.merge.sourceName}</code>, <code>{state.merge.targetBranch}</code> içine birleştiriliyor. MERGE_HEAD eşdeğeri: <code>{state.merge.theirs}</code>.</p><ul className="mt-3 space-y-3">{Object.values(state.merge.conflicts).map(conflict => <ConflictEditor key={conflict.path} conflict={conflict} content={state.workingTree[conflict.path] ?? ""} onChange={onWorkingFileChange} />)}</ul></section>}
      <section aria-label="Repository state" className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"><h3 className="text-xs font-black tracking-wider">WORKING DIRECTORY</h3><p className="mt-1 text-xs text-[var(--text-2)]">{rows.length} dosya · {working.length ? `${working.length} değişiklik` : "değişiklik yok"}</p><ul className="mt-3 space-y-2">{rows.map(file => <FileRow key={file.path} path={file.path} status={file.status} content={file.content} />)}</ul></div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"><h3 className="text-xs font-black tracking-wider">STAGING AREA</h3><p className="mt-1 text-xs text-[var(--text-2)]">{staged.length ? `${staged.length} hazırlanmış değişiklik` : "✓ INDEX temiz"}</p><ul className="mt-3 space-y-2">{staged.map(c => <FileRow key={c.path} path={c.path} status={c.status} content={index[c.path] ?? null} />)}</ul></div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"><h3 className="text-xs font-black tracking-wider">HEAD SNAPSHOT</h3><p className="mt-1 text-xs text-[var(--text-2)]">{Object.keys(head).length} kayıtlı dosya</p><ul className="mt-3 space-y-2">{Object.entries(head).sort().map(([path, content]) => <FileRow key={path} path={path} status="committed" content={content} />)}</ul></div>
      </section>
    </div>
}
