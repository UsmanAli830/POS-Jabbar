import { test, expect } from '@playwright/test';

test.describe('Inline Lookup & Serial Code QA Validation', () => {
  test('Validates Auto-Serial Code and Inline '+' Lookup Options', async ({ page }) => {
    // 1. Navigate to Product Catalog Management
    await page.goto('/');
    await expect(page.getByText(/Total Revenue/i)).toBeVisible({ timeout: 15000 });

    await page.getByText('Manage', { exact: true }).click();
    await page.getByText('Products', { exact: true }).click();
    await expect(page.getByText(/Product Catalog Management/i)).toBeVisible({ timeout: 10000 });

    // Click "+ Add New" button to trigger GET /api/products/next-code
    await page.getByRole('button', { name: /\+ Add New/i }).click();

    // Verify auto-populated product code input is non-empty
    const codeInput = page.locator('input[name="productCode"]');
    await expect(codeInput).not.toHaveValue('', { timeout: 5000 });
    const initialCode = await codeInput.inputValue();
    expect(Number(initialCode)).toBeGreaterThanOrEqual(1);

    // Override with custom manual code "500"
    await codeInput.fill('500');
    await page.locator('input[name="productName"]').fill('QA Manual Code Product 500');
    await page.locator('input[name="retailPrice"]').fill('150');
    await page.locator('input[name="costPrice"]').fill('80');
    await page.getByRole('button', { name: /Save Product/i }).click();

    // Verify saved product in grid
    await expect(page.getByText('QA Manual Code Product 500')).toBeVisible({ timeout: 10000 });

    // Click "+ Add New" again — next code should continue sequentially from 500 -> 501!
    await page.getByRole('button', { name: /\+ Add New/i }).click();
    await expect(codeInput).toHaveValue('501', { timeout: 5000 });

    // 2. Inline Category Creation on Product Catalog
    await page.getByTitle('Add New Category').click();
    await expect(page.getByText(/Add New Category/i)).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder(/Enter new Category name/i).fill('Category West QA');
    await page.getByRole('button', { name: /^Save$/i }).click();

    // Verify category is selected in the dropdown
    const catSelect = page.locator('select[name="pCatId"]');
    await expect(catSelect).toHaveText(/Category West QA/);

    // 3. Inline Zone Creation on Customer Management
    await page.getByText('Manage', { exact: true }).click();
    await page.getByText('Customers', { exact: true }).click();
    await expect(page.getByText(/Enterprise Customer CRM/i)).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByTitle('Add New Zone').click();
    await expect(page.getByText(/Add New Zone/i)).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder(/Enter new Zone name/i).fill('Zone West QA');
    await page.getByRole('button', { name: /^Save$/i }).click();

    // Verify Zone dropdown contains and has selected Zone West QA
    const zoneSelect = page.locator('div').filter({ hasText: /^Zone$/ }).locator('select').first();
    await expect(zoneSelect).toHaveText(/Zone West QA/);
  });
});
