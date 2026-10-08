// Generate provider workflows from the same installation, version, and check selections.
// The Prettier and EditorConfig settings a policy generates, with authored overrides carried along.
import { dirname, relative } from 'node:path';
import { Scalar, Document, stringify } from 'yaml';
import { CLI_PINS } from '#cli/config/generation/pins.ts';
import { compact, toPosix } from '#cli/platform/contracts.ts';
import { HOOK_RUNNERS } from '#cli/config/generation/hooks.ts';
import { everyTable } from '#cli/policy/settings/contracts.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import { hashCommentHeader } from '#cli/generation/documents/contracts.ts';
import type { Policy, FormatSettings } from '#cli/types/policy/settings.ts';
import { byScopeDepth, expandedPaths } from '#cli/repository/paths/public.ts';
import { UNREPRESENTABLE_SELECTOR } from '#cli/config/generation/formatting.ts';
import type { Pipeline, ActionPin, GithubCheck } from '#cli/types/generation/ci.ts';
import { CACHED_PATHS, GITHUB_WORKFLOW, GITLAB_WORKFLOW } from '#cli/config/generation/ci.ts';

import {
    DOT_GSPOT,
    VERSION_FILE,
    MISE_CONFIG_PATH,
    TOOL_PYTHON_PROJECT,
    TOOL_PACKAGE_PROJECT,
    NODE_MODULES_DIRECTORY,
} from '#cli/config/platform/locations.ts';
import type {
    ScopeFormat,
    PrettierInput,
    FormatOverride,
    NativeOverride,
    PrettierPlugin,
    EditorconfigOverride,
    PrettierPluginOptions,
} from '#cli/types/generation/formatting.ts';

// An action pinned to a commit, with the version the pin stands for as its comment, which pinact verifies.
function pinned({ name, sha, version }: ActionPin): Scalar {
    const node = new Scalar(`${name}@${sha}`);
    node.comment = ` ${version}`;
    return node;
}

