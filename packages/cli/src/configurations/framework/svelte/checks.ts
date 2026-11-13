import { join } from 'node:path';

import {
    FAILURE_LINE,
    FINDING_LINE,
    SVELTE_CHECK_COMMAND,
    SVELTE_CHECK_RULE,
    SVELTE_TSCONFIG_FLAG,
} from '#cli/config/configurations/framework.ts';
import { writeScopeTsconfig } from '#cli/configurations/tsc/scope-tsconfig.ts';
import { assertToolFindings } from '#cli/engine/tool-runs/output.ts';
import { runCheckTool } from '#cli/engine/tool-runs/tool.ts';
import { parseToolOutput } from '#cli/parsers/formats/json.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { failureMessageSchema, svelteFindingSchema } from '#cli/schemas/configurations.ts';
import { CheckStop } from '#cli/system/errors.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckFinding, CheckSession } from '#cli/types/engine/run.ts';

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

async function checkSvelteCheck(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    using runtime = createTemporaryFolder();
    const target = writeScopeTsconfig(session, planned.scope, runtime.path);
    const command = [...SVELTE_CHECK_COMMAND, SVELTE_TSCONFIG_FLAG, target];
    const result = await runCheckTool(session, planned, command, {
        cwd: join(session.root, planned.scope.path),
    });
    const findings = parseSvelteCheckFindings(planned, result.stdout);
    return assertToolFindings(result, findings, 'svelte-check');
}

export const SVELTE_CHECKS: Readonly<Record<string, CheckCode>> = {
    'svelte/svelte-check': { check: checkSvelteCheck },
};
