import { posix } from 'node:path';

import { NESTED_AGENTS_MESSAGE, NESTED_AGENTS_RULE } from '#cli/config/configurations/general.ts';
import { AGENTS_FILE } from '#cli/config/repository/setup.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode } from '#cli/types/engine/run.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import type { Session } from '#cli/types/tools.ts';

/**
Reports each tracked AGENTS.md outside the repository root.

@param session the repository and its tools.
@param _planned the configured check.
*/
function checkNestedAgentsFiles(session: Session, _planned: PlannedCheck): CheckFinding[] {
    return session.repository.files
        .filter(({ path }) => path !== AGENTS_FILE && posix.basename(path) === AGENTS_FILE)
        .map(({ path }) => ({ file: path, line: 1, rule: NESTED_AGENTS_RULE, message: NESTED_AGENTS_MESSAGE }));
}

export const ENGINEERING_CHECKS: Readonly<Record<string, CheckCode>> = {
    'engineering/nested-agents-files': { check: checkNestedAgentsFiles },
};
