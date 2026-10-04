import { runTool } from '#cli/tools/run.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { UV_MISE_PIN } from '#cli/config/tools/python.ts';
import { installationDiagnostics } from '#cli/tools/diagnostics.ts';

/**
 * Resolve the Python installer selected by policy before any temporary project runs it.
 * @param root the repository root for runner configuration
 * @param runner the explicitly selected task runner, if any
 * @returns the uv executable used for both lock resolution and installation
 */
export async function acquirePythonInstaller(root: string, runner: string | undefined): Promise<string> {
    if (runner !== 'mise') return 'uv';
    const acquired = await runTool(['mise', 'install', UV_MISE_PIN], { cwd: root });
    if (acquired.missing) throw new GspotError('tool', 'mise is unavailable. Install mise, then rerun the command.');
    if (acquired.code !== 0)
        throw new GspotError(
            'installation',
            `Cannot acquire ${UV_MISE_PIN}. Run: gspot install.
${installationDiagnostics(acquired, [])}`,
        );
    const located = await runTool(['mise', 'which', 'uv', '--tool', UV_MISE_PIN], { cwd: root });
    if (located.code !== 0 || located.stdout.trim() === '')
        throw new GspotError(
            'tool',
            `Cannot locate ${UV_MISE_PIN}. Run: mise install ${UV_MISE_PIN}, then rerun the command.
${installationDiagnostics(located, [])}`,
        );
    return located.stdout.trim();
}
