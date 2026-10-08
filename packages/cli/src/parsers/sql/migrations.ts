import { basename } from 'node:path/posix';
import { FROZEN_ALL, FROZEN_NONE, MIGRATION_VERSION } from '#cli/config/parsers/sql.ts';

/**
 * Select migration paths at or below the authored version.
 * @param paths the candidate migration paths
 * @param through the authored freeze boundary
 * @returns the frozen paths
 */
export function frozenMigrationPaths(paths: string[], through: string): Set<string> {
    if (through === FROZEN_NONE) return new Set();
    return new Set(
        paths.filter((path) => {
            const version = MIGRATION_VERSION.exec(basename(path))?.groups?.['version'];
            return (
                through === FROZEN_ALL ||
                (version !== undefined && /^\d+$/u.test(through) && BigInt(version) <= BigInt(through))
            );
        }),
    );
}
