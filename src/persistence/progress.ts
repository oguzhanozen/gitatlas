import { z } from "zod";

const STORAGE_KEY = "gitatlas:progress";
export const MAX_IMPORT_BYTES = 1024 * 1024;
const MAX_RESULTS = 100;

const resultSchema = z.object({ lessonId: z.string().max(200), completedAt: z.string(), hintCount: z.number().int().nonnegative() }).strict();
const lessonStatsSchema = z.object({
  attempts: z.number().int().nonnegative(),
  errors: z.number().int().nonnegative(),
  hints: z.number().int().nonnegative(),
  hintlessSuccesses: z.number().int().nonnegative(),
  recoverySuccesses: z.number().int().nonnegative(),
  lastAttempt: z.string().nullable(),
  lastSuccess: z.string().nullable(),
  intervalDays: z.number().int().min(1).max(30),
  nextReviewAt: z.string().nullable(),
}).strict();

const v1Schema = z.object({ version: z.literal(1), completedLessons: z.array(z.string()), bestHints: z.record(z.string(), z.number().int().nonnegative()) });
const v2Schema = z.object({ version: z.literal(2), completedLessons: z.array(z.string()), bestHints: z.record(z.string(), z.number().int().nonnegative()), lastLesson: z.string().nullable(), results: z.array(resultSchema), theme: z.enum(["light", "dark", "system"]) });
const v3Schema = z.object({ version: z.literal(3), completedLessons: z.array(z.string()), bestHints: z.record(z.string(), z.number().int().nonnegative()), lastLesson: z.string().nullable(), results: z.array(resultSchema) });
const v4Schema = z.object({
  version: z.literal(4),
  completedLessons: z.array(z.string().max(200)).max(500),
  bestHints: z.record(z.string(), z.number().int().nonnegative()),
  lastLesson: z.string().max(200).nullable(),
  results: z.array(resultSchema).max(MAX_RESULTS),
  lessonStats: z.record(z.string(), lessonStatsSchema),
}).strict();

export type LessonStats = z.infer<typeof lessonStatsSchema>;
export type Progress = z.infer<typeof v4Schema>;
export type ImportResult = { readonly ok: true; readonly progress: Progress } | { readonly ok: false; readonly error: string };

const initial: Progress = { version: 4, completedLessons: [], bestHints: {}, lastLesson: null, results: [], lessonStats: {} };
const emptyStats = (): LessonStats => ({ attempts: 0, errors: 0, hints: 0, hintlessSuccesses: 0, recoverySuccesses: 0, lastAttempt: null, lastSuccess: null, intervalDays: 1, nextReviewAt: null });
const normalizeResults = (results: Progress["results"]): Progress["results"] => {
  const seen = new Set<string>();
  return [...results].reverse().filter(result => !seen.has(result.lessonId) && Boolean(seen.add(result.lessonId))).slice(0, MAX_RESULTS).reverse();
};
const normalizeProgress = (progress: Progress): Progress => ({ ...progress, completedLessons: [...new Set(progress.completedLessons)].slice(0, 500), results: normalizeResults(progress.results) });

function migrate(raw: unknown): Progress | null {
  const v4 = v4Schema.safeParse(raw); if (v4.success) return normalizeProgress(v4.data);
  const v3 = v3Schema.safeParse(raw); if (v3.success) { const migrated=normalizeProgress({ ...v3.data, version: 4, lessonStats: {} });return v4Schema.safeParse(migrated).data??null; }
  const v2 = v2Schema.safeParse(raw); if (v2.success) { const { theme: _, ...progress } = v2.data; void _; const migrated=normalizeProgress({ ...progress, version: 4, lessonStats: {} });return v4Schema.safeParse(migrated).data??null; }
  const v1 = v1Schema.safeParse(raw); if (v1.success) { const migrated=normalizeProgress({ ...initial, completedLessons: v1.data.completedLessons, bestHints: v1.data.bestHints });return v4Schema.safeParse(migrated).data??null; }
  return null;
}

export function loadProgress(): Progress {
  if (typeof window === "undefined") return initial;
  try { return migrate(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")) ?? initial; } catch { return initial; }
}

const save = (value: Progress): boolean => {
  if (typeof window === "undefined") return false;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeProgress(value))); window.dispatchEvent(new Event("gitatlas:progress")); return true; } catch { return false; }
};

const isoAfterDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000).toISOString();

