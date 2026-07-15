import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { lessons } from "@/content/lessons";
import { lessonHref } from "@/domain/lessons/lesson-url";
import Home from "./page";

describe("home", () => {
  it("ana CTA'yı ilk seviyeye ve yol butonunu öğrenme haritasına bağlar", () => {
    render(<Home />);
    expect(screen.getByRole("link", { name: "Öğrenmeye başla!" })).toHaveAttribute("href", lessonHref(lessons[0].id));
    expect(screen.getByRole("link", { name: "Öğrenme yolunu incele" })).toHaveAttribute("href", "/learn");
  });
});
