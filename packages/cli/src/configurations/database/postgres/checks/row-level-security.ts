import { getPosition } from '#cli/system/text.ts';
import { getTable } from '#cli/settings/scopes.ts';
import type { Session } from '#cli/types/tools.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { ROW_SECURITY_RULE } from '#cli/config/configurations/infrastructure.ts';
import { buildDatabaseSchema } from '#cli/configurations/database/postgres/checks/schema.ts';
import { readParsedMigrations } from '#cli/configurations/database/postgres/checks/migrations.ts';

/**
Reports each table in a client schema with row security off.

@param session the repository and its tools.
@param planned the scope whose migrations to read.
*/
export async function checkRowLevelSecurity(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
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
