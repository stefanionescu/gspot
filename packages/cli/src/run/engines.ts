import { resolveProse } from '#cli/prose/engine.ts';
import { resolveNaming } from '#cli/naming/engine.ts';
// Dispatch to the built-in engines by `engine =` in the manifest.
import type { CheckSpec } from '#types/manifest.ts';
import type { CheckResult } from '#types/finding.ts';
import { resolveIntegrity } from '#cli/checks/dispatch.ts';
import { resolveStructure } from '#cli/structure/engine.ts';
import { MissingToolError } from '#cli/platform/missing-tool.ts';
import { SkippedCheckError } from '#cli/platform/skipped-check.ts';
import type { EngineInput, Engine, Session, PlannedCheck } from '#types/run.ts';

const engines: Record<NonNullable<CheckSpec['engine']>, (spec: CheckSpec) => Engine> = {
    integrity: resolveIntegrity,
    naming: resolveNaming,
    structure: resolveStructure,
    prose: resolveProse,
};

// Classify missing tools and unmet prerequisites separately from engine errors.
function failureOf(name: string, error: unknown): Pick<CheckResult, 'status' | 'note'> {
    if (error instanceof SkippedCheckError) return { status: 'skipped', note: error.message };
    if (error instanceof MissingToolError) return { status: 'missing', note: error.message };
    return { status: 'error', note: `the ${name} engine failed: ${(error as Error).message}` };
}

/**
 * Runs one planned engine check.
 * @param session the session
 * @param engine the implementation selected during planning
 * @param planned the check to run
 * @param staged the staged paths, in staged mode
 * @returns the check result with its findings
 */
export async function runEngineCheck(
    session: Session,
    engine: Engine,
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
    };
    const name = spec.engine;
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
        for (const finding of findings) {
            if (name !== undefined) finding.engine = name;
            finding.help ??= spec.help;
        }
        return {
            ...base,
            status: findings.length > 0 ? 'fail' : 'ok',
            duration: performance.now() - started,
            findings,
        };
    } catch (error) {
        return { ...base, duration: performance.now() - started, ...failureOf(name ?? spec.name, error) };
    }
}

/** Resolve a built-in implementation without executing its preparation or inspecting source files. */
export function resolveEngine(spec: CheckSpec & { engine: NonNullable<CheckSpec['engine']> }): Engine {
    return engines[spec.engine](spec);
}
