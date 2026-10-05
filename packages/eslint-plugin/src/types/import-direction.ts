export type ImportDirectionRoles = {
    types?: string[];
    tests?: string[];
    harness?: string[];
    config?: string[];
    env?: string[];
    runtime?: string[];
};

export type ImportDirectionRole = 'types' | 'tests' | 'harness' | 'config' | 'env' | 'runtime' | 'other';

/** A resolved import path and its configured architecture role. */
export type ImportLocation = { path: string; role: ImportDirectionRole };

export type ImportDirectionMessages = 'typesToRuntime' | 'runtimeToTests' | 'testsToInternals' | 'configToRuntime';

export type ImportEdge = {
    role: ImportDirectionRole;
    targetRole: ImportDirectionRole;
    source: string;
    target: string;
    isTypeOnly: boolean;
};

export type ImportVerdict = { messageId: ImportDirectionMessages; data: Record<string, string> };

export type ImportDirectionOptions = [
    { roles?: ImportDirectionRoles; aliases?: Record<string, string>; scope?: string },
];
