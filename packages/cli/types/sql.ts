// Types of the Postgres parser and what reads its tree.

/** The part of the Emscripten module the parser wrapper calls. */
export type PgModule = {
    lengthBytesUTF8: (text: string) => number;
    stringToUTF8: (text: string, pointer: number, size: number) => void;
    UTF8ToString: (pointer: number) => string;
    getValue: (pointer: number, kind: 'i32') => number;
    _malloc: (size: number) => number;
    _free: (pointer: number) => void;
    _wasm_parse_query_raw: (query: number) => number;
    _wasm_free_parse_result: (result: number) => void;
};

/** One node of the parse tree: a table of one key, the node kind, whose value holds the fields. */
export type SqlNode = Record<string, unknown>;

/** One statement of a file, with where it starts and how long it is, in bytes. */
export type SqlStatement = { stmt: SqlNode; stmt_location?: number; stmt_len?: number };

/** The parse tree of one file. */
export type SqlTree = { version: number; stmts?: SqlStatement[] };

/** The result of a parse: the tree, or the error. */
export type SqlParse =
    | { tree: SqlTree; error: undefined }
    | { tree: undefined; error: { text: string; offset: number } };

/** One statement as the checks read it: the node kind, its fields, and the index of its first keyword. */
export type SqlStatementView = { kind: string; fields: SqlNode; start: number };

/** A parsed file: the statements, or the error with its line and column. */
export type SqlFile = {
    statements: SqlStatementView[];
    error: { text: string; line: number; column: number } | undefined;
};

/** One name a statement declares, with its naming category. */
export type SqlNamed = { category: string; name: string };
