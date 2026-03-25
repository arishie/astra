import { pipeline } from '@xenova/transformers';

export class LocalEmbeddings {
    private pipe: any;
    private modelName: string = 'Xenova/all-MiniLM-L6-v2';

    constructor() {
    }

    private async ensurePipeline() {
        if (!this.pipe) {
            console.log(`[LocalEmbeddings] Loading model ${this.modelName}...`);
            this.pipe = await pipeline('feature-extraction', this.modelName);
            console.log(`[LocalEmbeddings] Model loaded.`);
        }
    }

    public async embedQuery(text: string): Promise<number[]> {
        await this.ensurePipeline();
        const output = await this.pipe(text, { pooling: 'mean', normalize: true });
        return Array.from(output.data);
    }

    public async embedDocuments(texts: string[]): Promise<number[][]> {
        await this.ensurePipeline();
        const embeddings: number[][] = [];
        for (const text of texts) {
            const output = await this.pipe(text, { pooling: 'mean', normalize: true });
            embeddings.push(Array.from(output.data));
        }
        return embeddings;
    }
}
