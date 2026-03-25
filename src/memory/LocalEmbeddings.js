import { pipeline } from '@xenova/transformers';
export class LocalEmbeddings {
    pipe;
    modelName = 'Xenova/all-MiniLM-L6-v2';
    constructor() {
    }
    async ensurePipeline() {
        if (!this.pipe) {
            console.log(`[LocalEmbeddings] Loading model ${this.modelName}...`);
            this.pipe = await pipeline('feature-extraction', this.modelName);
            console.log(`[LocalEmbeddings] Model loaded.`);
        }
    }
    async embedQuery(text) {
        await this.ensurePipeline();
        const output = await this.pipe(text, { pooling: 'mean', normalize: true });
        return Array.from(output.data);
    }
    async embedDocuments(texts) {
        await this.ensurePipeline();
        const embeddings = [];
        for (const text of texts) {
            const output = await this.pipe(text, { pooling: 'mean', normalize: true });
            embeddings.push(Array.from(output.data));
        }
        return embeddings;
    }
}
//# sourceMappingURL=LocalEmbeddings.js.map