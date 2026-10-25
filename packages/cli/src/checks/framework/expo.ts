import { join } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { stripVTControlCharacters } from 'node:util';
import { buildFinding } from '#cli/checks/finding.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { type Finding } from '#cli/types/runs/check.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import type { CheckSession } from '#cli/types/session.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { assertToolFindings } from '#cli/runs/command/output.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects/dependencies.ts';
import { findInstalledDependency } from '#cli/repository/npm/installed-packages.ts';

import {
    FAILED_CHECK,
    EXPO_PACKAGE,
    PASSED_CHECKS,
    BLOCK_END_PREFIXES,
    EXPO_DOCTOR_COMMAND,
} from '#cli/config/checks/framework/expo.ts';

function parseExpoDoctor(stdout: string): string[] {
    const lines = stripVTControlCharacters(stdout)
        .split('\n')
        .map((line) => line.trim());
    return lines.flatMap((line, index): string[] => {
        const description = FAILED_CHECK.exec(line)?.groups?.['description'];
        if (description === undefined) return [];
        const rest = lines.slice(index + 1);
        const end = rest.findIndex(
            (next) =>
                next === '' || BLOCK_END_PREFIXES.some((prefix) => next.startsWith(prefix)) || PASSED_CHECKS.test(next),
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
export async function checkExpoDoctor(session: CheckSession, planned: PlannedCheck): Promise<Finding[]> {
    const path = joinScope(planned.scope.folder.path, PACKAGE_JSON);
    if (findInstalledDependency(session.root, path, EXPO_PACKAGE) === undefined)
        throw new GspotError(
            'tool',
            'Install the project dependencies of this scope; Expo Doctor reads an installed Expo project.',
        );
    const result = await runCheckTool(session, planned, EXPO_DOCTOR_COMMAND, {
        cwd: join(session.root, planned.scope.folder.path),
    });
    const findings = parseExpoDoctor(result.stdout).map((message) =>
        buildFinding(planned, { file: path, line: 1 }, 'failed-check', message),
    );
    return assertToolFindings(result, findings, 'expo-doctor');
}
