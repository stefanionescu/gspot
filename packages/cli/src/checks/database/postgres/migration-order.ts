import type { Session } from '#cli/types/session.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { compareMigrationVersions } from '#cli/parsers/code/sql.ts';
import { RULES, MISSING_VERSION_MESSAGE } from '#cli/config/checks/database/postgres.ts';
import { readMigrations, readCommittedMigrations } from '#cli/checks/database/postgres/migrations.ts';

/**
Reports a version that two files share, a file with no version, and a new file that sorts before a committed one.

@param session the repository and its tools.
@param planned the scope whose migrations to compare with the last commit.
*/
export async function checkMigrationOrder(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const { migrations, findings: syntax } = await readMigrations(session, planned);
    if (syntax.length > 0) return syntax;
    const findings: CheckFinding[] = [];
    const seen = new Map<string, string>();
    for (const migration of migrations) {
        if (migration.version === '')
            findings.push({
                file: migration.path,
                line: 1,
                rule: RULES.version,
                message: MISSING_VERSION_MESSAGE,
            });
        const earlier = seen.get(migration.version);
        if (earlier !== undefined && migration.version !== '')
            findings.push({
                file: migration.path,
                line: 1,
                rule: RULES.duplicateVersion,
                message: `${earlier} already has the version ${migration.version}.`,
            });
        seen.set(migration.version, migration.name);
    }
    const texts = await readCommittedMigrations(
        session,
        migrations.map((migration) => migration.path),
        planned.base ?? 'HEAD',
    );
    const committed = migrations.filter((migration) => texts.has(migration.path));
    const newest = committed.at(-1);
    if (newest === undefined) return findings;
    const late = migrations.filter(
        (migration) =>
            migration.version !== '' &&
            newest.version !== '' &&
            compareMigrationVersions(migration.version, newest.version) < 0 &&
            !texts.has(migration.path),
    );
    return [
        ...findings,
        ...late.map((migration) => ({
            file: migration.path,
            line: 1,
            rule: RULES.order,
            message: `A new migration sorts before ${newest.name}, which is already committed.`,
        })),
    ];
}
