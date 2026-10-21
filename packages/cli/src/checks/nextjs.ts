import { join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { type CheckResult } from '#cli/types/runs/check.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { readTsconfigProject } from '#cli/parsers/tsconfig.ts';
import { copyCheckIntoScratch } from '#cli/runs/copy/files.ts';
import { listChecksById } from '#cli/configurations/manifests.ts';
import { getToolDeclaration } from '#cli/configurations/tools.ts';
import { TYPESCRIPT_TAG } from '#cli/config/repository/inventory.ts';
import type { ConfigurationCheck } from '#cli/types/configurations.ts';
import { type Session, type PlannedCheck } from '#cli/types/planning.ts';
import { runTsc, restoreCommandPaths } from '#cli/checks/typescript/compiler.ts';
import { TSC_TOOL, TYPESCRIPT_TSC_CHECK } from '#cli/config/checks/typescript.ts';

import {
    CAUSE_MARKS,
    SHOWN_LINES,
    MARKED_LINES,
    CI_ENVIRONMENT,
    NEXT_TYPEGEN_COMMAND,
} from '#cli/config/checks/nextjs.ts';

// Next.js puts the cause and its detail above the longer stack trace.
function summarizeFailure(text: string): string {
    const lines = stripVTControlCharacters(text).trim().split('\n');
    const marked = lines.findIndex((line) => CAUSE_MARKS.some((mark) => line.includes(mark)));
    const shown = marked === -1 ? lines.slice(-SHOWN_LINES) : lines.slice(marked, marked + MARKED_LINES);
    return shown.join(' ').trim();
}

/**
 * Generates Next.js route types and runs the TypeScript check in the same scratch copy.
 *
 * @param session the repository and its tools.
 * @param planned the Next.js compiler check.
 * @returns the compiler findings and status.
 */
export async function checkNextjsTsc(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const started = performance.now();
    using scratchFolder = await copyCheckIntoScratch(session, planned);
    const root = scratchFolder.path;
    const scratchSession = { ...session, root, reads: createReadCache(root) };
    // CI stops package installs; the Next.js generator output stays in the scratch copy.
    const generated = await runCheckTool(scratchSession, planned, NEXT_TYPEGEN_COMMAND, {
        cwd: join(root, planned.selection.scope.path),
        env: CI_ENVIRONMENT,
    });
    const output = `${generated.stdout}${generated.stderr}`;
    if (generated.code !== 0) throw new Error(`The next typegen command failed: ${summarizeFailure(output)}`);
    const compiler = listChecksById(session.manifests.values()).get(TYPESCRIPT_TSC_CHECK) as ConfigurationCheck;
    const result = await runTsc(
        scratchSession,
        {
            ...planned,
            check: { ...compiler.check, ...planned.check, output: compiler.check.output },
            tool: getToolDeclaration(session.manifests.values(), TSC_TOOL),
        },
        root,
        readTsconfigProject(
            root,
            planned.selection.scope.path,
            planned.files.filter((file) => file.tags.includes(TYPESCRIPT_TAG)).map((file) => file.path),
            scratchSession.reads,
        ),
    );
    result.duration = performance.now() - started;
    return restoreCommandPaths(result, root, session.root);
}
