// Generate provider workflows from the same installation, version, and check selections.
import { Scalar, Document, stringify } from 'yaml';
import { headerFor } from '#cli/generation/headers.ts';
import { MISE_MIN_VERSION } from '#cli/config/tools/mise.ts';
import type { GeneratedFile } from '#cli/types/generation/output.ts';
import { MISE_CONFIG_PATH } from '#cli/config/platform/locations.ts';
import type { Pipeline, ActionPin } from '#cli/types/generation/ci.ts';

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

function setupSteps(shape: Pipeline): Record<string, unknown>[] {
    if (shape.isMise)
        return [
            { uses: pinned(MISE), with: { version: MISE_MIN_VERSION, cache: false } },
            { run: 'mise exec -- gspot install' },
        ];
    return [
        { uses: pinned(NODE), with: { 'node-version': NODE_VERSION } },
        { run: `npm install --global @gspothq/cli@${shape.version}` },
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
        '            echo "Invalid CI comparison object" >&2',
        '            exit 2',
        '        fi',
        `        ${command} --changed --base "\${base}"`,
        '        ;;',
        'esac',
    ].join('\n');
}

function buildJob(shape: Pipeline, platform: string, stage: 'check' | 'manual'): Record<string, unknown> {
    const runner = RUNNERS[platform];
    if (runner === undefined) throw new Error(`No GitHub runner is known for ${platform}.`);
    const command = shape.isMise ? 'mise exec -- gspot check' : 'gspot check';
    const selected =
        stage === 'manual'
            ? `${command} --only ${shape.manualChecks.join(' ')}`
            : buildCheckScript(command, shape.run === 'all');
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
            { uses: pinned(CHECKOUT), with: { 'fetch-depth': 0, 'persist-credentials': false } },
            {
                uses: pinned(CACHE),
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
 * Generate independent check and manual jobs with read-only permissions; the manual job runs only when a manual check
 * is selected.
 * @param shape what the workflow covers: platforms, the Swift scope, and the runner
 * @returns the GitHub workflow file
 */
export function githubFile(shape: Pipeline): GeneratedFile {
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
            platforms.flatMap((platform) => {
                const jobs: [string, Record<string, unknown>][] = [
                    [`check-${platform}`, buildJob(shape, platform, 'check')],
                ];
                if (shape.manualChecks.length > 0)
                    jobs.push([`manual-${platform}`, buildJob(shape, platform, 'manual')]);
                return jobs;
            }),
        ),
    });
    const content = `${headerFor('gspot.yml', shape.version).trimEnd()}\n${workflow.toString({ lineWidth: 0 })}`;
    return { path: GITHUB_WORKFLOW, content, readOnly: true, kind: 'workflow' };
}

/**
 * Generate a GitLab include without changing the authored pipeline.
 * @param shape what the pipeline covers: platforms, the Swift scope, and the runner
 * @returns the GitLab include file
 */
export function gitlabFile(shape: Pipeline): GeneratedFile {
    const command = shape.isMise ? 'mise exec -- gspot' : 'gspot';
    const setup = shape.isMise
        ? [`mise trust ${MISE_CONFIG_PATH}`, 'mise install']
        : [`npm install --global @gspothq/cli@${shape.version}`];
    const check = [
        'GSPOT_CI_BASE="${CI_MERGE_REQUEST_DIFF_BASE_SHA:-${CI_COMMIT_BEFORE_SHA:-}}"',
        buildCheckScript(`${command} check`, shape.run === 'all'),
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
    return { path, content: `${headerFor(path, shape.version)}${content}`, readOnly: true, kind: 'workflow' };
}
