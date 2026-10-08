import { join } from 'node:path';
import { runTool } from '#cli/tools/run.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { environmentExecutable } from '#cli/platform/paths.ts';
import type { ScopeSelection } from '#cli/types/policy/settings.ts';
import { installationDiagnostics } from '#cli/tools/credentials.ts';
import { toolPin, pythonInstallerPin } from '#cli/configurations/pins.ts';

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
    const uv = pythonInstallerPin();
    const pin = `${uv.name}@${uv.version}`;
    const acquired = await runTool(['mise', 'install', pin], { cwd: root, cancelSignal });
    cancelSignal?.throwIfAborted();
    if (acquired.missing) throw new GspotError('tool', 'mise is unavailable. Install mise, then rerun the command.');
    if (acquired.code !== 0)
        throw new GspotError(
            'installation',
            `mise did not install ${pin}. Run mise install ${pin} and read its error.
${installationDiagnostics(acquired, [])}`,
        );
    const located = await runTool(['mise', 'which', 'uv', '--tool', pin], { cwd: root, cancelSignal });
    cancelSignal?.throwIfAborted();
    if (located.code !== 0 || located.stdout.trim() === '')
        throw new GspotError(
            'tool',
            `Cannot locate ${pin}. Run: mise install ${pin}, then rerun the command.
${installationDiagnostics(located, [])}`,
        );
    return located.stdout.trim();
}

/**
 * Run a pinned Python check over the scope's installed project dependencies.
 * @param selection the scope's selected tool declarations
 * @param scopeRoot the native project folder
 * @param command the target executable and its arguments
 * @returns uv's project command without synchronizing the project or its lockfile
 */
export function pythonProjectCommand(
    selection: ScopeSelection,
    scopeRoot: string,
    command: [string, ...string[]],
): string[] {
    const tool = toolPin(selection.selected, command[0]);
    const packagePin = tool.installers['pypi'];
    if (packagePin?.version === undefined)
        throw new GspotError('tool', `The ${tool.name} check has no pinned Python package declaration.`);
    return [
        'uv',
        'run',
        '--no-sync',
        '--project',
        scopeRoot,
        '--python',
        environmentExecutable(join(scopeRoot, '.venv'), 'python'),
        '--with',
        `${packagePin.name}==${packagePin.version}`,
        ...command,
    ];
}
