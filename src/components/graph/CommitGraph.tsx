"use client";
import { useState } from "react";
import type { CommitNode, RepositoryState } from "@/domain/git/models";
import type { ConceptGraphFocus } from "@/domain/lessons/concept-previews";

interface GraphNode {
    readonly commit: CommitNode;
    readonly depth: number;
    readonly lane: number;
    readonly x: number;
    readonly y: number;
}

export function buildGraphLayout(state: RepositoryState): readonly GraphNode[] {
    const depths = new Map<string, number>();
    function depthOf(id: string): number {
        const cached = depths.get(id); if (cached !== undefined) return cached;
        const commit = state.commits[id]; if (!commit || commit.parents.length === 0) { depths.set(id, 0); return 0; }
        const depth = Math.max(...commit.parents.map(parent => depthOf(parent))) + 1; depths.set(id, depth); return depth;
    }

    const lanes = new Map<string, number>();
    const branchOrder = Object.values(state.branches).sort((a, b) => a.name === "main" ? -1 : b.name === "main" ? 1 : a.name.localeCompare(b.name));
    branchOrder.forEach((branch, lane) => {
        let cursor = branch.target;
        while (cursor) {
            if (lanes.has(cursor)) break;
            lanes.set(cursor, lane);
            cursor = state.commits[cursor]?.parents[0] ?? null;
        }
    });
    Object.keys(state.commits).forEach(id => { if (!lanes.has(id)) lanes.set(id, 0); });

    return Object.values(state.commits).map(commit => {
        const depth = depthOf(commit.id); const lane = lanes.get(commit.id) ?? 0;
        return { commit, depth, lane, x: 105 + depth * 180, y: 150 + lane * 130 };
    }).sort((a, b) => a.depth - b.depth || a.lane - b.lane);
}

interface GraphLabel {
    readonly name: string;
    readonly kind: "local" | "remote" | "detached";
    readonly active: boolean;
}

