import { join } from 'node:path';
import type { CheckSession } from '#cli/types/session.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { type CheckFinding } from '#cli/types/runs/check.ts';
import { getConfigPath } from '#cli/runs/command/placeholders.ts';
import { runCopiedTool } from '#cli/checks/language/swift/build.ts';
import { prepareBuild, readRepositoryCacheFolder } from '#cli/checks/language/swift/cache.ts';

import {
    UNUSED_RULE,
    PERIPHERY_TOOL,
    PERIPHERY_COMMAND,
    ROOT_BUILD_FOLDER,
    SWIFT_BUILD_FOLDER,
    BUILD_SOURCE_FOLDER,
    SCOPE_FOLDER_PREFIX,
} from '#cli/config/checks/language/swift.ts';

/**
Runs Periphery over the project and reports every declaration nothing uses.

@param session the repository and its tools.
@param planned the scope to scan.
*/
export async function checkPeriphery(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const folder = join(
        readRepositoryCacheFolder(session.toolsRoot),
        SWIFT_BUILD_FOLDER,
        planned.scope.path === ''
            ? ROOT_BUILD_FOLDER
            : `${SCOPE_FOLDER_PREFIX}${Buffer.from(planned.scope.path).toString('hex')}`,
        'periphery',
    );
    const config = join(session.root, getConfigPath(session, planned, PERIPHERY_TOOL));
    const commandArguments = [...PERIPHERY_COMMAND, config];
    const { files } = prepareBuild(session.root, planned.files, folder);
    return await runCopiedTool(session, planned, {
        source: files.readCanonicalPath(BUILD_SOURCE_FOLDER),
        commandArguments,
        defaultRule: UNUSED_RULE,
        tool: 'periphery',
    });
}
