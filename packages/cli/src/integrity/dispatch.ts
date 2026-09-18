// The integrity engine: one function per check, chosen by `analysis =` in the manifest.
import type { EngineInput } from '#cli/run/engines.ts';
import { generatedDrift } from '#cli/integrity/generated-drift.ts';
import type { Finding } from '#types/finding.ts';

export type IntegrityCheck = (input: EngineInput) => Promise<Finding[]>;

const checks: Record<string, IntegrityCheck> = {
    'generated-drift': generatedDrift,
};

/** Registers an integrity check by its analysis name. */
export function registerIntegrity(name: string, check: IntegrityCheck): void {
    checks[name] = check;
}

/** The analysis names this build knows. */
export function integrityAnalyses(): string[] {
    return Object.keys(checks).sort();
}

/** Runs the analysis a check names. */
export async function runIntegrity(input: EngineInput): Promise<Finding[]> {
    const name = input.spec.analysis ?? input.spec.id.split('/')[1]!;
    const check = checks[name];
    if (!check) throw new Error(`no integrity analysis called ${name}`);
    return check(input);
}