export function CommitGraph({ state, focus }: { readonly state: RepositoryState; readonly focus?: ConceptGraphFocus }) {
    const [selected, setSelected] = useState<CommitNode | undefined>();
    const nodes = buildGraphLayout(state); const byId = new Map(nodes.map(node => [node.commit.id, node]));
    const labels: Record<string, GraphLabel[]> = {};
    function addLabel(target: string | null, label: GraphLabel) {
        if (!target || !state.commits[target]) return;
        labels[target] = [...(labels[target] ?? []), label];
    }
    Object.values(state.branches).forEach(branch => addLabel(branch.target, { name: branch.name, kind: "local", active: state.head.kind === "branch" && state.head.name === branch.name }));
    Object.entries(state.remoteTracking ?? {}).forEach(([name, target]) => addLabel(target, { name, kind: "remote", active: false }));
    if (state.head.kind === "detached") addLabel(state.head.target, { name: "HEAD (detached)", kind: "detached", active: true });
    const maxDepth = Math.max(0, ...nodes.map(node => node.depth)); const maxLane = Math.max(0, ...nodes.map(node => node.lane));
    const width = Math.max(620, 240 + maxDepth * 180); const height = Math.max(285, 250 + maxLane * 130);

    const refsAt = (commitId: string) => (labels[commitId] ?? []).map(label => `${label.active && label.kind === "local" ? "HEAD → " : ""}${label.name}`).join(", ") || "referans yok";
    return <div className="min-h-[300px] min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-[var(--text-2)]">Depo görünümü</p><h2 className="text-xl font-black">Commit grafiği</h2></div><div className="sm:text-right"><span className="block text-xs font-bold">{nodes.length} commit · {Object.keys(state.branches).length} branch</span><span className="text-[10px] text-[var(--text-2)]">Her yatay hat ayrı bir branch çizgisidir</span></div></div>
        {focus && <div role="note" className="mt-4 grid gap-2 rounded-xl border border-[var(--accent)]/35 bg-[var(--accent-soft)] p-4 sm:grid-cols-[1fr_auto]"><div><p className="text-[10px] font-black tracking-widest text-[var(--accent)]">COMMIT GRAFİĞİNDE ŞİMDİ</p><p className="mt-1 font-black">{focus.title}</p><p className="mt-1 text-xs leading-5 text-[var(--text-2)]">{focus.detail}</p></div><div className="rounded-lg bg-[var(--surface)] px-3 py-2 text-xs font-bold leading-5 sm:max-w-64"><span className="text-[var(--success)]">Kontrol:</span> {focus.observation}</div></div>}
        {state.merge && <div role="status" className="mt-4 rounded-xl border border-[var(--warning)] bg-[var(--surface-raised)] p-3 text-sm"><b>Merge devam ediyor:</b> {state.merge.sourceName} → {state.merge.targetBranch}; ortak ata {state.merge.mergeBase ?? "yok"}, ours {state.merge.ours}, MERGE_HEAD {state.merge.theirs}. Henüz merge commit oluşmadı.</div>}
        <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-auto w-full min-w-0" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Commit grafiği. ${nodes.length} commit. HEAD ${state.head.kind === "branch" ? state.head.name : `${state.head.target} üzerinde ayrık`} .`}>
            {Array.from({ length: maxLane + 1 }, (_, lane) => <line key={`lane-${lane}`} x1="35" y1={150 + lane * 130} x2={width - 35} y2={150 + lane * 130} stroke="var(--border)" strokeWidth="1" strokeDasharray="5 8" />)}
            {nodes.flatMap(node => node.commit.parents.map(parentId => {
                const parent = byId.get(parentId); if (!parent) return null;
                const bend = Math.max(32, (node.x - parent.x) * .45); const changesLane = node.lane !== parent.lane;
                return <path key={`${node.commit.id}-${parentId}`} d={`M ${parent.x} ${parent.y} C ${parent.x + bend} ${parent.y}, ${node.x - bend} ${node.y}, ${node.x} ${node.y}`} fill="none" stroke={changesLane ? "var(--success)" : "var(--text-2)"} strokeWidth={changesLane ? 5 : 4} strokeOpacity={changesLane ? .9 : .55} />;
            }))}
            {nodes.length === 0 && <text x="50%" y="145" textAnchor="middle" fill="var(--text-2)" fontSize="14">Henüz commit yok. İlk commit grafikte bir düğüm oluşturacak.</text>}
            {nodes.map(node => { const highlighted = focus?.commitIds.includes(node.commit.id); return <g key={node.commit.id} role="button" tabIndex={0} aria-label={`${node.commit.id}, ${node.commit.message}, ${node.commit.shortHash}`} onClick={() => setSelected(node.commit)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") setSelected(node.commit); }}>
                <circle cx={node.x} cy={node.y} r={highlighted ? 29 : 25} fill="var(--surface-raised)" stroke={highlighted ? "var(--warning)" : node.lane === 0 ? "var(--accent)" : "var(--success)"} strokeWidth={highlighted ? 8 : 6} className="transition-all" />
                <text x={node.x} y={node.y + 5} textAnchor="middle" fill="var(--text)" fontSize="13" fontWeight="800">{node.commit.id}</text>
                <text x={node.x} y={node.y + 49} textAnchor="middle" fill="var(--text-2)" fontSize="11">{node.commit.message.slice(0, 22)}</text>
                {(labels[node.commit.id] ?? []).map((label, index) => { const fill = label.active ? label.kind === "detached" ? "var(--warning)" : "var(--success)" : label.kind === "remote" ? "var(--accent-soft)" : "var(--bg)"; const stroke = label.kind === "remote" ? "var(--accent)" : label.active ? fill : "var(--border)"; const textFill = label.active ? "var(--bg)" : label.kind === "remote" ? "var(--accent)" : "var(--text)"; return <g key={`${label.kind}-${label.name}`} transform={`translate(${node.x - 73},${node.y - 88 + index * 29})`}><rect width="146" height="24" rx="8" fill={fill} stroke={stroke} strokeDasharray={label.kind === "remote" ? "4 3" : undefined} /><text x="73" y="16" textAnchor="middle" fontSize="10" fontWeight="800" fill={textFill}>{label.active && label.kind === "local" ? "HEAD → " : ""}{label.name}</text></g>; })}
            </g>; })}
        </svg>
        <details className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3"><summary className="cursor-pointer text-sm font-black">Grafiğin metinsel eşdeğeri</summary><p className="mt-2 text-xs text-[var(--text-2)]">HEAD: {state.head.kind === "branch" ? `${state.head.name} branch'i → ${state.branches[state.head.name]?.target ?? "boş"}` : `${state.head.target} üzerinde detached`}. Her commit için parent ve yerel/remote-tracking referansları aşağıdadır.</p><ol className="mt-3 space-y-2">{nodes.slice().reverse().map(node => <li key={`text-${node.commit.id}`} className="rounded-lg border border-[var(--border)] p-2 text-xs"><b>{node.commit.id} · {node.commit.message}</b><span className="block text-[var(--text-2)]">Parent: {node.commit.parents.join(", ") || "yok"} · Referanslar: {refsAt(node.commit.id)}{node.commit.parents.length > 1 ? " · İki parent'lı merge commit" : ""}</span></li>)}</ol>{state.merge && <p className="mt-3 text-xs font-bold text-[var(--warning)]">Devam eden merge: {state.merge.sourceName} → {state.merge.targetBranch}; çözülmemiş dosya sayısı {Object.values(state.merge.conflicts).filter(conflict => !conflict.resolved).length}. Bu durum tamamlanmış commit değildir.</p>}</details>
        {selected && <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 text-sm"><b>{selected.id} · {selected.message}</b><p className="mt-1 text-xs text-[var(--text-2)]">hash {selected.shortHash} · parent {selected.parents.join(", ") || "yok"} · {Object.keys(selected.snapshot).join(", ") || "boş snapshot"}</p></div>}
    </div>;
}
