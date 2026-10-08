// Git runs the gspot hooks through core.hooksPath. A repository that already runs hooks keeps them, and gets the
// lines to add to them instead.
import semver from 'semver';
import { GspotError } from '#cli/platform/public.ts';
import { CLI_PINS } from '#cli/config/generation/pins.ts';
import { rootView } from '#cli/policy/settings/public.ts';
import { prepareToolProjects } from '#cli/tools/public.ts';
import type { Log } from '#cli/types/lifecycle/ownership.ts';
import { EXIT_ERROR } from '#cli/config/platform/runtime.ts';
import { applicableManifests } from '#cli/planning/public.ts';
import { packageToolProject } from '#cli/tools/npm/public.ts';
import type { ToolProject } from '#cli/types/tools/project.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import type { Generated } from '#cli/types/generation/files.ts';
import { applyPlans } from '#cli/lifecycle/ownership/public.ts';
import { pythonToolProject } from '#cli/tools/python/public.ts';
import { registryEnvironment } from '#cli/tools/npm/contracts.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/platform/modes.ts';
import type { LockfilePreparation } from '#cli/types/tools/install.ts';
import { planReplacement } from '#cli/lifecycle/ownership/contracts.ts';
import { toolPin, pythonPins, collectPins } from '#cli/configurations/contracts.ts';
import { installTree, readInstalledTree } from '#cli/lifecycle/ownership/state/public.ts';
import { runTool, installToolProject, toolInstallationPlan } from '#cli/tools/contracts.ts';
import { getHookPlan, installHooks, hasValePackages, installValePackages } from '#cli/lifecycle/install/contracts.ts';

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
    TOOL_PYTHON_PROJECT,
    TOOL_PACKAGE_PROJECT,
    VALE_PACKAGE_DIRECTORY,
} from '#cli/config/platform/locations.ts';

// Previews share the same authored runner and generated manifest lookup.
function projectPreview<Parsed, Preparation, Installation>(
    session: ToolSession,
    generated: Generated,
    description: ToolProject<Parsed, Preparation, Installation>,
    refreshLockfiles = false,
) {
    const manifest = generated.files.find((file) => file.path === description.manifestPath);
    if (manifest === undefined) return { installer: [], lockfile: [], environment: [] };
    return toolInstallationPlan(session.root, description, manifest.content, session.policyFiles.policy.runner, {
        refreshLockfiles,
    });
}

const installations: [InstallationStep, ...InstallationStep[]] = [
    {
        preview: (session, _manifests, generated, refreshLockfiles) => {
            const python = projectPreview(session, generated, pythonToolProject, refreshLockfiles);
            const packages = projectPreview(session, generated, packageToolProject, refreshLockfiles);
            return { notes: [], steps: [...python.installer, ...packages.lockfile, ...python.lockfile] };
        },
        run: async (session, manifests, context) => {
            const { log, inputs, refreshLockfiles, generated } = context;
            if (pythonPins(manifests).length > 0) await session.pythonInstaller(session.cancelSignal);
            for (const path of [POLICY_FILE, TOOL_PACKAGE_PROJECT, TOOL_PYTHON_PROJECT, YARN_SETTINGS])
                inputs.read(path);
            await prepareToolProjects(session, generated.files, inputs, { refreshLockfiles });
            const files = generated.files.filter(
                (file) =>
                    file.kind === 'lock' ||
                    [TOOL_PACKAGE_PROJECT, TOOL_PYTHON_PROJECT, YARN_SETTINGS].includes(file.path),
            );
            const plans = files.map((file) => {
                const next = { bytes: Buffer.from(file.content), mode: OWNER_WRITABLE_FILE };
                context.prepared.set(file.path, next);
                return planReplacement(log, {
                    path: file.path,
                    next,
                    kind: file.kind === 'lock' ? 'lock' : 'tool_file',
                    canReplace: file.read !== undefined,
                    expected: file.read,
                });
            });
            const preserved = plans.filter((plan) => plan.status === 'preserved');
            if (preserved.length > 0)
                throw new GspotError(
                    'installation',
                    `Tool inputs were edited: ${preserved.map((plan) => plan.path).join(', ')}. Move them aside and run gspot install.`,
                );
            context.plans.push(...plans);
            return plans.some((plan) => plan.status === 'changed') ? 'prepared required tool lockfiles' : '';
        },
    },
    {
        preview: (session) => {
            const { command, note, path } = getHookPlan({
                policy: session.policyFiles.policy,
                repository: session.repository,
            });
            return {
                steps: command === undefined ? [] : [command],
                notes: command === undefined && note !== '' ? [note] : [],
                ...(path === undefined ? {} : { hooks: path }),
            };
        },
        run: (session) => installHooks({ policy: session.policyFiles.policy, repository: session.repository }),
    },
    {
        preview: (session) => ({
            notes: [],
            steps:
                session.policyFiles.policy.runner === 'mise'
                    ? [
                          ['mise', 'trust', MISE_CONFIG_PATH],
                          ['mise', 'install'],
                      ]
                    : [],
        }),
        run: async (session, _manifests, _context, preview) => {
            if (session.policyFiles.policy.runner !== 'mise') return '';
            const read = await runTool(['mise', '--version'], { cwd: session.root });
            const version = semver.coerce(read.stdout);
            if (read.code !== 0 || version === null || semver.lt(version, CLI_PINS.mise.version))
                throw new GspotError(
                    'tool',
                    `Install mise ${CLI_PINS.mise.version} or newer to read ${MISE_CONFIG_PATH}.`,
                );
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
                    : projectPreview(session, generated, packageToolProject).environment,
        }),
        run: async (session, manifests, context) =>
            session.packageInstaller() === undefined
                ? ''
                : await installToolProject(packageToolProject, context.inputs, {
                      root: session.root,
                      tools: collectPins(manifests),
                  }),
    },
    {
        preview: (session, manifests) => ({
            notes: [],
            steps:
                manifests.some((manifest) => manifest.tools.some((tool) => tool.name === 'vale')) &&
                !hasValePackages(session.root, session.policyFiles.policy.level)
                    ? [['vale', '--config', VALE_CONFIG, 'sync']]
                    : [],
        }),
        run: async (session, manifests, context) => {
            if (hasValePackages(session.root, session.policyFiles.policy.level)) return '';
            const problem = await installValePackages({
                owner: context.inputs,
                level: session.policyFiles.policy.level,
                search: session,
                tool: toolPin(manifests, 'vale'),
                timeoutSeconds: Number(rootView(session.scopes).settings['tool_timeout_seconds']),
                cancelSignal: session.cancelSignal,
            });
            if (problem === undefined) return `installed Vale packages in ${VALE_PACKAGE_DIRECTORY}`;
            const failure = `Vale package installation failed: ${problem}. Run: gspot install`;
            throw new GspotError('installation', failure);
        },
    },
    {
        preview: (session, manifests, generated) => ({
            notes: [],
            steps:
                pythonPins(manifests).length === 0
                    ? []
                    : projectPreview(session, generated, pythonToolProject).environment,
        }),
        run: async (session, manifests, context) => {
            if (pythonPins(manifests).length === 0) return '';
            const executable = await session.pythonInstaller(session.cancelSignal);
            return installToolProject(pythonToolProject, context.inputs, {
                root: session.root,
                executable,
                cancelSignal: session.cancelSignal,
            });
        },
    },
];

