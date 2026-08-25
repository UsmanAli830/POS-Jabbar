import { test, expect } from '@playwright/test';

test.describe('Robot User E2E Journey', () => {
  test('Completes the core business flow', async ({ page }) => {
    // ============================================================
    // STEP 1: Dashboard loads with KPI cards
    // ============================================================
    await page.goto('/');
    await expect(page.getByText(/Total Revenue/i)).toBeVisible({ timeout: 15000 });

    // ============================================================
    // STEP 2: Navigate to Customers and create a new record
    // ============================================================
    await page.getByText('Manage', { exact: true }).click();
    await page.getByText('Customers', { exact: true }).click();

    // Wait for the Customer Management page to load
    await expect(page.getByText(/Enterprise Customer CRM/i)).toBeVisible({ timeout: 10000 });

    // Switch to "Create" mode
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    // Fill form fields
    const uniqueCustomerName = `Robot User ${Date.now()}`;
    await page.locator('.form-group').filter({ hasText: /^Customer Name/ }).locator('input').fill(uniqueCustomerName);
    await page.locator('.form-group').filter({ hasText: /^Phone$/ }).locator('input').fill('555-0199');
    await page.locator('.form-group').filter({ hasText: /Opening Balance/ }).locator('input').fill('500');

    // Save
    await page.getByRole('button', { name: /Save Customer/i }).click();

    // Assert new customer is visible in the grid
    await expect(page.getByText(uniqueCustomerName)).toBeVisible({ timeout: 10000 });

    // ============================================================
    // STEP 3: Navigate to POS / Cash Register
    // ============================================================
    await page.getByText('Sales', { exact: true }).click();
    await page.getByText('Cash Register', { exact: true }).click();

    // Wait for the POS to load
    await expect(page.getByPlaceholder(/scan barcode or search products/i)).toBeVisible({ timeout: 15000 });

    // Add "Golden Product" to cart — scope to the product catalog panel (right pane)
    // Use .first() to handle any duplicate text matches (recharts hidden spans etc.)
    await page.getByText('Golden Product', { exact: true }).first().click();

    // PAY NOW button should now be enabled
    const payNowBtn = page.getByRole('button', { name: /PAY NOW/i });
    await expect(payNowBtn).toBeEnabled({ timeout: 5000 });
    await payNowBtn.click();

    // Checkout modal appears
    await expect(page.getByText('Complete Payment', { exact: true })).toBeVisible({ timeout: 5000 });

    // Click Confirm Sale button
    await page.getByRole('button', { name: /Confirm Sale/i }).click();

    // Success: modal closes and cart empties (PAY NOW button reverts to disabled)
    await expect(page.getByText('Complete Payment')).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /PAY NOW/i })).toBeDisabled({ timeout: 5000 });
  });
});
