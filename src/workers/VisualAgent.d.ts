import { ModelRouter } from '../llm/ModelRouter.js';
import { CapabilityManager } from '../capabilities/CapabilityManager.js';
import { LanceManager } from '../memory/LanceManager.js';
export interface VisualAction {
    type: 'click' | 'type' | 'move' | 'drag';
    x?: number;
    y?: number;
    text?: string;
    description: string;
}
export declare class VisualAgent {
    private modelRouter;
    private capabilities;
    private memory;
    private screenshotsDir;
    constructor(modelRouter: ModelRouter, capabilities: CapabilityManager, memory: LanceManager);
    captureScreen(): Promise<string>;
    analyze(goal: string): Promise<VisualAction>;
    performAction(action: VisualAction): Promise<void>;
}
//# sourceMappingURL=VisualAgent.d.ts.map