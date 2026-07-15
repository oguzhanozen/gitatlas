import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_IMPORT_BYTES,
  completeLesson,
  exportProgress,
  importProgress,
  loadProgress,
  recommendedLessons,
  recordAttempt,
  type Progress,
} from "./progress";

const storageKey = "gitatlas:progress";
const emptyProgress = (): Progress => ({ version: 4, completedLessons: [], bestHints: {}, lastLesson: null, results: [], lessonStats: {} });

describe("progress v4 güvenlik ve tekrar planı", () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-07-15T09:00:00.000Z")); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("v4 verisini kayıpsız yükler", () => {
    const value: Progress = { ...emptyProgress(), completedLessons: ["local/init"], bestHints: { "local/init": 0 }, lastLesson: "local/init", results: [{ lessonId: "local/init", completedAt: "2026-07-15T08:00:00.000Z", hintCount: 0 }], lessonStats: { "local/init": { attempts: 1, errors: 0, hints: 0, hintlessSuccesses: 1, recoverySuccesses: 0, lastAttempt: "2026-07-15T08:00:00.000Z", lastSuccess: "2026-07-15T08:00:00.000Z", intervalDays: 7, nextReviewAt: "2026-07-22T08:00:00.000Z" } } };
    localStorage.setItem(storageKey, JSON.stringify(value));
    expect(loadProgress()).toEqual(value);
  });

  it("localStorage okuma hatasında güvenli boş duruma döner", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("blocked"); });
    expect(loadProgress()).toEqual(emptyProgress());
  });

  it("attempt yazma/quota hatasını dışarı sızdırmaz", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("quota", "QuotaExceededError"); });
    expect(() => recordAttempt("lesson", { error: true, hints: 1 })).not.toThrow();
    expect(recordAttempt("lesson", { error: true })).toBe(false);
  });

  it("export/import roundtrip yapar ve yalnız v4 şema alanlarını taşır", () => {
    expect(completeLesson("branching/switch", 0)).toBe(true);
    const exported = exportProgress();
    localStorage.clear();
    const imported = importProgress(exported);
    expect(imported.ok).toBe(true);
    expect(loadProgress()).toEqual(imported.ok ? imported.progress : undefined);
    expect(exported).not.toMatch(/token|password|email/i);
  });

  it.each(["{not-json", JSON.stringify({ version: 4, completedLessons: "yanlış" })])("malformed içe aktarmayı reddeder: %s", text => {
    expect(importProgress(text)).toMatchObject({ ok: false });
    expect(loadProgress()).toEqual(emptyProgress());
  });

  it("1 MiB üstü içe aktarmayı parse etmeden reddeder", () => {
    const result = importProgress(" ".repeat(MAX_IMPORT_BYTES + 1));
    expect(result).toEqual({ ok: false, error: "Dosya 1 MiB içe aktarma sınırını aşıyor." });
  });

  it("doğrulanmış import yazılamazsa hata döner", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("quota", "QuotaExceededError"); });
    expect(importProgress(exportProgress(emptyProgress()))).toEqual({ ok: false, error: "Doğrulanan veri tarayıcıya yazılamadı." });
  });

  it("XSS benzeri ders kimliğini yalnız veri olarak tutar ve çalıştırmaz", () => {
    const payload = "</script><img src=x onerror=globalThis.__gitatlasXss=1>";
    const text = exportProgress({ ...emptyProgress(), completedLessons: [payload], lastLesson: payload });
    expect(importProgress(text).ok).toBe(true);
    expect(loadProgress().lastLesson).toBe(payload);
    expect((globalThis as typeof globalThis & { __gitatlasXss?: number }).__gitatlasXss).toBeUndefined();
  });

  it("legacy v3 importunu v4 üst sınırına normalize edip yeniden doğrular",()=>{const legacy={version:3,completedLessons:Array.from({length:501},(_,index)=>`lesson-${index}`),bestHints:{},lastLesson:null,results:[]};const imported=importProgress(JSON.stringify(legacy));expect(imported.ok).toBe(true);expect(loadProgress().completedLessons).toHaveLength(500);expect(()=>exportProgress(loadProgress())).not.toThrow()});

  it("hintless başarı aralığını 7 günden 14 güne çıkarır; ipuçlu ilk başarıyı 3 gün planlar", () => {
    completeLesson("hintless", 0);
    let progress = loadProgress();
    expect(progress.lessonStats.hintless.intervalDays).toBe(7);
    expect(progress.lessonStats.hintless.nextReviewAt).toBe("2026-07-22T09:00:00.000Z");
    vi.setSystemTime(new Date("2026-07-22T09:00:00.000Z"));
    completeLesson("hintless", 0);
    completeLesson("hinted", 2);
    progress = loadProgress();
    expect(progress.lessonStats.hintless.intervalDays).toBe(14);
    expect(progress.lessonStats.hintless.hintlessSuccesses).toBe(2);
    expect(progress.lessonStats.hinted.intervalDays).toBe(3);
  });

  it("hatalı denemeyi ertesi güne önerir ve zamanı gelmeyeni önermez", () => {
    recordAttempt("needs-review", { error: true });
    expect(recommendedLessons(loadProgress(), new Date("2026-07-15T12:00:00.000Z"))).toEqual([]);
    expect(recommendedLessons(loadProgress(), new Date("2026-07-16T09:00:00.000Z"))).toEqual(["needs-review"]);
  });
});
