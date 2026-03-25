import { ChromaClient, type Collection } from 'chromadb';
import { LocalEmbeddings } from './LocalEmbeddings.js';
import { v4 as uuidv4 } from 'uuid';

export class MemoryManager {
    private client: ChromaClient;
    private collection: Collection | null = null;
    private embeddings: LocalEmbeddings;
    private collectionName: string = 'astra_memory';

    constructor() {
        this.client = new ChromaClient({ path: 'http://localhost:8000' });
        this.embeddings = new LocalEmbeddings();
    }

    public async initialize() {
        try {
            this.collection = await this.client.getOrCreateCollection({
                name: this.collectionName,
                metadata: { "hnsw:space": "cosine" }
            });
            console.log(`[MemoryManager] Connected to ChromaDB collection: ${this.collectionName}`);
        } catch (e: any) {
            console.error(`[MemoryManager] Failed to connect to ChromaDB. Ensure it is running! Error: ${e.message}`);
        }
    }

    public async addDocument(text: string, metadata: any = {}) {
        if (!this.collection) await this.initialize();
        if (!this.collection) return; // Still failed

        console.log(`[MemoryManager] Generating embedding for document...`);
        const embedding = await this.embeddings.embedQuery(text); // Using embedQuery for single doc convenience

        await this.collection.add({
            ids: [uuidv4()],
            embeddings: [embedding],
            metadatas: [metadata],
            documents: [text]
        });
        console.log(`[MemoryManager] Document added.`);
    }

    public async search(query: string, limit: number = 3): Promise<string[]> {
        if (!this.collection) await this.initialize();
        if (!this.collection) return [];

        console.log(`[MemoryManager] Searching for: "${query}"...`);
        const queryEmbedding = await this.embeddings.embedQuery(query);

        const results = await this.collection.query({
            queryEmbeddings: [queryEmbedding],
            nResults: limit
        });

        // Flatten results (Chroma returns array of arrays)
        const docs = results.documents?.[0];
        if (docs && docs.length > 0) {
            return docs.filter((doc): doc is string => doc !== null);
        }
        return [];
    }
}
