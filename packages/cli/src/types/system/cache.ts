export type RunCache = {
    root: string;
    sources: Map<string, Buffer>;
    values: Map<symbol, Map<unknown, unknown>>;
};
