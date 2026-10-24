import { join } from 'node:path';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { parseToolReport } from '#cli/parsers/formats/json.ts';
import { assertToolFindings } from '#cli/runs/command/output.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { writeScopeTsconfig } from '#cli/checks/tsc/scope-tsconfig.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers/projects/tsconfig.ts';
import { TSCONFIG_COPY_FOLDER } from '#cli/config/checks/tsc/compiler.ts';
import { findingSchema, failureMessageSchema } from '#cli/schemas/checks/framework/svelte.ts';

import {
    FAILURE_LINE,
    FINDING_LINE,
    SVELTE_CHECK_COMMAND,
    SVELTE_TSCONFIG_FLAG,
} from '#cli/config/checks/framework/svelte.ts';

function parseSvelteCheckFindings(planned: PlannedCheck, stdout: string): Finding[] {
    const lines = stdout.split('\n');
    const failure = lines
        .map((line) => FAILURE_LINE.exec(line)?.groups?.['message'])
        .find((text) => text !== undefined);
    if (failure !== undefined)
        throw new Error(
            `The svelte-check run failed: ${parseToolReport('svelte-check', failure, failureMessageSchema)}`,
        );
    return lines.flatMap((line): Finding[] => {
        const text = FINDING_LINE.exec(line)?.groups?.['message'];
        if (text === undefined) return [];
        const reported = parseToolReport('svelte-check', text, findingSchema);
        const rule = typeof reported.code === 'number' ? `TS${String(reported.code)}` : reported.code;
        return [
            buildFinding(
                planned,
                {
                    file: joinScope(planned.scope.folder.path, convertToPosixPath(reported.filename)),
                    line: reported.start.line + 1,
                    column: reported.start.character + 1,
                },
                rule ?? 'svelte-check',
                reported.message,
            ),
        ];
    });
}

/**
Runs svelte-check on the scope for compiler warnings, accessibility warnings, and type errors.

@param session the repository and its tools.
@param planned the scope to check.
@returns one finding for each error and warning.
*/
export async function checkSvelteCheck(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    using runtime = createTemporaryFolder();
    const target = join(runtime.path, TSCONFIG_COPY_FOLDER, planned.scope.folder.path, TSCONFIG_FILE);
    const tsconfigPath = writeScopeTsconfig(session, planned.scope, target);
    const command = [...SVELTE_CHECK_COMMAND, SVELTE_TSCONFIG_FLAG, tsconfigPath];
    const result = await runCheckTool(session, planned, command, {
        cwd: join(session.root, planned.scope.folder.path),
    });
    const findings = parseSvelteCheckFindings(planned, result.stdout);
    return assertToolFindings(result, findings, 'svelte-check');
}
