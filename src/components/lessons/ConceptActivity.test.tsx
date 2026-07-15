import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createLessonRepository } from "@/domain/git/models";
import { ConceptActivity } from "./ConceptActivity";

describe("concept activities", () => {
    it("dosya kopyalarını doğru zaman sırasına dizer", () => {
        const complete = vi.fn(); render(<ConceptActivity activity="timeline" initialState={createLessonRepository()} onPreviewChange={() => undefined} onComplete={complete} />);
        ["odev_final.docx", "odev_final_SON.docx", "odev_final_SON_gercek.docx"].forEach(name => fireEvent.click(screen.getByText(name).closest("button")!));
        const button = screen.getByRole("button", { name: "Görevi tamamla" }); expect(button).toBeEnabled(); fireEvent.click(button); expect(complete).toHaveBeenCalledOnce();
    });

    it("zaman makinesinde tüm snapshot'ların ziyaret edilmesini ister", () => {
        render(<ConceptActivity activity="time-machine" initialState={createLessonRepository()} onPreviewChange={() => undefined} onComplete={() => undefined} />); const slider = screen.getByLabelText("Commit zaman çizgisi");
        fireEvent.change(slider, { target: { value: "0" } }); fireEvent.change(slider, { target: { value: "1" } });
        expect(screen.getByRole("button", { name: "Görevi tamamla" })).toBeEnabled();
    });

    it("dosyayı add ve commit ile üç alan arasında taşır", () => {
        render(<ConceptActivity activity="three-areas" initialState={createLessonRepository()} onPreviewChange={() => undefined} onComplete={() => undefined} />);
        fireEvent.click(screen.getByRole("button", { name: /git add/ })); expect(screen.getAllByText(/git add içeriği seçti; commit grafiği yine değişmez/).length).toBeGreaterThan(0);
        fireEvent.click(screen.getByRole("button", { name: /git commit/ })); expect(screen.getByRole("button", { name: "Görevi tamamla" })).toBeEnabled();
    });

    it("Seviye 4.1 akışında branch işaretçilerini grafik durumuna uygular", () => {
        const preview = vi.fn();
        render(<ConceptActivity activity="branch-metaphor" initialState={createLessonRepository()} onPreviewChange={preview} onComplete={() => undefined} />);

        fireEvent.click(screen.getByRole("button", { name: /Başlangıç noktasını oku/ }));
        fireEvent.click(screen.getByRole("button", { name: /feature branch oluştur/ }));

        const branchState = preview.mock.calls.at(-1)![0].state;
        expect(Object.keys(branchState.commits)).toEqual(["C0"]);
        expect(branchState.branches.main.target).toBe("C0");
        expect(branchState.branches.feature.target).toBe("C0");

        fireEvent.click(screen.getByRole("button", { name: /feature üzerinde commit oluştur/ }));
        const commitState = preview.mock.calls.at(-1)![0].state;
        expect(commitState.branches.main.target).toBe("C0");
        expect(commitState.branches.feature.target).toBe("C1");
        expect(commitState.head).toEqual({ kind: "branch", name: "feature" });
        expect(screen.getByRole("button", { name: "Görevi tamamla" })).toBeEnabled();
    });
});
