import { join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';

import {
    CAUSE_MARKS,
    CI_ENVIRONMENT,
    MARKED_LINES,
    NEXT_TYPEGEN_COMMAND,
    SHOWN_LINES,
} from '#cli/config/configurations/nextjs.ts';
import { TYPESCRIPT_TAG } from '#cli/config/configurations/shared.ts';
import { runTsc } from '#cli/configurations/tsc/compiler.ts';
import { createCheckCopy } from '#cli/engine/copies/files.ts';
import { restoreCommandPaths } from '#cli/engine/results.ts';
import { runCheckTool } from '#cli/engine/tool-runs/tool.ts';
import { readTsconfigProject } from '#cli/parsers/projects/tsconfig.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { CheckStop } from '#cli/system/errors.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { type CheckCode, type CheckResult, type CheckSession } from '#cli/types/engine/run.ts';

function formatNextjsFailure(text: string): string {
    const lines = stripVTControlCharacters(text).trim().split('\n');
    const marked = lines.findIndex((line) => CAUSE_MARKS.some((mark) => line.includes(mark)));
    const shown = marked === -1 ? lines.slice(-SHOWN_LINES) : lines.slice(marked, marked + MARKED_LINES);
    return shown.join(' ').trim();
}

async function checkNextjsTsc(session: CheckSession, planned: PlannedCheck): Promise<CheckResult> {
    const started = performance.now();
    using scratchFolder = await createCheckCopy(session, planned);
    const root = scratchFolder.path;
    const scratchSession = { ...session, root, cache: createRunCache(root) };
    const generated = await runCheckTool(scratchSession, planned, NEXT_TYPEGEN_COMMAND, {
        cwd: join(root, planned.scope.path),
        env: CI_ENVIRONMENT,
    });
    const output = `${generated.stdout}${generated.stderr}`;
    if (generated.code !== 0)
        throw new CheckStop('error', `The next typegen command failed: ${formatNextjsFailure(output)}`);
    const result = await runTsc(
        scratchSession,
        planned,
        root,
        readTsconfigProject(
            root,
            planned.scope.path,
            planned.files.filter((file) => file.tags.includes(TYPESCRIPT_TAG)).map((file) => file.path),
            scratchSession.cache,
        ),
    );
    result.duration = Math.round(performance.now() - started);
    return restoreCommandPaths(result, root, session.root);
}

export const NEXTJS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'nextjs/tsc': { run: checkNextjsTsc },
};
