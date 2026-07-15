import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeLesson, loadProgress, setLastLesson } from "./progress";

const storageKey = "gitatlas:progress";

describe("progress persistence", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("v1 verisini v4'e migrate eder", () => {
    localStorage.setItem(storageKey, JSON.stringify({
      version: 1,
      completedLessons: ["local/2-1-init"],
      bestHints: { "local/2-1-init": 2 },
    }));

    expect(loadProgress()).toEqual({
      version: 4,
      completedLessons: ["local/2-1-init"],
      bestHints: { "local/2-1-init": 2 },
      lastLesson: null,
      results: [],
      lessonStats: {},
    });
  });

  it("v2 verisini v4'e migrate eder ve eski theme alanını atar", () => {
    localStorage.setItem(storageKey, JSON.stringify({
      version: 2,
      completedLessons: ["history/3-1-log"],
      bestHints: { "history/3-1-log": 1 },
      lastLesson: "history/3-1-log",
      results: [{ lessonId: "history/3-1-log", completedAt: "2026-07-14T08:00:00.000Z", hintCount: 1 }],
      theme: "dark",
    }));

    const progress = loadProgress();
    expect(progress).toEqual({
      version: 4,
      completedLessons: ["history/3-1-log"],
      bestHints: { "history/3-1-log": 1 },
      lastLesson: "history/3-1-log",
      results: [{ lessonId: "history/3-1-log", completedAt: "2026-07-14T08:00:00.000Z", hintCount: 1 }],
      lessonStats: {},
    });
    expect(progress).not.toHaveProperty("theme");
  });

  it("geçerli v3 verisini v4'e taşır", () => {
    const stored = {
      version: 3 as const,
      completedLessons: ["branching/4-2-create-switch"],
      bestHints: { "branching/4-2-create-switch": 0 },
      lastLesson: "branching/4-2-create-switch",
      results: [{ lessonId: "branching/4-2-create-switch", completedAt: "2026-07-14T09:00:00.000Z", hintCount: 0 }],
    };
    localStorage.setItem(storageKey, JSON.stringify(stored));

    expect(loadProgress()).toEqual({ ...stored, version: 4, lessonStats: {} });
  });

  it.each([2, 3] as const)("v%s sonuçlarını yüklerken tekilleştirir ve en yeni 100 kayıtla sınırlar", version => {
    const results = Array.from({ length: 101 }, (_, index) => ({
      lessonId: `lesson-${index}`,
      completedAt: `2026-07-14T10:${String(index % 60).padStart(2, "0")}:00.000Z`,
      hintCount: 0,
    }));
    results.push({ lessonId: "lesson-100", completedAt: "2026-07-14T12:00:00.000Z", hintCount: 9 });
    localStorage.setItem(storageKey, JSON.stringify({
      version,
      completedLessons: results.map(result => result.lessonId),
      bestHints: {},
      lastLesson: "lesson-100",
      results,
      ...(version === 2 ? { theme: "dark" } : {}),
    }));

    const progress = loadProgress();
    expect(progress.results).toHaveLength(100);
    expect(progress.results.filter(result => result.lessonId === "lesson-100")).toEqual([
      { lessonId: "lesson-100", completedAt: "2026-07-14T12:00:00.000Z", hintCount: 9 },
    ]);
    expect(progress.results.some(result => result.lessonId === "lesson-0")).toBe(false);
  });

  it.each([
    ["bozuk JSON", "{not-json"],
    ["şemaya uymayan veri", JSON.stringify({ version: 3, completedLessons: "yanlış" })],
  ])("%s için güvenli varsayılana döner", (_label, raw) => {
    localStorage.setItem(storageKey, raw);

    expect(loadProgress()).toEqual({
      version: 4,
      completedLessons: [],
      bestHints: {},
      lastLesson: null,
      results: [],
      lessonStats: {},
    });
  });

  it("storage write hatasını completeLesson dışına taşımaz ve false döner", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });

    expect(() => completeLesson("local/2-1-init", 1)).not.toThrow();
    expect(completeLesson("local/2-1-init", 1)).toBe(false);
  });

  it("storage write hatasını setLastLesson dışına taşımaz ve false döner", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });

    expect(() => setLastLesson("local/2-1-init")).not.toThrow();
    expect(setLastLesson("local/2-1-init")).toBe(false);
  });

  it("aynı ders sonucunu tekilleştirir ve en iyi ipucu sayısını korur", () => {
    expect(completeLesson("local/2-1-init", 2)).toBe(true);
    expect(completeLesson("local/2-1-init", 7)).toBe(true);

    const progress = loadProgress();
    expect(progress.completedLessons).toEqual(["local/2-1-init"]);
    expect(progress.bestHints["local/2-1-init"]).toBe(2);
    expect(progress.results).toHaveLength(1);
    expect(progress.results[0]).toMatchObject({ lessonId: "local/2-1-init", hintCount: 7 });
  });

  it("sonuç geçmişini en yeni 100 kayıtla sınırlar", () => {
    const results = Array.from({ length: 100 }, (_, index) => ({
      lessonId: `lesson-${index}`,
      completedAt: `2026-07-14T10:${String(index % 60).padStart(2, "0")}:00.000Z`,
      hintCount: index % 3,
    }));
    localStorage.setItem(storageKey, JSON.stringify({
      version: 3,
      completedLessons: results.map(result => result.lessonId),
      bestHints: Object.fromEntries(results.map(result => [result.lessonId, result.hintCount])),
      lastLesson: "lesson-99",
      results,
    }));

    expect(completeLesson("lesson-100", 0)).toBe(true);

    const progress = loadProgress();
    expect(progress.results).toHaveLength(100);
    expect(progress.results[0].lessonId).toBe("lesson-1");
    expect(progress.results.at(-1)?.lessonId).toBe("lesson-100");
    expect(progress.results.some(result => result.lessonId === "lesson-0")).toBe(false);
  });
});
