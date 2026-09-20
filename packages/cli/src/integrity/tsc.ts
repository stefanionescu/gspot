// Selects compiler project mode and confines build metadata to a disposable copy.
import { join } from 'node:path';
import { rmSync, readFileSync } from 'node:fs';
import type { CheckResult } from '#types/finding.ts';
import { parseJsonc } from '#cli/repository/jsonc.ts';
import { runToolCheck } from '#cli/run/tool-runner.ts';
import { scratchCopy } from '#cli/run/scratch-copy.ts';
import type { Session, PlannedCheck } from '#types/run.ts';

function hasReferences(path: string): boolean {
    const config = parseJsonc(readFileSync(path, 'utf8'));
    return (
        typeof config === 'object' &&
        config !== null &&
        'references' in config &&
        Array.isArray(config.references) &&
        config.references.length > 0
    );
}

/**
 * Checks ordinary projects and every project named by a solution configuration.
 * @param session the repository session
 * @param planned the compiler check for one scope
 * @returns compiler findings and the shared tool execution status
 */
export async function checkTypescript(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const references = hasReferences(join(session.root, planned.scope.scope.path, 'tsconfig.json'));
    const command = references
        ? ['tsc', '-b', '--noEmit', '--pretty', 'false']
        : ['tsc', '--noEmit', '-p', 'tsconfig.json', '--pretty', 'false'];
    const check = { ...planned, spec: { ...planned.spec, command } };
    if (!references) return runToolCheck(session, check);
    const scratch = scratchCopy(
        session,
        session.repository.files.map((file) => file.path),
    );
    try {
        const result = await runToolCheck({ ...session, root: scratch }, check);
        if (result.command !== undefined)
            result.command = result.command.map((part) => part.replace(scratch, () => session.root));
        return result;
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
}
