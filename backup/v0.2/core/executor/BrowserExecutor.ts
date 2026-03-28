import {
  AnyAction,
  ActionResult,
  BrowserNavigateAction,
  BrowserClickAction,
  BrowserInputAction,
  BrowserWaitAction,
  BrowserExtractAction,
  BrowserScreenshotAction,
} from '../action/ActionSchema';

export class BrowserExecutor {
  private browser: any = null;
  private context: any = null;
  private page: any = null;

  async execute(action: AnyAction): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      await this.ensureBrowser();

      switch (action.type) {
        case 'browser:navigate':
          return await this.navigate(action as BrowserNavigateAction, startTime);
        case 'browser:click':
          return await this.click(action as BrowserClickAction, startTime);
        case 'browser:input':
          return await this.input(action as BrowserInputAction, startTime);
        case 'browser:wait':
          return await this.wait(action as BrowserWaitAction, startTime);
        case 'browser:extract':
          return await this.extract(action as BrowserExtractAction, startTime);
        case 'browser:screenshot':
          return await this.screenshot(action as BrowserScreenshotAction, startTime);
        default:
          return {
            success: false,
            error: {
              code: 'UNKNOWN_ACTION',
              message: `Unknown browser action: ${action.type}`,
              recoverable: false,
            },
            duration: Date.now() - startTime,
          };
      }
    } catch (error: any) {
      console.error(`[BrowserExecutor] Action failed:`, error);
      return {
        success: false,
        error: {
          code: 'BROWSER_ERROR',
          message: error.message || 'Unknown browser error',
          recoverable: true,
        },
        duration: Date.now() - startTime,
      };
    }
  }

  private async ensureBrowser(): Promise<void> {
    if (this.page) return;

    try {
      const { chromium } = require('playwright');
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
      });
      this.page = await this.context.newPage();
      console.log('[BrowserExecutor] Browser launched');
    } catch (error) {
      console.error('[BrowserExecutor] Failed to launch browser:', error);
      throw error;
    }
  }

  private async navigate(action: BrowserNavigateAction, startTime: number): Promise<ActionResult> {
    const { url, waitUntil = 'domcontentloaded' } = action.params;

    console.log(`[BrowserExecutor] Navigating to: ${url}`);

    await this.page.goto(url, { waitUntil, timeout: 30000 });

    const currentUrl = this.page.url();
    console.log(`[BrowserExecutor] Navigated to: ${currentUrl}`);

    return {
      success: true,
      output: { url: currentUrl, title: await this.page.title() },
      duration: Date.now() - startTime,
    };
  }

  private async click(action: BrowserClickAction, startTime: number): Promise<ActionResult> {
    const { selector, index = 0 } = action.params;

    console.log(`[BrowserExecutor] Clicking: ${selector}[${index}]`);

    const elements = await this.page.locator(selector).all();
    if (elements.length === 0) {
      throw new Error(`Element not found: ${selector}`);
    }

    const targetElement = elements[index] || elements[0];
    await targetElement.click();

    return {
      success: true,
      output: { clicked: selector },
      duration: Date.now() - startTime,
    };
  }

  private async input(action: BrowserInputAction, startTime: number): Promise<ActionResult> {
    const { selector, text, clear = true, delay = 0 } = action.params;

    console.log(`[BrowserExecutor] Input to: ${selector}`);

    const element = this.page.locator(selector);
    
    if (clear) {
      await element.clear();
    }

    if (delay > 0) {
      for (const char of text) {
        await element.type(char, { delay });
      }
    } else {
      await element.fill(text);
    }

    return {
      success: true,
      output: { input: text, selector },
      duration: Date.now() - startTime,
    };
  }

  private async wait(action: BrowserWaitAction, startTime: number): Promise<ActionResult> {
    const { selector, timeout = 10000, state = 'visible' } = action.params;

    console.log(`[BrowserExecutor] Waiting for: ${selector} (${state})`);

    if (selector) {
      await this.page.waitForSelector(selector, { state, timeout });
    } else {
      await this.page.waitForTimeout(timeout);
    }

    return {
      success: true,
      output: { waited: selector || timeout },
      duration: Date.now() - startTime,
    };
  }

  private async extract(action: BrowserExtractAction, startTime: number): Promise<ActionResult> {
    const { selector, type = 'text', multiple = false } = action.params;

    console.log(`[BrowserExecutor] Extracting from: ${selector}`);

    const element = this.page.locator(selector);
    let output: any;

    switch (type) {
      case 'text':
        output = multiple ? await element.allTextContents() : await element.textContent();
        break;
      case 'html':
        output = multiple ? await element.allInnerHTMLs() : await element.innerHTML();
        break;
      case 'json':
        output = await element.evaluate((el: any) => {
          try {
            return JSON.parse(el.textContent || '');
          } catch {
            return el.textContent;
          }
        });
        break;
      case 'table':
        output = await element.evaluate((table: any) => {
          const rows = table.querySelectorAll('tr');
          return Array.from(rows).map((row: any) => {
            const cells = row.querySelectorAll('th, td');
            return Array.from(cells).map((c: any) => c.textContent);
          });
        });
        break;
      default:
        output = await element.textContent();
    }

    return {
      success: true,
      output,
      duration: Date.now() - startTime,
    };
  }

  private async screenshot(action: BrowserScreenshotAction, startTime: number): Promise<ActionResult> {
    const { fullPage = false, selector } = action.params;

    console.log(`[BrowserExecutor] Taking screenshot (fullPage: ${fullPage})`);

    let screenshot: string;

    if (selector) {
      const element = this.page.locator(selector);
      screenshot = await element.screenshot({});
    } else {
      screenshot = await this.page.screenshot({ fullPage });
    }

    const base64 = Buffer.from(screenshot).toString('base64');

    return {
      success: true,
      output: { screenshot: base64 },
      screenshots: [base64],
      duration: Date.now() - startTime,
    };
  }

  async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      console.log('[BrowserExecutor] Browser cleanup complete');
    } catch (error) {
      console.error('[BrowserExecutor] Cleanup error:', error);
    }
  }

  getPage() {
    return this.page;
  }

  async getScreenshot(): Promise<string | null> {
    if (!this.page) return null;
    try {
      const screenshot = await this.page.screenshot();
      return Buffer.from(screenshot).toString('base64');
    } catch (error) {
      console.error('[BrowserExecutor] Failed to get screenshot:', error);
      return null;
    }
  }
}

export default BrowserExecutor;