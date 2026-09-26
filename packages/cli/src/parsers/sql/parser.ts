// The Postgres parser: libpg-query compiled to WASM, loaded from the bytes the binary embeds.

import { grammarPath } from '#cli/platform/assets.ts';
import createModule from 'libpg-query/wasm/libpg-query.js';
import type { PgModule, SqlParse, SqlTree } from '#cli/parsers/sql/types.ts';

const POINTER_BYTES = 4;
const ERROR_POSITION_OFFSET = 16;
const state: { module: Promise<PgModule> | undefined } = { module: undefined };

async function pgModule(): Promise<PgModule> {
    if (state.module !== undefined) return state.module;
    state.module = createModule({ locateFile: () => grammarPath('libpg-query.wasm') });
    return state.module;
}

function readResult(module: PgModule, result: number): SqlParse {
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

/**
 * Parses SQL text as Postgres reads it.
 * @param text the SQL
 * @returns the parse tree, or the error with the Unicode character offset it points at
 */
export async function parseSql(text: string): Promise<SqlParse> {
    const module = await pgModule();
    const size = module.lengthBytesUTF8(text) + 1;
    const query = module._malloc(size);
    module.stringToUTF8(text, query, size);
    const result = module._wasm_parse_query_raw(query);
    try {
        return readResult(module, result);
    } finally {
        module._free(query);
        module._wasm_free_parse_result(result);
    }
}

/**
 * Parse procedural bodies using the same embedded PostgreSQL parser as SQL statements.
 * @param text the PL/pgSQL body
 * @returns the parse tree as the parser reports it
 */
export async function parsePlpgsql(text: string): Promise<unknown> {
    const module = await pgModule();
    const size = module.lengthBytesUTF8(text) + 1;
    const query = module._malloc(size);
    module.stringToUTF8(text, query, size);
    const result = module._wasm_parse_plpgsql(query);
    try {
        const value = module.UTF8ToString(result);
        if (!value.startsWith('{')) throw new Error(value);
        return JSON.parse(value) as unknown;
    } finally {
        module._free(query);
        module._wasm_free_string(result);
    }
}
