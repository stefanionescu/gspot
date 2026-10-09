// The Git hooks gspot writes: one short script per stage in .gspot/hooks, each running one gspot check.
import { statSync } from 'node:fs';
import { stringify } from 'smol-toml';
import { join, posix } from 'node:path';
import type { Session } from '#cli/types/planning.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import type { EtaInputs } from '#cli/types/generation/eta.ts';
import type { HookName } from '#cli/types/generation/hooks.ts';
import { runGitBlocking } from '#cli/platform/git/contracts.ts';
import { toolProjectPins } from '#cli/configurations/contracts.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import { PYTHON_TOOL_PROJECT } from '#cli/config/parsers/packages.ts';
import { isGitRepository } from '#cli/repository/discovery/contracts.ts';
import { HOOK_ARGS, HOOK_RUNNERS } from '#cli/config/generation/hooks.ts';
import type { Policy, ScopeSelection } from '#cli/types/policy/settings.ts';
import { generatedIgnores, hashCommentHeader } from '#cli/generation/documents/contracts.ts';
import { HOOKS_DIRECTORY, TOOL_PYTHON_PROJECT, CONFIGURATION_DIRECTORY } from '#cli/config/platform/locations.ts';

// The script of one hook. Git runs it from the top level; a commit message path Git gives relative to there
// becomes absolute first, in the Windows spelling under Git for Windows.
function hookScript(name: HookName, runner: Policy['runner'], prefix: string, version: string): string {
    const program = runner ?? 'gspot';
    const { install } = HOOK_RUNNERS[program];
    const quoted = prefix.replaceAll("'", String.raw`'\''`);
    const absolutePath =
        name === 'commit-msg'
            ? [
                  'case "$1" in /*|[A-Za-z]:*) message=$1 ;; *) message="$PWD/$1" ;; esac',
                  'if command -v cygpath >/dev/null 2>&1; then message=$(cygpath -w "$message"); fi',
                  'set -- "$message"',
              ]
            : [];
    const body = [
        ...absolutePath,
        ...(prefix === '' ? [] : [`cd '${quoted}' || exit 2`]),
        `command -v ${program} >/dev/null 2>&1 || { echo '${program} is not installed. ${install}' >&2; exit 2; }`,
        `exec ${hookLine(name, runner)}`,
        '',
    ].join('\n');
    return `#!/bin/sh\n${hashCommentHeader(version)}${body}`;
}

/**
 * The path from the Git top level to the repository root, which Git runs hooks from.
 * @param root the repository root
 * @returns the prefix with a trailing slash, '' at the top level or outside Git
 */
export function hookPrefix(root: string): string {
    if (!isGitRepository(root)) return '';
    const result = runGitBlocking(root, ['rev-parse', '--show-prefix']);
    if (result.code !== 0) throw new Error(`Cannot find the hook directory: ${result.stderr.trim()}`);
    return result.stdout.replace(/\n$/u, '');
}

/**
 * The command a hook runs for one stage, through the runner of the policy or the gspot on PATH.
 * @param name the hook
 * @param runner the task runner the policy names, or undefined
 * @returns the command line
 */
export function hookLine(name: HookName, runner: Policy['runner']): string {
    return `${HOOK_RUNNERS[runner ?? 'gspot'].command} ${HOOK_ARGS[name]}`;
}

/**
 * The hook scripts, one per stage, in the hooks folder of the repository, when the policy selects hooks.
 * @param root the repository root
 * @param policy the repository policy
 * @param version the gspot version the header names
 * @returns the generated files
 */
export function hookFiles(root: string, policy: Policy, version: string): GeneratedFile[] {
    if (policy.hooks?.enabled !== true) return [];
    const prefix = hookPrefix(root);
    return (Object.keys(HOOK_ARGS) as HookName[]).map((name) => ({
        path: `${HOOKS_DIRECTORY}/${name}`,
        content: hookScript(name, policy.runner, prefix, version),
        executable: true,
        kind: 'hook',
    }));
}

/**
 * Keep Python lint dependencies in a tool project owned by gspot.
 * @param manifests the selected manifests
 * @returns the Python tool project files, or none without Python tools
 */
export function pythonProject(manifests: Manifest[]): GeneratedFile[] {
    const { python: dependencies, constraints } = toolProjectPins(manifests);
    if (dependencies.length === 0) return [];
    return [
        {
            path: TOOL_PYTHON_PROJECT,
            content: stringify({
                project: { ...PYTHON_TOOL_PROJECT, dependencies },
                tool: {
                    uv: {
                        package: false,
                        ...(constraints.length === 0 ? {} : { 'constraint-dependencies': constraints }),
                    },
                },
            }),
            kind: 'tool_file',
        },
    ];
}

/**
 * Resolve native Python configuration paths for both type and lint tools.
 * @param session the repository and policy
 * @param selection the scope being emitted
 * @returns the scope's environment and configuration-relative exclusions
 */
export function pythonInputs(
    session: Session,
    selection: ScopeSelection,
): Pick<EtaInputs, 'pythonVenv' | 'pythonScopePath' | 'pythonExcludes' | 'ruffRules' | 'basedpyrightOptions'> {
    const root = session.installedRoot ?? session.root;
    const { policy } = session.policyFiles;
    const base = posix.relative(posix.join(CONFIGURATION_DIRECTORY, selection.scope.path), '.');
    const exclusions = generatedIgnores(
        policy.declarations.flatMap(({ paths }) => paths),
        policy.exclude,
    );
    return {
        basedpyrightOptions: Object.fromEntries(
            selection.selected.flatMap((manifest) => Object.entries(manifest.basedpyright_options[policy.level])),
        ),
        ruffRules: selection.selected.flatMap((manifest) => [
            ...manifest.ruff_rules.recommended,
            ...(policy.level === 'all' ? manifest.ruff_rules.all : []),
        ]),
        pythonScopePath: posix.join(base, selection.scope.path),
        pythonVenv:
            statSync(join(root, selection.scope.path, '.venv'), { throwIfNoEntry: false })?.isDirectory() === true
                ? '.venv'
                : undefined,
        pythonExcludes: (check: string) =>
            [
                ...exclusions,
                ...selection.view
                    .ignoresFor(check)
                    .filter((entry) => entry.rule === undefined)
                    .flatMap((entry) => entry.paths),
            ].map((path) => `${base}/${path}`),
    };
}
