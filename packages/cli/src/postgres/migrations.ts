// The migrations of a repository: where they live, their versions, and their parsed statements.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import type { EngineInput } from '#types/run.ts';
import { sqlFile } from '#cli/sql/statements.ts';
import type { Migration } from '#types/postgres.ts';
import { MIGRATION_FOLDERS, MIGRATION_VERSION } from '#config/postgres.ts';

function folderOf(input: EngineInput): string | undefined {
    const named = input.view.tool('postgres')['migrations_dir'] as string | undefined;
    if (named !== undefined && named !== '') return named.replace(/\/$/u, '');
    const paths = input.session.repository.files.map((file) => file.path);
    return MIGRATION_FOLDERS.find((folder) => paths.some((path) => path.startsWith(`${folder}/`)));
}

/**
 * Every tracked migration in version order, read and parsed.
 * @param input the engine input
 * @returns the migrations, empty when the repository has no migrations folder
 */
export async function migrationsOf(input: EngineInput): Promise<Migration[]> {
    const folder = folderOf(input);
    if (folder === undefined) return [];
    const paths = input.session.repository.files
        .map((file) => file.path)
        .filter((path) => path.startsWith(`${folder}/`) && path.endsWith('.sql'))
        .toSorted((left, right) => left.localeCompare(right));
    const migrations: Migration[] = [];
    for (const path of paths) {
        const text = readFileSync(join(input.root, path), 'utf8');
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
