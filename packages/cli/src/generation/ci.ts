import { quoteArgument } from '#cli/text.ts';
import { Scalar, Document, stringify } from 'yaml';
import { systemSkip } from '#cli/planning/skips.ts';
import { name as cliName } from '../../package.json';
import { TOOL_BUILDS } from '#cli/config/configurations.ts';
import { DOT_GSPOT } from '#cli/config/system/locations.ts';
import type { MisePin } from '#cli/types/configurations.ts';
import { hashCommentHeader } from '#cli/generation/headers.ts';
import { requiredToolNames } from '#cli/planning/needed-tools.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import { pinOf, missingBuild } from '#cli/configurations/tool-pins.ts';
import { OPERATING_SYSTEMS } from '#cli/config/system/operating-systems.ts';
import type { Pipeline, ActionPin, GithubCheck } from '#cli/types/generation/ci.ts';

import {
    CI_PINS,
    ZERO_SHAS,
    GITLAB_RULES,
    CACHED_PATHS,
    GITHUB_EVENTS,
    CI_CACHE_FILES,
    GITHUB_WORKFLOW,
    GITLAB_WORKFLOW,
    CI_BASE_VARIABLE,
    CHECKOUT_OPTIONS,
    GITLAB_BASE_LINE,
    GITHUB_CONCURRENCY,
    CI_TIMEOUT_MINUTES,
    GITHUB_BASE_EXPRESSION,
    GITHUB_MANUAL_CONDITION,
    GITLAB_MANUAL_CONDITION,
} from '#cli/config/generation/ci.ts';

// An action pinned to a commit, with the version the pin stands for as its comment, which pinact verifies.
function pinned({ name, sha, version }: ActionPin): Scalar {
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
        `        ${command} --changed --base "\${base}"`,
        '        ;;',
        'esac',
    ].join('\n');
}

// The selected package client shares the same mise invocation as Node and the published CLI.
function ciCommand(pipeline: Pipeline): string {
    const client = pipeline.npmClient;
    const tools = ['node@24', `npm:${cliName}@${pipeline.version}`];
    if (client !== undefined && client.name !== 'npm') tools.push(`${client.name}@${client.version}`);
    return `mise exec ${tools.map((tool) => quoteArgument(tool)).join(' ')} -- gspot`;
}

// Both providers select manual checks and their program builds for the machine that runs them.
function supportedManual(pipeline: Pipeline, platform: Pipeline['operatingSystems'][number], arch: string) {
    const checks = pipeline.manualChecks.filter(
        (planned) => systemSkip(planned.check, planned.tool, { platform, arch }) === undefined,
    );
    const required = new Set(checks.flatMap((check) => requiredToolNames(check)));
    const tools = pipeline.manualTools
        .filter((tool) => required.has(tool.name) && missingBuild(tool, platform, arch) === undefined)
        .map((tool) => (pinOf(tool) as MisePin).name);
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
    const command = ciCommand(pipeline);
    const cacheFiles = CI_CACHE_FILES.map((path) => `'${path}'`).join(', ');
    return {
        'runs-on': machine.label,
        'timeout-minutes': CI_TIMEOUT_MINUTES,
        ...(check.condition === undefined ? {} : { if: check.condition }),
        defaults: { run: { shell: 'bash' } },
        steps: [
            { uses: pinned(CI_PINS.actions.checkout), with: CHECKOUT_OPTIONS },
            {
                uses: pinned(CI_PINS.actions.cache),
                with: {
                    key: `gspot-\${{ runner.os }}-\${{ runner.arch }}-\${{ hashFiles(${cacheFiles}) }}`,
                    path: `${CACHED_PATHS.join('\n')}\n`,
                },
            },
            { uses: pinned(CI_PINS.actions.mise), with: { version: CI_PINS.mise.version, cache: false } },
            ...(pipeline.setupCommand === undefined
                ? []
                : [{ run: pipeline.setupCommand.map((argument) => quoteArgument(argument)).join(' ') }]),
            { run: `${command} install` },
            structuredClone(check.step),
        ],
    };
}

