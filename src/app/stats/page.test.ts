import { describe, expect, it } from "vitest";
import { lessonHref } from "@/domain/lessons/lesson-url";
import { reviewHref } from "./page";

describe("review links", () => {
  it("ders, assessment ve bilinmeyen kayıtları güvenli hedeflere ayırır", () => {
    expect(reviewHref("concepts/1-1-version-control")).toBe(lessonHref("concepts/1-1-version-control"));
    expect(reviewHref("mastery/local")).toBe("/assessments");
    expect(reviewHref("imported-invalid-id")).toBeNull();
  });
});