function setupSteps(pipeline: Pipeline): Record<string, unknown>[] {
    if (pipeline.isMise)
        return [
            { uses: pinned(CLI_PINS.actions.mise), with: { version: CLI_PINS.mise.version, cache: false } },
            { run: `${HOOK_RUNNERS.mise.command} install` },
            { run: `${HOOK_RUNNERS.mise.command} doctor` },
        ];
    return [
        { uses: pinned(CLI_PINS.actions.node), with: { 'node-version': CLI_PINS.node } },
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

function buildJob(
    pipeline: Pipeline,
    platform: Pipeline['platforms'][number],
    check: GithubCheck,
): Record<string, unknown> {
    const runner = CLI_PINS.runners[platform];
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
            { uses: pinned(CLI_PINS.actions.checkout), with: { 'fetch-depth': 0, 'persist-credentials': false } },
            {
                uses: pinned(CLI_PINS.actions.cache),
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

// A selector list as written: one string or several.
function asList(value: string | string[] | undefined): string[] {
    if (value === undefined) return [];
    return typeof value === 'string' ? [value] : value;
}

// A negation keeps its mark in front of the moved selector.
function rebasePattern(pattern: string, fromConfig: (selector: string) => string): string {
    return pattern.startsWith('!') ? `!${fromConfig(pattern.slice(1))}` : fromConfig(pattern);
}

// Basename selectors stay relative to every folder; path selectors move from the root to the generated file.
function rebaseOverrides(
    entries: NativeOverride<Record<string, unknown>>[],
    fromConfig: (pattern: string) => string,
): FormatOverride[] {
    return entries.flatMap((entry) => {
        const files = asList(entry.files);
        const excluded = asList(entry.excludeFiles);
        return [false, true].flatMap((hasSlash) => {
            const patterns = files.filter((pattern) => pattern.includes('/') === hasSlash);
            if (patterns.length === 0) return [];
            return [
                {
                    files: hasSlash ? patterns.map((pattern) => rebasePattern(pattern, fromConfig)) : patterns,
                    excludeFiles: hasSlash ? excluded.map((pattern) => rebasePattern(pattern, fromConfig)) : excluded,
                    options: entry.options,
                },
            ];
        });
    });
}

/**
 * A path as a glob that matches only itself.
 * @param path the literal path
 * @returns the path with every glob character escaped
 */
function literalGlob(path: string): string {
    return path.replaceAll(/[\\*?{}[\]()!+@,]/gu, String.raw`\$&`);
}

function formatEntries(policy: Policy): ScopeFormat[] {
    const tables = everyTable(policy)
        .toSorted((first, second) => byScopeDepth(first.scope ?? '', second.scope ?? ''))
        .flatMap(({ scope = '', table }) => (table.format === undefined ? [] : [{ scope, format: table.format }]));
    const base = tables.flatMap(({ scope, format: { overrides: _overrides, ...format } }) =>
        scope === '' || Object.keys(format).length === 0 ? [] : [{ scope, paths: ['**/*'], format }],
    );
    const overrides = tables.flatMap(({ scope, format }) =>
        (format.overrides ?? []).map(({ paths, ...format }) => ({ scope, paths, format: compact(format) })),
    );
    return [...base, ...overrides];
}

// The overrides the policy's scoped and path-specific format settings become, relative to the generated file.
function policyOverrides(policy: Policy, fromConfig: (pattern: string) => string): FormatOverride[] {
    return formatEntries(policy).map(({ scope, paths, format }) => {
        const expanded = expandedPaths(paths);
        const files = expanded.filter((path) => !path.startsWith('!')).map((path) => fromConfig(path));
        const excludeFiles = expanded.filter((path) => path.startsWith('!')).map((path) => fromConfig(path.slice(1)));
        if (scope !== '') excludeFiles.push(`!${fromConfig(literalGlob(scope))}/**`);
        return { files, excludeFiles, options: prettierOptions(format) };
    });
}

// The plugins Prettier loads: the authored ones, then each shipped plugin by a path relative to the configuration file.
function pluginEntries(
    plugins: PrettierPlugin[],
    prefix: string,
    extras: Record<string, unknown>,
): PrettierPluginOptions {
    if (plugins.length === 0) return {};
    const base = prefix === '' ? '.' : prefix;
    const shipped = plugins.map((plugin) => `${base}/${NODE_MODULES_DIRECTORY}/${plugin.name}/${plugin.entry}`);
    return { plugins: [...((extras['plugins'] as string[] | undefined) ?? []), ...shipped] };
}

// A Prettier selector as an EditorConfig section path, placed under its scope when it has one.
function editorconfigSelector(pattern: string, scope: string): string {
    if (pattern.startsWith('!') || UNREPRESENTABLE_SELECTOR.test(pattern))
        throw new Error(
            `EditorConfig cannot represent selector ${JSON.stringify(pattern)}. Keep this override in tools.prettier.verbatim.overrides or a native EditorConfig section.`,
        );
    if (scope === '' || pattern.startsWith(`${scope}/`)) return pattern;
    if (!pattern.startsWith('**/') || pattern.slice('**/'.length).includes('/'))
        throw new Error(
            `EditorConfig cannot intersect selector ${JSON.stringify(pattern)} with scope ${scope}. Use a root-relative selector within that scope.`,
        );
    return `${literalGlob(scope)}/${pattern}`;
}

/**
 * The Prettier options for the format settings a policy states.
 * @param format the format settings, each optional
 * @returns the options Prettier reads, only for the settings given
 */
function prettierOptions(format: Partial<FormatSettings>): Record<string, unknown> {
    return {
        ...(format.indent_width === undefined ? {} : { tabWidth: format.indent_width }),
        ...(format.indent_style === undefined ? {} : { useTabs: format.indent_style === 'tab' }),
        ...(format.print_width === undefined ? {} : { printWidth: format.print_width }),
        ...(format.quotes === undefined ? {} : { singleQuote: format.quotes === 'single' }),
        ...(format.trailing_commas === undefined ? {} : { trailingComma: format.trailing_commas }),
        ...(format.semicolons === undefined ? {} : { semi: format.semicolons }),
        ...(format.line_ending === undefined ? {} : { endOfLine: format.line_ending }),
    };
}

/**
 * Generate independent check and manual jobs with read-only permissions; the manual job runs only when a manual check
 * is selected.
 * @param pipeline the gspot version, file selection, platforms, Swift selection, manual checks, and whether mise runs gspot
 * @returns the GitHub workflow file
 */
export function githubFile(pipeline: Pipeline): GeneratedFile {
    const command = `${HOOK_RUNNERS[pipeline.isMise ? 'mise' : 'gspot'].command} check`;
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
    const platforms = [...new Set([...pipeline.platforms, ...(pipeline.hasSwift ? (['macos'] as const) : [])])];
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
    const content = `${hashCommentHeader(pipeline.version)}${workflow.toString({ lineWidth: 0 })}`;
    return { path, content, kind: 'workflow' };
}

/**
 * Generate a GitLab include without changing the authored pipeline. Platform and Swift selections do not apply.
 * @param pipeline the gspot version, file selection, and whether mise runs gspot
 * @returns the GitLab include file
 */
export function gitlabFile(pipeline: Pipeline): GeneratedFile {
    const command = HOOK_RUNNERS[pipeline.isMise ? 'mise' : 'gspot'].command;
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
    return { path, content: `${hashCommentHeader(pipeline.version)}${content}`, kind: 'workflow' };
}

/**
 * Generate each Prettier configuration relative to its own output path.
 * @param input effective formatting, authored overrides, applicable plugins, and the output path
 * @returns the Prettier configuration
 */
export function prettierConfiguration(input: PrettierInput): Record<string, unknown> {
    const { policy, format, targetPath, verbatim, plugins } = input;
    const prefix = toPosix(relative(dirname(targetPath), '.'));
    const fromConfig = (pattern: string): string => (prefix === '' ? pattern : `${prefix}/${pattern}`);
    const { overrides: nativeOverrides = [], ...extras } = verbatim === undefined ? {} : verbatim;
    const overrides = [
        ...plugins.flatMap((plugin) => plugin.overrides),
        ...policyOverrides(policy, fromConfig),
        ...rebaseOverrides(nativeOverrides as NativeOverride<Record<string, unknown>>[], fromConfig),
    ];
    return {
        ...prettierOptions(format),
        arrowParens: 'always',
        embeddedLanguageFormatting: 'off',
        ...extras,
        ...pluginEntries(plugins, prefix, extras),
        ...(overrides.length === 0 ? {} : { overrides }),
    };
}

/**
 * The EditorConfig sections that the policy's format settings become.
 * @param policy the repository policy
 * @returns one override per selector with the settings EditorConfig can express
 * @throws when EditorConfig cannot express a selector
 */
export function editorconfigOverrides(policy: Policy): EditorconfigOverride[] {
    return formatEntries(policy).flatMap(({ scope, paths, format }) => {
        const options = {
            ...(format.indent_style === undefined ? {} : { indent_style: format.indent_style }),
            ...(format.indent_width === undefined ? {} : { indent_size: format.indent_width }),
            ...(format.line_ending === undefined ? {} : { end_of_line: format.line_ending }),
            ...(format.final_newline === undefined ? {} : { insert_final_newline: format.final_newline }),
        };
        if (Object.keys(options).length === 0) return [];
        return expandedPaths(paths).map((pattern) => ({ path: `/${editorconfigSelector(pattern, scope)}`, options }));
    });
}
