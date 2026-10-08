/** Independent clean and leaked commits whose final trees contain no test files. */
export type SecretHistory = { base: string; tree: string; good: string; leaked: string; removed: string };

/** A local provider that verifies test tokens and records requests. */
export type SecretVerifier = AsyncDisposable & {
    firstToken: string;
    secondToken: string;
    requests: unknown[];
    modeFile: string;
};
