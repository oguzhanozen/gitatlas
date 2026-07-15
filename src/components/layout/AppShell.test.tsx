import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

describe("AppShell theme persistence", () => {
    beforeEach(() => {
        Object.defineProperty(window, "matchMedia", {
            configurable: true,
            value: vi.fn().mockReturnValue({
                matches: false,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            }),
        });
    });

    afterEach(() => vi.restoreAllMocks());

    it("storage erişimi engellendiğinde temayı bellek içinde değiştirmeye devam eder", () => {
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("blocked"); });
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("blocked"); });

        render(<AppShell><p>İçerik</p></AppShell>);
        const toggle = screen.getByRole("button", { name: "Koyu temaya geç" });

        expect(() => fireEvent.click(toggle)).not.toThrow();
        expect(screen.getByRole("button", { name: "Açık temaya geç" })).toBeVisible();
    });

    it("başka sekmedeki tema değişikliğini storage event ile uygular", () => {
        const values = new Map<string, string>();
        values.set("gitatlas:theme", "light");
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(key => values.get(key) ?? null);
        vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, value) => { values.set(key, value); });
        render(<AppShell><p>İçerik</p></AppShell>);
        expect(screen.getByRole("button", { name: "Koyu temaya geç" })).toBeVisible();

        values.set("gitatlas:theme", "dark");
        fireEvent(window, new StorageEvent("storage", { key: "gitatlas:theme", newValue: "dark" }));

        expect(screen.getByRole("button", { name: "Açık temaya geç" })).toBeVisible();
    });
});
