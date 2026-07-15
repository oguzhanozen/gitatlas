import { expect, test } from "@playwright/test";
import { lessonHref } from "../src/domain/lessons/lesson-url";

async function openLesson(page: import("@playwright/test").Page, id: string, level: string) {
  await page.goto(lessonHref(id));
  await page.getByRole("button", { name: new RegExp(`Seviye ${level} görevine başla`) }).click();
}
async function command(page: import("@playwright/test").Page, text: string) {
  const terminal = page.getByRole("region", { name: "Git terminali" });
  await terminal.getByRole("textbox", { name: "Git komutu" }).fill(text);
  await terminal.getByRole("button", { name: "Çalıştır" }).click();
}

test("kullanıcı conflict'i edit → add → iki parent'lı commit ile çözer", async ({ page }) => {
  await openLesson(page, "merging/5-3-conflict", "5.3");
  await command(page, "git merge banana");
  await expect(page.getByRole("region", { name: "Git terminali" })).toContainText("CONFLICT");
  await command(page, "git status");
  await page.getByLabel("Birleştirilmiş çalışma kopyası").fill("# Pusula\nAna ve banana birlikte");
  await command(page, "git add README.md");
  await expect(page.getByText("ÇÖZÜLDÜ VE STAGE EDİLDİ")).toBeVisible();
  await command(page, 'git commit -m "conflict çözüldü"');
  await expect(page.getByText("Görev tamamlandı.")).toBeVisible();
  const textGraph=page.locator("details").filter({hasText:"Grafiğin metinsel eşdeğeri"});await textGraph.locator("summary").click();
  await expect(textGraph).toContainText("Parent: C1, C2");
});

test("merge --abort pre-merge görünüme döner", async ({ page }) => {
  await openLesson(page, "merging/5-3-conflict", "5.3");
  await command(page, "git merge banana");
  await expect(page.getByRole("region", { name: "Merge conflict çözümü" })).toBeVisible();
  await command(page, "git merge --abort");
  await expect(page.getByRole("region", { name: "Merge conflict çözümü" })).toHaveCount(0);
  await expect(page.getByText("Görev tamamlandı.")).toHaveCount(0);
});

test("fetch izleme ref'ini günceller, pull yerel main'i entegre eder", async ({ page }) => {
  await openLesson(page, "remotes/6-3-fetch-pull", "6.3");
  await command(page, "git fetch origin main");
  const textGraph=page.locator("details").filter({hasText:"Grafiğin metinsel eşdeğeri"});await textGraph.locator("summary").click();await expect(textGraph).toContainText("origin/main");
  await command(page, "git pull origin main");
  await expect(page.getByText("Görev tamamlandı.")).toBeVisible();
});

test("dialog klavyeyle kapanır ve odağı tetikleyene döndürür", async ({ page }) => {
  await openLesson(page, "branching/4-2-create-switch", "4.2");
  const trigger = page.getByRole("button", { name: "Seviye açıklamasını tekrar aç" });
  await trigger.focus(); await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("360px görünümde sayfa yatay taşmaz ve sandbox ilerleme yazmaz", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/sandbox");
  await page.evaluate(() => localStorage.removeItem("gitatlas:progress"));
  await command(page, "git status");
  const overflow=await page.evaluate(()=>[...document.querySelectorAll<HTMLElement>("body *")].filter(element=>{const rect=element.getBoundingClientRect();return rect.right>window.innerWidth+1||rect.left<-1}).map(element=>({tag:element.tagName,className:element.className?.toString().slice(0,120),right:Math.round(element.getBoundingClientRect().right),width:element.scrollWidth})).sort((a,b)=>b.right-a.right).slice(0,15));
  expect(overflow).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem("gitatlas:progress"))).toBeNull();
});

test("terminal girdisi HTML olarak yürütülmez", async ({ page }) => {
  await page.goto("/sandbox");
  await command(page, '<img src=x onerror="window.__xss=1">');
  expect(await page.evaluate(() => (window as Window & { __xss?: number }).__xss)).toBeUndefined();
  await expect(page.locator("img[src='x']")).toHaveCount(0);
});

test("ipucusuz assessment normal ders ilerlemesinden ayrı mastery üretir", async ({ page }) => {
  await page.goto("/assessments");
  const lab=page.locator("article").filter({has:page.getByRole("heading",{name:"Yeni bir değişikliği güvenle kaydet"})});
  const terminal=lab.getByRole("region",{name:"Git terminali"});
  await terminal.getByRole("textbox",{name:"Git komutu"}).fill("git status");await terminal.getByRole("button",{name:"Çalıştır"}).click();
  await terminal.getByRole("textbox",{name:"Git komutu"}).fill('git commit -m "assessment"');await terminal.getByRole("button",{name:"Çalıştır"}).click();
  await expect(lab.getByRole("status")).toContainText("Mastery kanıtlandı");
  await terminal.getByRole("textbox",{name:"Git komutu"}).fill("git status");await terminal.getByRole("button",{name:"Çalıştır"}).click();
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem("gitatlas:progress")??"{}"));
  expect(stored.completedLessons??[]).not.toContain("mastery/local");
  expect(stored.lessonStats["mastery/local"].hintlessSuccesses).toBe(1);
});
