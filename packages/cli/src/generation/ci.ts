import type { Session } from '#cli/types/session.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { findSystemSkip } from '#cli/planning/skips.ts';
import { listCheckTools } from '#cli/planning/tools.ts';
import { formatHeader } from '#cli/generation/header.ts';
import { GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { PACKAGE_MANAGERS } from '#cli/config/repository/npm.ts';
import { readPackageJson } from '#cli/repository/dependencies.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import { OPERATING_SYSTEMS } from '#cli/config/system/environment.ts';
import { CHECK_LIST_SEPARATOR } from '#cli/config/commands/check/check.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects/dependencies.ts';
import { compareText, quoteCommand, quoteArgument } from '#cli/system/text.ts';
import { getUvPin, findMisePin, findMissingBuild } from '#cli/configurations/tools.ts';
import type { Pipeline, ActionPin, FrozenLockfile } from '#cli/types/generation/ci.ts';
import { TOOL_BUILDS, NEXTJS_CONFIGURATION } from '#cli/config/configurations/names.ts';
import { Scalar, Document, type Node, stringify, type YAMLMap, type YAMLSeq } from 'yaml';
import type { PackageManager, PackageManagerPin } from '#cli/types/repository/npm/package-manager.ts';

import {
    isYarnBerry,
    readPackageManagerPin,
    readPackageManagerVersion,
    buildPackageManagerCommand,
} from '#cli/repository/npm/package-manager.ts';
import {
    CI_PINS,
    CI_NODE,
    CI_JOB_NAME,
    GITLAB_RULES,
    CACHED_PATHS,
    CI_DIFF_LINES,
    CI_CACHE_STEP,
    CI_STEP_NAMES,
    GITHUB_EVENTS,
    CI_CACHE_FILES,
    CI_CACHE_PREFIX,
    FROZEN_INSTALLS,
    GITHUB_WORKFLOW,
    GITLAB_WORKFLOW,
    CI_BASE_VARIABLE,
    CHECKOUT_OPTIONS,
    GITLAB_BASE_LINE,
    NEXT_TYPEGEN_LINE,
    YARN_BERRY_INSTALL,
    GITHUB_CONCURRENCY,
    CI_TIMEOUT_MINUTES,
    CI_CACHE_SAVED_KEY,
    GITHUB_PUSH_CONDITION,
    GITHUB_SLOW_CONDITION,
    MISE_TOKEN_ENVIRONMENT,
    GITHUB_BASE_EXPRESSION,
    CI_CACHE_MISS_CONDITION,
    GITLAB_MANUAL_CONDITION,
} from '#cli/config/generation/ci.ts';

function buildActionPin({ name, sha, version }: ActionPin): Scalar {
    const node = new Scalar(`${name}@${sha}`);
    node.comment = ` ${version}`;
    return node;
}

function buildGspotCommand(pipeline: Pipeline): string {
    const { packageManager } = pipeline;
    const tools = [CI_NODE, `npm:${cliPackage.name}[allow_low_downloads=true]@${pipeline.version}`];
    if (packageManager !== undefined && packageManager.name !== 'npm')
        tools.push(`${packageManager.name}@${packageManager.version}`);
    return `mise exec ${quoteCommand(tools)} -- gspot`;
}

function selectManualChecks(pipeline: Pipeline, platform: Pipeline['operatingSystems'][number], arch: string) {
    const checks = pipeline.manualChecks.filter(
        (planned) => findSystemSkip(planned.check, planned.tool, { platform, arch }) === undefined,
    );
    const required = new Set(checks.flatMap((check) => listCheckTools(check)));
    const tools = pipeline.tools.flatMap((tool) => {
        const pin = findMisePin(tool);
        return pin !== undefined && required.has(tool.name) && findMissingBuild(tool, { platform, arch }) === undefined
            ? pin.name
            : [];
    });
    return {
        checks: [...new Set(checks.map((planned) => planned.check.id))].toSorted((first, second) =>
            compareText(first, second),
        ),
        tools,
    };
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Inlined, it puts buildJob over the 60-line function limit.
function listInstallSteps(pipeline: Pipeline, command: string): Record<string, unknown>[] {
    return [
        {
            name: CI_STEP_NAMES.mise,
            uses: buildActionPin(CI_PINS.actions.mise),
            with: { version: CI_PINS.mise.version, cache: false },
        },
        ...(pipeline.setupCommand === undefined
            ? []
            : [
                  {
                      name: CI_STEP_NAMES.setup,
                      run: quoteCommand(pipeline.setupCommand),
                  },
              ]),
        ...(pipeline.projectInstall.length === 0
            ? []
            : [{ name: CI_STEP_NAMES.projectInstall, run: pipeline.projectInstall.join('\n') }]),
        {
            name: CI_STEP_NAMES.install,
            env: { ...MISE_TOKEN_ENVIRONMENT },
            run: [`${command} install`, ...CI_DIFF_LINES].join('\n'),
        },
    ];
}

function buildJob(pipeline: Pipeline, platform: Pipeline['operatingSystems'][number]): Record<string, unknown> {
    const machine = CI_PINS.githubRunners[platform];
    const command = buildGspotCommand(pipeline);
    const slow = selectManualChecks(pipeline, platform, machine.arch);
    const hashed = [...CI_CACHE_FILES, ...pipeline.lockfiles].map((path) => `'${path}'`).join(', ');
    const cache = {
        key: `${CI_CACHE_PREFIX}${pipeline.version}-\${{ hashFiles(${hashed}) }}`,
        path: `${CACHED_PATHS.join('\n')}\n`,
    };
    return {
        'runs-on': platform === 'linux' ? pipeline.linuxRunner : machine.label,
        'timeout-minutes': CI_TIMEOUT_MINUTES,
        if: GITHUB_PUSH_CONDITION,
        defaults: { run: { shell: 'bash' } },
        steps: [
            { name: CI_STEP_NAMES.checkout, uses: buildActionPin(CI_PINS.actions.checkout), with: CHECKOUT_OPTIONS },
            {
                name: CI_STEP_NAMES.restoreCache,
                id: CI_CACHE_STEP,
                uses: buildActionPin(CI_PINS.actions.restoreCache),
                with: { ...cache, 'restore-keys': CI_CACHE_PREFIX },
            },
            ...listInstallSteps(pipeline, command),
            {
                name: CI_STEP_NAMES.saveCache,
                if: CI_CACHE_MISS_CONDITION,
                uses: buildActionPin(CI_PINS.actions.saveCache),
                with: { key: CI_CACHE_SAVED_KEY, path: cache.path },
            },
            {
                name: CI_STEP_NAMES.check,
                env: { [CI_BASE_VARIABLE]: GITHUB_BASE_EXPRESSION },
                run: `${command} check --changed "\${${CI_BASE_VARIABLE}}"\n`,
            },
            ...(slow.checks.length === 0
                ? []
                : [
                      {
                          name: CI_STEP_NAMES.slow,
                          if: GITHUB_SLOW_CONDITION,
                          ...(slow.tools.length > 0 && { env: { ...MISE_TOKEN_ENVIRONMENT } }),
                          run: listManualLines(command, slow).join('\n') + '\n',
                      },
                  ]),
        ],
    };
}

function spaceWorkflowGroups(workflow: Document): void {
    const root = workflow.contents as YAMLMap<Scalar, Node>;
    for (const { key } of root.items.slice(1)) key.spaceBefore = true;
    const jobs = workflow.get('jobs', true) as YAMLMap<Scalar, YAMLMap<Scalar, Node>>;
    for (const { key } of jobs.items.slice(1)) key.spaceBefore = true;
    for (const { value } of jobs.items) {
        const steps = (value as YAMLMap<Scalar, Node>).get('steps') as YAMLSeq<Node>;
        for (const step of steps.items.slice(1)) step.spaceBefore = true;
    }
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in this file share it.
function listManualLines(command: string, manual: { checks: string[]; tools: string[] }): string[] {
    return [
        ...(manual.tools.length === 0 ? [] : [`(cd ${GSPOT_FOLDER} && mise install ${quoteCommand(manual.tools)})`]),
        `${command} check --only ${quoteArgument(manual.checks.join(CHECK_LIST_SEPARATOR))}`,
    ];
}

/**
Build one lint job for each system, each with one mise setup.

@param pipeline what the workflow runs.

@returns the GitHub workflow file.
*/
export function buildGithubWorkflow(pipeline: Pipeline): GeneratedFile {
    const platforms = [...new Set([...pipeline.operatingSystems, ...(pipeline.hasSwift ? (['macos'] as const) : [])])];
    const jobs = platforms.map((platform): [string, Record<string, unknown>] =>
        platforms.length === 1
            ? [CI_JOB_NAME, buildJob(pipeline, platform)]
            : [`${CI_JOB_NAME}-${platform}`, { name: `${CI_JOB_NAME} (${platform})`, ...buildJob(pipeline, platform) }],
    );
    const workflow = new Document(
        {
            name: 'gspot',
            on: GITHUB_EVENTS,
            permissions: { contents: 'read' },
            concurrency: GITHUB_CONCURRENCY,
            jobs: Object.fromEntries(jobs),
        },
        { aliasDuplicateObjects: false },
    );
    spaceWorkflowGroups(workflow);
    const content = `${formatHeader(GITHUB_WORKFLOW)}${workflow.toString({ lineWidth: 0 })}`;
    return { path: GITHUB_WORKFLOW, content, kind: 'workflow' };
}

/**
Build a GitLab include, and leave the authored pipeline unchanged. Platform and Swift choices do not apply.

@param pipeline what the include runs.

@returns the GitLab include file.
*/
export function buildGitlabWorkflow(pipeline: Pipeline): GeneratedFile {
    const command = buildGspotCommand(pipeline);
    const setup = pipeline.setupCommand === undefined ? pipeline.projectInstall : [quoteCommand(pipeline.setupCommand)];
    const check = [GITLAB_BASE_LINE, `${command} check --changed "\${${CI_BASE_VARIABLE}}"`].join('\n');
    const builds = OPERATING_SYSTEMS.flatMap((system) =>
        TOOL_BUILDS.filter((build) => build.startsWith(`${system.name}-`)).flatMap((build) => {
            const arch = build.slice(system.name.length + 1);
            const manual = selectManualChecks(pipeline, system.name, arch);
            return manual.checks.length === 0
                ? []
                : { pattern: `${system.nodeName}/${arch}`, lines: listManualLines(command, manual) };
        }),
    );
    const branches = [...Map.groupBy(builds, ({ lines }) => lines.join('\n'))].flatMap(([lines, group]) => [
        `    ${group.map(({ pattern }) => pattern).join('|')})`,
        ...lines.split('\n').map((line) => `        ${line}`),
        '        ;;',
    ]);
    const manual =
        branches.length === 0
            ? []
            : [
                  [
                      `if ${GITLAB_MANUAL_CONDITION}; then`,
                      `    case "$(mise exec ${CI_NODE} -- node -p 'process.platform + "/" + process.arch')" in`,
                      ...branches,
                      '    esac',
                      'fi',
                  ].join('\n'),
              ];
    const content = stringify({
        gspot: {
            stage: 'test',
            timeout: `${String(CI_TIMEOUT_MINUTES)}m`,
            variables: { GIT_DEPTH: '0' },
            rules: GITLAB_RULES,
            script: ['set -euo pipefail', ...setup, `${command} install`, ...CI_DIFF_LINES, check, ...manual],
        },
    });
    return { path: GITLAB_WORKFLOW, content: `${formatHeader(GITLAB_WORKFLOW)}${content}`, kind: 'workflow' };
}

function readProjectPackageManager(session: Session, scope: string, name: PackageManagerPin['name']): PackageManager {
    const packageJson = readPackageJson(session.root, joinScope(scope, PACKAGE_JSON));
    const written = packageJson === undefined ? undefined : readPackageManagerPin(packageJson);
    const pin = [written, session.packageManager].find((each) => each?.name === name) ?? { name };
    return readPackageManagerVersion(session.toolsRoot, pin, session.timeoutSeconds, session.reads);
}

function buildFrozenInstall(session: Session, scope: string, lockfile: FrozenLockfile): readonly string[] {
    const command = FROZEN_INSTALLS[lockfile];
    const name = PACKAGE_MANAGERS.find((tool) => tool === command[0]);
    const runner = name === undefined ? getUvPin() : readProjectPackageManager(session, scope, name);
    const args =
        runner.name === 'yarn' && isYarnBerry({ name: 'yarn', version: runner.version })
            ? YARN_BERRY_INSTALL.slice(1)
            : command.slice(1);
    return buildPackageManagerCommand(runner, args);
}

/**
List the tracked lockfiles of the root and of each scope, which CI installs from and keys its cache on.

@param session the repository and its scopes.
@returns the repository paths of the lockfiles.
*/
export function listProjectLockfiles(session: Session): string[] {
    const tracked = new Set(session.repository.files.map((file) => file.path));
    return session.scopes.flatMap(({ path: scopePath }) =>
        (Object.keys(FROZEN_INSTALLS) as FrozenLockfile[])
            .map((lockfile) => joinScope(scopePath, lockfile))
            .filter((path) => tracked.has(path)),
    );
}

/**
List the shell lines that install the locked dependencies of each project, then write the route types of each
Next.js project, which typed lint rules read.

@param session the repository, its scopes, and its tools.
@returns the lines, each run from the repository root.
*/
export function listProjectInstallLines(session: Session): string[] {
    const lockfiles = new Set(listProjectLockfiles(session));
    return session.scopes.flatMap(({ path: scopePath, configurations }) => {
        const installs = (Object.keys(FROZEN_INSTALLS) as FrozenLockfile[])
            .filter((lockfile) => lockfiles.has(joinScope(scopePath, lockfile)))
            .map((lockfile) => quoteCommand(buildFrozenInstall(session, scopePath, lockfile)));
        const isNext = configurations.some((configuration) => configuration.name === NEXTJS_CONFIGURATION);
        const lines = [...installs, ...(isNext && installs.length > 0 ? [NEXT_TYPEGEN_LINE] : [])];
        return scopePath === '' ? lines : lines.map((line) => `(cd ${quoteArgument(scopePath)} && ${line})`);
    });
}
