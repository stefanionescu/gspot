import { getPosition } from '#cli/system/text.ts';
import type { Session } from '#cli/types/tools.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { buildDatabaseSchema } from '#cli/configurations/database/postgres/checks/schema.ts';
import { readParsedMigrations } from '#cli/configurations/database/postgres/checks/migrations.ts';
import { SECURITY_DEFINER_MESSAGE, DEFINER_SEARCH_PATH_RULE } from '#cli/config/configurations/infrastructure.ts';

/**
Reports each SECURITY DEFINER function that sets no search_path.

@param session the repository and its tools.
@param planned the scope whose migrations to read.
*/
export async function checkDefinerSearchPath(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const message = SECURITY_DEFINER_MESSAGE;
    const { functions } = buildDatabaseSchema(await readParsedMigrations(session, planned));
    const looseDefiners = [...functions.values()].filter(({ definer, path }) => definer && !path);
    return looseDefiners.map(({ migration, statement }) => ({
        file: migration.path,
        ...getPosition(migration.text, statement.start),
        rule: DEFINER_SEARCH_PATH_RULE,
        message: message,
    }));
}
