// Build readable GitHub workflows and GitLab includes from selected checks.
import type { Node, YAMLMap, YAMLSeq } from 'yaml';
import { Scalar, Document, stringify } from 'yaml';
import { quoteArgument } from '#cli/system/text.ts';
import { name as cliName } from '../../package.json';
import { findSystemSkip } from '#cli/planning/skips.ts';
import { formatHeader } from '#cli/generation/header.ts';
import { TOOL_BUILDS } from '#cli/config/configurations.ts';
import { DOT_GSPOT } from '#cli/config/system/locations.ts';
import { listRequiredTools } from '#cli/planning/needed-tools.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import { OPERATING_SYSTEMS } from '#cli/config/system/operating-systems.ts';
import { findMisePin, findMissingBuild } from '#cli/configurations/tools.ts';
import type { Pipeline, ActionPin, GithubCheck } from '#cli/types/generation/ci.ts';

import {
    CI_PINS,
    CI_NODE,
    ZERO_SHAS,
    GITLAB_RULES,
    CACHED_PATHS,
    CI_STEP_NAMES,
    GITHUB_EVENTS,
    CI_CACHE_FILES,
    GITHUB_WORKFLOW,
    GITLAB_WORKFLOW,
    CI_BASE_VARIABLE,
    CHECKOUT_OPTIONS,
    GITLAB_BASE_LINE,
    GITHUB_CONCURRENCY,
    CI_TIMEOUT_MINUTES,
    MISE_TOKEN_ENVIRONMENT,
    GITHUB_BASE_EXPRESSION,
    GITHUB_MANUAL_CONDITION,
    GITLAB_MANUAL_CONDITION,
} from '#cli/config/generation/ci.ts';

// An action pinned to a commit, with the version the pin stands for as its comment.
function buildPinnedAction({ name, sha, version }: ActionPin): Scalar {
    const node = new Scalar(`${name}@${sha}`);
    node.comment = ` ${version}`;
    return node;
}

// A first push has no base, so the job checks everything; otherwise it checks what changed after the base commit.
function buildCheckScript(command: string): string {
    return [
        `base="\${${CI_BASE_VARIABLE}:-}"`,
        'case "${base}" in',
        `    '' | ${ZERO_SHAS.join(' | ')}) ${command} ;;`,
        '    *)',
        `        ${command} --changed "\${base}"`,
        '        ;;',
        'esac',
    ].join('\n');
}

// The selected package manager shares the same mise invocation as Node and the published CLI.
function buildGspotCommand(pipeline: Pipeline): string {
    const { packageManager } = pipeline;
    const tools = [CI_NODE, `npm:${cliName}@${pipeline.version}`];
    if (packageManager !== undefined && packageManager.name !== 'npm')
        tools.push(`${packageManager.name}@${packageManager.version}`);
    return `mise exec ${tools.map((tool) => quoteArgument(tool)).join(' ')} -- gspot`;
}

// Both providers select manual checks and their program builds for the machine that runs them.
function selectManualChecks(pipeline: Pipeline, platform: Pipeline['operatingSystems'][number], arch: string) {
    const checks = pipeline.manualChecks.filter(
        (planned) => findSystemSkip(planned.check, planned.tool, { platform, arch }) === undefined,
    );
    const required = new Set(checks.flatMap((check) => listRequiredTools(check)));
    const tools = pipeline.manualTools.flatMap((tool) => {
        const pin = findMisePin(tool);
        return pin !== undefined && required.has(tool.name) && findMissingBuild(tool, platform, arch) === undefined
            ? [pin.name]
            : [];
    });
    return {
        checks: [...new Set(checks.map((planned) => planned.check.name))].toSorted((first, second) =>
            first.localeCompare(second),
        ),
        tools,
    };
}

function buildJob(
    pipeline: Pipeline,
    platform: Pipeline['operatingSystems'][number],
    check: GithubCheck,
): Record<string, unknown> {
    const machine = CI_PINS.githubRunners[platform];
    const command = buildGspotCommand(pipeline);
    const cacheFiles = CI_CACHE_FILES.map((path) => `'${path}'`).join(', ');
    return {
        'runs-on': machine.label,
        'timeout-minutes': CI_TIMEOUT_MINUTES,
        ...(check.condition === undefined ? {} : { if: check.condition }),
        defaults: { run: { shell: 'bash' } },
        steps: [
            { name: CI_STEP_NAMES.checkout, uses: buildPinnedAction(CI_PINS.actions.checkout), with: CHECKOUT_OPTIONS },
            {
                name: CI_STEP_NAMES.cache,
                uses: buildPinnedAction(CI_PINS.actions.cache),
                with: {
                    key: `gspot-\${{ runner.os }}-\${{ runner.arch }}-\${{ hashFiles(${cacheFiles}) }}`,
                    path: `${CACHED_PATHS.join('\n')}\n`,
                },
            },
            {
                name: CI_STEP_NAMES.mise,
                uses: buildPinnedAction(CI_PINS.actions.mise),
                with: { version: CI_PINS.mise.version, cache: false },
            },
            ...(pipeline.setupCommand === undefined
                ? []
                : [
                      {
                          name: CI_STEP_NAMES.setup,
                          run: pipeline.setupCommand.map((argument) => quoteArgument(argument)).join(' '),
                      },
                  ]),
            { name: CI_STEP_NAMES.install, env: { ...MISE_TOKEN_ENVIRONMENT }, run: `${command} install` },
            structuredClone(check.step),
        ],
    };
}

