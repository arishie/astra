export declare enum TaskTier {
    SIMPLE = 1,
    STANDARD = 2,
    COMPLEX = 3
}
export declare class TaskClassifier {
    /**
     * heuristic-based classification for speed and privacy.
     * In a production system, this could be a small BERT model or a call to a very cheap LLM.
     */
    static classify(query: string): TaskTier;
}
//# sourceMappingURL=TaskClassifier.d.ts.map