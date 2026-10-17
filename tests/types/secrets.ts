/** Independent clean and leaked commits whose final trees contain no test files. */
export type SecretHistory = { base: string; tree: string; good: string; leaked: string; removed: string };

/** A local provider that verifies test tokens and records requests. */
export type SecretVerifier = AsyncDisposable & {
    firstToken: string;
    secondToken: string;
    requests: unknown[];
};

/** Commit hashes for the history reports and the exact fingerprint ignores. */
export type GitleaksHistory = { base: string; leaked: string; removed: string };
