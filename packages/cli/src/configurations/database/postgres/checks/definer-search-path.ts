import { DEFINER_SEARCH_PATH_RULE, SECURITY_DEFINER_MESSAGE } from '#cli/config/configurations/postgres.ts';
import { readParsedMigrations } from '#cli/configurations/database/postgres/checks/migrations.ts';
import { buildDatabaseSchema } from '#cli/configurations/database/postgres/checks/schema.ts';
import { getPosition } from '#cli/system/text.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckFinding } from '#cli/types/engine/run.ts';
import type { Session } from '#cli/types/tools.ts';

async function checkDefinerSearchPath(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const { functions } = buildDatabaseSchema(await readParsedMigrations(session, planned));
    return functions
        .values()
        .filter(({ definer, path }) => definer && !path)
        .map(({ migration, statement }) => ({
            file: migration.path,
            ...getPosition(migration.text, statement.start),
            rule: DEFINER_SEARCH_PATH_RULE,
            message: SECURITY_DEFINER_MESSAGE,
        }))
        .toArray();
}

export const DEFINER_SEARCH_PATH_CHECKS: Readonly<Record<string, CheckCode>> = {
    'postgres/definer-search-path': { check: checkDefinerSearchPath },
};
