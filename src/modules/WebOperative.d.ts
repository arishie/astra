export declare class WebOperative {
    private browser;
    constructor();
    launch(): Promise<void>;
    shutdown(): Promise<void>;
    fetchContent(url: string): Promise<string>;
    takeScreenshot(url: string, outputPath: string): Promise<void>;
}
//# sourceMappingURL=WebOperative.d.ts.map