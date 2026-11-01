import { GspotError } from '#cli/system/errors.ts';
import { PACKAGE_JSON } from '#cli/config/parsers.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { CI_PINS } from '#cli/config/settings/schema.ts';
import { formatHeader } from '#cli/generation/header.ts';
import { UV_TOOL } from '#cli/config/tools/installers.ts';
import { getTool, findMisePin } from '#cli/tools/pins.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { readConfigurations } from '#cli/manifests/read.ts';
import { STRICT_MODE } from '#cli/config/configurations/bash.ts';
import { readPackageJson } from '#cli/repository/dependencies.ts';
import { quoteCommand, quoteArgument } from '#cli/system/text.ts';
import type { PackageManagerPin } from '#cli/types/repository.ts';
import { frozenInstallArguments } from '#cli/repository/javascript/setup.ts';
import { NEXTJS_CONFIGURATION } from '#cli/config/configurations/javascript.ts';
import { type Session, type MiseToolPin, type GeneratedFile } from '#cli/types/tools.ts';
import { Scalar, Document, type Node, stringify, type YAMLMap, type YAMLSeq } from 'yaml';
import { CI_NODE, FROZEN_INSTALLS, PACKAGE_MANAGERS } from '#cli/config/repository/javascript.ts';
import type { Pipeline, ActionPin, FrozenLockfile, GithubJobPurpose } from '#cli/types/generation.ts';
import { findPackageManagerPin, buildPackageManagerCommand } from '#cli/repository/javascript/package-manager.ts';

import {
    CI_JOB_NAME,
    GITLAB_RULES,
    GITLAB_CACHE,
    CACHED_PATHS,
    CI_DIFF_LINES,
    CI_CACHE_STEP,
    CI_STEP_NAMES,
    GITHUB_EVENTS,
    CI_CACHE_FILES,
    CI_CACHE_PREFIX,
    GITHUB_WORKFLOW,
    GITLAB_WORKFLOW,
    GITHUB_SCHEDULE,
    GITLAB_VARIABLES,
    CI_CHECK_COMMAND,
    CI_BASE_VARIABLE,
    CHECKOUT_OPTIONS,
    GITLAB_BASE_LINE,
    GITLAB_MISE_IMAGE,
    NEXT_TYPEGEN_LINE,
    CI_TESTS_JOB_NAME,
    CI_ADVISORIES_JOB,
    CI_INSTALL_COMMAND,
    GITHUB_CONCURRENCY,
    CI_TIMEOUT_MINUTES,
    CI_CACHE_SAVED_KEY,
    GITHUB_PUSH_CONDITION,
    CI_ADVISORIES_COMMAND,
    MISE_TOKEN_ENVIRONMENT,
    GITHUB_BASE_EXPRESSION,
    GITHUB_EXPRESSION_START,
    CI_CACHE_MISS_CONDITION,
    GITHUB_SCHEDULE_CONDITION,
    GITHUB_EXPRESSION_MESSAGE,
} from '#cli/config/generation.ts';

function buildActionPin({ name, sha, version }: ActionPin): Scalar {
    const node = new Scalar(`${name}@${sha}`);
    node.comment = ` ${version}`;
    return node;
}

function buildGspotTools(pipeline: Pipeline): string {
    const { packageManager } = pipeline;
    const tools = [CI_NODE, `npm:${cliPackage.name}[allow_low_downloads=true]@${pipeline.version}`];
    if (packageManager?.version !== undefined && packageManager.name !== 'npm')
        tools.push(`${packageManager.name}@${packageManager.version}`);
    return quoteCommand(tools);
}

function buildJob(
    pipeline: Pipeline,
    platform: Pipeline['operatingSystems'][number],
    purpose: GithubJobPurpose,
): Record<string, unknown> {
    const machine = CI_PINS.githubRunners[platform];
    const tools = buildGspotTools(pipeline);
    const hashed = [...CI_CACHE_FILES, ...pipeline.lockfiles]
        .map((path) => `'${path.replaceAll("'", "''")}'`)
        .join(', ');
    const cache = {
        key: `${CI_CACHE_PREFIX}${pipeline.version}-\${{ hashFiles(${hashed}) }}`,
        path: `${[...CACHED_PATHS[platform].mise, ...pipeline.packageManagers.flatMap((name) => CACHED_PATHS[platform][name])].join('\n')}\n`,
    };
    return {
        'runs-on': platform === 'linux' ? pipeline.linuxRunner : machine.label,
        'timeout-minutes': CI_TIMEOUT_MINUTES,
        if: purpose.condition,
        defaults: { run: { shell: 'bash' } },
        steps: [
            { name: CI_STEP_NAMES.checkout, uses: buildActionPin(CI_PINS.actions.checkout), with: CHECKOUT_OPTIONS },
            {
                name: CI_STEP_NAMES.restoreCache,
                id: CI_CACHE_STEP,
                uses: buildActionPin(CI_PINS.actions.restoreCache),
                with: cache,
            },
            {
                name: CI_STEP_NAMES.mise,
                uses: buildActionPin(CI_PINS.actions.mise),
                with: { version: CI_PINS.mise.version, cache: false },
            },
            ...(pipeline.setupCommand === undefined
                ? []
                : [{ name: CI_STEP_NAMES.setup, run: quoteCommand(pipeline.setupCommand) }]),
            ...(pipeline.projectInstall.length === 0
                ? []
                : [{ name: CI_STEP_NAMES.projectInstall, run: pipeline.projectInstall.join('\n') }]),
            {
                name: CI_STEP_NAMES.gspot,
                env: { ...MISE_TOKEN_ENVIRONMENT },
                run: `mise install ${tools}\nmise bin-paths ${tools} >> "$GITHUB_PATH"`,
            },
            { name: CI_STEP_NAMES.install, run: [CI_INSTALL_COMMAND, ...CI_DIFF_LINES].join('\n') },
            {
                name: CI_STEP_NAMES.saveCache,
                if: CI_CACHE_MISS_CONDITION,
                uses: buildActionPin(CI_PINS.actions.saveCache),
                with: { key: CI_CACHE_SAVED_KEY, path: cache.path },
            },
            purpose.lastStep,
        ],
    };
}

