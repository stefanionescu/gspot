import { findingAt } from '#cli/checks/finding.ts';
import { emitAll } from '#cli/generation/public.ts';
import { emptyResult } from '#cli/execution/report.ts';
import { applyIgnores } from '#cli/execution/public.ts';
import { computeDrift } from '#cli/lifecycle/public.ts';
import { checkInput } from '#cli/execution/contracts.ts';
import { configuredChecks } from '#cli/planning/public.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { trackedEntries } from '#cli/repository/contracts.ts';
import { pathMatcher } from '#cli/repository/paths/public.ts';
import { relativePath } from '#cli/policy/schema/contracts.ts';
import { everyTable } from '#cli/policy/settings/contracts.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import { mapPolicyPaths, prefixScopePath } from '#cli/policy/paths.ts';
import { declaredNames } from '#cli/checks/general/naming/contracts.ts';
import { planReplacement } from '#cli/lifecycle/ownership/contracts.ts';
import type { PolicyPathCallback } from '#cli/types/policy/settings.ts';
import { scopeSchema, policySchema } from '#cli/policy/schema/public.ts';
import { scopeView, activeIgnores } from '#cli/policy/settings/public.ts';
import { valueAt, isRecord, expandPaths } from '#cli/platform/contracts.ts';
import { applyPlans, openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { DRIFT_HELP, DRIFT_MESSAGES } from '#cli/config/checks/general/gspot.ts';
import type { FixResult, CheckInput, CheckResult, BuiltInChecks } from '#cli/types/execution/check.ts';
import { emitPolicy, parseTomlText, readPolicyFile, writePolicyFile } from '#cli/policy/document/public.ts';

// Authored source selectors that match no tracked file or folder.
async function unmatchedPatterns(input: CheckInput): Promise<Finding[]> {
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
        if (scope !== '') mapPolicyPaths(relativePath, scope, visit, []);
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

// Allowances name declarations, or file names when their category is files.
async function unusedNames(input: CheckInput): Promise<Finding[]> {
    const names = await declaredNames(input);
    const findings: Finding[] = [];
    for (const { table, path, scope = '' } of everyTable(input.policyFiles.policy)) {
        for (const [index, override] of (table.naming?.overrides ?? []).entries()) {
            const matches = pathMatcher(override.paths.map((pattern) => prefixScopePath(pattern, scope)));
            const declared = new Set(
                names
                    .filter((file) => matches(file.path))
                    .flatMap((file) =>
                        override.categories?.includes('files') === true
                            ? [...file.declarations, file.names[0]]
                            : file.declarations,
                    ),
            );
            findings.push(
                ...(override.allowed ?? [])
                    .filter((name) => !declared.has(name))
                    .map((name) =>
                        findingAt(
                            input,
                            { file: POLICY_FILE, line: 1 },
                            'unused-name',
                            `${name} under [[${[...path, 'naming', 'overrides'].join('.')}]] entry ${String(index + 1)} is declared by no file under its paths.`,
                        ),
                    ),
            );
        }
    }
    return findings;
}

// Same-check records share one raw native pass. Each retains its own rule and path match.
async function unusedIgnores(input: CheckInput, session: ToolSession, checks: BuiltInChecks): Promise<Finding[]> {
    const findings: Finding[] = [];
    const entries = activeIgnores(session.policyFiles.policy);
    for (const name of new Set(entries.map((entry) => entry.check))) {
        const implementation = checks[name];
        if (!name.startsWith('structure/') || implementation === undefined || !('input' in implementation)) continue;
        const policy = {
            ...session.policyFiles.policy,
            ignore: session.policyFiles.policy.ignore.filter((entry) => entry.check !== name),
        };
        const observed = {
            ...session,
            policyFiles: { ...session.policyFiles, policy },
            scopes: session.scopes.map((scope) => ({
                ...scope,
                view: scopeView(scope.surface, policy, scope.selected, scope.scope.path),
            })),
        };
        const planned = configuredChecks(observed).filter((check) => check.check.name === name);
        if (planned.length === 0) continue;
        const outcomes = await Promise.all(
            planned.map(async (check) => await implementation.input(checkInput(observed, check))),
        );
        const raw = outcomes.flatMap((outcome) => (Array.isArray(outcome) ? outcome : outcome.findings));
        for (const entry of entries.filter(
            (entry) => entry.check === name && applyIgnores(raw, [entry]).uses.every((use) => use.matched === 0),
        ))
            findings.push(
                findingAt(
                    input,
                    { file: POLICY_FILE, line: 1 },
                    'unused-ignore',
                    `The [[ignore]] entry for ${entry.check} matches no finding when that entry is removed.`,
                ),
            );
    }
    return findings;
}

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
    const findings = computeDrift(session.root, emitAll(session)).map((entry) => ({
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
        text,
        original,
        publish: (next, expected) => {
            applyPlans(log, [
                planReplacement(log, { path: POLICY_FILE, next, kind: 'policy', canReplace: true, expected }),
            ]);
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
 * Report authored selectors, allowed names, and structure exceptions that match no source or finding.
 * @param input the root policy check input.
 * @param session the actual scoped execution session.
 * @param checks the native registry supplying structure input implementations.
 * @returns findings at the policy file.
 */
export async function unmatchedPaths(
    input: CheckInput,
    session: ToolSession,
    checks: BuiltInChecks,
): Promise<Finding[]> {
    const names = everyTable(input.policyFiles.policy).some(
        ({ table }) => table.naming?.overrides.some((override) => (override.allowed?.length ?? 0) > 0) === true,
    );
    return [
        ...(await unmatchedPatterns(input)),
        ...(names ? await unusedNames({ ...input, files: session.repository.files }) : []),
        ...(await unusedIgnores(input, session, checks)),
    ];
}
