import { runProse } from '#cli/prose/engine.ts';
import { runNaming } from '#cli/naming/engine.ts';
// Dispatch to the built-in engines by `engine =` in the manifest.
import type { CheckResult } from '#types/finding.ts';
import { runStructure } from '#cli/structure/engine.ts';
import { runIntegrity } from '#cli/integrity/dispatch.ts';
import { MissingToolError } from '#cli/platform/missing-tool.ts';
import { SkippedCheckError } from '#cli/platform/skipped-check.ts';
import type { EngineInput, Engine, Session, PlannedCheck } from '#types/run.ts';

const engines = new Map<string, Engine>([
    ['integrity', runIntegrity],
    ['naming', runNaming],
    ['structure', runStructure],
    ['prose', runProse],
]);

// Classify missing tools and unmet prerequisites separately from engine errors.
function failureOf(name: string, error: unknown): Pick<CheckResult, 'status' | 'note'> {
    if (error instanceof SkippedCheckError) return { status: 'skipped', note: error.message };
    if (error instanceof MissingToolError) return { status: 'missing', note: error.message };
    return { status: 'error', note: `the ${name} engine failed: ${(error as Error).message}` };
}

/**
 * True when an engine of this name exists in this build.
 * @param name the engine name from the manifest
 * @returns whether the engine is built
 */
export function hasEngine(name: string): boolean {
    return engines.has(name);
}

/**
 * Runs one planned engine check.
 * @param session the session
 * @param planned the check to run
 * @param staged the staged paths, in staged mode
 * @returns the check result with its findings
 */
export async function runEngineCheck(
    session: Session,
    planned: PlannedCheck,
    staged?: Set<string>,
): Promise<CheckResult> {
    const { spec, scope } = planned;
    const base: CheckResult = {
        check: spec.name,
        scope: scope.scope.path,
        status: 'ok',
        files: planned.files.length,
        duration: 0,
        findings: [],
        baselined: 0,
    };
    const name = spec.engine ?? '';
    const engine = engines.get(name);
    if (!engine) return { ...base, status: 'skipped', note: `the ${name} engine is not in this build yet` };
    const started = performance.now();
    try {
        const input: EngineInput = {
            session,
            root: session.root,
            scope: scope.scope.path,
            view: scope.view,
            spec,
            files: planned.files,
        };
        if (staged) input.staged = staged;
        const findings = await engine(input);
        for (const finding of findings) finding.help ??= spec.help;
        return {
            ...base,
            status: findings.length > 0 ? 'fail' : 'ok',
            duration: performance.now() - started,
            findings,
        };
    } catch (error) {
        return { ...base, duration: performance.now() - started, ...failureOf(name, error) };
    }
}
