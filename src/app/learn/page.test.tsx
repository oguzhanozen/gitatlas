import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LearnPage from "./page";

describe("learn progress storage", () => {
    afterEach(() => vi.restoreAllMocks());

    it("storage erişimi engellendiğinde güvenli boş ilerleme gösterir", () => {
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("blocked"); });

        expect(() => render(<LearnPage />)).not.toThrow();
        expect(screen.getByText("%0")).toBeVisible();
    });
});
