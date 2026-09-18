// Every baseline names a check that exists, and every path in a tool's suppressions file is still tracked.
import { join } from 'node:path';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { existsSync, readFileSync } from 'node:fs';
import type { SuppressionFile } from '#types/integrity.ts';
import { fileName, readBaselines } from '#cli/run/baselines.ts';

function checkIds(input: EngineInput): Set<string> {
    const fromManifests = input.session.scopes.flatMap((scope) =>
        scope.selected.flatMap((manifest) => manifest.checks.map((check) => check.id)),
    );
    const declared = input.session.policyFiles.policy.checks.map((entry) => entry.id);
    return new Set([...fromManifests, ...declared]);
}

function countFindings(input: EngineInput): Finding[] {
    const known = checkIds(input);
    return readBaselines(input.root)
        .filter((baseline) => !known.has(baseline.check))
        .map((baseline) => ({
            check: input.spec.id,
            file: `.gspot/baseline/${fileName(baseline.check, baseline.rule)}`,
            line: 1,
            rule: 'unknown-check',
            message: `The baseline for ${baseline.check}:${baseline.rule} names a check that does not run here.`,
            fixable: false,
        }));
}

function suppressionFiles(input: EngineInput): SuppressionFile[] {
    const named = input.session.scopes.flatMap((scope) =>
        scope.selected.flatMap((manifest) =>
            manifest.checks.flatMap((check) => (check.baseline_file === undefined ? [] : [check.baseline_file])),
        ),
    );
    return [...new Set(named)]
        .filter((path) => existsSync(join(input.root, path)))
        .map((path) => ({ path, scope: '' }));
}

function stalePaths(input: EngineInput, file: SuppressionFile): Finding[] {
    const tracked = new Set(input.session.repository.files.map((entry) => entry.path));
    const parsed = JSON.parse(readFileSync(join(input.root, file.path), 'utf8')) as Record<string, unknown>;
    return Object.keys(parsed)
        .filter((entry) => !tracked.has(entry.replaceAll('\\', '/')))
        .map((entry) => ({
            check: input.spec.id,
            file: file.path,
            line: 1,
            rule: 'stale-suppression',
            message: `${entry} has suppressions and is not tracked; run gspot apply --baseline to prune.`,
            fixable: false,
        }));
}

/**
 * One finding per baseline that names a check that does not run, and per suppressed file that is gone.
 * @param input the engine input
 * @returns the findings
 */
export function baselinesCurrent(input: EngineInput): Promise<Finding[]> {
    const findings = [...countFindings(input), ...suppressionFiles(input).flatMap((file) => stalePaths(input, file))];
    return Promise.resolve(findings);
}
