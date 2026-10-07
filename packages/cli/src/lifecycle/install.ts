import semver from 'semver';
import { runTool } from '#cli/tools/run.ts';
import { isDeepStrictEqual } from 'node:util';
import { GspotError } from '#cli/platform/errors.ts';
import { emitAll } from '#cli/generation/outputs.ts';
import { rootView } from '#cli/policy/settings/view.ts';
import type { Log } from '#cli/types/lifecycle/ownership.ts';
import { EXIT_ERROR } from '#cli/config/platform/runtime.ts';
import { MISE_MIN_VERSION } from '#cli/config/tools/mise.ts';
import type { Session } from '#cli/types/execution/session.ts';
import { preserveMode } from '#cli/lifecycle/ownership/log.ts';
import { applyPlans } from '#cli/lifecycle/ownership/commit.ts';
import { registryEnvironment } from '#cli/tools/npm/registry.ts';
import type { LockPreparation } from '#cli/types/tools/install.ts';
import { proposeReplacement } from '#cli/lifecycle/ownership/plans.ts';
import { installTree } from '#cli/lifecycle/ownership/installations.ts';
import { getHookPlan, installHooks } from '#cli/lifecycle/hooks-path.ts';
import { hasValePackages, installValePackages } from '#cli/tools/vale.ts';
import { applicableManifests } from '#cli/execution/planning/requirements.ts';
import { toolPin, pythonPins, collectPins } from '#cli/configurations/pins.ts';
import { READ_ONLY_FILE, OWNER_WRITABLE_FILE } from '#cli/config/platform/modes.ts';
import { packageInstallSteps, installPackageProject, preparePackageProject } from '#cli/tools/npm/project.ts';
import { installPythonProject, preparePythonProject, pythonInstallationPlan } from '#cli/tools/python/project.ts';

import type {
    InstallationPlan,
    InstallationStep,
    InstallationResult,
    InstallationContext,
} from '#cli/types/lifecycle/install.ts';
import {
    POLICY_FILE,
    VALE_CONFIG,
    YARN_SETTINGS,
    MISE_CONFIG_PATH,
    STYLES_DIRECTORY,
    TOOL_PYTHON_PROJECT,
    TOOL_PACKAGE_PROJECT,
} from '#cli/config/platform/locations.ts';

// Refuse to commit prepared files when another writer changed an input during the run.
function assertInstallationInputs(context: InstallationContext): void {
    for (const [path, original] of context.original)
        if (!isDeepStrictEqual(context.log.files.read(path), original))
            throw new GspotError('installation', `Tool inputs changed: ${path}. Retry gspot install.`);
}

