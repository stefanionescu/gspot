import { Document, type Node, Scalar, stringify, type YAMLMap, type YAMLSeq } from 'yaml';

import cliPackage from '#cli-package' with { type: 'json' };
import { STRICT_MODE } from '#cli/config/configurations/bash.ts';
import { WORKFLOW_EXPRESSION } from '#cli/config/configurations/github-actions.ts';
import {
    CHECKOUT_OPTIONS,
    CI_BASE_VARIABLE,
    CI_CHECK_COMMAND,
    CI_DIFF_LINES,
    CI_JOB_NAME,
    CI_PACKAGE_RUNNER,
    CI_STEP_NAMES,
    CI_TESTS_JOB_NAME,
    CI_TIMEOUT_MINUTES,
    GITHUB_BASE_EXPRESSION,
    GITHUB_CONCURRENCY,
    GITHUB_EVENTS,
    GITHUB_EXPRESSION_MESSAGE,
    GITHUB_PUSH_CONDITION,
    GITHUB_WORKFLOW,
    GITLAB_BASE_LINE,
    GITLAB_CACHE,
    GITLAB_MISE_IMAGE,
    GITLAB_RULES,
    GITLAB_VARIABLES,
    GITLAB_WORKFLOW,
} from '#cli/config/generation/files.ts';
import { GSPOT_INSTALL } from '#cli/config/manifests.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects.ts';
import { FROZEN_INSTALLS, PACKAGE_MANAGERS } from '#cli/config/repository/package-managers.ts';
import { CI_NODE, NODE_TOOL } from '#cli/config/repository/version-pin.ts';
import { CI_PINS } from '#cli/config/settings/schema.ts';
import { formatHeader } from '#cli/generation/builders/header.ts';
import { readPackageJson } from '#cli/parsers/projects/dependencies.ts';
import {
    buildFrozenInstallArguments,
    buildPackageManagerCommand,
    findPackageManagerPin,
} from '#cli/repository/projects/package-manager.ts';
import { readMisePin } from '#cli/repository/projects/pin.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { GspotError } from '#cli/system/errors.ts';
import { quoteArgument, quoteCommand } from '#cli/system/text/quoting.ts';
import { getUvPin } from '#cli/tools/pins.ts';
import type { ActionPin, FrozenLockfile, Pipeline } from '#cli/types/generation.ts';
import type { PackageManagerPin } from '#cli/types/repository.ts';
import type { GeneratedFile, Session } from '#cli/types/tools.ts';

function buildActionPin({ name, sha, version }: ActionPin): Scalar {
    const node = new Scalar(`${name}@${sha}`);
    node.comment = ` ${version}`;
    return node;
}

function buildGspotTools(pipeline: Pipeline): string {
    const { packageManager } = pipeline;
    const tools = [pipeline.node, `npm:${cliPackage.name}[allow_low_downloads=true]@${pipeline.version}`];
    if (packageManager?.version !== undefined && packageManager.name !== 'npm')
        tools.push(`${packageManager.name}@${packageManager.version}`);
    return quoteCommand(tools);
}

/**
Run the checks under mise exec, which loads the [env] of the mise config files of the repository. A command check
reads those variables, and the search path of the job holds the tools without them.
*/
function buildCheckLine(tools: string, checkCommand: string): string {
    return `mise exec ${tools} -- ${checkCommand}`;
}

