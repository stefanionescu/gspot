import { z } from 'zod';
import { parse } from 'smol-toml';
import { statSync } from 'node:fs';
// The Supabase project: its config file, its function folders and its finding shape.
import { join, posix } from 'node:path';
import type { Finding } from '#cli/output/schema.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import { readSource } from '#cli/repository/tracked.ts';

const projectSchema = z.object({
    functions: z.record(z.string(), z.unknown()).optional(),
    storage: z.object({ buckets: z.record(z.string(), z.unknown()).optional() }).optional(),
});

const DEFAULT_FUNCTIONS = 'supabase/functions';
const SHARED_PREFIX = '_';

/**
 * The parsed project file, or the text of the error when it does not parse, or undefined when the repository has none.
 * @param input the scoped repository observation
 * @returns the config or the error
 */
export function readProject(input: EngineInput): z.infer<typeof projectSchema> | string | undefined {
    const local = posix.join(input.scope, SUPABASE_CONFIG);
    const path = join(input.root, local);
    if (!(statSync(path, { throwIfNoEntry: false }) !== undefined)) return undefined;
    const text = readSource(input.root, local, input.observations).toString('utf8');
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

/**
 * One finding of a supabase check.
 * @param input the engine input
 * @param at the file and the line
 * @param at.file the file
 * @param at.line the line
 * @param rule the rule
 * @param text the message
 * @returns the finding
 */
export function supabaseFinding(
    input: EngineInput,
    at: { file: string; line: number },
    rule: string,
    text: string,
): Finding {
    return { check: input.spec.name, file: at.file, line: at.line, rule, message: text, fixable: false };
}

export const SUPABASE_CONFIG = 'supabase/config.toml';