export function setLastLesson(id: string): boolean { return save({ ...loadProgress(), lastLesson: id }); }

export function recordAttempt(id: string, options: { readonly error?: boolean; readonly hints?: number } = {}): boolean {
  const value = loadProgress(); const now = new Date().toISOString(); const previous = value.lessonStats[id] ?? emptyStats();
  const stats: LessonStats = { ...previous, attempts: previous.attempts + 1, errors: previous.errors + (options.error ? 1 : 0), hints: previous.hints + (options.hints ?? 0), lastAttempt: now, nextReviewAt: options.error ? isoAfterDays(new Date(now), 1) : previous.nextReviewAt };
  return save({ ...value, lessonStats: { ...value.lessonStats, [id]: stats } });
}

export function completeLesson(id: string, hints: number, recovered = false): boolean {
  const value = loadProgress(); const now = new Date(); const previous = value.lessonStats[id] ?? emptyStats();
  const hintless = hints === 0; const intervalDays = previous.lastSuccess ? Math.min(30, Math.max(hintless ? 7 : 3, previous.intervalDays * 2)) : hintless ? 7 : 3;
  const stats: LessonStats = { ...previous, attempts: Math.max(1, previous.attempts), hints: Math.max(previous.hints, hints), hintlessSuccesses: previous.hintlessSuccesses + (hintless ? 1 : 0), recoverySuccesses: previous.recoverySuccesses + (recovered ? 1 : 0), lastAttempt: now.toISOString(), lastSuccess: now.toISOString(), intervalDays, nextReviewAt: isoAfterDays(now, intervalDays) };
  const best = Math.min(value.bestHints[id] ?? Number.MAX_SAFE_INTEGER, hints);
  const results = normalizeResults([...value.results, { lessonId: id, completedAt: now.toISOString(), hintCount: hints }]);
  return save({ ...value, completedLessons: [...new Set([...value.completedLessons, id])], bestHints: { ...value.bestHints, [id]: best }, lastLesson: id, results, lessonStats: { ...value.lessonStats, [id]: stats } });
}

/** Mastery/assessment kaydı normal ders tamamlama ve rozet ilerlemesinden bilinçli olarak ayrıdır. */
export function recordMastery(id: string, options: { readonly errors: number; readonly recovered: boolean }): boolean {
  const value = loadProgress(); const now = new Date(); const previous = value.lessonStats[id] ?? emptyStats(); const intervalDays = options.errors === 0 ? Math.min(30, previous.lastSuccess ? previous.intervalDays * 2 : 7) : 1;
  const stats: LessonStats = { ...previous, attempts: previous.attempts + 1, errors: previous.errors + options.errors, hintlessSuccesses: previous.hintlessSuccesses + (options.errors === 0 ? 1 : 0), recoverySuccesses: previous.recoverySuccesses + (options.recovered ? 1 : 0), lastAttempt: now.toISOString(), lastSuccess: now.toISOString(), intervalDays, nextReviewAt: isoAfterDays(now, intervalDays) };
  return save({ ...value, lessonStats: { ...value.lessonStats, [id]: stats } });
}

export function recommendedLessons(progress: Progress = loadProgress(), now = new Date()): readonly string[] {
  return Object.entries(progress.lessonStats).filter(([, stats]) => stats.nextReviewAt && new Date(stats.nextReviewAt) <= now).sort((a, b) => (a[1].nextReviewAt ?? "").localeCompare(b[1].nextReviewAt ?? "")).map(([id]) => id);
}

/** Export yalnız whitelist edilmiş eğitim ilerlemesini içerir; terminal/dosya/kimlik bilgisi şemada yoktur. */
export function exportProgress(progress: Progress = loadProgress()): string { return JSON.stringify(v4Schema.parse(progress), null, 2); }

export function importProgress(text: string): ImportResult {
  if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) return { ok: false, error: "Dosya 1 MiB içe aktarma sınırını aşıyor." };
  try {
    const progress = migrate(JSON.parse(text));
    if (!progress) return { ok: false, error: "Dosya geçerli bir GitAtlas ilerleme şeması değil." };
    if (!save(progress)) return { ok: false, error: "Doğrulanan veri tarayıcıya yazılamadı." };
    return { ok: true, progress };
  } catch { return { ok: false, error: "Dosya geçerli JSON değil." }; }
}

export function resetProgress(confirmed: boolean): boolean {
  if (!confirmed || typeof window === "undefined") return false;
  return save(initial);
}
