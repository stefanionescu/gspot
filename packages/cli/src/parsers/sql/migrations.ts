// Reads migration versions and frozen migration paths.
import { basename } from 'node:path/posix';
import { FROZEN_ALL, FROZEN_NONE, MIGRATION_NUMBER, MIGRATION_VERSION } from '#cli/config/parsers/sql.ts';

/**
 * Select migration paths at or below the written version.
 *
 * @param paths the candidate migration files.
 * @param through the written freeze version.
 * @returns the frozen paths.
 */
export function selectFrozenMigrations(paths: string[], through: string): Set<string> {
    if (through === FROZEN_NONE) return new Set();
    return new Set(
        paths.filter((path) => {
            const version = MIGRATION_VERSION.exec(basename(path))?.groups?.['version'];
            return (
                through === FROZEN_ALL ||
                (version !== undefined && MIGRATION_NUMBER.test(through) && BigInt(version) <= BigInt(through))
            );
        }),
    );
}
