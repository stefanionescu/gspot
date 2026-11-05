import { DEFINER_SEARCH_PATH_RULE, SECURITY_DEFINER_MESSAGE } from '#cli/config/configurations/infrastructure.ts';
import { readParsedMigrations } from '#cli/configurations/database/postgres/checks/migrations.ts';
import { buildDatabaseSchema } from '#cli/configurations/database/postgres/checks/schema.ts';
import { getPosition } from '#cli/system/text.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode } from '#cli/types/engine/run.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import type { Session } from '#cli/types/tools.ts';

/**
Reports each SECURITY DEFINER function that sets no search_path.

@param session the repository and its tools.
@param planned the scope whose migrations to read.
*/
async function checkDefinerSearchPath(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const message = SECURITY_DEFINER_MESSAGE;
    const { functions } = buildDatabaseSchema(await readParsedMigrations(session, planned));
    const looseDefiners = functions
        .values()
        .filter(({ definer, path }) => definer && !path)
        .toArray();
    return looseDefiners.map(({ migration, statement }) => ({
        file: migration.path,
        ...getPosition(migration.text, statement.start),
        rule: DEFINER_SEARCH_PATH_RULE,
        message: message,
    }));
}

export const DEFINER_SEARCH_PATH_CHECKS: Readonly<Record<string, CheckCode>> = {
    'postgres/definer-search-path': { check: checkDefinerSearchPath },
};
