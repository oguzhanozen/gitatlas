import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { lessons } from "@/content/lessons";
import Home from "./page";

describe("home", () => {
  it("ana CTA'yı ilk seviyeye ve yol butonunu öğrenme haritasına bağlar", () => {
    render(<Home />);
    expect(screen.getByRole("link", { name: "Öğrenmeye başla!" })).toHaveAttribute("href", `/learn/${encodeURIComponent(lessons[0].id)}`);
    expect(screen.getByRole("link", { name: "Öğrenme yolunu incele" })).toHaveAttribute("href", "/learn");
  });
});
