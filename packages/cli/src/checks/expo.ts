import { join } from 'node:path';
import { createRequire } from 'node:module';
import { GspotError } from '#cli/system/errors.ts';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import { stripVTControlCharacters } from 'node:util';
import { joinScope } from '#cli/repository/scopes.ts';
import { type Finding } from '#cli/types/runs/check.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { assertToolFindings } from '#cli/runs/command/output.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependencies.ts';

import {
    FAILED_CHECK,
    PASSED_CHECKS,
    EXPO_PACKAGE_JSON,
    BLOCK_END_PREFIXES,
    EXPO_DOCTOR_COMMAND,
} from '#cli/config/checks/expo.ts';

function hasInstalledExpo(scopeRoot: string): boolean {
    try {
        createRequire(join(scopeRoot, PACKAGE_JSON)).resolve(EXPO_PACKAGE_JSON);
        return true;
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'MODULE_NOT_FOUND') return false;
        throw error;
    }
}

// A blank line, advice, another check, or the summary ends the details of a failed check.
function isBlockEnd(line: string): boolean {
    if (line === '' || BLOCK_END_PREFIXES.some((prefix) => line.startsWith(prefix))) return true;
    return PASSED_CHECKS.test(line);
}

/**
 * Turns each failed Expo Doctor check into one message with its details.
 *
 * @param stdout what Doctor printed.
 * @returns one message per failed Doctor check, with its details.
 */
function parseExpoDoctor(stdout: string): string[] {
    const lines = stripVTControlCharacters(stdout)
        .split('\n')
        .map((line) => line.trim());
    return lines.flatMap((line, index): string[] => {
        const description = FAILED_CHECK.exec(line)?.groups?.['description'];
        if (description === undefined) return [];
        const rest = lines.slice(index + 1);
        const end = rest.findIndex((next) => isBlockEnd(next));
        const issues = end === -1 ? rest : rest.slice(0, end);
        return [[description, ...issues].join(' ')];
    });
}

/**
 * Runs Expo Doctor in a scope that depends on expo.
 *
 * @param session the repository and its tools.
 * @param planned the scope to check.
 * @returns one finding per failed Doctor check.
 */
export async function checkExpoDoctor(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const path = joinScope(planned.scope.folder.path, PACKAGE_JSON);
    // Doctor exits 0 without reading a project whose expo package does not exist, so check the project first.
    if (!hasInstalledExpo(join(session.root, planned.scope.folder.path)))
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
