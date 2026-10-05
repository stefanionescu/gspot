// Generate provider workflows from the same installation, version, and check selections.
import { Scalar, Document, stringify } from 'yaml';
import { hashHeader } from '#cli/generation/headers.ts';
import { MISE_MIN_VERSION } from '#cli/config/tools/mise.ts';
import type { GeneratedFile } from '#cli/types/generation/output.ts';
import type { Pipeline, ActionPin, GithubCheck } from '#cli/types/generation/ci.ts';

import {
    DOT_GSPOT,
    VERSION_FILE,
    MISE_CONFIG_PATH,
    TOOL_PYTHON_PROJECT,
    TOOL_PACKAGE_PROJECT,
} from '#cli/config/platform/locations.ts';
import {
    MISE,
    NODE,
    CACHE,
    RUNNERS,
    CHECKOUT,
    CACHED_PATHS,
    NODE_VERSION,
    GITHUB_WORKFLOW,
    GITLAB_WORKFLOW,
} from '#cli/config/generation/ci.ts';

// An action pinned to a commit, with the version the pin stands for as its comment, which pinact verifies.
function pinned({ name, sha, version }: ActionPin): Scalar {
    const node = new Scalar(`${name}@${sha}`);
    node.comment = ` ${version}`;
    return node;
}

function setupSteps(pipeline: Pipeline): Record<string, unknown>[] {
    if (pipeline.isMise)
        return [
            { uses: pinned(MISE), with: { version: MISE_MIN_VERSION, cache: false } },
            { run: 'mise exec -- gspot install' },
            { run: 'mise exec -- gspot doctor' },
        ];
    return [
        { uses: pinned(NODE), with: { 'node-version': NODE_VERSION } },
        { run: `npm install --global @gspothq/cli@${pipeline.version}` },
        { run: 'gspot install' },
        { run: 'gspot doctor' },
    ];
}

// A first push has no base, so the job checks everything; otherwise it checks what changed after the base commit.
function buildCheckScript(command: string, isFull: boolean): string {
    if (isFull) return command;
    return [
        'base="${GSPOT_CI_BASE:-}"',
        'case "${base}" in',
        `    '' | 0000000000000000000000000000000000000000 | 0000000000000000000000000000000000000000000000000000000000000000) ${command} ;;`,
        '    *)',
        '        if [[ ! ${base} =~ ^[0-9a-fA-F]{40}([0-9a-fA-F]{24})?$ ]]; then',
        '            echo "GSPOT_CI_BASE is not a commit SHA: ${base}" >&2',
        '            exit 2',
        '        fi',
        `        ${command} --changed --base "\${base}"`,
        '        ;;',
        'esac',
    ].join('\n');
}

function buildJob(pipeline: Pipeline, platform: string, check: GithubCheck): Record<string, unknown> {
    const runner = RUNNERS[platform];
    if (runner === undefined) throw new Error(`No GitHub runner is known for ${platform}.`);
    const cacheFiles = [
        TOOL_PACKAGE_PROJECT,
        `${DOT_GSPOT}/*lock*`,
        TOOL_PYTHON_PROJECT,
        MISE_CONFIG_PATH,
        VERSION_FILE,
    ]
        .map((path) => `'${path}'`)
        .join(', ');
    return {
        'runs-on': runner,
        'timeout-minutes': 30,
        ...(check.condition === undefined ? {} : { if: check.condition }),
        defaults: { run: { shell: 'bash' } },
        steps: [
            { uses: pinned(CHECKOUT), with: { 'fetch-depth': 0, 'persist-credentials': false } },
            {
                uses: pinned(CACHE),
                with: {
                    key: `gspot-\${{ runner.os }}-\${{ runner.arch }}-\${{ hashFiles(${cacheFiles}) }}`,
                    path: `${CACHED_PATHS.join('\n')}\n`,
                },
            },
            ...setupSteps(pipeline),
            structuredClone(check.step),
        ],
    };
}

/**
 * Generate independent check and manual jobs with read-only permissions; the manual job runs only when a manual check
 * is selected.
 * @param pipeline the gspot version, file selection, platforms, Swift selection, manual checks, and whether mise runs gspot
 * @returns the GitHub workflow file
 */
export function githubFile(pipeline: Pipeline): GeneratedFile {
    const command = pipeline.isMise ? 'mise exec -- gspot check' : 'gspot check';
    const check: GithubCheck = {
        step: {
            name: 'Check',
            env: {
                GSPOT_CI_BASE:
                    "${{ github.event_name == 'pull_request' && github.event.pull_request.base.sha || github.event_name == 'merge_group' && github.event.merge_group.base_sha || github.event.before }}",
            },
            run: `${buildCheckScript(command, pipeline.run === 'all')}\n`,
        },
    };
    const manual: GithubCheck = {
        condition:
            "github.event_name == 'push' && github.ref == format('refs/heads/{0}', github.event.repository.default_branch)",
        step: { name: 'Check', run: `${command} --only ${pipeline.manualChecks.join(' ')}\n` },
    };
    const platforms = [...new Set([...pipeline.platforms, ...(pipeline.hasSwift ? ['macos'] : [])])];
    const workflow = new Document({
        name: 'gspot',
        on: ['push', 'pull_request', 'merge_group'],
        permissions: { contents: 'read' },
        concurrency: {
            group: "gspot-${{ github.workflow }}-${{ github.event_name == 'pull_request' && github.ref || github.run_id }}",
            'cancel-in-progress': "${{ github.event_name == 'pull_request' }}",
        },
        jobs: Object.fromEntries(
            platforms.flatMap((platform) => {
                const jobs: [string, Record<string, unknown>][] = [
                    [`check-${platform}`, buildJob(pipeline, platform, check)],
                ];
                if (pipeline.manualChecks.length > 0)
                    jobs.push([`manual-${platform}`, buildJob(pipeline, platform, manual)]);
                return jobs;
            }),
        ),
    });
    const path = GITHUB_WORKFLOW;
    const content = `${hashHeader(pipeline.version)}${workflow.toString({ lineWidth: 0 })}`;
    return { path, content, readOnly: true, kind: 'workflow' };
}

/**
 * Generate a GitLab include without changing the authored pipeline. Platform and Swift selections do not apply.
 * @param pipeline the gspot version, file selection, and whether mise runs gspot
 * @returns the GitLab include file
 */
export function gitlabFile(pipeline: Pipeline): GeneratedFile {
    const command = pipeline.isMise ? 'mise exec -- gspot' : 'gspot';
    const setup = pipeline.isMise
        ? [`mise trust ${MISE_CONFIG_PATH}`, 'mise install']
        : [`npm install --global @gspothq/cli@${pipeline.version}`];
    const check = [
        'GSPOT_CI_BASE="${CI_MERGE_REQUEST_DIFF_BASE_SHA:-${CI_COMMIT_BEFORE_SHA:-}}"',
        buildCheckScript(`${command} check`, pipeline.run === 'all'),
    ].join('\n');
    const path = GITLAB_WORKFLOW;
    const content = stringify({
        gspot: {
            stage: 'test',
            timeout: '30m',
            variables: { GIT_DEPTH: '0' },
            rules: [
                { if: '$CI_PIPELINE_SOURCE == "merge_request_event"', interruptible: true },
                { if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH', interruptible: false },
            ],
            script: ['set -euo pipefail', ...setup, `${command} install`, `${command} doctor`, check],
        },
    });
    return { path, content: `${hashHeader(pipeline.version)}${content}`, readOnly: true, kind: 'workflow' };
}
