import { join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { getTool } from '#cli/configurations/tools.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { createCheckCopy } from '#cli/runs/copy/files.ts';
import type { CheckSession } from '#cli/types/session.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { type CheckResult } from '#cli/types/runs/check.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { listChecksById } from '#cli/configurations/manifests.ts';
import { TYPESCRIPT_TAG } from '#cli/config/checks/tsc/compiler.ts';
import type { ConfigurationCheck } from '#cli/types/configurations.ts';
import { readTsconfigProject } from '#cli/parsers/projects/tsconfig.ts';
import { runTsc, restoreCommandPaths } from '#cli/checks/tsc/compiler.ts';

import {
    TSC_TOOL,
    CAUSE_MARKS,
    SHOWN_LINES,
    MARKED_LINES,
    CI_ENVIRONMENT,
    TYPESCRIPT_TSC_CHECK,
    NEXT_TYPEGEN_COMMAND,
} from '#cli/config/checks/framework/nextjs.ts';

function formatNextjsFailure(text: string): string {
    const lines = stripVTControlCharacters(text).trim().split('\n');
    const marked = lines.findIndex((line) => CAUSE_MARKS.some((mark) => line.includes(mark)));
    const shown = marked === -1 ? lines.slice(-SHOWN_LINES) : lines.slice(marked, marked + MARKED_LINES);
    return shown.join(' ').trim();
}

/**
Generates Next.js route types and runs the TypeScript check in the same copy.

@param session the repository and its tools.
@param planned the Next.js compiler check.
@returns the compiler findings and status.
*/
export async function checkNextjsTsc(session: CheckSession, planned: PlannedCheck): Promise<CheckResult> {
    const started = performance.now();
    using scratchFolder = await createCheckCopy(session, planned);
    const root = scratchFolder.path;
    const scratchSession = { ...session, root, reads: createReadCache(root) };
    const generated = await runCheckTool(scratchSession, planned, NEXT_TYPEGEN_COMMAND, {
        cwd: join(root, planned.scope.path),
        env: CI_ENVIRONMENT,
    });
    const output = `${generated.stdout}${generated.stderr}`;
    if (generated.code !== 0) throw new Error(`The next typegen command failed: ${formatNextjsFailure(output)}`);
    const compiler = listChecksById(session.configurations.values()).get(TYPESCRIPT_TSC_CHECK) as ConfigurationCheck;
    const result = await runTsc(
        scratchSession,
        {
            ...planned,
            check: { ...compiler.check, ...planned.check, output: compiler.check.output },
            tool: getTool(session.configurations.values(), TSC_TOOL),
        },
        root,
        readTsconfigProject(
            root,
            planned.scope.path,
            planned.files.filter((file) => file.tags.includes(TYPESCRIPT_TAG)).map((file) => file.path),
            scratchSession.reads,
        ),
    );
    result.duration = Math.round(performance.now() - started);
    return restoreCommandPaths(result, root, session.root);
}
