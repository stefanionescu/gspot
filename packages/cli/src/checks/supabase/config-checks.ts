import { posix } from 'node:path';
import type { EngineInput } from '#cli/run/types.ts';
// The checks that read supabase/config.toml: it parses, its functions exist, its buckets have policies, and migrations are named as the CLI names them.
import type { Finding } from '#cli/output/finding.ts';
import { migrationsOf } from '#cli/checks/postgres/migrations.ts';
import { MIGRATION_NAME, SUPABASE_CONFIG } from '#cli/checks/supabase/supabase-definitions.ts';
import { functionFolders, readProject, supabaseFinding } from '#cli/checks/supabase/project.ts';

/**
 * The project file parses, and every function it configures has a folder.
 * @param input the engine input
 * @returns the findings
 */
export function projectValid(input: EngineInput): Finding[] {
    const config = readProject(input.scopeRoot);
    const at = { file: posix.join(input.scope, SUPABASE_CONFIG), line: 1 };
    if (config === undefined) return [];
    if (typeof config === 'string') return [supabaseFinding(input, at, 'parse', config)];
    const folders = new Set(functionFolders(input).map((folder) => folder.slice(folder.lastIndexOf('/') + 1)));
    const missing = Object.keys(config.functions ?? {}).filter((name) => !folders.has(name));
    return missing.map((name) =>
        supabaseFinding(
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
    const config = readProject(input.scopeRoot);
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
            supabaseFinding(
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
            supabaseFinding(
                input,
                { file: migration.path, line: 1 },
                'migration-name',
                'The name is fourteen digits, an underscore, and snake case words, ending in .sql.',
            ),
        );
}
