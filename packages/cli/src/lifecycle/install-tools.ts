import { installHooks } from '#cli/lifecycle/hooks.ts';
import { UV_INSTALLER } from '#config/installers.ts';
import { InstallationError } from '#cli/lifecycle/install-error.ts';
import semver from 'semver';
import { MissingToolError } from '#cli/platform/missing-tool.ts';
import { MISE_CONFIG_PATH, MISE_MIN_VERSION } from '#cli/emit/runner-tasks.ts';
import { installPythonProject } from '#cli/lifecycle/python-project.ts';
import { installPackageProject } from '#cli/lifecycle/package-project.ts';
import { runToolCommand } from '#cli/run/tool-runner.ts';
import { packageEnvironment } from '#cli/platform/package-environment.ts';
import { toolEnvironment } from '#cli/emit/tool-environment.ts';
import type { Session } from '#types/run.ts';

async function runInstall(root: string, commands: string[][]): Promise<string> {
    const notes: string[] = [];
    const env = await packageEnvironment(root);
    for (const command of commands) {
        const result = await runToolCommand(undefined, command, { cwd: root, env });
        const shown = command.join(' ');
        if (result.code !== 0)
            throw new InstallationError(
                `The installation command ${shown} failed (exit ${String(result.code)}): check the package manager and registry settings.`,
            );
        notes.push(`ran ${shown}`);
    }
    return notes.join('; ');
}

/**
 * Install private tool projects and clone-local hooks, with optional task-runner integration.
 * @param session the selected tools and repository
 * @param isInstalling whether init was asked to install
 * @returns the installation summary
 */
export async function installTools(session: Session, isInstalling: boolean): Promise<string> {
    const { root } = session;
    const runner = session.policyFiles.policy.runner?.tool;
    if (!isInstalling) {
        return 'install skipped; run: gspot install';
    }
    const hookNote = installHooks(session);
    const notes: string[] = hookNote === '' ? [] : [hookNote];
    const failures: Error[] = [];
    try {
        if (runner === 'mise') {
            const observed = await runToolCommand(undefined, ['mise', '--version'], { cwd: root });
            const version = semver.coerce(observed.stdout);
            if (observed.code !== 0 || version === null || semver.lt(version, MISE_MIN_VERSION))
                throw new MissingToolError(`Install mise ${MISE_MIN_VERSION} or newer to load ${MISE_CONFIG_PATH}.`);
        }
        const commands =
            runner === 'mise'
                ? [
                      ['mise', 'trust', MISE_CONFIG_PATH],
                      ['mise', 'install'],
                  ]
                : [];
        if (commands.length > 0) notes.push(await runInstall(root, commands));
    } catch (error) {
        failures.push(error instanceof Error ? error : new Error('Native tool installation failed.'));
    }
    try {
        const installed = session.packageManager === undefined ? '' : await installPackageProject(root);
        if (installed !== '') notes.push(installed);
    } catch (error) {
        failures.push(error instanceof Error ? error : new Error('Package installation failed.'));
    }
    try {
        if (toolEnvironment(session).length > 0) {
            let executable = 'uv';
            if (runner === 'mise') {
                const located = await runToolCommand(
                    undefined,
                    ['mise', 'which', 'uv', '--tool', `${UV_INSTALLER.name}@${UV_INSTALLER.version}`],
                    { cwd: root },
                );
                if (located.code !== 0 || located.stdout.trim() === '')
                    throw new MissingToolError('The pinned uv installer is unavailable. Run: gspot install');
                executable = located.stdout.trim();
            }
            const installed = await installPythonProject(root, executable);
            if (installed !== '') notes.push(installed);
        }
    } catch (error) {
        failures.push(error instanceof Error ? error : new Error('Python installation failed.'));
    }
    if (failures.length > 0)
        throw new AggregateError(failures, [...notes, ...failures.map((error) => error.message)].join('\n'));
    return notes.join('; ');
}
