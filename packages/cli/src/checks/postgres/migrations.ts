import { scopeOf } from '#cli/repository/scopes.ts';
import { readSource } from '#cli/repository/tracked.ts';
import { sqlFile } from '#cli/parsers/sql/statements.ts';
import type { EngineInput } from '#cli/types/checks/checks.ts';
import type { Migration } from '#cli/types/checks/postgres.ts';
import { MIGRATION_FOLDERS, MIGRATION_VERSION } from '#cli/constants/checks/postgres.ts';

const observations = new WeakMap<object, Map<string, Promise<Migration[]>>>();

function folderOf(input: EngineInput, paths: string[]): string | undefined {
    const named = input.view.tool('postgres')['migrations_directory'];
    const prefix = input.scope === '' ? '' : `${input.scope}/`;
    if (typeof named === 'string' && named !== '') return `${prefix}${named.replace(/\/$/u, '')}`;
    return MIGRATION_FOLDERS.map((folder) => `${prefix}${folder}`).find((folder) =>
        paths.some((path) => path.startsWith(`${folder}/`)),
    );
}

async function readMigrations(input: EngineInput, paths: string[]): Promise<Migration[]> {
    const migrations: Migration[] = [];
    for (const path of paths) {
        const text = readSource(input.root, path, input.observations).toString('utf8');
        const name = path.slice(path.lastIndexOf('/') + 1);
        const parsed = await sqlFile(text, input.observations);
        if (parsed.error !== undefined)
            throw new Error(
                `SQL parse failed at ${String(parsed.error.line)}:${String(parsed.error.column)}: ${parsed.error.text}`,
            );
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
    let folders = observations.get(input.observations);
    if (folders === undefined) {
        folders = new Map();
        observations.set(input.observations, folders);
    }
    const key = JSON.stringify([folder, paths]);
    let migrations = folders.get(key);
    if (migrations === undefined) {
        migrations = readMigrations(
            input,
            paths
                .filter((path) => path.startsWith(`${folder}/`) && path.endsWith('.sql'))
                .toSorted((left, right) => left.localeCompare(right)),
        );
        folders.set(key, migrations);
    }
    return migrations;
}
