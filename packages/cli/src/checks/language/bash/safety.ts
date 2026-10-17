import { buildFinding } from '#cli/checks/finding.ts';
import { readScripts } from '#cli/checks/language/bash/scripts.ts';
import type { Finding, CheckInput } from '#cli/types/checks/run/check.ts';
import { SAFETY_PATTERNS, ALL_LEVEL_SAFETY_PATTERNS } from '#cli/config/checks/language/bash.ts';

/**
 * Reports each unsafe process kill or removal, and at level `all`, each discarded failure.
 * @param input the scope scripts and level.
 * @returns the findings.
 */
export async function checkBashSafety(input: CheckInput): Promise<Finding[]> {
    const rules = [
        ...(input.settingsFile.settings.level === 'all' ? ALL_LEVEL_SAFETY_PATTERNS : []),
        ...SAFETY_PATTERNS,
    ];
    const scripts = await readScripts(input);
    return scripts.flatMap((file) =>
        file.code.flatMap((code, position) => {
            const isCleanup = file.temporaryPaths.some((temporary) => temporary.cleanupLines.includes(position + 1));
            return rules
                .filter(([pattern]) => pattern.test(code))
                .filter(([, rule]) => rule !== 'recursive-remove' || !isCleanup)
                .map(([, rule, text]) =>
                    buildFinding(input, { file: file.path, line: position + 1 }, rule, `Here ${text}.`),
                );
        }),
    );
}
