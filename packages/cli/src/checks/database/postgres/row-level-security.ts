import { getPosition } from '#cli/system/text.ts';
import { getTable } from '#cli/settings/scopes.ts';
import type { Session } from '#cli/types/session.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { buildDatabaseSchema } from '#cli/checks/database/postgres/schema.ts';
import { readParsedMigrations } from '#cli/checks/database/postgres/migrations.ts';
import { ROW_SECURITY_RULE } from '#cli/config/checks/database/postgres/row-level-security.ts';

/**
Reports each table in a client schema with row security off.

@param session the repository and its tools.
@param planned the scope whose migrations to read.
*/
export async function checkPostgresRowLevelSecurity(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const migrations = await readParsedMigrations(session, planned);
    const schema = buildDatabaseSchema(migrations);
    const schemas = new Set(getTable(planned.scope.settings, 'postgres')['client_schemas']);
    return schema.tables
        .entries()
        .filter(([table]) => schemas.has(table.slice(0, table.indexOf('.'))) && !schema.secured.has(table))
        .map(([table, at]) => ({
            file: at.path,
            ...getPosition(at.text, at.offset),
            rule: ROW_SECURITY_RULE,
            message: `${table} does not have row level security enabled.`,
        }))
        .toArray();
}
