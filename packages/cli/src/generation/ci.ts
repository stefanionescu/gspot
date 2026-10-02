import { Scalar, Document, stringify } from 'yaml';
import { headerFor } from '#cli/generation/headers.ts';
import type { GeneratedFile } from '#cli/types/kits.ts';
import type { WorkflowShape } from '#cli/types/generation/generation.ts';

import {
    MISE,
    NODE,
    CACHE,
    RUNNERS,
    CHECKOUT,
    NODE_VERSION,
    MISE_CONFIG_PATH,
    MISE_MIN_VERSION,
} from '#cli/config/generation/generation.ts';

// An action pinned to a commit, with the version the pin stands for as its comment, which pinact verifies.
function pinned(action: string, version: string): Scalar {
    const node = new Scalar(action);
    node.comment = ` ${version}`;
    return node;
}

function setupSteps(shape: WorkflowShape): Record<string, unknown>[] {
    if (shape.isMise)
        return [
            { uses: pinned(MISE, 'v3.2.0'), with: { version: MISE_MIN_VERSION, cache: false } },
            { run: 'mise exec -- gspot install' },
        ];
    return [
        { uses: pinned(NODE, 'v7.0.0'), with: { 'node-version': NODE_VERSION } },
        { run: `npm install --global @gspothq/cli@${shape.version}` },
        { run: 'gspot install' },
        { run: 'gspot doctor' },
    ];
}

// A first push has no base, so the job checks everything; otherwise it checks what changed after the base commit.
function comparisonCheck(command: string, isFull: boolean): string {
    if (isFull) return command;
    return [
        'base="${GSPOT_CI_BASE:-}"',
        'case "${base}" in',
        `    '' | 0000000000000000000000000000000000000000 | 0000000000000000000000000000000000000000000000000000000000000000) ${command} ;;`,
        '    *)',
        '        if [[ ! ${base} =~ ^[0-9a-fA-F]{40}([0-9a-fA-F]{24})?$ ]]; then',
        '            echo "Invalid CI comparison object" >&2',
        '            exit 2',
        '        fi',
        `        ${command} --changed="\${base}"`,
        '        ;;',
        'esac',
    ].join('\n');
}

// The paths the job caches between runs: the package caches and the installed tools.
const CACHED_PATHS = [
    '~/.npm/_cacache',
    '~/.bun/install/cache',
    '~/.cache/uv',
    '~/.cache/mise',
    '~/.local/share/mise/installs',
    '~/.local/share/pnpm/store',
    '~/.yarn/berry/cache',
];

function checkJob(shape: WorkflowShape, platform: string, stage: 'check' | 'manual'): Record<string, unknown> {
    const runner = RUNNERS[platform];
    if (runner === undefined) throw new Error(`No GitHub runner is known for ${platform}.`);
    const command = shape.isMise ? 'mise exec -- gspot check' : 'gspot check';
    const selected = stage === 'manual' ? `${command} --stage manual` : comparisonCheck(command, shape.run === 'all');
    const check = {
        name: 'Check',
        ...(stage === 'manual'
            ? {}
            : {
                  env: {
                      GSPOT_CI_BASE:
                          "${{ github.event_name == 'pull_request' && github.event.pull_request.base.sha || github.event_name == 'merge_group' && github.event.merge_group.base_sha || github.event.before }}",
                  },
              }),
        run: `${selected}\n`,
    };
    return {
        'runs-on': runner,
        'timeout-minutes': 30,
        ...(stage === 'manual'
            ? {
                  if: "github.event_name == 'push' && github.ref == format('refs/heads/{0}', github.event.repository.default_branch)",
              }
            : {}),
        defaults: { run: { shell: 'bash' } },
        steps: [
            { uses: pinned(CHECKOUT, 'v4.3.1'), with: { 'fetch-depth': 0, 'persist-credentials': false } },
            {
                uses: pinned(CACHE, 'v4.2.3'),
                with: {
                    key: "gspot-${{ runner.os }}-${{ runner.arch }}-${{ hashFiles('.gspot/package.json', '.gspot/*lock*', '.gspot/pyproject.toml', '.mise/conf.d/gspot-tools.toml', '.gspot/version') }}",
                    path: `${CACHED_PATHS.join('\n')}\n`,
                },
            },
            ...setupSteps(shape),
            check,
        ],
    };
}

/**
 * Generate independent check and manual jobs with read-only permissions.
 * @param shape what the workflow covers: platforms, the Swift scope, and the runner
 * @returns the GitHub workflow file
 */
export function workflowFile(shape: WorkflowShape): GeneratedFile {
    const platforms = [...new Set([...shape.platforms, ...(shape.swiftScope === undefined ? [] : ['macos'])])];
    const workflow = new Document({
        name: 'gspot',
        on: ['push', 'pull_request', 'merge_group'],
        permissions: { contents: 'read' },
        concurrency: {
            group: "gspot-${{ github.workflow }}-${{ github.event_name == 'pull_request' && github.ref || github.run_id }}",
            'cancel-in-progress': "${{ github.event_name == 'pull_request' }}",
        },
        jobs: Object.fromEntries(
            platforms.flatMap((platform) => [
                [`check-${platform}`, checkJob(shape, platform, 'check')],
                [`manual-${platform}`, checkJob(shape, platform, 'manual')],
            ]),
        ),
    });
    const content = `${headerFor('gspot.yml', shape.version).trimEnd()}\n${workflow.toString({ lineWidth: 0 })}`;
    return { path: '.github/workflows/gspot.yml', content, readOnly: true, kind: 'workflow' };
}

/**
 * Generate a GitLab include without changing the authored pipeline.
 * @param shape what the pipeline covers: platforms, the Swift scope, and the runner
 * @returns the GitLab include file
 */
export function gitlabFile(shape: WorkflowShape): GeneratedFile {
    const command = shape.isMise ? 'mise exec -- gspot' : 'gspot';
    const setup = shape.isMise
        ? [`mise trust ${MISE_CONFIG_PATH}`, 'mise install']
        : [`npm install --global @gspothq/cli@${shape.version}`];
    const check = [
        'GSPOT_CI_BASE="${CI_MERGE_REQUEST_DIFF_BASE_SHA:-${CI_COMMIT_BEFORE_SHA:-}}"',
        comparisonCheck(`${command} check`, shape.run === 'all'),
    ].join('\n');
    const path = '.gitlab/ci/gspot.yml';
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
    return { path, content: `${headerFor(path, shape.version)}${content}`, readOnly: true, kind: 'workflow' };
}
