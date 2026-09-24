import { readSource } from '#cli/repository/tracked.ts';
// The migrations of a repository: where they live, their versions, and their parsed statements.
import type { EngineInput } from '#cli/types/execution.ts';
import type { Migration } from '#cli/checks/postgres/types.ts';
import { scopeOf } from '#cli/repository/scopes.ts';
import { sqlFile } from '#cli/parsers/sql/statements.ts';


const observations = new WeakMap<object, Map<string, Promise<Migration[]>>>();

function folderOf(input: EngineInput, paths: string[]): string | undefined {
    const named = input.view.tool('postgres')['migrations_dir'];
    const prefix = input.scope === '' ? '' : `${input.scope}/`;
    if (typeof named === 'string' && named !== '') return `${prefix}${named.replace(/\/$/u, '')}`;
    return MIGRATION_FOLDERS.map((folder) => `${prefix}${folder}`).find((folder) =>
        paths.some((path) => path.startsWith(`${folder}/`)),
    );
}

async function readMigrations(root: string, paths: string[]): Promise<Migration[]> {
    const migrations: Migration[] = [];
    for (const path of paths) {
        const text = readSource(root, path).toString('utf8');
        const name = path.slice(path.lastIndexOf('/') + 1);
        const parsed = await sqlFile(text);
        if (parsed.error !== undefined)
            throw new Error(`SQL parse failed at ${parsed.error.line}:${parsed.error.column}: ${parsed.error.text}`);
        migrations.push({
            path,
            name,
            version: MIGRATION_VERSION.exec(name)?.groups?.['version'] ?? '',
            text,
            statements: parsed.statements,
        });
    }
    return migrations;
}

/**
 * Every tracked migration in version order, read and parsed.
 * @param input the engine input
 * @returns the migrations, empty when the repository has no migrations folder
 */
export async function migrationsOf(input: EngineInput): Promise<Migration[]> {
    const paths = input.files
        .filter((file) => scopeOf(file.path, input.scopeEntries).path === input.scope)
        .map((file) => file.path);
    const folder = folderOf(input, paths);
    if (folder === undefined) return [];
    let folders = observations.get(input.runKey);
    if (folders === undefined) {
        folders = new Map();
        observations.set(input.runKey, folders);
    }
    const key = JSON.stringify([folder, paths]);
    let migrations = folders.get(key);
    if (migrations === undefined) {
        migrations = readMigrations(
            input.root,
            paths
                .filter((path) => path.startsWith(`${folder}/`) && path.endsWith('.sql'))
                .toSorted((left, right) => left.localeCompare(right)),
        );
        folders.set(key, migrations);
    }
    return migrations;
}

const MIGRATION_FOLDERS = ['supabase/migrations', 'db/migrations', 'migrations'];

const MIGRATION_VERSION = /^(?<version>\d+)/u;
