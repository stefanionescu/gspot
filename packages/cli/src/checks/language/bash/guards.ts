import { findingAt } from '#cli/checks/finding.ts';
import { codeLines } from '#cli/parsers/bash/public.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { rolePaths } from '#cli/policy/settings/contracts.ts';
import { pathMatcher } from '#cli/repository/paths/public.ts';
import type { BuiltInCheck } from '#cli/types/execution/check.ts';
import { getScriptIndex } from '#cli/checks/language/contracts.ts';
import { CONFIG_GUARD, DEFAULT_EXPANSION } from '#cli/config/checks/language/bash.ts';

/**
 * One finding per `${name:-value}` default outside the environment owners.
 * @param input the check context
 * @returns the findings
 */
export const bashVariableDefaults: BuiltInCheck = async (input) => {
    const isOwner = pathMatcher(rolePaths(input.policyFiles.policy.architecture.roles, 'env'));
    const index = await getScriptIndex(input);
    return index.files.flatMap((file) => {
        if (isOwner(file.path)) return [];
        return file.code.flatMap((line, position) => {
            if (line.trimStart().startsWith('#')) return [];
            const match = DEFAULT_EXPANSION.exec(line);
            return match === null
                ? []
                : [
                      findingAt(
                          input,
                          { file: file.path, line: position + 1 },
                          'default-outside-owner',
                          `${match[0]} sets a default outside the configuration owners.`,
                      ),
                  ];
        });
    });
};

/**
 * One finding per owner without the guard, with a malformed second line, or with a guard another owner already uses.
 * @param input the check context
 * @returns the findings
 */
export const guards: BuiltInCheck = async (input) => {
    const isOwner = pathMatcher(rolePaths(input.policyFiles.policy.architecture.roles, 'env'));
    const index = await getScriptIndex(input);
    const seen = new Map<string, string>();
    return index.files
        .filter((file) => isOwner(file.path))
        .flatMap((file) => {
            const [first = { number: 1, code: '' }, second] = codeLines(file.code);
            const name = CONFIG_GUARD.exec(first.code)?.groups?.['name'];
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
            if (second?.code !== expected)
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
};
