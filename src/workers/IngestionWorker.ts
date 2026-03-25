import chokidar, { type FSWatcher } from 'chokidar';
import fs from 'fs';
import path from 'path';
// @ts-ignore
import pdfParse from 'pdf-parse'; 
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { LanceManager } from '../memory/LanceManager.js';

export class IngestionWorker {
    private watcher: FSWatcher | null = null;
    private memory: LanceManager;
    private watchDir: string;
    private textSplitter: RecursiveCharacterTextSplitter;

    constructor(memoryManager: LanceManager, watchDir: string = './knowledge_base') {
        this.memory = memoryManager;
        this.watchDir = watchDir;
        this.textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
    }

    public start() {
        if (!fs.existsSync(this.watchDir)) {
            fs.mkdirSync(this.watchDir, { recursive: true });
        }

        console.log(`[IngestionWorker] Watching directory: ${this.watchDir}`);
        
        this.watcher = chokidar.watch(this.watchDir, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true
        });

        this.watcher.on('add', async (filePath: string) => {
            console.log(`[IngestionWorker] File detected: ${filePath}`);
            await this.processFile(filePath);
        });
    }

    private async processFile(filePath: string) {
        try {
            const ext = path.extname(filePath).toLowerCase();
            let text = '';

            if (ext === '.pdf') {
                const dataBuffer = fs.readFileSync(filePath);
                const data = await pdfParse(dataBuffer);
                text = data.text;
            } else if (ext === '.md' || ext === '.txt') {
                text = fs.readFileSync(filePath, 'utf-8');
            } else {
                console.log(`[IngestionWorker] Skipping unsupported file type: ${ext}`);
                return;
            }

            if (!text.trim()) {
                console.log(`[IngestionWorker] File is empty: ${filePath}`);
                return;
            }

            // Split Text
            const chunks = await this.textSplitter.createDocuments([text]);
            console.log(`[IngestionWorker] Split ${filePath} into ${chunks.length} chunks. Ingesting to LanceDB...`);

            for (const chunk of chunks) {
                await this.memory.addMemory(chunk.pageContent, {
                    source: filePath,
                    type: 'document'
                });
            }
            console.log(`[IngestionWorker] Finished ingesting ${filePath}`);

        } catch (error: any) {
            console.error(`[IngestionWorker] Error processing file ${filePath}: ${error.message}`);
        }
    }
}
