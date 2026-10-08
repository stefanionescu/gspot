import { z } from 'zod';
import { findingAt } from '#cli/checks/finding.ts';
import { emitAll } from '#cli/generation/public.ts';
import { emptyResult } from '#cli/execution/report.ts';
import { computeDrift } from '#cli/lifecycle/public.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { pathMatcher } from '#cli/repository/paths/public.ts';
import { trackedEntries } from '#cli/repository/contracts.ts';
import { everyTable } from '#cli/policy/settings/contracts.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import { mapPolicyPaths, prefixScopePath } from '#cli/policy/paths.ts';
import type { PolicyPathCallback } from '#cli/types/policy/settings.ts';
import { planReplacement } from '#cli/lifecycle/ownership/contracts.ts';
import { scopeSchema, policySchema } from '#cli/policy/schema/public.ts';
import { valueAt, isRecord, expandPaths } from '#cli/platform/contracts.ts';
import { applyPlan, openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { DRIFT_HELP, DRIFT_MESSAGES } from '#cli/config/checks/general/gspot.ts';
import type { FixResult, CheckInput, CheckResult } from '#cli/types/execution/check.ts';
import { emitPolicy, parseTomlText, readPolicyFile, writePolicyFile } from '#cli/policy/document/public.ts';

/**
 * Compare generated files with the policy output and report changes, missing files, conflicts, and stray outputs.
 * @param session the policy and repository to emit
 * @param planned the repository-wide drift check
 * @returns the check result with its generated-file findings
 */
export function gspotDrift(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    if (planned.check.runs !== 'once')
        throw new Error(
            'The gspot/drift check needs generated file comparisons, so its manifest must say runs = "once".',
        );
    const started = performance.now();
    const findings = computeDrift(session.root, session.policyFiles.policy, emitAll(session)).map((entry) => ({
        check: planned.check.name,
        file: entry.path,
        rule: entry.kind,
        message: DRIFT_MESSAGES[entry.kind],
        help: DRIFT_HELP[entry.kind],
        fixable: true,
    }));
    return Promise.resolve({
        ...emptyResult(planned),
        findings,
        status: findings.length > 0 ? 'failed' : 'passed',
        duration: performance.now() - started,
    });
}

/**
 * Compare the authored policy with its canonical section, value, and comment layout.
 * @param session the repository session
 * @param planned the policy-layout check
 * @returns the policy file's layout finding, when its canonical bytes differ
 */
export function gspotPolicyLayout(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const started = performance.now();
    const text = readPolicyFile(session.root);
    const canonical = emitPolicy(text, parseTomlText(text, POLICY_FILE, 'policy'));
    const findings =
        text === canonical
            ? []
            : [
                  {
                      check: planned.check.name,
                      file: POLICY_FILE,
                      message: 'The policy file differs from its canonical layout.',
                      help: planned.check.help,
                      fixable: true,
                  },
              ];
    return Promise.resolve({
        ...emptyResult(planned),
        findings,
        status: findings.length === 0 ? 'passed' : 'failed',
        duration: performance.now() - started,
    });
}

/**
 * Publish the policy's canonical layout under its native claim and captured-file comparison.
 * @param planned the selected policy-layout check
 * @param root the real repository or disposable preview root
 * @returns whether the policy bytes changed
 */
export function fixPolicyLayout(planned: PlannedCheck, root: string): FixResult {
    using log = openOwnership(root);
    const original = log.files.read(POLICY_FILE);
    const previous = readPolicyFile(root);
    const text = emitPolicy(previous, parseTomlText(previous, POLICY_FILE, 'policy'));
    if (original?.bytes.equals(Buffer.from(previous)) !== true)
        throw new Error('The gspot.toml file changed while its fix was running; the fix was not applied.');
    writePolicyFile({
        files: log.files,
        text,
        original,
        publish: (next, expected) => {
            applyPlan(
                log,
                planReplacement(log, { path: POLICY_FILE, next, kind: 'policy', canReplace: true, expected }),
            );
        },
    });
    const changed = previous !== text;
    return {
        check: planned.check.name,
        status: changed ? 'changed' : 'unchanged',
        changed: changed ? [POLICY_FILE] : [],
    };
}

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
