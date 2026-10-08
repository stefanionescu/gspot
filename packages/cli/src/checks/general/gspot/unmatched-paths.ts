import { z } from 'zod';
import { findingAt } from '#cli/checks/finding.ts';
import { expandPaths } from '#cli/platform/paths.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { everyTable } from '#cli/policy/settings/lookup.ts';
import { trackedEntries } from '#cli/repository/tracked.ts';
import { valueAt, isRecord } from '#cli/platform/objects.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import { mapPolicyPaths, prefixScopePath } from '#cli/policy/paths.ts';
import type { PolicyPathCallback } from '#cli/types/policy/settings.ts';
import { scopeSchema, policySchema } from '#cli/policy/schema/policy.ts';

/**
 * Report authored source selectors that match no tracked file or folder.
 * @param input the root policy check input.
 * @returns findings at the policy file.
 */
export async function unmatchedPaths(input: CheckInput): Promise<Finding[]> {
    const files = await trackedEntries(input.root, [], input.index);
    const candidates = [...expandPaths(files.map((file) => file.path))];
    return everyTable(input.policyFiles.policy).flatMap(({ table, scope = '', path }) => {
        const findings: Finding[] = [];
        const modules = new Set(table.architecture?.modules.map((module) => module.name));
        const schema = scope === '' ? policySchema : scopeSchema;
        // eslint-disable-next-line sonarjs/no-invariant-returns -- reason: This required path-transform callback records findings and must return each original path unchanged.
        const visit: PolicyPathCallback = (pattern, keys, role) => {
            if (role === 'destination' || (keys.join('.').startsWith('architecture.roles.') && modules.has(pattern)))
                return pattern;
            const repositoryPattern = keys.length === 0 ? pattern : prefixScopePath(pattern, scope);
            const matches = pathMatcher([repositoryPattern.replace(/^!/u, '')]);
            if (candidates.some((candidate) => matches(candidate))) return pattern;
            const names = keys
                .filter((part): part is string => typeof part === 'string')
                .filter((part, index, fields) => part !== 'paths' || index !== fields.length - 1);
            const owner = [...path, ...names].join('.');
            const source = valueAt(table.authored, names);
            const where = Array.isArray(source) && source.some((entry) => isRecord(entry)) ? `[[${owner}]]` : owner;
            findings.push(
                findingAt(
                    input,
                    { file: POLICY_FILE, line: 1 },
                    'unmatched-pattern',
                    `${repositoryPattern} under ${where} matches no tracked file or folder.`,
                ),
            );
            return pattern;
        };
        if (scope !== '')
            mapPolicyPaths(z.instanceof(z.ZodType).parse(policySchema.shape.scope.unwrap().keyType), scope, visit, []);
        mapPolicyPaths(
            schema,
            Object.fromEntries(
                Object.entries(table.authored)
                    .filter(([key]) => key !== 'scope')
                    .toSorted(([left], [right]) => Number(right === 'ignore') - Number(left === 'ignore')),
            ),
            visit,
            [],
        );
        return findings;
    });
}
