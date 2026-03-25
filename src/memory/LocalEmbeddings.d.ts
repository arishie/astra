export declare class LocalEmbeddings {
    private pipe;
    private modelName;
    constructor();
    private ensurePipeline;
    embedQuery(text: string): Promise<number[]>;
    embedDocuments(texts: string[]): Promise<number[][]>;
}
//# sourceMappingURL=LocalEmbeddings.d.ts.map