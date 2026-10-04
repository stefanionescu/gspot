// The Postgres parser: libpg-query compiled to WebAssembly, loaded from the package.
import { wasmPath } from '#cli/platform/assets.ts';
import createModule from 'libpg-query/wasm/libpg-query.js';
import { POINTER_BYTES, ERROR_POSITION_OFFSET } from '#cli/config/parsers/sql.ts';
import type { PgCall, SqlNode, SqlTree, PgModule, SqlParse, PgRuntime } from '#cli/types/parsers/sql.ts';

const state: PgRuntime = { module: undefined };

async function pgModule(): Promise<PgModule> {
    if (state.module !== undefined) return state.module;
    state.module = createModule({ locateFile: () => wasmPath('libpg-query.wasm') });
    return state.module;
}

function readParse(module: PgModule, result: number): SqlParse {
    const treeAt = module.getValue(result, 'i32');
    const errorAt = module.getValue(result + POINTER_BYTES + POINTER_BYTES, 'i32');
    if (errorAt !== 0) {
        const textAt = module.getValue(errorAt, 'i32');
        const position = module.getValue(errorAt + ERROR_POSITION_OFFSET, 'i32');
        return {
            tree: undefined,
            error: {
                text: textAt === 0 ? 'The statement does not parse.' : module.UTF8ToString(textAt),
                offset: Math.max(position - 1, 0),
            },
        };
    }
    return { tree: JSON.parse(module.UTF8ToString(treeAt)) as SqlTree, error: undefined };
}

// Keep the allocated UTF-8 input alive for either parser and release it even when the native call fails.
function useCString<Result>(module: PgModule, text: string, call: PgCall<Result>): Result {
    const size = module.lengthBytesUTF8(text) + 1;
    const query = module._malloc(size);
    try {
        module.stringToUTF8(text, query, size);
        return call(query);
    } finally {
        module._free(query);
    }
}

/**
 * Parses SQL text as Postgres reads it.
 * @param text the SQL
 * @returns the parse tree, or the error with the Unicode character offset it points at
 */
export async function parse(text: string): Promise<SqlParse> {
    const module = await pgModule();
    return useCString(module, text, (query) => {
        const result = module._wasm_parse_query_raw(query);
        try {
            return readParse(module, result);
        } finally {
            module._wasm_free_parse_result(result);
        }
    });
}

/**
 * Parse procedural bodies using the same PostgreSQL parser as SQL statements.
 * @param text the PL/pgSQL body
 * @returns the parse tree as the parser reports it
 */
export async function parsePlpgsql(text: string): Promise<unknown> {
    const module = await pgModule();
    return useCString(module, text, (query) => {
        const result = module._wasm_parse_plpgsql(query);
        try {
            const value = module.UTF8ToString(result);
            if (!value.startsWith('{')) throw new Error(value);
            return JSON.parse(value) as unknown;
        } finally {
            module._wasm_free_string(result);
        }
    });
}

/**
 * The nodes of one kind in a list field. Every item of a list is a table of one key, the node kind.
 * @param list the field, a list or nothing
 * @param kind the node kind wanted
 * @returns the fields of each node of that kind
 */
export function nodesOf(list: unknown, kind: string): SqlNode[] {
    const items = Array.isArray(list) ? (list as SqlNode[]) : [];
    return items.flatMap((item) => (item[kind] === undefined ? [] : [item[kind] as SqlNode]));
}

/**
 * The text of a field, or an empty string when the field holds something else.
 * @param field the field
 * @returns the text
 */
export function textOf(field: unknown): string {
    return typeof field === 'string' ? field : '';
}

/**
 * The texts of a list of String nodes, such as a qualified name.
 * @param list the field
 * @returns each part
 */
export function partsOf(list: unknown): string[] {
    return nodesOf(list, 'String').map((node) => textOf(node['sval']));
}