async function runInstallationPhases(session: ToolSession, context: InstallationContext): Promise<string[]> {
    const manifests = applicableManifests(session);
    const failures: GspotError[] = [];
    const { preparation, phases } = installationPlan(session, context.generated, context.refreshLockfiles);
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
 * @param generated the outputs calculated once for this preview or installation.
 * @param refreshLockfiles include fresh resolution of every declared tool pin.
 * @returns the applicable phases and their install commands.
 */
export function installationPlan(
    session: ToolSession,
    generated: Generated,
    refreshLockfiles = false,
): InstallationPlan {
    const manifests = applicableManifests(session);
    const [first, ...remaining] = installations;
    const preparation = { phase: first, ...first.preview(session, manifests, generated, refreshLockfiles) };
    const phases = remaining
        .map((phase) => ({ phase, ...phase.preview(session, manifests, generated, refreshLockfiles) }))
        .filter(({ steps, notes }) => steps.length > 0 || notes.length > 0);
    const hooks = phases.find((phase) => phase.hooks !== undefined)?.hooks;
    return {
        preparation,
        phases,
        ...(hooks === undefined ? {} : { hooks }),
        steps: [...preparation.steps, ...phases.flatMap(({ steps }) => steps)],
        notes: [...preparation.notes, ...phases.flatMap(({ notes }) => notes)],
    };
}

/**
 * Install tool projects and clone-local hooks, with optional task-runner integration.
 * @param session the selected tools and repository.
 * @param log the command's locked ownership context.
 * @param generated the outputs calculated once for this installation.
 * @param options whether to resolve declared pins again before installing.
 * @param options.refreshLockfiles resolve declared pins instead of reusing matching lockfiles.
 * @returns the installation summary and exit code, with a repair command for installation failures.
 */
export async function installTools(
    session: ToolSession,
    log: Log,
    generated: Generated,
    { refreshLockfiles }: LockfilePreparation,
): Promise<InstallationResult> {
    const context: InstallationContext = {
        log,
        generated,
        original: new Map(),
        prepared: new Map(),
        plans: [],
        trees: new Map(),
        refreshLockfiles,
        inputs: {
            read: (path) => {
                const prepared = context.prepared.get(path);
                if (prepared !== undefined) return prepared;
                if (!context.original.has(path)) context.original.set(path, log.files.read(path));
                return context.original.get(path);
            },
            installTree: (kind, directory) => {
                context.trees.set(kind, readInstalledTree(directory, kind));
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
    applyPlans(log, context.plans);
    for (const [kind, outputs] of context.trees) installTree(log, kind, outputs);
    return { note: summaries.join('; '), exitCode: 0 };
}
