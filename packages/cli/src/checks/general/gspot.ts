import { emitAll } from '#cli/generation/outputs.ts';
import { computeDrift } from '#cli/lifecycle/drift.ts';
import { emptyResult } from '#cli/execution/report.ts';
import { applyPlan } from '#cli/lifecycle/ownership/commit.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import { proposeReplacement } from '#cli/lifecycle/ownership/plans.ts';
import type { FixResult, CheckResult } from '#cli/types/execution/check.ts';
import { DRIFT_HELP, DRIFT_MESSAGES } from '#cli/config/checks/general/gspot.ts';
import { emitPolicy, parseTomlText, readPolicyFile, writePolicyFile } from '#cli/policy/file.ts';

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
                proposeReplacement(log, { path: POLICY_FILE, next, kind: 'policy', canReplace: true, expected }),
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