/**
 * Generate check and applicable manual jobs for each machine through the same mise setup.
 *
 * @param pipeline the gspot version, selected npm client, machines, and manual checks and tools.
 *
 * @returns the GitHub workflow file.
 */
export function githubFile(pipeline: Pipeline): GeneratedFile {
    const command = `${ciCommand(pipeline)} check`;
    const check: GithubCheck = {
        step: {
            name: 'Check',
            env: {
                [CI_BASE_VARIABLE]: GITHUB_BASE_EXPRESSION,
            },
            run: `${buildCheckScript(command)}\n`,
        },
    };
    const platforms = [...new Set([...pipeline.operatingSystems, ...(pipeline.hasSwift ? (['macos'] as const) : [])])];
    const workflow = new Document({
        name: 'gspot',
        on: GITHUB_EVENTS,
        permissions: { contents: 'read' },
        concurrency: GITHUB_CONCURRENCY,
        jobs: Object.fromEntries(
            platforms.flatMap((platform) => {
                const machine = CI_PINS.githubRunners[platform];
                const manual = supportedManual(pipeline, platform, machine.arch);
                const jobs: [string, Record<string, unknown>][] = [
                    [`check-${platform}`, buildJob(pipeline, platform, check)],
                ];
                if (manual.checks.length > 0)
                    jobs.push([
                        `manual-${platform}`,
                        buildJob(pipeline, platform, {
                            condition: GITHUB_MANUAL_CONDITION,
                            step: {
                                name: 'Manual checks',
                                run:
                                    [
                                        ...(manual.tools.length === 0
                                            ? []
                                            : [
                                                  `(cd ${DOT_GSPOT} && mise install ${manual.tools.map((element) => quoteArgument(element)).join(' ')})`,
                                              ]),
                                        `${ciCommand(pipeline)} check --only ${manual.checks.map((element) => quoteArgument(element)).join(' ')}`,
                                    ].join('\n') + '\n',
                            },
                        }),
                    ]);
                return jobs;
            }),
        ),
    });
    const path = GITHUB_WORKFLOW;
    const content = `${hashCommentHeader()}${workflow.toString({ lineWidth: 0 })}`;
    return { path, content, kind: 'workflow' };
}

/**
 * Generate a GitLab include without changing the authored pipeline. Platform and Swift selections do not apply.
 *
 * @param pipeline the gspot version, selected npm client, and manual checks and tools.
 *
 * @returns the GitLab include file.
 */
export function gitlabFile(pipeline: Pipeline): GeneratedFile {
    const command = ciCommand(pipeline);
    const setup = [
        ...(pipeline.setupCommand === undefined
            ? []
            : [pipeline.setupCommand.map((argument) => quoteArgument(argument)).join(' ')]),
    ];
    const check = [GITLAB_BASE_LINE, buildCheckScript(`${command} check`)].join('\n');
    const branches = OPERATING_SYSTEMS.flatMap((system) =>
        TOOL_BUILDS.filter((build) => build.startsWith(`${system.name}-`)).flatMap((build) => {
            const arch = build.slice(system.name.length + 1);
            const manual = supportedManual(pipeline, system.name, arch);
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
                      `    case "$(mise exec node@24 -- node -p 'process.platform + "/" + process.arch')" in`,
                      ...branches,
                      '    esac',
                      'fi',
                  ].join('\n'),
              ];
    const path = GITLAB_WORKFLOW;
    const content = stringify({
        gspot: {
            stage: 'test',
            timeout: `${String(CI_TIMEOUT_MINUTES)}m`,
            variables: { GIT_DEPTH: '0' },
            rules: GITLAB_RULES,
            script: ['set -euo pipefail', ...setup, `${command} install`, check, ...manual],
        },
    });
    return { path, content: `${hashCommentHeader()}${content}`, kind: 'workflow' };
}
