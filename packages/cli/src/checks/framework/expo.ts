import { join } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { stripVTControlCharacters } from 'node:util';
import { joinScope } from '#cli/repository/scopes.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import type { CheckSession } from '#cli/types/session.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { type CheckFinding } from '#cli/types/runs/check.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects.ts';
import { assertToolFindings } from '#cli/runs/command/output.ts';
import { findInstalledDependency } from '#cli/executables/packages.ts';

import {
    EXPO_PACKAGE,
    FAILED_CHECK_RULE,
    FAILED_CHECK_LINE,
    PASSED_CHECKS_LINE,
    BLOCK_END_PREFIXES,
    EXPO_DOCTOR_COMMAND,
    UNINSTALLED_EXPO_MESSAGE,
} from '#cli/config/checks/framework/framework.ts';

function parseExpoDoctor(stdout: string): string[] {
    const lines = stripVTControlCharacters(stdout)
        .split('\n')
        .map((line) => line.trim());
    return lines.flatMap((line, index): string[] => {
        const description = FAILED_CHECK_LINE.exec(line)?.groups?.['description'];
        if (description === undefined) return [];
        const rest = lines.slice(index + 1);
        const end = rest.findIndex(
            (next) =>
                next === '' ||
                BLOCK_END_PREFIXES.some((prefix) => next.startsWith(prefix)) ||
                PASSED_CHECKS_LINE.test(next),
        );
        const issues = end === -1 ? rest : rest.slice(0, end);
        return [[description, ...issues].join(' ')];
    });
}

/**
Runs Expo Doctor in a scope that depends on expo.

@param session the repository and its tools.
@param planned the scope to check.
@returns one finding per failed Doctor check.
*/
export async function checkExpoDoctor(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const path = joinScope(planned.scope.path, PACKAGE_JSON);
    if (findInstalledDependency(session.root, path, EXPO_PACKAGE) === undefined)
        throw new GspotError('tool', UNINSTALLED_EXPO_MESSAGE);
    const result = await runCheckTool(session, planned, EXPO_DOCTOR_COMMAND, {
        cwd: join(session.root, planned.scope.path),
    });
    const findings = parseExpoDoctor(result.stdout).map((message) => ({
        file: path,
        line: 1,
        rule: FAILED_CHECK_RULE,
        message: message,
    }));
    return assertToolFindings(result, findings, 'expo-doctor');
}
