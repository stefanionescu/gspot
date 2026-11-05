import { MIGRATION_RULES, MISSING_VERSION_MESSAGE } from '#cli/config/configurations/infrastructure.ts';
import { readCommittedMigrations, readMigrations } from '#cli/configurations/database/postgres/checks/migrations.ts';
import { MIGRATION_ORDER_EXPLANATIONS } from '#cli/configurations/database/postgres/explanations.ts';
import { compareMigrationVersions } from '#cli/parsers/code/sql.ts';
import type { Migration } from '#cli/types/configurations/infrastructure.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { type CheckCode, type CheckSession } from '#cli/types/engine/run.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';

function listVersionFindings(migrations: Migration[]): CheckFinding[] {
    const findings: CheckFinding[] = [];
    const seen = new Map<string, string>();
    for (const migration of migrations) {
        if (migration.version === '')
            findings.push({
                file: migration.path,
                line: 1,
                rule: MIGRATION_RULES.version,
                message: MISSING_VERSION_MESSAGE,
            });
        const earlier = seen.get(migration.version);
        if (earlier !== undefined && migration.version !== '')
            findings.push({
                file: migration.path,
                line: 1,
                rule: MIGRATION_RULES.duplicateVersion,
                message: `${earlier} already has the version ${migration.version}.`,
            });
        seen.set(migration.version, migration.name);
    }
    return findings;
}

/**
Reports a version that two files share, a file with no version, and a new file that sorts before a committed one.

@param session the repository and its tools.
@param planned the scope whose migrations to compare with the last commit.
*/
async function checkMigrationOrder(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const { migrations, findings: syntax } = await readMigrations(session, planned);
    if (syntax.length > 0) return syntax;
    const findings = listVersionFindings(migrations);
    const texts = await readCommittedMigrations(
        session,
        migrations.map((migration) => migration.path),
        session.selection?.base ?? 'HEAD',
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
            rule: MIGRATION_RULES.order,
            message: `A new migration sorts before ${newest.name}, which is already committed.`,
        })),
    ];
}

export const POSTGRES_MIGRATION_ORDER_CHECKS: Readonly<Record<string, CheckCode>> = {
    'postgres/migration-order': { check: checkMigrationOrder, explanations: MIGRATION_ORDER_EXPLANATIONS },
};
