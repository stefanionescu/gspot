import { posix } from 'node:path';
import { memo } from '#cli/platform/memo.ts';
import { readSource } from '#cli/platform/source.ts';
import { parseSqlFile } from '#cli/parsers/sql/statements.ts';
import { MIGRATION_VERSION } from '#cli/config/parsers/sql.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import type { Migration } from '#cli/types/checks/database/postgres.ts';
import { MIGRATION_DOWN, MIGRATION_FOLDERS } from '#cli/config/checks/database/postgres.ts';

const MIGRATION_MEMO = { create: () => new Map<string, Promise<Migration[]>>() };

function folderOf(input: CheckInput, paths: string[]): string | undefined {
    const setting = input.view.options('postgres')['migrations_folder'];
    const prefix = input.scope === '' ? '' : `${input.scope}/`;
    if (setting !== '') return `${prefix}${setting.replace(/\/$/u, '')}`;
    return MIGRATION_FOLDERS.map((folder) => `${prefix}${folder}`).find((folder) =>
        paths.some((path) => path.startsWith(`${folder}/`)),
    );
}

async function readMigrations(input: CheckInput, paths: string[]): Promise<Migration[]> {
    const migrations: Migration[] = [];
    for (const path of paths) {
        const original = readSource(input.root, path, input.reads).toString('utf8');
        const text = original.split(MIGRATION_DOWN, 1)[0] ?? '';
        const name = posix.basename(path);
        const parsed = await parseSqlFile(text, input.reads);
        if (parsed.error !== undefined)
            throw new Error(
                `${path}:${String(parsed.error.line)}:${String(parsed.error.column)}: the SQL does not parse: ${parsed.error.text}`,
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
 * Select tracked migration files without parsing their SQL.
 * @param input the selected scope and repository inventory
 * @returns the repository-relative migration paths
 */
export function migrationPaths(input: CheckInput): string[] {
    const paths = input.files.map((file) => file.path);
    const folder = folderOf(input, paths);
    return folder === undefined
        ? []
        : paths.filter((path) => path.startsWith(`${folder}/`) && path.endsWith('.sql') && !path.endsWith('.down.sql'));
}

/**
 * Reads and parses every tracked migration in version order.
 * @param input the check input
 * @returns the migrations, empty when the repository has no migrations folder
 */
export async function migrationsOf(input: CheckInput): Promise<Migration[]> {
    const paths = migrationPaths(input);
    if (paths.length === 0) return [];
    const folders = memo(input.reads, MIGRATION_MEMO);
    const key = JSON.stringify(paths);
    let migrations = folders.get(key);
    if (migrations === undefined) {
        migrations = readMigrations(
            input,
            paths
                .map((path) => ({
                    path,
                    version: BigInt(MIGRATION_VERSION.exec(posix.basename(path))?.groups?.['version'] ?? '0'),
                }))
                .toSorted((left, right) => {
                    if (left.version === right.version) return left.path.localeCompare(right.path);
                    return left.version < right.version ? -1 : 1;
                })
                .map((entry) => entry.path),
        );
        folders.set(key, migrations);
    }
    return migrations;
}
