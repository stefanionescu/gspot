// Selects compiler project mode and confines build metadata to a disposable copy.
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import type { CheckResult } from '#types/finding.ts';
import { runToolCheck } from '#cli/run/tool-runner.ts';
import { scratchCopy } from '#cli/run/scratch-copy.ts';
import { getTsconfig } from '#cli/repository/tsconfig.ts';
import type { Session, PlannedCheck } from '#types/run.ts';

/**
 * Checks ordinary projects and every project named by a solution configuration.
 * @param session the repository session
 * @param planned the compiler check for one scope
 * @returns compiler findings and the shared tool execution status
 */
export async function checkTypescript(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const config = getTsconfig(join(session.root, planned.scope.scope.path, 'tsconfig.json'));
    const references = (config?.projectReferences?.length ?? 0) > 0;
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
