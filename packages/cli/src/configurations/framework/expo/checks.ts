import { join } from 'node:path';
import { CheckStop } from '#cli/system/errors.ts';
import { stripVTControlCharacters } from 'node:util';
import { joinScope } from '#cli/repository/scopes.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects.ts';
import { runCheckTool } from '#cli/engine/run/tool-runs/tool.ts';
import { findInstalledDependency } from '#cli/tools/programs/packages.ts';
import { assertToolFindings } from '#cli/engine/run/tool-runs/failures.ts';
import type { CheckCode, CheckFinding, CheckSession } from '#cli/types/engine/run.ts';

import {
    EXPO_PACKAGE,
    FAILED_CHECK_LINE,
    FAILED_CHECK_RULE,
    BLOCK_END_PREFIXES,
    PASSED_CHECKS_LINE,
    EXPO_DOCTOR_COMMAND,
    UNINSTALLED_EXPO_MESSAGE,
} from '#cli/config/configurations/framework.ts';

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

async function checkExpoDoctor(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const path = joinScope(planned.scope.path, PACKAGE_JSON);
    if (findInstalledDependency(session.root, path, EXPO_PACKAGE) === undefined)
        throw new CheckStop('missing', UNINSTALLED_EXPO_MESSAGE);
    const result = await runCheckTool(session, planned, EXPO_DOCTOR_COMMAND, {
        cwd: join(session.root, planned.scope.path),
    });
    const findings = parseExpoDoctor(result.stdout).map((message) => ({
        file: path,
        line: 1,
        rule: FAILED_CHECK_RULE,
        message,
    }));
    return assertToolFindings(result, findings, 'expo-doctor');
}

export const EXPO_CHECKS: Readonly<Record<string, CheckCode>> = {
    'expo/expo-doctor': { check: checkExpoDoctor },
};
