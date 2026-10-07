import { runTool } from '#cli/tools/run.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { UV_MISE_PIN } from '#cli/config/tools/python.ts';
import { installationDiagnostics } from '#cli/tools/credentials.ts';

/**
 * Resolve uv through the selected runner before a temporary project uses it.
 * @param root the repository root for runner configuration
 * @param runner the explicitly selected task runner, if any
 * @param cancelSignal the command cancellation
 * @returns the uv executable used for both lockfile creation and installation
 */
export async function acquirePythonInstaller(
    root: string,
    runner: string | undefined,
    cancelSignal: AbortSignal | undefined,
): Promise<string> {
    if (runner !== 'mise') return 'uv';
    const acquired = await runTool(['mise', 'install', UV_MISE_PIN], { cwd: root, cancelSignal });
    cancelSignal?.throwIfAborted();
    if (acquired.missing) throw new GspotError('tool', 'mise is unavailable. Install mise, then rerun the command.');
    if (acquired.code !== 0)
        throw new GspotError(
            'installation',
            `mise did not install ${UV_MISE_PIN}. Run mise install ${UV_MISE_PIN} and read its error.
${installationDiagnostics(acquired, [])}`,
        );
    const located = await runTool(['mise', 'which', 'uv', '--tool', UV_MISE_PIN], { cwd: root, cancelSignal });
    cancelSignal?.throwIfAborted();
    if (located.code !== 0 || located.stdout.trim() === '')
        throw new GspotError(
            'tool',
            `Cannot locate ${UV_MISE_PIN}. Run: mise install ${UV_MISE_PIN}, then rerun the command.
${installationDiagnostics(located, [])}`,
        );
    return located.stdout.trim();
}
