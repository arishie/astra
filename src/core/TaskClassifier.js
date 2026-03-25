export var TaskTier;
(function (TaskTier) {
    TaskTier[TaskTier["SIMPLE"] = 1] = "SIMPLE";
    TaskTier[TaskTier["STANDARD"] = 2] = "STANDARD";
    TaskTier[TaskTier["COMPLEX"] = 3] = "COMPLEX";
})(TaskTier || (TaskTier = {}));
export class TaskClassifier {
    /**
     * heuristic-based classification for speed and privacy.
     * In a production system, this could be a small BERT model or a call to a very cheap LLM.
     */
    static classify(query) {
        const lower = query.toLowerCase();
        // Tier 3: Architecture, Security, Planning, Auditing, "Deep", "Multi-step"
        if (lower.includes("architect") ||
            lower.includes("audit") ||
            lower.includes("security analysis") ||
            lower.includes("plan a") ||
            lower.includes("strategy") ||
            lower.includes("debug this complex") ||
            lower.length > 500 // Long context implies complexity
        ) {
            return TaskTier.COMPLEX;
        }
        // Tier 2: Coding, Explanation, Generation, Refactoring
        if (lower.includes("code") ||
            lower.includes("function") ||
            lower.includes("script") ||
            lower.includes("refactor") ||
            lower.includes("explain") ||
            lower.includes("generate") ||
            lower.includes("write a")) {
            return TaskTier.STANDARD;
        }
        // Tier 1: Chat, Summary, Fact retrieval
        return TaskTier.SIMPLE;
    }
}
//# sourceMappingURL=TaskClassifier.js.map