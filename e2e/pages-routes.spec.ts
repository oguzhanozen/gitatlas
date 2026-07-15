import { expect, test } from "@playwright/test";
import { lessonHref } from "../src/domain/lessons/lesson-url";

const basePath = "/gitatlas";
const pagesLessonUrl = (id: string) => `${basePath}${lessonHref(id)}/`;
async function dismissBriefing(page: import("@playwright/test").Page) {
  const button = page.getByRole("button", { name: /görevine başla/i });
  if (await button.isVisible()) await button.click();
}

test("ana sayfadan ilk ders açılır ve URL encoded slash içermez", async ({ page }) => {
  await page.goto(`${basePath}/`);
  await page.getByRole("link", { name: "Öğrenmeye başla!" }).click();
  await expect(page).toHaveURL(new RegExp(`${pagesLessonUrl("concepts/1-1-version-control")}$`));
  await expect(page.getByRole("heading", { name: "Versiyon Kontrolü Nedir?", level: 1 })).toBeVisible();
  expect(page.url()).not.toMatch(/%2f/i);
});

test("ders doğrudan açılır, yenilenir ve önceki/sonraki navigasyonu çalışır", async ({ page }) => {
  await page.goto(pagesLessonUrl("concepts/1-1-version-control"));
  await expect(page.getByRole("heading", { name: "Versiyon Kontrolü Nedir?", level: 1 })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Versiyon Kontrolü Nedir?", level: 1 })).toBeVisible();
  await dismissBriefing(page);
  await page.getByRole("link", { name: "Sonraki ders" }).click();
  await expect(page).toHaveURL(new RegExp(`${pagesLessonUrl("concepts/1-2-time-machine")}$`));
  await dismissBriefing(page);
  await page.getByRole("link", { name: "Önceki ders" }).click();
  await expect(page).toHaveURL(new RegExp(`${pagesLessonUrl("concepts/1-1-version-control")}$`));
  expect(page.url()).not.toMatch(/%2f/i);
});
