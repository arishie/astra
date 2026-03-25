import { ModelRouter } from '../llm/ModelRouter.js';
import { LanceManager } from '../memory/LanceManager.js';
export declare class ThinkingHive {
    private modelRouter;
    private memory;
    constructor(modelRouter: ModelRouter, memory: LanceManager);
    collaborate(goal: string, context: string): Promise<string>;
}
//# sourceMappingURL=ThinkingHive.d.ts.map