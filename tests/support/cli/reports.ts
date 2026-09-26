// The shapes of the files gspot and the test fixtures write, as the tests that assert on them read them back.

/** The fields the tests read from the SARIF report gspot writes. */
export type SarifReport = {
    runs: {
        results: unknown[];
        invocations: { executionSuccessful: boolean; toolExecutionNotifications?: { message: { text: string } }[] }[];
        properties?: { comparison?: { reference: string }; canceled?: { pendingRefs: string[] } };
    }[];
};

/** The code quality report gspot writes: one issue per finding. */
export type CodeQualityReport = {
    description: string;
    check_name: string;
    fingerprint: string;
    severity: string;
    location: { path: string; lines: { begin: number } };
}[];

/** What a planted hook program records about the call it received. */
export type HookCapture = { args: string[]; input?: string; cwd?: string; hook?: string };