const installations: [InstallationStep, ...InstallationStep[]] = [
    {
        preview: (session, _manifests, generated, refreshLocks) => ({
            notes: [],
            steps: [
                ...generated.files
                    .filter((file) => file.path === TOOL_PYTHON_PROJECT)
                    .flatMap(
                        (file) =>
                            pythonInstallationPlan(session.root, file.content, session.policyFiles.policy.run_with, {
                                refreshLocks,
                            }).installer,
                    ),
                ...generated.files
                    .filter((file) => file.path === TOOL_PACKAGE_PROJECT)
                    .flatMap((file) => packageInstallSteps(session.root, file.content, refreshLocks).slice(0, -1)),
                ...generated.files
                    .filter((file) => file.path === TOOL_PYTHON_PROJECT)
                    .flatMap(
                        (file) =>
                            pythonInstallationPlan(session.root, file.content, session.policyFiles.policy.run_with, {
                                refreshLocks,
                            }).lock,
                    ),
            ],
        }),
        run: async (session, manifests, context) => {
            const { log, inputs, refreshLocks } = context;
            if (pythonPins(manifests).length > 0) await session.pythonInstaller();
            const generated = emitAll(session);
            for (const path of [POLICY_FILE, TOOL_PACKAGE_PROJECT, TOOL_PYTHON_PROJECT, YARN_SETTINGS])
                inputs.read(path);
            await preparePackageProject(session.root, generated.files, inputs, { refreshLocks });
            await preparePythonProject(session, generated.files, inputs, { refreshLocks });
            const files = generated.files.filter(
                (file) =>
                    file.kind === 'lock' ||
                    [TOOL_PACKAGE_PROJECT, TOOL_PYTHON_PROJECT, YARN_SETTINGS].includes(file.path),
            );
            const plans = files.map((file) =>
                proposeReplacement(log, {
                    path: file.path,
                    next: preserveMode(
                        {
                            bytes: Buffer.from(file.content),
                            mode: file.readOnly ? READ_ONLY_FILE : OWNER_WRITABLE_FILE,
                        },
                        inputs.read(file.path),
                    ),
                    kind: file.kind === 'lock' ? 'lock' : 'config',
                    canReplace: file.read !== undefined,
                    expected: file.read,
                }),
            );
            const preserved = plans.filter((plan) => plan.status === 'preserved');
            if (preserved.length > 0)
                throw new GspotError(
                    'installation',
                    `Tool inputs were edited: ${preserved.map((plan) => plan.path).join(', ')}. Move them aside and run gspot install.`,
                );
            assertInstallationInputs(context);
            context.plans.push(...plans);
            for (const file of files)
                context.prepared.set(
                    file.path,
                    preserveMode(
                        {
                            bytes: Buffer.from(file.content),
                            mode: file.readOnly ? READ_ONLY_FILE : OWNER_WRITABLE_FILE,
                        },
                        inputs.read(file.path),
                    ),
                );
            return plans.some((plan) => plan.status === 'changed') ? 'prepared required tool locks' : '';
        },
    },
    {
        preview: (session) => {
            const { command, note } = getHookPlan({
                policy: session.policyFiles.policy,
                repository: session.repository,
            });
            return {
                steps: command === undefined ? [] : [command],
                notes: command === undefined && note !== '' ? [note] : [],
            };
        },
        run: (session) => installHooks({ policy: session.policyFiles.policy, repository: session.repository }),
    },
    {
        preview: (session) => ({
            notes: [],
            steps:
                session.policyFiles.policy.run_with === 'mise'
                    ? [
                          ['mise', 'trust', MISE_CONFIG_PATH],
                          ['mise', 'install'],
                      ]
                    : [],
        }),
        run: async (session, _manifests, _context, preview) => {
            if (session.policyFiles.policy.run_with !== 'mise') return '';
            const read = await runTool(['mise', '--version'], { cwd: session.root });
            const version = semver.coerce(read.stdout);
            if (read.code !== 0 || version === null || semver.lt(version, MISE_MIN_VERSION))
                throw new GspotError('tool', `Install mise ${MISE_MIN_VERSION} or newer to read ${MISE_CONFIG_PATH}.`);
            const notes: string[] = [];
            const env = await registryEnvironment(session.root);
            for (const command of preview.steps) {
                const result = await runTool(command, { cwd: session.root, env });
                const shown = command.join(' ');
                if (result.code !== 0) {
                    const failure = `The installation command ${shown} failed (exit ${String(result.code)}): check the package manager and registry settings.`;
                    throw new GspotError('installation', failure);
                }
                notes.push(`ran ${shown}`);
            }
            return notes.join('; ');
        },
    },
    {
        preview: (session, _manifests, generated) => ({
            notes: [],
            steps:
                session.packageInstaller() === undefined
                    ? []
                    : packageInstallSteps(
                          session.root,
                          generated.files.find((file) => file.path === TOOL_PACKAGE_PROJECT)?.content,
                      ).slice(-1),
        }),
        run: async (session, manifests, context) =>
            session.packageInstaller() === undefined
                ? ''
                : await installPackageProject(session.root, context.inputs, collectPins(manifests)),
    },
    {
        preview: (session, manifests) => ({
            notes: [],
            steps:
                manifests.some((manifest) => manifest.tools.some((tool) => tool.name === 'vale')) &&
                !hasValePackages(session.root)
                    ? [['vale', '--config', VALE_CONFIG, 'sync']]
                    : [],
        }),
        run: async (session, manifests) => {
            if (hasValePackages(session.root)) return '';
            const problem = await installValePackages({
                search: session,
                tool: toolPin(manifests, 'vale'),
                timeoutSeconds: Number(rootView(session.scopes).settings['tool_timeout_seconds']),
                cancelSignal: session.cancelSignal,
            });
            if (problem !== undefined) {
                const failure = `Vale package installation failed: ${problem}. Run: gspot install`;
                throw new GspotError('installation', failure);
            }
            return `installed Vale packages in ${STYLES_DIRECTORY}`;
        },
    },
    {
        preview: (session, manifests, generated) => ({
            notes: [],
            steps:
                pythonPins(manifests).length === 0
                    ? []
                    : pythonInstallationPlan(
                          session.root,
                          generated.files.find((file) => file.path === TOOL_PYTHON_PROJECT)?.content,
                          session.policyFiles.policy.run_with,
                          { refreshLocks: false },
                      ).environment,
        }),
        run: async (session, manifests, context) => {
            if (pythonPins(manifests).length === 0) return '';
            const executable = await session.pythonInstaller();
            return installPythonProject(session.root, context.inputs, executable);
        },
    },
];

