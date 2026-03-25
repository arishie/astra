import { ModelRouter } from '../llm/ModelRouter.js';
import { CapabilityManager } from '../capabilities/CapabilityManager.js';
export declare class ToolSynthesizer {
    private modelRouter;
    private capabilities;
    private sandbox;
    private dynamicToolsDir;
    private tempDir;
    constructor(modelRouter: ModelRouter, capabilities: CapabilityManager);
    synthesize(goal: string, sessionToken: string): Promise<string>;
    private generateCode;
    private sanitizeName;
}
//# sourceMappingURL=ToolSynthesizer.d.ts.map