import { findingAt } from '#cli/checks/finding.ts';
import { withoutDeclaration } from '#cli/parsers/bash.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import { rolePaths } from '#cli/policy/settings/lookup.ts';
import type { Engine } from '#cli/types/execution/check.ts';
import { TOP_LEVEL_ASSIGNMENT } from '#cli/config/checks/language/bash.ts';
import { functionAt, getScriptIndex } from '#cli/checks/language/bash/scripts.ts';

/**
 * One finding per read of an owner-declared variable outside the owner.
 * @param input the check context
 * @returns the findings
 */
export const envOwner: Engine = async (input) => {
    const isOwner = pathMatcher(rolePaths(input.policyFiles.policy.architecture.roles, 'env'));
    const index = await getScriptIndex(input);
    const owned = new Set(
        index.files
            .filter((file) => isOwner(file.path))
            .flatMap((file) => [
                ...file.code.flatMap((code, position) => {
                    if (functionAt(file.functions, position + 1) !== undefined) return [];
                    const name = TOP_LEVEL_ASSIGNMENT.exec(withoutDeclaration(code.trim()))?.groups?.['name'];
                    return name === undefined ? [] : [name];
                }),
            ]),
    );
    if (owned.size === 0) return [];
    const read = new RegExp(String.raw`\$\{?(${[...owned].join('|')})\b`, 'u');
    return index.files.flatMap((file) => {
        if (isOwner(file.path)) return [];
        return file.code.flatMap((line, position) => {
            const match = read.exec(line);
            if (match?.[1] === undefined) return [];
            return [
                findingAt(
                    input,
                    { file: file.path, line: position + 1 },
                    'read-outside-owner',
                    `${match[1]} is read here but declared by the environment owner; read it there and pass the value in.`,
                ),
            ];
        });
    });
};