async function runInstallationPhases(session: Session, context: InstallationContext): Promise<string[]> {
    const manifests = applicableManifests(session);
    const failures: GspotError[] = [];
    const { preparation, phases } = installationPlan(session, context.refreshLocks);
    const notes = [await preparation.phase.run(session, manifests, context, preparation)];
    for (const installation of phases) {
        try {
            notes.push(await installation.phase.run(session, manifests, context, installation));
        } catch (error) {
            if (!isInstallationFailure(error)) throw error;
            failures.push(error);
        }
    }
    if (failures.length > 0) throw new AggregateError(failures, failures.map((error) => error.message).join('\n'));
    return notes.filter((note) => note !== '');
}

function isInstallationFailure(error: unknown): error is GspotError {
    return error instanceof GspotError && (error.code === 'tool' || error.code === 'installation');
}

/**
 * The installation phases and commands calculated without resolving or downloading tools.
 * @param session the saved policy, scope selections, and repository inventory.
 * @param refreshLocks include fresh resolution of every declared tool pin.
 * @returns the applicable phases and their acquisition commands.
 */
export function installationPlan(session: Session, refreshLocks = false): InstallationPlan {
    const manifests = applicableManifests(session);
    const generated = emitAll(session);
    const [first, ...remaining] = installations;
    const preparation = { phase: first, ...first.preview(session, manifests, generated, refreshLocks) };
    const phases = remaining
        .map((phase) => ({ phase, ...phase.preview(session, manifests, generated, refreshLocks) }))
        .filter(({ steps, notes }) => steps.length > 0 || notes.length > 0);
    return {
        preparation,
        phases,
        steps: [...preparation.steps, ...phases.flatMap(({ steps }) => steps)],
        notes: [...preparation.notes, ...phases.flatMap(({ notes }) => notes)],
    };
}

/**
 * Install tool projects and clone-local hooks, with optional task-runner integration.
 * @param session the selected tools and repository.
 * @param log the command's locked ownership context.
 * @param options whether to resolve declared pins again before installing.
 * @param options.refreshLocks resolve declared pins instead of reusing matching locks.
 * @returns the installation summary and exit code, with a repair command for acquisition failures.
 */
export async function installTools(
    session: Session,
    log: Log,
    { refreshLocks }: LockPreparation,
): Promise<InstallationResult> {
    const context: InstallationContext = {
        log,
        original: new Map(),
        prepared: new Map(),
        plans: [],
        trees: new Map(),
        refreshLocks,
        inputs: {
            read: (path) => {
                const prepared = context.prepared.get(path);
                if (prepared !== undefined) return prepared;
                if (!context.original.has(path)) context.original.set(path, log.files.read(path));
                return context.original.get(path);
            },
            installTree: (kind, outputs) => {
                context.trees.set(kind, outputs);
            },
        },
    };
    let summaries;
    try {
        summaries = await runInstallationPhases(session, context);
    } catch (error) {
        if (
            !isInstallationFailure(error) &&
            !(error instanceof AggregateError && error.errors.every(isInstallationFailure))
        )
            throw error;
        return {
            note: `${error.message}\nTool installation is incomplete. Run: gspot install`,
            exitCode: EXIT_ERROR,
        };
    }
    assertInstallationInputs(context);
    applyPlans(log, context.plans);
    for (const [kind, outputs] of context.trees) installTree(log, kind, outputs);
    return { note: summaries.join('; '), exitCode: 0 };
}
