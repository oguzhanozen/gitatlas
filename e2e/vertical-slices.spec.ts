import { expect, test } from "@playwright/test";
const route = (id: string) => `/learn/${encodeURIComponent(id)}`;

async function dismissBriefing(page: import("@playwright/test").Page) {
    const btn = page.getByRole("button", { name: /Öğrendim/i });
    if (await btn.isVisible()) {
        await btn.click();
    }
}

async function command(page: import("@playwright/test").Page, value: string) {
    await dismissBriefing(page);
    const input = page.getByLabel("Git komutu");
    await input.fill(value);
    await input.press("Enter");
}

test("kullanıcı Workspace dersini tamamlar", async ({ page }) => {
    await page.goto(route("basics/01-workspace"));
    await command(page, "git status");
    await expect(page.getByRole("heading", { name: "Görev tamamlandı." })).toBeVisible()
});

test("kullanıcı Staging dersini tamamlar", async ({ page }) => {
    await page.goto(route("basics/02-staging"));
    await command(page, "git add merhaba.txt");
    await expect(page.getByText("Staged new")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Görev tamamlandı." })).toBeVisible()
});

test("kullanıcı Commit dersini tamamlar ve ilerleme yenilemede korunur", async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on("console", message => { if (message.type() === "error") runtimeErrors.push(message.text()); });
    page.on("pageerror", error => runtimeErrors.push(error.message));
    await page.goto(route("basics/03-commit"));
    await command(page, 'git commit -m "ilk commit"');
    await expect(page.getByRole("img", { name: /Commit grafiği\. 1 commit\./ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Görev tamamlandı." })).toBeVisible();

    await page.goto("/learn");
    await page.reload();
    const card = page.getByRole("heading", { name: /İlk Commit'ini Oluştur/ }).locator("..");
    await expect(card.getByText("Tamamlandı", { exact: true })).toBeVisible();
    expect(runtimeErrors).toEqual([]);
});

test("kullanıcı Diff dersini tamamlar", async ({ page }) => {
    await page.goto(route("basics/05-diff"));
    await command(page, "git diff");
    await expect(page.getByText("+ Bir satir daha eklendi!")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Görev tamamlandı." })).toBeVisible()
});

test("mobil viewport'ta terminal ve repository panelleri kullanılabilir", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route("basics/02-staging"));
    await dismissBriefing(page);
    await expect(page.getByLabel("Repository state")).toBeVisible();
    await expect(page.getByLabel("Git terminali")).toBeVisible();
    await command(page, "git add merhaba.txt");
    await expect(page.getByText("Staged new")).toBeVisible()
});
