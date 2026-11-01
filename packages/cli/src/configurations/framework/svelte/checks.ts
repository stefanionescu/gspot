import { join, dirname } from 'node:path';
import { CheckStop } from '#cli/system/errors.ts';
import { mkdirSync, writeFileSync } from 'node:fs';
import { joinScope } from '#cli/repository/scopes.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { runCheckTool } from '#cli/engine/tool-runs/tool.ts';
import type { CheckSession } from '#cli/types/engine/run.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { parseToolOutput } from '#cli/parsers/formats/json.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { assertToolFindings } from '#cli/engine/tool-runs/output.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { buildTsconfig } from '#cli/configurations/tsc/scope-tsconfig.ts';
import { svelteFindingSchema, failureMessageSchema } from '#cli/schemas/configurations.ts';

import {
    FAILURE_LINE,
    FINDING_LINE,
    SVELTE_CHECK_RULE,
    TSCONFIG_COPY_FOLDER,
    SVELTE_CHECK_COMMAND,
    SVELTE_TSCONFIG_FLAG,
} from '#cli/config/configurations/framework.ts';

function parseSvelteCheckFindings(planned: PlannedCheck, stdout: string): CheckFinding[] {
    const lines = stdout.split('\n');
    const failure = lines
        .map((line) => FAILURE_LINE.exec(line)?.groups?.['message'])
        .find((text) => text !== undefined);
    if (failure !== undefined)
        throw new CheckStop(
            'error',
            `The svelte-check run failed: ${parseToolOutput(SVELTE_CHECK_RULE, failure, failureMessageSchema)}`,
        );
    return lines.flatMap((line): CheckFinding[] => {
        const text = FINDING_LINE.exec(line)?.groups?.['message'];
        if (text === undefined) return [];
        const reported = parseToolOutput(SVELTE_CHECK_RULE, text, svelteFindingSchema);
        const rule = typeof reported.code === 'number' ? `TS${String(reported.code)}` : reported.code;
        return [
            {
                file: joinScope(planned.scope.path, convertToPosixPath(reported.filename)),
                line: reported.start.line + 1,
                column: reported.start.character + 1,
                rule: rule ?? SVELTE_CHECK_RULE,
                message: reported.message,
            },
        ];
    });
}

/**
Runs svelte-check on the scope for compiler warnings, accessibility warnings, and type errors.

@param session the repository and its tools.
@param planned the scope to check.
@returns one finding for each error and warning.
*/
export async function checkSvelteCheck(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    using runtime = createTemporaryFolder();
    const target = join(runtime.path, TSCONFIG_COPY_FOLDER, planned.scope.path, TSCONFIG_FILE);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, JSON.stringify(buildTsconfig(session, planned.scope, target)));
    const command = [...SVELTE_CHECK_COMMAND, SVELTE_TSCONFIG_FLAG, target];
    const result = await runCheckTool(session, planned, command, {
        cwd: join(session.root, planned.scope.path),
    });
    const findings = parseSvelteCheckFindings(planned, result.stdout);
    return assertToolFindings(result, findings, 'svelte-check');
}
