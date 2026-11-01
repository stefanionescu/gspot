import { getTable } from '#cli/settings/scopes.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/tools.ts';
import { FROZEN_NONE } from '#cli/config/parsers.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { selectFrozenMigrations } from '#cli/parsers/code/sql.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { FROZEN_RULE, FROZEN_THROUGH_NOTE, FROZEN_EDIT_MESSAGE } from '#cli/config/configurations/infrastructure.ts';

import {
    extractForwardText,
    readParsedMigrations,
    readCommittedMigrations,
} from '#cli/configurations/database/postgres/checks/migrations.ts';

/**
Reports each migration at or before postgres.frozen_through whose text differs from the committed text.

@param session the repository and its tools.
@param planned the scope whose migrations to compare with the last commit.
*/
export async function checkEditedMigrations(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const through = getTable(planned.scope.settings, 'postgres')['frozen_through'];
    if (through === FROZEN_NONE) throw new GspotError('skip', FROZEN_THROUGH_NOTE);
    const migrations = await readParsedMigrations(session, planned);
    const texts = await readCommittedMigrations(
        session,
        migrations.map((migration) => migration.path),
        planned.base ?? 'HEAD',
    );
    const frozen = selectFrozenMigrations(
        migrations.map((migration) => migration.path),
        through,
    );
    return migrations
        .filter((migration) => frozen.has(migration.path))
        .flatMap((migration): CheckFinding[] => {
            const committed = texts.get(migration.path);
            if (committed === undefined || extractForwardText(committed) === migration.text) return [];
            return [
                {
                    file: migration.path,
                    line: 1,
                    rule: FROZEN_RULE,
                    message: FROZEN_EDIT_MESSAGE,
                },
            ];
        });
}
