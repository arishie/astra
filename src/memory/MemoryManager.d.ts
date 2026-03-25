export declare class MemoryManager {
    private client;
    private collection;
    private embeddings;
    private collectionName;
    constructor();
    initialize(): Promise<void>;
    addDocument(text: string, metadata?: any): Promise<void>;
    search(query: string, limit?: number): Promise<string[]>;
}
//# sourceMappingURL=MemoryManager.d.ts.map