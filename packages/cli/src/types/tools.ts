type ToolState = 'ok' | 'outdated' | 'newer' | 'missing' | 'host' | 'error';

export type ToolProbe = {
    name: string;
    state: ToolState;
    want?: string;
    found?: string;
    path?: string;
    hint?: string;
    note?: string;
    floor?: string;
};

export type ToolContext = {
    root: string;
    cwd?: string;
    probes: Map<string, ToolProbe>;
    policyFiles?: import('#cli/types/policy.ts').PolicyFiles;
};
