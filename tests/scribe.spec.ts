import { test, expect } from '@playwright/test';

test.describe('YouTube Scribe App Comprehensive E2E Suite', () => {
  
  // Helper to serialize any JS object to TanStack Start's serialized JSON format
  const serializeToTsr = (val: any, indexRef = { val: 0 }): any => {
    if (val === null || val === undefined) {
      return { t: 2, s: 1 };
    }
    if (typeof val === 'string') {
      return { t: 1, s: val };
    }
    if (typeof val === 'number') {
      return { t: 0, s: val };
    }
    if (typeof val === 'boolean') {
      return { t: 2, s: val ? 2 : 3 };
    }
    if (Array.isArray(val)) {
      const idx = ++indexRef.val;
      if (val.length === 0) {
        return { t: 9, i: idx, a: [], o: 0 };
      }
      return {
        t: 9,
        i: idx,
        a: val.map(item => serializeToTsr(item, indexRef)),
        o: 0
      };
    }
    if (typeof val === 'object') {
      const idx = ++indexRef.val;
      const keys = Object.keys(val);
      const values = keys.map(k => serializeToTsr(val[k], indexRef));
      return {
        t: 10,
        i: idx,
        p: { k: keys, v: values },
        o: 0
      };
    }
    return val;
  };

  const wrapTsrResponse = (data: any) => {
    const indexRef = { val: 0 };
    const serializedData = serializeToTsr(data, indexRef);
    const contextIdx = ++indexRef.val;
    return {
      t: 10,
      i: 0,
      p: {
        k: ['result', 'error', 'context'],
        v: [
          serializedData,
          { t: 2, s: 1 },
          { t: 11, i: contextIdx, p: { k: [], v: [] }, o: 0 }
        ]
      },
      o: 0
    };
  };

  // Robust helper to open a Radix select dropdown and choose an option with click retry
  const selectOption = async (page: any, comboboxText: string, optionText: string) => {
    const trigger = page.getByRole('combobox').filter({ hasText: comboboxText });
    // Wait for the trigger to be attached and enabled (proves React has hydrated it)
    await trigger.waitFor({ state: 'attached', timeout: 10000 });
    await expect(trigger).toBeEnabled({ timeout: 5000 });
    
    // Focus and click trigger with a small delay for WebKit
    await trigger.focus();
    await trigger.click({ delay: 100 });
    
    const option = page.locator(`[role="option"]:has-text("${optionText}")`);
    try {
      await option.waitFor({ state: 'visible', timeout: 4000 });
    } catch (e) {
      // If option is not visible, try opening with keypress
      console.log(`[TEST HELP] Option "${optionText}" not visible after click. Trying keyboard ArrowDown...`);
      await trigger.focus();
      await trigger.press('ArrowDown');
      try {
        await option.waitFor({ state: 'visible', timeout: 4000 });
      } catch (e2) {
        console.log(`[TEST HELP] Retrying click as final fallback...`);
        await trigger.click();
        await option.waitFor({ state: 'visible', timeout: 8000 });
      }
    }
    await option.click();
    // Wait for Radix Select to fully close and React state to settle (critical for WebKit)
    await page.waitForTimeout(600);
  };

  // Generic helper to intercept TanStack Start server functions at HTTP layer
  const setupServerMocks = async (page: any, customMockHandlers: Record<string, () => any> = {}) => {
    page.on('console', (msg: any) => {
      console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
    });
    page.on('pageerror', (err: any) => {
      console.error(`[BROWSER EXCEPTION] ${err.message}`);
    });

    // Mock Supabase Auth to prevent network hangs during session retrieval
    await page.route('**/*.supabase.co/auth/v1/*', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ session: null, user: null }),
      });
    });

    // Mock Scribe Server Functions
    await page.route((url) => url.pathname.includes('_serverFn') || url.href.includes('_serverFn'), async (route) => {
      const request = route.request();
      const method = request.method();
      const urlStr = request.url();
      const headers = request.headers();
      const postData = request.postData() || '';

      console.log(`[ROUTE MOCK] Intercepted: ${method} ${urlStr}`);

      if (method !== 'POST' && method !== 'GET') {
        return route.continue();
      }

      const isFn = (name: string) => {
        const nameLower = name.toLowerCase();
        if (urlStr.toLowerCase().includes(nameLower)) return true;
        if (postData.toLowerCase().includes(nameLower)) return true;
        
        // Decode base64 URL segments (TanStack Start server function names are base64 encoded in the pathname)
        try {
          const pathname = new URL(urlStr).pathname;
          const segments = pathname.split('/');
          for (const seg of segments) {
            if (seg.length > 15) {
              try {
                // Support both standard base64 and base64url encoding
                const normalizedSeg = seg.replace(/-/g, '+').replace(/_/g, '/');
                const decoded = Buffer.from(normalizedSeg, 'base64').toString('utf8');
                if (decoded.toLowerCase().includes(nameLower)) {
                  return true;
                }
              } catch (e) {
                // Ignore base64 decoding errors
              }
            }
          }
        } catch (e) {
          // Ignore URL parsing errors
        }

        for (const [k, v] of Object.entries(headers)) {
          if (typeof v === 'string') {
            const vLower = v.toLowerCase();
            if (k.toLowerCase().includes('server-fn') && vLower.includes(nameLower)) {
              return true;
            }
          }
        }
        return false;
      };

      // Helper to respond in TanStack Start serialized envelope
      const fulfillTsr = (data: any) => {
        return route.fulfill({
          status: 200,
          headers: {
            'content-type': 'application/json',
            'x-tss-serialized': 'true'
          },
          body: JSON.stringify(wrapTsrResponse(data)),
        });
      };

      // 1. Authenticate User (POST with email & password)
      if (method === 'POST' && (isFn('authenticateUser') || (postData.includes('email') && postData.includes('password')))) {
        if (customMockHandlers.authenticateUser) {
          return fulfillTsr(customMockHandlers.authenticateUser());
        }
        return fulfillTsr({
          user: {
            id: 'mock-auth-user-id',
            email: 'john.doe@example.com',
            user_metadata: {
              full_name: 'John Doe',
              plan: 'Free',
              integrations: { devto: '', medium: '', hashnode: '' },
            },
          },
        });
      }

      // 2. Convert Video (POST with url & tone/format)
      if (method === 'POST' && (isFn('convertVideo') || (postData.includes('url') && (postData.includes('tone') || postData.includes('format'))))) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fulfillTsr({
          markdown: '# Mock Article: The Magic of Repurposing\n\nRepurposing video content can save up to 80% of editing time [[t=12]]. It is a major SEO booster [[t=37]].\n\n## Why Video to Text Works\n\nText drafts are indexable by search engines [[t=60]]. People like lists [[t=90]].\n\n### Key Takeaways\n- AI saves massive time.\n- Structure drafts properly.',
          seo: {
            title: 'Mock Article: Magic of Repurposing',
            metaDescription: 'Learn why converting video into SEO blogs boosts content strategy.',
            tags: ['video', 'repurposing', 'seo', 'writing', 'automation'],
            readingTime: '3 min read',
          },
          error: null,
        });
      }

      // 3. Support Chat Bot Response (POST with messages)
      if (method === 'POST' && (isFn('getSupportBotResponse') || postData.includes('messages'))) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fulfillTsr({ reply: 'This is a **mock Scribe bot** answer. Workspaces help group posts.' });
      }

      // 4. Get Dashboard Data (GET server function)
      if (isFn('getUserDashboardData') || urlStr.includes('getUserDashboardData') || postData.includes('getUserDashboardData') || urlStr.includes('userId') || postData.includes('userId')) {
        if (customMockHandlers.getUserDashboardData) {
          return fulfillTsr(customMockHandlers.getUserDashboardData());
        }
        return fulfillTsr({
          generations: [],
          workspaces: [],
          templates: [],
          email: 'john.developer@example.com',
          fullName: 'John Developer',
          plan: 'Free',
          integrations: { devto: '', medium: '', hashnode: '' },
          brandVoice: {
            enabled: false,
            vocabulary: { prefer: '', avoid: '' },
            sliders: { depth: 50, exuberance: 50, directness: 50 },
            sampleText: '',
          },
          notFound: false,
        });
      }

      // 5. Workspace folder creation
      if (method === 'POST' && (isFn('createWorkspaceFolder') || postData.includes('createWorkspaceFolder') || (postData.includes('name') && !postData.includes('tone') && !postData.includes('format')))) {
        return fulfillTsr({
          workspace: {
            id: 'mock-ws-id-' + Math.random().toString(36).substr(2, 9),
            name: 'Product Marketing',
          },
        });
      }

      // 6. Custom template creation
      if (method === 'POST' && (isFn('createCustomTemplate') || postData.includes('createCustomTemplate') || (postData.includes('name') && postData.includes('tone') && postData.includes('format')))) {
        return fulfillTsr({
          template: {
            id: 'mock-tpl-id-' + Math.random().toString(36).substr(2, 9),
            name: 'Premium Dev Newsletter',
            tone: 'Casual',
            length: 'Short',
            format: 'Deep Dive',
          },
        });
      }

      // 7. Save Generation History
      if (method === 'POST' && (isFn('saveGenerationHistory') || postData.includes('saveGenerationHistory') || (postData.includes('title') && postData.includes('markdown') && !postData.includes('genId')))) {
        return fulfillTsr({
          generation: {
            id: 'saved-gen-id',
            url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            tone: 'Casual',
            length: 'Short',
            format: 'Deep Dive',
            title: 'Mock Article: Magic of Repurposing',
            markdown: '# Mock Article: The Magic of Repurposing',
            seo: {},
            createdAt: new Date().toISOString(),
            versions: [],
            activeVersionId: 'version-1',
          },
          isUpdate: false,
        });
      }

      // 8. Update Generation Content/Draft
      if (method === 'POST' && (isFn('updateGenerationContent') || postData.includes('updateGenerationContent') || (postData.includes('genId') && postData.includes('markdown')))) {
        return fulfillTsr({
          success: true,
          generation: {
            id: 'saved-gen-id',
            markdown: '# Modified Content',
            title: 'Modified Title',
            seo: {},
          },
        });
      }

      // 9. Update User Brand Voice
      if (method === 'POST' && (isFn('updateUserBrandVoice') || postData.includes('updateUserBrandVoice') || postData.includes('brandVoice'))) {
        return fulfillTsr({
          user: {
            id: 'mock-logged-in-user-id',
            email: 'john.developer@example.com',
            user_metadata: {
              full_name: 'John Developer',
              plan: 'Free',
              integrations: { devto: '', medium: '', hashnode: '' },
              brand_voice: {},
            },
          },
        });
      }

      // 10. Update User Integrations
      if (method === 'POST' && (isFn('updateUserIntegrations') || postData.includes('updateUserIntegrations') || postData.includes('devto') || postData.includes('medium'))) {
        return fulfillTsr({
          user: {
            id: 'mock-logged-in-user-id',
            email: 'john.developer@example.com',
            user_metadata: {
              full_name: 'John Developer',
              plan: 'Free',
              integrations: { devto: 'devto_key_xyz123', medium: 'medium_token_abc456', hashnode: '' },
            },
          },
        });
      }

      // 11. Upgrade User Plan
      if (method === 'POST' && (isFn('upgradeUserPlan') || postData.includes('upgradeUserPlan') || postData.includes('plan'))) {
        if (customMockHandlers.upgradeUserPlan) {
          return fulfillTsr(customMockHandlers.upgradeUserPlan());
        }
        return fulfillTsr({
          user: {
            id: 'mock-logged-in-user-id',
            email: 'john.developer@example.com',
            user_metadata: {
              full_name: 'John Developer',
              plan: 'Pro',
            },
          },
        });
      }

      // Generic delete / success mock fallback
      return fulfillTsr({ success: true });
    });
  };

  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(90000);
    // Stub out the WebSocket constructor to prevent Vite's Hot Module Replacement (HMR) from
    // opening connection threads. Under WebKit on Windows, active WebSocket connection threads
    // are a known cause of browser processes failing to exit cleanly during teardown.
    if (testInfo.project.name === 'webkit') {
      await page.addInitScript(() => {
        class DummyWebSocket {
          url: string;
          readyState = 3; // CLOSED
          constructor(url: string) {
            this.url = url;
          }
          close() {}
          send() {}
          addEventListener() {}
          removeEventListener() {}
          dispatchEvent() { return true; }
        }
        (window as any).WebSocket = DummyWebSocket;
      });
    }
  });

  test.afterEach(async ({ page, context }) => {
    try {
      await page.close();
      await context.close();
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  test('Test 1: Sanity & Landing Page Static Layout', async ({ page }) => {
    await setupServerMocks(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => (window as any).ReactHydrated === true, { timeout: 45000 });

    // Wait for guest trigger to confirm hydration
    await expect(page.locator('aside >> text=Guest User')).toBeVisible({ timeout: 15000 });

    // Verify SEO Title
    await expect(page).toHaveTitle(/Scribe/);

    // Verify heading text is visible
    await expect(page.locator('h1')).toContainText('Turn any YouTube video');
    await expect(page.locator('h1')).toContainText('into a polished blog post.');

    // Check main input placeholder is present
    const input = page.locator('#url');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('placeholder', 'https://www.youtube.com/watch?v=...');

    // Option triggers are visible
    await expect(page.locator('button:has-text("Professional")')).toBeVisible();
    await expect(page.locator('button:has-text("Medium")')).toBeVisible();
    await expect(page.locator('button:has-text("Deep Dive")')).toBeVisible();
    
    // Sidebar elements
    await expect(page.locator('aside >> p:has-text("Templates")')).toBeVisible();
    await expect(page.locator('aside >> p:has-text("Workspaces")')).toBeVisible();
    await expect(page.locator('aside >> text=Guest User')).toBeVisible();
  });

  test('Test 2: Video Conversion Guest Flow & Copy Dialog', async ({ page }) => {
    // Stub navigator.clipboard.writeText across all browsers (grantPermissions is Chromium-only)
    await page.addInitScript(() => {
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        Object.defineProperty(navigator, 'clipboard', {
          value: { writeText: () => Promise.resolve(), readText: () => Promise.resolve('') },
          writable: true
        });
      } else {
        navigator.clipboard.writeText = () => Promise.resolve();
      }
    });
    await setupServerMocks(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => (window as any).ReactHydrated === true, { timeout: 45000 });

    // Wait for hydration
    await expect(page.locator('aside >> text=Guest User')).toBeVisible({ timeout: 15000 });

    // Select options FIRST before filling URL (WebKit can clear input when Radix Select steals focus)
    await selectOption(page, 'Professional', 'Casual');
    await selectOption(page, 'Medium', 'Short');

    // Fill YouTube URL AFTER select interactions to avoid WebKit input-clearing race
    const urlInput = page.locator('#url');
    await urlInput.click();
    await urlInput.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    // Verify URL was actually set (guards against WebKit fill race)
    await expect(urlInput).toHaveValue('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { timeout: 3000 });

    // Click "Convert to blog post" button
    await page.locator('button:has-text("Convert to blog post")').click();

    // Verify loader steps show correct sequential progression
    await expect(page.locator('text=Fetching transcript')).toBeVisible();
    await expect(page.locator('text=Analysing content')).toBeVisible();
    await expect(page.locator('text=Writing blog post')).toBeVisible();

    // Verify final blog article output is displayed
    await expect(page.locator('text=SEO metadata').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('h2:has-text("Mock Article: Magic of Repurposing")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Repurposing video content can save up to 80%')).toBeVisible({ timeout: 10000 });

    // After conversion, the app shows a "Saved to History" alert dialog — dismiss it before interacting with tabs
    const saveDialog = page.getByTestId('custom-dialog');
    await saveDialog.waitFor({ state: 'visible', timeout: 10000 });
    await saveDialog.locator('button:has-text("Awesome")').click({ force: true });
    await expect(saveDialog).not.toBeVisible();

    // Test tab transitions (Preview, Markdown, Document Editor)
    await page.locator('button:has-text("Markdown")').click();
    await expect(page.locator('pre')).toContainText('# Mock Article: The Magic of Repurposing');

    await page.locator('button:has-text("📝 Document Editor")').click();
    await expect(page.locator('[contenteditable="true"]')).toBeVisible();

    // Go back to Preview to test copying
    await page.locator('button:has-text("Preview")').click();
    await page.locator('button:has-text("Copy")').click();

    // Verify custom popup dialog titles and buttons
    const customDialog = page.getByTestId('custom-dialog');
    await customDialog.waitFor({ state: 'visible' });
    await expect(customDialog.locator('h2')).toContainText('Copied to Clipboard');
    
    // Dismiss the custom copy dialog
    await customDialog.locator('button:has-text("Got it")').click({ force: true });
    await expect(customDialog).not.toBeVisible();
  });

  test('Test 3: Sidebar Workspace & Custom Template Managers', async ({ page }) => {
    await setupServerMocks(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => (window as any).ReactHydrated === true, { timeout: 45000 });

    // Wait for hydration
    await expect(page.locator('aside >> text=Guest User')).toBeVisible({ timeout: 15000 });

    // ── Template Sidebar Management ──
    // Click add template — wait for button to be attached (hydrated) before clicking
    const addTemplateBtn = page.locator('button[title="Save current config as template"]');
    await addTemplateBtn.waitFor({ state: 'attached', timeout: 5000 });
    await addTemplateBtn.click({ force: true });

    // Handle Custom Dialog Prompt
    const customDialog = page.getByTestId('custom-dialog');
    await customDialog.waitFor({ state: 'visible', timeout: 10000 });
    await customDialog.locator('input').waitFor({ state: 'visible' });
    await expect(customDialog.locator('h2')).toContainText('Save Config as Template');
    await customDialog.locator('input').fill('Premium Dev Newsletter');
    await customDialog.locator('button:has-text("Save Template")').click({ force: true });

    // Verify template is present in sidebar
    await expect(page.locator('aside >> text=Premium Dev Newsletter')).toBeVisible();

    // Ensure the save dialog is completely closed and unmounted before clicking delete
    await expect(customDialog).not.toBeVisible();

    // Delete custom template
    await page.locator('aside >> .group:has-text("Premium Dev Newsletter") >> button').click({ force: true });
    await customDialog.waitFor({ state: 'visible' });
    await expect(customDialog.locator('h2')).toContainText('Delete Template');
    await customDialog.locator('button:has-text("Delete")').click({ force: true });
    
    // Verify template is deleted
    await expect(page.locator('aside >> text=Premium Dev Newsletter')).not.toBeVisible();
    await expect(customDialog).not.toBeVisible();

    // ── Workspace Sidebar Management ──
    // Click add workspace folder (force: true bypasses rendering latency)
    const addWsBtn = page.locator('button[title="Create Workspace Folder"]');
    await addWsBtn.waitFor({ state: 'attached', timeout: 5000 });
    await addWsBtn.click({ force: true });
    
    // Handle Prompt
    await customDialog.waitFor({ state: 'visible', timeout: 10000 });
    await customDialog.locator('input').waitFor({ state: 'visible' });
    await expect(customDialog.locator('h2')).toContainText('Create Workspace Folder');
    await customDialog.locator('input').fill('Product Marketing');
    await customDialog.locator('button:has-text("Create Folder")').click({ force: true });

    // Verify workspace is present
    await expect(page.locator('aside >> text=Product Marketing')).toBeVisible();
    await expect(customDialog).not.toBeVisible();

    // Delete workspace folder
    await page.locator('aside >> .group:has-text("Product Marketing") >> button').click({ force: true });
    await customDialog.waitFor({ state: 'visible' });
    await expect(customDialog.locator('h2')).toContainText('Delete Workspace');
    await customDialog.locator('button:has-text("Delete Workspace")').click({ force: true });

    // Verify workspace is deleted
    await expect(page.locator('aside >> text=Product Marketing')).not.toBeVisible();
  });

  test('Test 4: Settings Studio, Sliders, Voice Cloning, Integrations, and checkout upgrade', async ({ page }) => {
    // 1. Set logged-in session in localStorage to unlock all settings features
    await page.addInitScript(() => {
      localStorage.setItem('custom_session', JSON.stringify({
        id: 'mock-logged-in-user-id',
        email: 'john.developer@example.com',
        user_metadata: {
          full_name: 'John Developer',
          plan: 'Free',
          integrations: { devto: '', medium: '', hashnode: '' },
          brand_voice: {
            enabled: false,
            vocabulary: { prefer: '', avoid: '' },
            sliders: { depth: 50, exuberance: 50, directness: 50 },
            sampleText: '',
          }
        }
      }));
    });

    await setupServerMocks(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => (window as any).ReactHydrated === true, { timeout: 45000 });

    // Wait for user details to load inside sidebar — needs extra time for dashboard data fetch + state update
    await expect(page.locator('aside >> text=John Developer')).toBeVisible({ timeout: 15000 });

    // Open settings trigger in sidebar profile trigger
    await page.locator('aside >> text=John Developer').click();
    await page.locator('[role="menuitem"]:has-text("Settings")').click({ force: true });

    // Check Settings Modal is opened
    const settingsModal = page.getByTestId('settings-modal');
    await settingsModal.waitFor({ state: 'visible' });
    
    // Explicitly check for exact Settings trigger inside the header to bypass tabs conflict
    await expect(settingsModal.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();

    // ── Personalization tab ──
    await settingsModal.locator('[role="tab"]:has-text("Personalization")').click({ force: true });
    await expect(settingsModal.locator('h2:has-text("Multi-Modal Brand Voice Clone")')).toBeVisible();
    
    // Toggle Brand Voice Clone status (uses a regular button styled as a switch)
    await settingsModal.locator('button:has(span.pointer-events-none)').first().click();
    
    // Modify style sliders
    const depthSlider = settingsModal.locator('input[type="range"]').nth(0);
    await depthSlider.fill('85'); // Advanced Expert Depth
    
    // Add preferred terms
    await settingsModal.getByPlaceholder('e.g. robust, cryptographic, paradigm').fill('idempotent, serverless, atomic');
    // Save Voice Clone
    await settingsModal.locator('button:has-text("Save Voice Clone")').click({ force: true });

    // ── Integrations tab ──
    await settingsModal.locator('[role="tab"]:has-text("Integrations")').click({ force: true });
    await settingsModal.getByPlaceholder('Enter dev.to API key (e.g. devto_...)').fill('devto_key_xyz123');
    await settingsModal.getByPlaceholder('Enter Medium Integration Token').fill('medium_token_abc456');
    await settingsModal.locator('button:has-text("Save API Keys")').click({ force: true });

    // ── Upgrade Plan tab (Credit card checkout) ──
    await settingsModal.locator('[role="tab"]:has-text("Upgrade Plan")').click({ force: true });
    
    // Intercept upgrade Fn response to return Pro plan
    await setupServerMocks(page, {
      getUserDashboardData: () => ({
        generations: [],
        workspaces: [],
        templates: [],
        email: 'john.developer@example.com',
        fullName: 'John Developer',
        plan: 'Pro', // Plan upgraded to Pro!
        integrations: { devto: 'devto_key_xyz123', medium: 'medium_token_abc456', hashnode: '' },
      }),
      upgradeUserPlan: () => ({
        user: {
          id: 'mock-logged-in-user-id',
          email: 'john.developer@example.com',
          user_metadata: {
            full_name: 'John Developer',
            plan: 'Pro',
          },
        },
      })
    });

    await settingsModal.locator('button:has-text("Upgrade Now")').click({ force: true });

    // Checkout Modal pops up
    const checkoutDialog = page.getByTestId('checkout-dialog');
    await checkoutDialog.waitFor({ state: 'visible' });
    await expect(checkoutDialog.locator('h2')).toContainText('Scribe Pro Checkout');

    // Select Card Payment and fill fake fields
    await checkoutDialog.getByPlaceholder('Jane Doe').fill('John Developer');
    await checkoutDialog.getByPlaceholder('4111 1111 1111 1111').fill('4111 1111 1111 1111');
    await checkoutDialog.getByPlaceholder('MM/YY').fill('12/28');
    await checkoutDialog.getByPlaceholder('123').fill('987');
    await checkoutDialog.getByPlaceholder('10001').fill('94043');

    // Submit payment
    await checkoutDialog.locator('button[type="submit"]').click({ force: true });

    // Verify payment transitions and upgrades status
    await expect(checkoutDialog).not.toBeVisible({ timeout: 10000 });
    
    // Plan should show Pro inside dashboard profile dropdown area
    await settingsModal.locator('[role="tab"]:has-text("Upgrade Plan")').click({ force: true, timeout: 10000 });
    await expect(settingsModal.locator('text=You are currently on the Pro plan')).toBeVisible({ timeout: 10000 });
  });

  test('Test 5: AI Support Bot Integration Chat Flow', async ({ page }) => {
    await setupServerMocks(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => (window as any).ReactHydrated === true, { timeout: 45000 });

    // Wait for hydration
    await expect(page.locator('aside >> text=Guest User')).toBeVisible({ timeout: 15000 });

    // Toggle circular support bot launcher — target the last button inside the fixed chat container
    const supportChatContainer = page.locator('div[class*="fixed"][class*="bottom-6"][class*="right-6"]');
    await supportChatContainer.waitFor({ state: 'visible', timeout: 10000 });
    const launcherBtn = supportChatContainer.locator('button').last();
    await launcherBtn.waitFor({ state: 'attached', timeout: 5000 });
    await launcherBtn.click({ force: true });

    // Verify Chat dialog is expanded
    await expect(page.locator('h3:has-text("Scribe Assistant")')).toBeVisible({ timeout: 10000 });

    // Select standard presets trigger
    await page.locator('button:has-text("Workspace folders 📂")').click({ force: true });

    // Bot typing simulation should show, then append mock response
    await expect(page.locator('text=Scribe Support is writing...')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=This is a mock Scribe bot answer.')).toBeVisible({ timeout: 10000 });

    // Submit a custom query
    const botInput = page.getByPlaceholder('Ask support a question...');
    await botInput.fill('Is there an offline backup?');
    // Scope to the support chat form specifically to avoid strict mode violation with other forms on the page
    const supportChatForm = page.locator('form').filter({ has: page.getByPlaceholder('Ask support a question...') });
    await supportChatForm.locator('button[type="submit"]').click();

    // Verify loader and final text
    await expect(page.locator('text=Scribe Support is writing...')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=This is a mock Scribe bot answer.')).toBeVisible({ timeout: 10000 });

    // Close chat — click the launcher button again (it toggles open/closed)
    await launcherBtn.click({ force: true });
    await expect(page.locator('h3:has-text("Scribe Assistant")')).not.toBeVisible({ timeout: 5000 });
  });

  test('Test 6: Credentials Auth Signup & Log Out Redirect Flow', async ({ page }) => {
    await setupServerMocks(page, {
      getUserDashboardData: () => ({
        generations: [],
        workspaces: [],
        templates: [],
        email: 'john.doe@example.com',
        fullName: 'John Doe',
        plan: 'Free',
        integrations: { devto: '', medium: '', hashnode: '' },
      }),
      authenticateUser: () => ({
        user: {
          id: 'user-abc-123',
          email: 'john.doe@example.com',
          user_metadata: {
            full_name: 'John Doe',
            plan: 'Free',
            integrations: { devto: '', medium: '', hashnode: '' },
          },
        },
      }),
    });

    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => (window as any).ReactHydrated === true, { timeout: 45000 });

    // Verify Auth Header
    await expect(page.locator('h1')).toContainText('Log in or sign up', { timeout: 15000 });

    // Submit Email address
    const emailInput = page.getByPlaceholder('Email address');
    await emailInput.focus();
    await emailInput.pressSequentially('john.doe@example.com', { delay: 50 });
    // Click the form submit button (scoped to the email form to avoid matching OAuth "Continue with X" buttons)
    const emailForm = page.locator('form').filter({ has: page.getByPlaceholder('Email address') });
    const emailSubmitBtn = emailForm.locator('button[type="submit"]');
    await expect(emailSubmitBtn).toBeEnabled({ timeout: 10000 });
    await emailSubmitBtn.click();

    // Password screen transitions
    await expect(page.locator('h1')).toContainText('Enter your password', { timeout: 10000 });
    const passwordInput = page.getByPlaceholder('Password');
    await passwordInput.focus();
    await passwordInput.pressSequentially('testpassword123', { delay: 50 });

    // Submit password (scoped to the password form)
    const passwordForm = page.locator('form').filter({ has: page.getByPlaceholder('Password') });
    const pwSubmitBtn = passwordForm.locator('button[type="submit"]');
    await expect(pwSubmitBtn).toBeEnabled({ timeout: 5000 });
    await pwSubmitBtn.click();

    // Check successful authentication redirect to main dashboard
    await expect(page).toHaveURL('/', { timeout: 10000 });

    // Verify Display Name and Initials in the profile trigger (waiting for hydration)
    await page.locator('aside >> text=John Doe').waitFor({ state: 'visible', timeout: 15000 });
    await expect(page.locator('aside >> text=John Doe')).toBeVisible();
    await expect(page.locator('aside').getByText('JO', { exact: true })).toBeVisible();

    // Test Logging out cleanly
    await page.locator('aside >> text=John Doe').click();
    await page.locator('[role="menuitem"]:has-text("Log out")').click();

    // Verify profile area falls back cleanly to Guest User state
    await expect(page.locator('aside >> text=Guest User')).toBeVisible();
    await expect(page.locator('aside').getByText('G', { exact: true })).toBeVisible();
  });

});
