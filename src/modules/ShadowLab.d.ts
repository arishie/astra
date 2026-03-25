export declare class ShadowLab {
    private sandboxDir;
    constructor();
    /**
     * Executes code in a simulated isolated environment.
     * In a production environment, this would run `docker run -v ... node:alpine ...`
     * For this local demo, we use a separate process with a timeout.
     */
    verifyCode(code: string, language: 'javascript' | 'python'): Promise<{
        success: boolean;
        output: string;
    }>;
}
//# sourceMappingURL=ShadowLab.d.ts.map