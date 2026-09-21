// The migrations of a repository: where they live, their versions, and their parsed statements.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import type { EngineInput, Session } from '#types/run.ts';
import type { Migration } from '#types/postgres.ts';
import { scopeOf } from '#cli/repository/scopes.ts';
import { sqlFile } from '#cli/readers/sql/statements.ts';
import { MIGRATION_FOLDERS, MIGRATION_VERSION } from '#config/postgres.ts';

const observations = new WeakMap<Session, Map<string, Promise<Migration[]>>>();

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
        const text = readFileSync(join(root, path), 'utf8');
        const name = path.slice(path.lastIndexOf('/') + 1);
        const parsed = await sqlFile(text);
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
    const paths = input.session.repository.files
        .filter((file) => scopeOf(file.path, input.session.repository.scopes).path === input.scope)
        .map((file) => file.path);
    const folder = folderOf(input, paths);
    if (folder === undefined) return [];
    let folders = observations.get(input.session);
    if (folders === undefined) {
        folders = new Map();
        observations.set(input.session, folders);
    }
    let migrations = folders.get(folder);
    if (migrations === undefined) {
        migrations = readMigrations(
            input.root,
            paths
                .filter((path) => path.startsWith(`${folder}/`) && path.endsWith('.sql'))
                .toSorted((left, right) => left.localeCompare(right)),
        );
        folders.set(folder, migrations);
    }
    return migrations;
}