function buildJob(
    pipeline: Pipeline,
    platform: Pipeline['operatingSystems'][number],
    checkCommand: string,
): Record<string, unknown> {
    const machine = CI_PINS.githubRunners[platform];
    const tools = buildGspotTools(pipeline);
    return {
        'runs-on': platform === 'linux' ? pipeline.linuxRunner : machine.label,
        'timeout-minutes': CI_TIMEOUT_MINUTES,
        if: GITHUB_PUSH_CONDITION,
        defaults: { run: { shell: 'bash' } },
        steps: [
            { name: CI_STEP_NAMES.checkout, uses: buildActionPin(CI_PINS.actions.checkout), with: CHECKOUT_OPTIONS },
            {
                name: CI_STEP_NAMES.mise,
                uses: buildActionPin(CI_PINS.actions.mise),
                with: { version: CI_PINS.mise.version, cache: false },
            },
            {
                name: CI_STEP_NAMES.gspot,
                run: `mise install ${tools}\nmise bin-paths ${tools} >> "$GITHUB_PATH"`,
            },
            ...(pipeline.setupCommand === undefined
                ? []
                : [{ name: CI_STEP_NAMES.setup, run: quoteCommand(pipeline.setupCommand) }]),
            ...(pipeline.projectInstall.length === 0
                ? []
                : [{ name: CI_STEP_NAMES.projectInstall, run: pipeline.projectInstall.join('\n') }]),
            { name: CI_STEP_NAMES.install, run: [GSPOT_INSTALL, ...CI_DIFF_LINES.github].join('\n') },
            {
                name: CI_STEP_NAMES.check,
                env: { [CI_BASE_VARIABLE]: GITHUB_BASE_EXPRESSION },
                run: `${buildCheckLine(tools, checkCommand)}\n`,
            },
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

function buildFrozenInstall(
    session: Session,
    { scopePath, lockfile, node }: { scopePath: string; lockfile: FrozenLockfile; node: string },
): readonly string[] {
    const command = FROZEN_INSTALLS[lockfile];
    const name = PACKAGE_MANAGERS.find((tool) => tool === command[0]);
    const uv = getUvPin();
    const runner = name === undefined ? uv : readProjectPackageManager(session, scopePath, name);
    return buildPackageManagerCommand(runner, buildFrozenInstallArguments(lockfile, runner.version), node);
}

/**
Build one lint job for each system, each with one mise setup. With test checks, each system also gets a tests job,
and its lint job leaves them out. Refuse a command from the repository that holds a GitHub expression: GitHub expands
it before the shell runs.
*/
/**
Select the Node.js that CI runs gspot and the package managers with: the one that mise.toml pins, so CI runs what the
developers run, or the one that gspot is tested with when mise.toml pins none.
*/
export function readCiNode(root: string): string {
    const version = readMisePin(root, NODE_TOOL);
    return version === undefined ? CI_NODE : `${NODE_TOOL}@${version}`;
}

export function buildGithubWorkflow(pipeline: Pipeline): GeneratedFile {
    const commands = [...(pipeline.setupCommand ?? []), ...pipeline.projectInstall, buildGspotTools(pipeline)];
    if (commands.some((command) => command.includes(WORKFLOW_EXPRESSION)))
        throw new GspotError('settings', GITHUB_EXPRESSION_MESSAGE);
    const platforms = pipeline.operatingSystems;
    const jobs = Object.entries(buildJobCommands(pipeline)).flatMap(([name, command]) =>
        platforms.map((platform): [string, Record<string, unknown>] =>
            platforms.length === 1
                ? [name, buildJob(pipeline, platform, command)]
                : [`${name}-${platform}`, { name: `${name} (${platform})`, ...buildJob(pipeline, platform, command) }],
        ),
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
    return { path: GITHUB_WORKFLOW, content };
}

export function buildGitlabWorkflow(pipeline: Pipeline): GeneratedFile {
    const tools = buildGspotTools(pipeline);
    const setup = pipeline.setupCommand === undefined ? pipeline.projectInstall : [quoteCommand(pipeline.setupCommand)];
    const install = [
        `mise install ${tools}`,
        `PATH="$(mise bin-paths ${tools} | paste -sd : -):\${PATH}"`,
        'export PATH',
    ];
    const check = [GITLAB_BASE_LINE, buildCheckLine(tools, CI_CHECK_COMMAND)].join('\n');
    const content = stringify({
        gspot: {
            image: `${GITLAB_MISE_IMAGE}:${CI_PINS.mise.version}-debian`,
            stage: '.pre',
            timeout: `${String(CI_TIMEOUT_MINUTES)}m`,
            variables: GITLAB_VARIABLES,
            cache: GITLAB_CACHE,
            rules: GITLAB_RULES,
            script: [STRICT_MODE, ...install, ...setup, GSPOT_INSTALL, ...CI_DIFF_LINES.gitlab, check],
        },
    });
    return { path: GITLAB_WORKFLOW, content: `${formatHeader(GITLAB_WORKFLOW)}${content}` };
}

export function listTestChecks(session: Session): string[] {
    const checks = session.configuredChecks
        .filter(({ configuration }) => configuration?.group === 'testing')
        .map(({ check }) => check.id);
    return [...new Set(checks)];
}

export function listProjectInstallLines(session: Session): string[] {
    const tracked = new Set(session.repository.files.map((file) => file.path));
    const node = readCiNode(session.root);
    return session.scopes.flatMap(({ path: scopePath, configurations }) => {
        const installs = (Object.keys(FROZEN_INSTALLS) as FrozenLockfile[])
            .filter((lockfile) => tracked.has(joinScope(scopePath, lockfile)))
            .map((lockfile) => quoteCommand(buildFrozenInstall(session, { scopePath, lockfile, node })));
        const setup = configurations.flatMap((configuration) => configuration.ci_setup);
        const lines = [
            ...installs,
            ...(installs.length > 0 ? setup.map((command) => `${CI_PACKAGE_RUNNER} ${quoteCommand(command)}`) : []),
        ];
        return scopePath === '' ? lines : lines.map((line) => `(cd ${quoteArgument(scopePath)} && ${line})`);
    });
}
