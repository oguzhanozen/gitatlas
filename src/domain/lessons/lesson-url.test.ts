import { describe, expect, it } from "vitest";
import { lessons } from "@/content/lessons";
import { lessonHref, lessonIdToSlug, lessonSlugToId } from "./lesson-url";

describe("lesson URL dönüşümü", () => {
  it("29 canonical ders kimliğini benzersiz, tek segmentli slug'lara dönüştürür", () => {
    const slugs = lessons.map(lesson => lessonIdToSlug(lesson.id));

    expect(lessons).toHaveLength(29);
    expect(new Set(slugs).size).toBe(lessons.length);
    for (const [index, slug] of slugs.entries()) {
      expect(slug).not.toMatch(/[/\\%]/);
      expect(lessonSlugToId(slug)).toBe(lessons[index].id);
      expect(lessonHref(lessons[index].id)).toBe(`/learn/${slug}`);
    }
  });

  it("bozuk veya çok segmentli URL parametrelerini reddeder", () => {
    expect(lessonSlugToId("concepts%2F1-1-version-control")).toBeNull();
    expect(lessonSlugToId("concepts/1-1-version-control")).toBeNull();
    expect(lessonSlugToId("unknown")).toBeNull();
  });
});
