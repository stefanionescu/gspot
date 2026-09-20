// Every baseline names a check that exists, and every path in a tool's suppressions file is still tracked.
import { join } from 'node:path';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { existsSync, readFileSync } from 'node:fs';
import type { SuppressionFile } from '#types/integrity.ts';
import { toolBaselineFile } from '#cli/run/scope-paths.ts';
import { fileName, readBaselines } from '#cli/run/baselines.ts';

function checkIds(input: EngineInput): Set<string> {
    const fromManifests = input.session.scopes.flatMap((scope) =>
        scope.selected.flatMap((manifest) => manifest.checks.map((check) => check.name)),
    );
    const declared = input.session.policyFiles.policy.checks.map((entry) => entry.name);
    return new Set([...fromManifests, ...declared]);
}

function countFindings(input: EngineInput): Finding[] {
    const known = checkIds(input);
    return readBaselines(input.root)
        .filter((baseline) => !known.has(baseline.check))
        .map((baseline) => ({
            check: input.spec.name,
            file: `.gspot/baselines/${fileName(baseline.check, baseline.rule)}`,
            line: 1,
            rule: 'unknown-check',
            message: `The baseline for ${baseline.check}:${baseline.rule} names a check that does not run here.`,
            fixable: false,
        }));
}

function suppressionFiles(input: EngineInput): SuppressionFile[] {
    const named = input.session.scopes.flatMap((selection) =>
        selection.selected.flatMap((manifest) =>
            manifest.checks.flatMap((check) =>
                check.baseline_file === undefined
                    ? []
                    : [
                          {
                              path: toolBaselineFile(check.baseline_file, selection.scope.path),
                              scope: selection.scope.path,
                          },
                      ],
            ),
        ),
    );
    const byPath = new Map(named.map((file) => [file.path, file]));
    return byPath
        .values()
        .filter((file) => existsSync(join(input.root, file.path)))
        .toArray();
}

// ESLint keys its file by paths from the root. basedpyright keeps the paths of one scope under files, from that scope.
function suppressedPaths(parsed: Record<string, unknown>, scope: string): string[] {
    const held = parsed['files'];
    if (typeof held !== 'object' || held === null) return Object.keys(parsed);
    return Object.keys(held)
        .map((path) => path.replace(/^\.\//u, ''))
        .map((path) => (scope === '' ? path : `${scope}/${path}`));
}

function stalePaths(input: EngineInput, file: SuppressionFile): Finding[] {
    const tracked = new Set(input.session.repository.files.map((entry) => entry.path));
    const parsed = JSON.parse(readFileSync(join(input.root, file.path), 'utf8')) as Record<string, unknown>;
    return suppressedPaths(parsed, file.scope)
        .filter((entry) => !tracked.has(entry.replaceAll('\\', '/')))
        .map((entry) => ({
            check: input.spec.name,
            file: file.path,
            line: 1,
            rule: 'stale-suppression',
            message: `${entry} has suppressions and is not tracked; run gspot apply --lower-baselines to prune.`,
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
