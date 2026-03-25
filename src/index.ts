import { AstraOrchestrator } from './core/AstraOrchestrator.js';

const astra = new AstraOrchestrator();

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log("Shutting down Astra...");
    process.exit(0);
});

astra.start().catch(err => {
    console.error("Fatal Error:", err);
});
