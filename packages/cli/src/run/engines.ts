// Dispatch to the built-in engines by `engine =` in the manifest.
import type { MergedView } from '#cli/policy/merge.ts';
import { runIntegrity } from '#cli/integrity/dispatch.ts';
import type { PlannedCheck } from '#cli/run/plan.ts';
import type { Session } from '#cli/run/session.ts';
import type { CheckResult, Finding } from '#types/finding.ts';
import type { CheckSpec } from '#types/manifest.ts';
import type { TrackedFile } from '#types/repository.ts';

export type EngineInput = {
    session: Session;
    root: string;
    scope: string;
    view: MergedView;
    spec: CheckSpec;
    files: TrackedFile[];
    staged?: Set<string>;
};

export type Engine = (input: EngineInput) => Promise<Finding[]>;

const engines: Record<string, Engine> = {
    integrity: runIntegrity,
};

/** Registers an engine; the structure, naming and prose engines register themselves when built. */
export function registerEngine(name: string, engine: Engine): void {
    engines[name] = engine;
}

/** True when an engine of this name exists in this build. */
export function hasEngine(name: string): boolean {
    return name in engines;
}

/** Runs one planned engine check. */
export async function runEngineCheck(
    session: Session,
    planned: PlannedCheck,
    staged?: Set<string>,
): Promise<CheckResult> {
    const { spec, scope } = planned;
    const base: CheckResult = {
        id: spec.id,
        scope: scope.scope.path,
        status: 'ok',
        files: planned.files.length,
        duration: 0,
        findings: [],
        baselined: 0,
    };
    const engine = engines[spec.engine ?? ''];
    if (!engine) return { ...base, status: 'skipped', note: `the ${spec.engine} engine is not in this build yet` };
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
        for (const finding of findings) finding.help ??= spec.fix;
        return {
            ...base,
            status: findings.length > 0 ? 'fail' : 'ok',
            duration: performance.now() - started,
            findings,
        };
    } catch (error) {
        return {
            ...base,
            status: 'error',
            duration: performance.now() - started,
            note: `the ${spec.engine} engine failed: ${(error as Error).message}`,
        };
    }
}
