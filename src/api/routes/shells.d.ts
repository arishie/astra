/**
 * Shell API Routes
 *
 * REST API for managing shells (custom AI agents).
 * Also provides webhook endpoints for n8n integration.
 */
import { ShellManager } from '../../shells/index.js';
declare const router: import("express-serve-static-core").Router;
export declare function setShellManager(manager: ShellManager): void;
export default router;
//# sourceMappingURL=shells.d.ts.map