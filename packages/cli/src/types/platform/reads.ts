/** A stable producer binds a run-owned memo entry to its value type. */
export type MemoKey<Value extends object> = Readonly<{ create: () => Value }>;

/** Source bytes and derived values owned by one execution run. */
export type ReadCache = {
    root: string;
    sources: Map<string, Buffer>;
    memo: Map<MemoKey<object>, object>;
};
