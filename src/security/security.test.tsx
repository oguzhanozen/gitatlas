import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RepositoryPanel } from "@/components/repository/RepositoryPanel";
import { Terminal } from "@/components/terminal/Terminal";
import { executeCommand } from "@/domain/git/engine";
import { createLessonRepository } from "@/domain/git/models";
import { parseCommand } from "@/domain/git/parser";
import { exportProgress, importProgress, type Progress } from "@/persistence/progress";

function runtimeSources(directory = path.join(process.cwd(), "src")): readonly string[] {
  return readdirSync(directory).flatMap(name => {
    const file = path.join(directory, name);
    if (statSync(file).isDirectory()) return name === "security" || name === "tests" ? [] : runtimeSources(file);
    return /\.(ts|tsx)$/.test(name) && !name.includes(".test.") ? [file] : [];
  });
}

const emptyProgress = (): Progress => ({ version: 4, completedLessons: [], bestHints: {}, lastLesson: null, results: [], lessonStats: {} });

describe("statik istemci güvenlik sınırları", () => {
  afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

  it("runtime kaynaklarında HTML/script yürütme ve doğrudan ağ/telemetri API'si bulunmaz", () => {
    const source = runtimeSources().map(file => readFileSync(file, "utf8")).join("\n");
    expect(source).not.toMatch(/dangerouslySetInnerHTML|\.innerHTML\s*=|\beval\s*\(|new\s+Function\s*\(|createElement\s*\(\s*["']script|<script\b/i);
    expect(source).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|new\s+WebSocket|next\/script|google-analytics|googletagmanager|segment\.com/i);
  });

  it("terminal ve dosya girdilerini HTML yerine metin olarak render eder", () => {
    const payload = '<img src=x onerror="globalThis.__xss=1">';
    const state = { ...createLessonRepository(), workingTree: { [payload]: payload } };
    const { unmount } = render(<Terminal entries={[{ command: payload, lines: [payload], kind: "error" }]} onCommand={() => undefined} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect((screen.getByLabelText("Git terminali").textContent?.split(payload).length ?? 1) - 1).toBe(2);
    unmount();
    render(<RepositoryPanel state={state} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getAllByText(payload).length).toBeGreaterThanOrEqual(1);
    expect((globalThis as typeof globalThis & { __xss?: number }).__xss).toBeUndefined();
  });

  it("kullanıcı remote URL'sini yalnız simülasyon verisi olarak saklar; ağ veya script çalıştırmaz", () => {
    const network = vi.fn(); vi.stubGlobal("fetch", network);
    const parsed = parseCommand("git remote add origin javascript:alert(1)");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = executeCommand(createLessonRepository(), parsed.command);
    expect(result.state.remotes.origin.url).toBe("javascript:alert(1)");
    expect(network).not.toHaveBeenCalled();
  });

  it("export şeması hassas/unknown alanları kabul etmez; import da strict v4 dışını reddeder", () => {
    const unsafe = { ...emptyProgress(), token: "secret", email: "user@example.com" };
    expect(() => exportProgress(unsafe as Progress)).toThrow();
    expect(importProgress(JSON.stringify(unsafe))).toMatchObject({ ok: false });
    expect(localStorage.getItem("gitatlas:progress")).toBeNull();
  });
});
