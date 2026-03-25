import { LanceManager } from '../memory/LanceManager.js';
export declare class IngestionWorker {
    private watcher;
    private memory;
    private watchDir;
    private textSplitter;
    constructor(memoryManager: LanceManager, watchDir?: string);
    start(): void;
    private processFile;
}
//# sourceMappingURL=IngestionWorker.d.ts.map