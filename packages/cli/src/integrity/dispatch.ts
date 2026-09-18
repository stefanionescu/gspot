// The integrity engine: one function per check, chosen by `analysis =` in the manifest.
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { fences } from '#cli/integrity/fences.ts';
import { envFiles } from '#cli/integrity/env/files.ts';
import type { IntegrityCheck } from '#types/integrity.ts';
import { envExample } from '#cli/integrity/env/example.ts';
import { largeFiles } from '#cli/integrity/large-files.ts';
import { stalePaths } from '#cli/integrity/stale-paths.ts';
import { taskPolicy } from '#cli/integrity/task-policy.ts';
import { readmeShape } from '#cli/integrity/readme/shape.ts';
import { suppressions } from '#cli/integrity/suppressions.ts';
import { docsHeadings } from '#cli/integrity/docs-headings.ts';
import { readmePresent } from '#cli/integrity/readme/present.ts';
import { generatedDrift } from '#cli/integrity/generated-drift.ts';
import { allowlistsMatch } from '#cli/integrity/allowlists-match.ts';
import { tsconfigOptions } from '#cli/integrity/tsconfig-options.ts';
import { configurationPurity } from '#cli/integrity/config-purity.ts';
import { baselinesCurrent } from '#cli/integrity/baselines-current.ts';
import { gitleaksBaseline } from '#cli/integrity/gitleaks-baseline.ts';
import { trackedDependencies } from '#cli/integrity/tracked-dependencies.ts';

const checks: Record<string, IntegrityCheck> = {
    'generated-drift': generatedDrift,
    'tsconfig-options': tsconfigOptions,
    'docs-headings': docsHeadings,
    'stale-paths': stalePaths,
    'readme-present': readmePresent,
    'readme-shape': readmeShape,
    fences,
    'env-example': envExample,
    'baselines-current': baselinesCurrent,
    'config-purity': configurationPurity,
    suppressions,
    'allowlists-match': allowlistsMatch,
    'task-policy': taskPolicy,
    'large-files': largeFiles,
    'tracked-dependencies': trackedDependencies,
    'env-files': envFiles,
    'gitleaks-baseline': gitleaksBaseline,
};

/**
 * Runs the analysis a check names.
 * @param input the engine input
 * @returns the findings
 */
export async function runIntegrity(input: EngineInput): Promise<Finding[]> {
    const name = input.spec.analysis ?? input.spec.id.slice(input.spec.id.indexOf('/') + 1);
    const check = checks[name];
    if (!check) throw new Error(`No integrity analysis is called ${name}.`);
    return check(input);
}
