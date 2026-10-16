import { join } from 'node:path';
import { createRequire } from 'node:module';
import { GspotError } from '#cli/system/errors.ts';
import { stripVTControlCharacters } from 'node:util';
import { buildFinding } from '#cli/checks/finding.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { runCheckTool } from '#cli/checks/run/command/tool.ts';
import { assertToolFindings } from '#cli/checks/run/command/output.ts';
import { type Finding, type CheckInput } from '#cli/types/checks/run/check.ts';

import {
    FAILED_CHECK,
    PASSED_CHECKS,
    EXPO_PACKAGE_JSON,
    BLOCK_END_PREFIXES,
    EXPO_DOCTOR_COMMAND,
} from '#cli/config/checks/framework/expo.ts';

function hasInstalledExpo(scopeRoot: string): boolean {
    try {
        createRequire(join(scopeRoot, 'package.json')).resolve(EXPO_PACKAGE_JSON);
        return true;
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'MODULE_NOT_FOUND') return false;
        throw error;
    }
}

// Whether a Doctor line ends the issues of a failed check: a blank, advice, another check, or the summary.
function isBlockEnd(line: string): boolean {
    if (line === '' || BLOCK_END_PREFIXES.some((prefix) => line.startsWith(prefix))) return true;
    return PASSED_CHECKS.test(line);
}

/**
 * Reads the report Expo Doctor prints.
 * @param stdout what Doctor printed.
 * @returns one finding for each check Doctor reports as failed, with its issues.
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
 * @param input the project scope and installed tool environment.
 * @returns one finding for each check Doctor reports as failed.
 */
export async function checkExpoDoctor(input: CheckInput): Promise<Finding[]> {
    const path = joinScope(input.scope.scope.path, 'package.json');
    // Doctor exits 0 without reading a project whose expo package does not exist, so check the project first.
    if (!hasInstalledExpo(join(input.root, input.scope.scope.path)))
        throw new GspotError(
            'tool',
            'Expo is not installed in this scope; Expo Doctor reads an installed Expo project.',
        );
    const result = await runCheckTool(input, EXPO_DOCTOR_COMMAND, {
        cwd: join(input.root, input.scope.scope.path),
    });
    const findings = parseExpoDoctor(result.stdout).map((message) =>
        buildFinding(input, { file: path, line: 1 }, 'failed-check', message),
    );
    return assertToolFindings(result, findings, 'expo-doctor');
}
