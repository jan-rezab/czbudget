import { test, expect } from '@playwright/test';

test('budget overview stays simple and reveals detail only on click', async ({ page }) => {
  await page.goto('/money-flow.html?lang=en');
  await expect(page.locator('[data-node]')).toHaveCount(12);
  await expect(page.locator('.flow-detail')).toBeHidden();
  await expect(page.locator('[data-unit="hundred"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-node="out:education"]').click();
  await expect(page.locator('[data-node]')).toHaveCount(9);
  await expect(page.locator('.flow-detail')).toBeVisible();
  await expect(page.locator('#flow-lesson')).toBeHidden();
  await page.locator('#flow-breadcrumb [data-path=""]').click();
  await expect(page.locator('[data-node]')).toHaveCount(12);
});

test('guided explanation shows the gap, financing and a working quiz', async ({ page }) => {
  await page.goto('/money-flow.html?lang=en');
  await expect(page.locator('[data-node]')).toHaveCount(12);
  await page.locator('#lesson-start').click();
  await page.locator('[data-lesson-step="3"]').click();
  await expect(page.locator('.lesson-hundred i')).toHaveCount(100);
  await expect(page.locator('#lesson-copy')).toContainText('87.2 Kč');
  await expect(page.locator('[data-flow="in:deficit"]')).toHaveClass(/lesson-gap-ghost/);
  await page.locator('#lesson-next').click();
  await expect(page.locator('.lesson-grid-wrap')).toHaveClass(/is-financed/);
  await page.locator('[data-lesson-step="5"]').click();
  await page.locator('[data-answer="0"]').click();
  await expect(page.locator('#lesson-feedback')).toContainText('Try again');
  await page.locator('[data-answer="1"]').click();
  await expect(page.locator('#lesson-feedback')).toContainText('Exactly');
});

test('the Czech budget links to the lesson in the selected language', async ({ page }) => {
  await page.goto('/cesky-rozpocet.html?lang=en');
  await expect(page.locator('.hero-actions a[href^="money-flow.html"]')).toHaveAttribute('href', /lang=en/);
  await page.locator('.hero-actions a[href^="money-flow.html"]').click();
  await expect(page.locator('[data-node]')).toHaveCount(12);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.locator('[data-lang="cs"]').click();
  await expect(page.locator('#lesson-title')).toHaveText('Kdo platí věci, které sdílíme?');
});
