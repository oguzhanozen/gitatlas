"use client";
import { useEffect, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

const themeEvent = "gitatlas:theme";
type Theme = "light" | "dark";
let volatileTheme: Theme | null = null;

const systemTheme = (): Theme => window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
const readTheme = (): Theme => {
    try {
        const saved = localStorage.getItem("gitatlas:theme");
        if (saved === "light" || saved === "dark") volatileTheme = saved;
    } catch { /* Use the in-memory or system preference fallback. */ }
    return volatileTheme ?? systemTheme();
};
const writeTheme = (theme: Theme) => {
    volatileTheme = theme;
    try { localStorage.setItem("gitatlas:theme", theme); } catch { /* The in-memory theme remains usable. */ }
    window.dispatchEvent(new Event(themeEvent));
};
const subscribe = (listener: () => void) => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onStorage = (event: StorageEvent) => { if (event.key === "gitatlas:theme" || event.key === null) { volatileTheme = null; listener(); } };
    window.addEventListener(themeEvent, listener); window.addEventListener("storage", onStorage); media.addEventListener("change", listener);
    return () => { window.removeEventListener(themeEvent, listener); window.removeEventListener("storage", onStorage); media.removeEventListener("change", listener); };
};
const themeSnapshot = (): Theme => readTheme();
const serverTheme = (): "light" => "light";

export function AppShell({ children }: { readonly children: ReactNode }) {
    const theme = useSyncExternalStore(subscribe, themeSnapshot, serverTheme);

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
    }, [theme]);

    const toggle = () => writeTheme(theme === "light" ? "dark" : "light");

    return (
        <div id="main-content" data-theme={theme}>
            {children}
            <button
                onClick={toggle}
                aria-label={theme === "dark" ? "Açık temaya geç" : "Koyu temaya geç"}
                title={theme === "dark" ? "Açık tema" : "Koyu tema"}
                className="fixed bottom-5 right-5 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-raised)] text-lg shadow-lg transition-transform hover:scale-110 active:scale-95"
            >
                {theme === "dark" ? "☀️" : "🌙"}
            </button>
        </div>
    );
}
