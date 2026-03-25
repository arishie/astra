import { chromium, type Browser, type Page } from 'playwright';

export class WebOperative {
    private browser: Browser | null = null;

    constructor() {}

    public async launch() {
        if (!this.browser) {
            console.log("[WebOperative] Launching Stealth Browser...");
            this.browser = await chromium.launch({ headless: true }); // Headless for server use
        }
    }

    public async shutdown() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    public async fetchContent(url: string): Promise<string> {
        await this.launch();
        if (!this.browser) throw new Error("Browser failed to launch");

        const context = await this.browser.newContext();
        const page = await context.newPage();

        try {
            console.log(`[WebOperative] Navigating to: ${url}`);
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            
            // Extract meaningful text (simplified)
            const text = await page.evaluate(() => document.body.innerText);
            return text.substring(0, 5000); // Limit context
        } catch (e: any) {
            return `Error navigating to ${url}: ${e.message}`;
        } finally {
            await context.close();
        }
    }

    public async takeScreenshot(url: string, outputPath: string): Promise<void> {
        await this.launch();
        if (!this.browser) throw new Error("Browser failed to launch");

        const context = await this.browser.newContext();
        const page = await context.newPage();
        
        try {
             await page.goto(url, { waitUntil: 'networkidle' });
             await page.screenshot({ path: outputPath });
             console.log(`[WebOperative] Screenshot saved to ${outputPath}`);
        } finally {
            await context.close();
        }
    }
}
