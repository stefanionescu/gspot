import type { z } from 'zod';
import type { RunCache } from '#cli/types/system.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { findText } from '#cli/system/files/reads.ts';
import { PYPROJECT_TOML } from '#cli/config/parsers/projects.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml/parse.ts';

/**
Read the pyproject.toml of a scope.

@returns undefined when the scope has no pyproject.toml.
*/
export function readPyproject(cache: RunCache, scopePath: string): Record<string, unknown> | undefined;

export function readPyproject<Value>(cache: RunCache, scopePath: string, schema: z.ZodType<Value>): Value | undefined;

export function readPyproject(cache: RunCache, scopePath: string, schema?: z.ZodType): unknown {
    const path = joinScope(scopePath, PYPROJECT_TOML);
    const text = findText(cache, path);
    if (text === undefined) return undefined;
    return schema === undefined ? parseTomlFile(path, text) : parseTomlFile(path, text, schema);
}
