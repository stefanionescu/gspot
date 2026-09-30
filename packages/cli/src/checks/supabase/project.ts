import { z } from 'zod';
import { parse } from 'smol-toml';
import { statSync } from 'node:fs';
import { join, posix } from 'node:path';
import type { EngineInput } from '#cli/types/checks.ts';
import { readSource } from '#cli/repository/tracked.ts';
import { SHARED_PREFIX, SUPABASE_CONFIG, DEFAULT_FUNCTIONS } from '#cli/config/checks/platforms.ts';

const projectSchema = z.object({
    functions: z.record(z.string(), z.unknown()).optional(),
    storage: z.object({ buckets: z.record(z.string(), z.unknown()).optional() }).optional(),
});

/**
 * The parsed project file, or the text of the error when it does not parse, or undefined when the repository has none.
 * @param input the scoped repository read
 * @returns the config or the error
 */
export function readProject(input: EngineInput): z.infer<typeof projectSchema> | string | undefined {
    const local = posix.join(input.scope, SUPABASE_CONFIG);
    const path = join(input.root, local);
    if (statSync(path, { throwIfNoEntry: false }) === undefined) return undefined;
    const text = readSource(input.root, local, input.reads).toString('utf8');
    try {
        return projectSchema.parse(parse(text));
    } catch (error) {
        return error instanceof Error ? error.message : 'The file does not parse.';
    }
}

/**
 * The folders that hold one edge function each: every folder under the functions folder with an index file.
 * @param input the engine input
 * @returns the folder paths, repository-relative
 */
export function functionFolders(input: EngineInput): string[] {
    const named = input.view.tool('supabase')['functions_directory'];
    const base = posix.join(input.scope, typeof named === 'string' && named !== '' ? named : DEFAULT_FUNCTIONS);
    const folders = input.files
        .map((file) => file.path)
        .filter((path) => path.startsWith(`${base}/`) && /\/index\.tsx?$/u.test(path))
        .map((path) => path.slice(0, path.lastIndexOf('/')))
        .filter((folder) => folder.split('/').length === base.split('/').length + 1)
        .filter((folder) => !folder.slice(folder.lastIndexOf('/') + 1).startsWith(SHARED_PREFIX));
    return [...new Set(folders)];
}
