import { basename } from 'node:path/posix';
import { FROZEN_ALL, FROZEN_NONE, MIGRATION_VERSION } from '#cli/config/parsers/code/sql/migrations.ts';

/**
 * Select migration paths at or below the written version.
 *
 * @param paths the migration files to filter.
 * @param through the written freeze version.
 * @returns the frozen paths.
 */
export function selectFrozenMigrations(paths: string[], through: string): Set<string> {
    if (through === FROZEN_NONE) return new Set();
    const cutoff = MIGRATION_VERSION.exec(through)?.groups?.['version'];
    return new Set(
        paths.filter((path) => {
            const version = MIGRATION_VERSION.exec(basename(path))?.groups?.['version'];
            return (
                through === FROZEN_ALL ||
                (version !== undefined && cutoff !== undefined && BigInt(version) <= BigInt(cutoff))
            );
        }),
    );
}