// Keep provider job and step groups visually separate without changing their YAML values.
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

/**
 * Generate check and applicable manual jobs for each machine through the same mise setup.
 *
 * @param pipeline the gspot version, selected package manager, machines, and manual checks and tools.
 *
 * @returns the GitHub workflow file.
 */
function buildGithubWorkflow(pipeline: Pipeline): GeneratedFile {
    const command = `${buildGspotCommand(pipeline)} check`;
    const check: GithubCheck = {
        step: {
            name: CI_STEP_NAMES.check,
            env: {
                [CI_BASE_VARIABLE]: GITHUB_BASE_EXPRESSION,
            },
            run: `${buildCheckScript(command)}\n`,
        },
    };
    const platforms = [...new Set([...pipeline.operatingSystems, ...(pipeline.hasSwift ? (['macos'] as const) : [])])];
    const workflow = new Document(
        {
            name: 'gspot',
            on: GITHUB_EVENTS,
            permissions: { contents: 'read' },
            concurrency: GITHUB_CONCURRENCY,
            jobs: Object.fromEntries(
                platforms.flatMap((platform) => {
                    const machine = CI_PINS.githubRunners[platform];
                    const manual = selectManualChecks(pipeline, platform, machine.arch);
                    const jobs: [string, Record<string, unknown>][] = [
                        [`check-${platform}`, buildJob(pipeline, platform, check)],
                    ];
                    if (manual.checks.length > 0)
                        jobs.push([
                            `manual-${platform}`,
                            buildJob(pipeline, platform, {
                                condition: GITHUB_MANUAL_CONDITION,
                                step: {
                                    name: CI_STEP_NAMES.manual,
                                    ...(manual.tools.length === 0 ? {} : { env: { ...MISE_TOKEN_ENVIRONMENT } }),
                                    run:
                                        [
                                            ...(manual.tools.length === 0
                                                ? []
                                                : [
                                                      `(cd ${DOT_GSPOT} && mise install ${manual.tools.map((element) => quoteArgument(element)).join(' ')})`,
                                                  ]),
                                            `${buildGspotCommand(pipeline)} check --only ${manual.checks.map((element) => quoteArgument(element)).join(' ')}`,
                                        ].join('\n') + '\n',
                                },
                            }),
                        ]);
                    return jobs;
                }),
            ),
        },
        { aliasDuplicateObjects: false },
    );
    spaceWorkflowGroups(workflow);
    const content = `${formatHeader(GITHUB_WORKFLOW)}${workflow.toString({ lineWidth: 0 })}`;
    return { path: GITHUB_WORKFLOW, content, kind: 'workflow' };
}

/**
 * Generate a GitLab include without changing the authored pipeline. Platform and Swift selections do not apply.
 *
 * @param pipeline the gspot version, selected package manager, and manual checks and tools.
 *
 * @returns the GitLab include file.
 */
function buildGitlabWorkflow(pipeline: Pipeline): GeneratedFile {
    const command = buildGspotCommand(pipeline);
    const setup =
        pipeline.setupCommand === undefined
            ? []
            : [pipeline.setupCommand.map((argument) => quoteArgument(argument)).join(' ')];
    const check = [GITLAB_BASE_LINE, buildCheckScript(`${command} check`)].join('\n');
    const branches = OPERATING_SYSTEMS.flatMap((system) =>
        TOOL_BUILDS.filter((build) => build.startsWith(`${system.name}-`)).flatMap((build) => {
            const arch = build.slice(system.name.length + 1);
            const manual = selectManualChecks(pipeline, system.name, arch);
            if (manual.checks.length === 0) return [];
            return [
                `    ${system.nodeName}/${arch})`,
                ...(manual.tools.length === 0
                    ? []
                    : [
                          `        (cd ${DOT_GSPOT} && mise install ${manual.tools.map((element) => quoteArgument(element)).join(' ')})`,
                      ]),
                `        ${command} check --only ${manual.checks.map((element) => quoteArgument(element)).join(' ')}`,
                '        ;;',
            ];
        }),
    );
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
            script: ['set -euo pipefail', ...setup, `${command} install`, check, ...manual],
        },
    });
    return { path: GITLAB_WORKFLOW, content: `${formatHeader(GITLAB_WORKFLOW)}${content}`, kind: 'workflow' };
}

export { buildGithubWorkflow, buildGitlabWorkflow };
