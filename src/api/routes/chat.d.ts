import { BridgeManager } from '../../bridge/BridgeManager.js';
declare const router: import("express-serve-static-core").Router;
export declare function setBridgeManager(manager: BridgeManager): void;
export declare function setOrchestratorHandler(handler: (userId: string, message: string, context: any) => Promise<string>): void;
export default router;
//# sourceMappingURL=chat.d.ts.map