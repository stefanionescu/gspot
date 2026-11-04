import { join } from 'node:path';
import { CheckStop } from '#cli/system/errors.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { getConfigPath } from '#cli/engine/tool-runs/placeholders.ts';
import { type CheckCode, type CheckSession } from '#cli/types/engine/run.ts';
import { planSwiftBuild } from '#cli/configurations/language/swift/checks/cache.ts';
import { runCopiedTool, runSwiftBuild } from '#cli/configurations/language/swift/checks/build.ts';

import {
    UNUSED_RULE,
    PERIPHERY_TOOL,
    FAILED_BUILD_NOTE,
    PERIPHERY_COMMAND,
    BUILD_SOURCE_FOLDER,
    PERIPHERY_INDEX_STORE_FLAG,
} from '#cli/config/configurations/builds.ts';

/**
Runs Periphery over the project and reports every declaration nothing uses.

@param session the repository and its tools.
@param planned the scope to scan.
*/
async function checkPeriphery(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const plan = planSwiftBuild(session, planned);
    const { code, files } = await runSwiftBuild(session, planned, plan, { clean: false });
    if (code !== 0) throw new CheckStop('skipped', FAILED_BUILD_NOTE);
    const config = join(session.root, getConfigPath(session, planned, PERIPHERY_TOOL));
    return await runCopiedTool(session, planned, {
        source: files.readCanonicalPath(BUILD_SOURCE_FOLDER),
        commandArguments: [...PERIPHERY_COMMAND, config, PERIPHERY_INDEX_STORE_FLAG, plan.store],
        defaultRule: UNUSED_RULE,
        tool: 'periphery',
    });
}

export const SWIFT_PERIPHERY_CHECKS: Readonly<Record<string, CheckCode>> = {
    'swift/periphery': { check: checkPeriphery },
};
