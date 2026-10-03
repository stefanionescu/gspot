import { z } from 'zod';
import { parse } from 'smol-toml';
import { statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { findingAt } from '#cli/execution/finding.ts';
import { readSource } from '#cli/repository/sources.ts';
import { migrationsOf } from '#cli/checks/database/postgres/migrations.ts';
import type { Finding, EngineInput } from '#cli/types/execution/execution.ts';

import {
    SHARED_PREFIX,
    MIGRATION_NAME,
    SUPABASE_CONFIG,
    FUNCTIONS_DIRECTORY,
} from '#cli/config/checks/platform/supabase.ts';

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
    const base = posix.join(input.scope, typeof named === 'string' && named !== '' ? named : FUNCTIONS_DIRECTORY);
    const folders = input.files
        .map((file) => file.path)
        .filter((path) => path.startsWith(`${base}/`) && /\/index\.tsx?$/u.test(path))
        .map((path) => path.slice(0, path.lastIndexOf('/')))
        .filter((folder) => folder.split('/').length === base.split('/').length + 1)
        .filter((folder) => !posix.basename(folder).startsWith(SHARED_PREFIX));
    return [...new Set(folders)];
}

/**
 * The project file parses, and every function it configures has a folder.
 * @param input the engine input
 * @returns the findings
 */
export function projectValid(input: EngineInput): Finding[] {
    const config = readProject(input);
    const at = { file: posix.join(input.scope, SUPABASE_CONFIG), line: 1 };
    if (config === undefined) return [];
    if (typeof config === 'string') return [findingAt(input, at, 'syntax', config)];
    const folders = new Set(functionFolders(input).map((folder) => posix.basename(folder)));
    const missing = Object.keys(config.functions ?? {}).filter((name) => !folders.has(name));
    return missing.map((name) =>
        findingAt(
            input,
            at,
            'function',
            `[functions.${name}] configures a function that has no folder with an index file.`,
        ),
    );
}

/**
 * Every storage bucket of the project file has a policy on storage.objects that names it, in some migration.
 * @param input the engine input
 * @returns the findings
 */
export async function storagePolicies(input: EngineInput): Promise<Finding[]> {
    const config = readProject(input);
    const at = { file: posix.join(input.scope, SUPABASE_CONFIG), line: 1 };
    if (config === undefined) return [];
    if (typeof config === 'string') throw new Error(`Cannot inspect storage policies: ${config}`);
    const migrations = await migrationsOf(input);
    const policed = migrations
        .map((migration) => migration.text)
        .filter((text) => /policy/iu.test(text) && text.includes('storage.objects'));
    return Object.keys(config.storage?.buckets ?? {})
        .filter((bucket) => policed.every((text) => !text.includes(`'${bucket}'`)))
        .map((bucket) =>
            findingAt(
                input,
                at,
                'bucket-policy',
                `The bucket ${bucket} has no policy on storage.objects in any migration.`,
            ),
        );
}

/**
 * Every migration is named the way the Supabase CLI names one.
 * @param input the engine input
 * @returns the findings
 */
export async function migrationNames(input: EngineInput): Promise<Finding[]> {
    const migrations = await migrationsOf(input);
    return migrations
        .filter((migration) => !MIGRATION_NAME.test(migration.name))
        .map((migration) =>
            findingAt(
                input,
                { file: migration.path, line: 1 },
                'migration-name',
                'The name is fourteen digits, an underscore, and snake case words, ending in .sql.',
            ),
        );
}
