import semver from 'semver';
import { pythonPins } from '#cli/tools/pins.ts';
import { everyManifest } from '#cli/kits/select.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { runToolCommand } from '#cli/tools/command.ts';
import type { Session } from '#cli/types/tools/tools.ts';
import { UV_INSTALLER } from '#cli/config/tools/tools.ts';
import { asOwner } from '#cli/lifecycle/ownership/owner.ts';
import { installHooks } from '#cli/lifecycle/hooks-path.ts';
import { installPythonProject } from '#cli/tools/python.ts';
import type { InstallationStep } from '#cli/types/commands/install.ts';
import { installPackageProject } from '#cli/tools/packages/project.ts';
import { packageEnvironment } from '#cli/tools/packages/environment.ts';
import { MISE_CONFIG_PATH, MISE_MIN_VERSION } from '#cli/config/generation/generation.ts';

const installations: InstallationStep[] = [
    {
        failure: 'Hook installation failed.',
        run: (session) => installHooks({ policy: session.policyFiles.policy, repository: session.repository }),
    },
    {
        failure: 'Native tool installation failed.',
        run: async (session) => {
            if (session.policyFiles.policy.runner !== 'mise') return '';
            const read = await runToolCommand(undefined, ['mise', '--version'], { cwd: session.root });
            const version = semver.coerce(read.stdout);
            if (read.code !== 0 || version === null || semver.lt(version, MISE_MIN_VERSION))
                throw new GspotError('tool', `Install mise ${MISE_MIN_VERSION} or newer to load ${MISE_CONFIG_PATH}.`);
            return runInstall(session.root, [
                ['mise', 'trust', MISE_CONFIG_PATH],
                ['mise', 'install'],
            ]);
        },
    },
    {
        failure: 'Package installation failed.',
        run: async (session, manifests) =>
            session.packageClient === undefined
                ? ''
                : await asOwner(session.root, (owner) =>
                      installPackageProject(
                          session.root,
                          owner,
                          manifests.flatMap((manifest) => manifest.tools),
                      ),
                  ),
    },
    {
        failure: 'Python installation failed.',
        run: async (session, manifests) => {
            if (pythonPins(manifests).length === 0) return '';
            let executable = 'uv';
            if (session.policyFiles.policy.runner === 'mise') {
                const located = await runToolCommand(
                    undefined,
                    ['mise', 'which', 'uv', '--tool', `${UV_INSTALLER.name}@${UV_INSTALLER.version}`],
                    { cwd: session.root },
                );
                if (located.code !== 0 || located.stdout.trim() === '')
                    throw new GspotError('tool', 'The pinned uv installer is unavailable. Run: gspot install');
                executable = located.stdout.trim();
            }
            return asOwner(session.root, (owner) => installPythonProject(session.root, owner, executable));
        },
    },
];

async function runInstall(root: string, commands: string[][]): Promise<string> {
    const notes: string[] = [];
    const env = await packageEnvironment(root);
    for (const command of commands) {
        const result = await runToolCommand(undefined, command, { cwd: root, env });
        const shown = command.join(' ');
        if (result.code !== 0)
            throw new GspotError(
                'installation',
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
    if (!isInstalling) return 'install skipped; run: gspot install';
    const manifests = everyManifest(session.scopes);
    const notes: string[] = [];
    const failures: Error[] = [];
    for (const installation of installations) {
        try {
            notes.push(await installation.run(session, manifests));
        } catch (error) {
            failures.push(error instanceof Error ? error : new Error(installation.failure));
        }
    }
    const summaries = notes.filter((note) => note !== '');
    if (failures.length > 0)
        throw new AggregateError(failures, [...summaries, ...failures.map((error) => error.message)].join('\n'));
    return summaries.join('; ');
}
