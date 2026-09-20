import type { EngineInput } from '#types/run.ts';
// The checks that read supabase/config.toml: it parses, its functions exist, its buckets have policies, and migrations are named as the CLI names them.
import type { Finding } from '#types/finding.ts';
import { migrationsOf } from '#cli/checks/postgres/migrations.ts';
import { MIGRATION_NAME, SUPABASE_CONFIG } from '#config/supabase.ts';
import { functionFolders, readProject, supabaseFinding } from '#cli/checks/supabase/project.ts';

const AT_CONFIG = { file: SUPABASE_CONFIG, line: 1 };

/**
 * The project file parses, and every function it configures has a folder.
 * @param input the engine input
 * @returns the findings
 */
export function projectValid(input: EngineInput): Promise<Finding[]> {
    const config = readProject(input.root);
    if (config === undefined) return Promise.resolve([]);
    if (typeof config === 'string') return Promise.resolve([supabaseFinding(input, AT_CONFIG, 'parse', config)]);
    const folders = new Set(functionFolders(input).map((folder) => folder.slice(folder.lastIndexOf('/') + 1)));
    const missing = Object.keys(config.functions ?? {}).filter((name) => !folders.has(name));
    return Promise.resolve(
        missing.map((name) =>
            supabaseFinding(
                input,
                AT_CONFIG,
                'function',
                `[functions.${name}] configures a function that has no folder with an index file.`,
            ),
        ),
    );
}

/**
 * Every storage bucket of the project file has a policy on storage.objects that names it, in some migration.
 * @param input the engine input
 * @returns the findings
 */
export async function storagePolicies(input: EngineInput): Promise<Finding[]> {
    const config = readProject(input.root);
    if (config === undefined || typeof config === 'string') return [];
    const migrations = await migrationsOf(input);
    const policed = migrations
        .map((migration) => migration.text)
        .filter((text) => /policy/iu.test(text) && text.includes('storage.objects'));
    return Object.keys(config.storage?.buckets ?? {})
        .filter((bucket) => policed.every((text) => !text.includes(`'${bucket}'`)))
        .map((bucket) =>
            supabaseFinding(
                input,
                AT_CONFIG,
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