function buildJobCommands({ testChecks }: Pipeline): Record<string, string> {
    if (testChecks.length === 0) return { [CI_JOB_NAME]: CI_CHECK_COMMAND };
    const checks = testChecks.join(',');
    return {
        [CI_JOB_NAME]: `${CI_CHECK_COMMAND} --skip ${checks}`,
        [CI_TESTS_JOB_NAME]: `${CI_CHECK_COMMAND} --only ${checks}`,
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

function readProjectPackageManager(
    session: Session,
    scopePath: string,
    name: PackageManagerPin['name'],
): PackageManagerPin {
    const packageJson = readPackageJson(session.root, joinScope(scopePath, PACKAGE_JSON));
    const written = packageJson === undefined ? undefined : findPackageManagerPin(packageJson);
    return [written, session.packageManager].find((each) => each?.name === name) ?? { name };
}

function buildFrozenInstall(session: Session, scopePath: string, lockfile: FrozenLockfile): readonly string[] {
    const command = FROZEN_INSTALLS[lockfile];
    const name = PACKAGE_MANAGERS.find((tool) => tool === command[0]);
    const uv = findMisePin(getTool(readConfigurations().values(), UV_TOOL)) as MiseToolPin;
    const runner = name === undefined ? uv : readProjectPackageManager(session, scopePath, name);
    return buildPackageManagerCommand(runner, frozenInstallArguments(lockfile, runner.version));
}

/**
Build one lint job for each system, each with one mise setup. With test checks, each system also gets a tests job,
and its lint job leaves them out. Refuse a command from the repository that holds a GitHub expression: GitHub expands
it before the shell runs.

@param pipeline what the workflow runs.
*/
export function buildGithubWorkflow(pipeline: Pipeline): GeneratedFile {
    const commands = [...(pipeline.setupCommand ?? []), ...pipeline.projectInstall, buildGspotTools(pipeline)];
    if (commands.some((command) => command.includes(GITHUB_EXPRESSION_START)))
        throw new GspotError('settings', GITHUB_EXPRESSION_MESSAGE);
    const platforms = pipeline.operatingSystems;
    const jobs = Object.entries(buildJobCommands(pipeline)).flatMap(([name, command]) => {
        const lint = {
            condition: GITHUB_PUSH_CONDITION,
            lastStep: {
                name: CI_STEP_NAMES.check,
                env: { [CI_BASE_VARIABLE]: GITHUB_BASE_EXPRESSION },
                run: command + '\n',
            },
        };
        return platforms.map((platform): [string, Record<string, unknown>] =>
            platforms.length === 1
                ? [name, buildJob(pipeline, platform, lint)]
                : [`${name}-${platform}`, { name: `${name} (${platform})`, ...buildJob(pipeline, platform, lint) }],
        );
    });
    const scan = {
        condition: GITHUB_SCHEDULE_CONDITION,
        lastStep: { name: CI_STEP_NAMES.advisories, run: CI_ADVISORIES_COMMAND + '\n' },
    };
    const hasLockfiles = pipeline.lockfiles.length > 0;
    const scanJobs = platforms
        .slice(0, 1)
        .map((platform): [string, Record<string, unknown>] => [CI_ADVISORIES_JOB, buildJob(pipeline, platform, scan)]);
    const workflow = new Document(
        {
            name: 'gspot',
            on: hasLockfiles ? { ...GITHUB_EVENTS, schedule: GITHUB_SCHEDULE } : GITHUB_EVENTS,
            permissions: { contents: 'read' },
            concurrency: GITHUB_CONCURRENCY,
            jobs: Object.fromEntries(hasLockfiles ? [...jobs, ...scanJobs] : jobs),
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
*/
export function buildGitlabWorkflow(pipeline: Pipeline): GeneratedFile {
    const tools = buildGspotTools(pipeline);
    const setup = pipeline.setupCommand === undefined ? pipeline.projectInstall : [quoteCommand(pipeline.setupCommand)];
    const install = [
        `mise install ${tools}`,
        `PATH="$(mise bin-paths ${tools} | paste -sd : -):\${PATH}"`,
        'export PATH',
    ];
    const check = [GITLAB_BASE_LINE, CI_CHECK_COMMAND].join('\n');
    const content = stringify({
        gspot: {
            image: `${GITLAB_MISE_IMAGE}:${CI_PINS.mise.version}-debian`,
            stage: '.pre',
            timeout: `${String(CI_TIMEOUT_MINUTES)}m`,
            variables: GITLAB_VARIABLES,
            cache: GITLAB_CACHE,
            rules: GITLAB_RULES,
            script: [STRICT_MODE, ...setup, ...install, CI_INSTALL_COMMAND, ...CI_DIFF_LINES, check],
        },
    });
    return { path: GITLAB_WORKFLOW, content: `${formatHeader(GITLAB_WORKFLOW)}${content}`, kind: 'workflow' };
}

/**
List the tracked lockfiles of the root and of each scope.

@param session the repository and its scopes.
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
List the checks of the selected testing configurations that the repository runs.

@param session the repository and its enabled checks.
*/
export function listTestChecks(session: Session): string[] {
    const checks = session.configuredChecks
        .filter(({ configuration }) => configuration?.group === 'testing')
        .map(({ check }) => check.id);
    return [...new Set(checks)];
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
