import { codeLines } from '#cli/parsers/bash.ts';
import { findingAt } from '#cli/checks/finding.ts';
import { ENV_ROLE } from '#cli/config/settings/values.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import { readScripts } from '#cli/checks/language/bash/scripts.ts';
import { INCLUDE_GUARD } from '#cli/config/checks/language/bash.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';

/**
 * One finding per owner without the guard, with a malformed second line, or with a guard another owner already uses.
 * @param input the check context.
 * @returns the findings.
 */
export async function bashIncludeGuards(input: CheckInput): Promise<Finding[]> {
    const isOwner = pathMatcher(input.settingsFile.settings.architecture.roles[ENV_ROLE]);
    const index = await readScripts(input);
    const seen = new Map<string, string>();
    return index
        .filter((file) => isOwner(file.path))
        .flatMap((file) => {
            const [first = { number: 1, text: '' }, second] = codeLines(file.code);
            const name = INCLUDE_GUARD.exec(first.text)?.groups?.['name'];
            if (name === undefined)
                return [
                    findingAt(
                        input,
                        { file: file.path, line: first.number },
                        'guard-first',
                        'A configuration owner opens with [[ -n ${<GUARD>:-} ]] && return 0.',
                    ),
                ];
            const findings: Finding[] = [];
            const expected = `readonly ${name}=1`;
            if (second?.text !== expected)
                findings.push(
                    findingAt(
                        input,
                        { file: file.path, line: first.number },
                        'guard-mark',
                        `Put ${expected} on the line after the guard.`,
                    ),
                );
            const other = seen.get(name);
            if (other !== undefined)
                findings.push(
                    findingAt(
                        input,
                        { file: file.path, line: first.number },
                        'guard-shared',
                        `${name} already guards ${other}. Use a separate guard name for this file.`,
                    ),
                );
            seen.set(name, file.path);
            return findings;
        });
}
