import { z } from 'zod';
import semver from 'semver';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { probeTool } from '#cli/tools/probe.ts';
import { binaryPath } from '#cli/platform/assets.ts';
import type { Policy } from '#cli/policy/normalize.ts';
import type { ToolContext } from '#cli/tools/probe.ts';
import { runToolCommand } from '#cli/tools/command.ts';
import type { Repository } from '#cli/repository/tree.ts';
import { installHooks } from '#cli/lifecycle/hooks/git.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import type { FileSnapshot } from '#cli/platform/filesystem.ts';
import { preCommitConfiguration } from '#cli/generation/pre-commit.ts';
import { HOOK_FILES, LEFTHOOK_MIN_VERSION } from '#cli/repository/hooks.ts';
import { hasConfiguration } from '#cli/lifecycle/configuration-document.ts';
import { simpleGitHookFallback } from '#cli/generation/simple-git-hooks.ts';
import { huskyReady, simpleGitHooksReady } from '#cli/lifecycle/hooks/state.ts';

import {
    hookPrefix,
    huskyLines,
    lefthookCommand,
    lefthookConfiguration,
    simpleGitHookCommand,
} from '#cli/generation/hooks.ts';

/**
 * Generate native manager hooks in an isolated Git directory, then publish through the lifecycle owner.
 * @param options
 * @param options.policy
 * @param options.repository
 * @param options.tools
 */
export async function installHookManager({
    policy,
    repository,
    tools,
}: {
    policy: Policy;
    repository: Pick<Repository, 'root' | 'hasGit'>;
    tools: ToolContext;
}): Promise<string> {
    const manager = policy.hooks?.tool;
    if (
        !repository.hasGit ||
        (manager !== 'simple-git-hooks' && manager !== 'pre-commit' && manager !== 'lefthook' && manager !== 'husky')
    )
        return '';
    const lefthook =
        manager === 'lefthook' ? lefthookConfiguration(repository.root, policy.runner?.tool, binaryPath()) : undefined;
    const ready =
        manager === 'husky'
            ? huskyReady(repository.root, policy.runner?.tool, binaryPath())
            : lefthook === undefined
              ? manager === 'simple-git-hooks'
                  ? simpleGitHooksReady(repository.root, policy.runner?.tool, binaryPath())
                  : hasConfiguration(
                        repository.root,
                        preCommitConfiguration(repository.root, policy.runner?.tool, binaryPath()),
                    )
              : hasConfiguration(repository.root, lefthook);
    if (!ready) throw new Error(`${manager} integration is missing or edited. Run gspot apply before installing.`);
    const tool = probeTool(tools, {
        name: manager,
        provider: 'host',
        windows: true,
        installers: {},
        ...(manager === 'lefthook' ? { version_command: ['version'] } : {}),
    });
    const executable = tool.path;
    if (executable === undefined)
        throw new Error(`Install the repository ${manager} dependency, then run gspot install.`);
    if (manager === 'lefthook' && (tool.found === undefined || semver.lt(tool.found, LEFTHOOK_MIN_VERSION)))
        throw new Error(
            `Install Lefthook ${LEFTHOOK_MIN_VERSION} or newer to keep native hooks from replacing the installed dispatcher, then run gspot install.`,
        );
    const configPath = lefthook?.path ?? (manager === 'simple-git-hooks' ? 'package.json' : '.pre-commit-config.yaml');
    const source = openConfinedRoot(repository.root);
    let configuration: FileSnapshot | undefined;
    try {
        configuration = manager === 'husky' ? undefined : source.read(configPath);
    } finally {
        source.close();
    }
    if (manager !== 'husky' && configuration === undefined) throw new Error(`${manager} requires ${configPath}.`);
    if (manager === 'lefthook' && configuration !== undefined) {
        const dumped = await runToolCommand(undefined, [executable, 'dump', '--format', 'json'], {
            cwd: repository.root,
        });
        if (dumped.code !== 0)
            throw new Error('Cannot load Lefthook configuration. Correct it before running gspot install.');
        let resolved: Record<string, unknown>;
        try {
            resolved = z.record(z.string(), z.unknown()).parse(JSON.parse(dumped.stdout));
        } catch (error) {
            throw new Error('Cannot load Lefthook configuration. Correct it before running gspot install.', {
                cause: error,
            });
        }
        // Native dump resolves these sources; preparation must not load them again from its temporary root.
        for (const field of ['extends', 'remotes', 'remote']) Reflect.deleteProperty(resolved, field);
        configuration = { bytes: Buffer.from(JSON.stringify(resolved)), mode: configuration.mode };
    }

    const installedConfig = manager === 'pre-commit' ? `${hookPrefix(repository.root)}${configPath}` : configPath;
    const work = mkdtempSync(join(tmpdir(), 'gspot-hook-manager-'));
    const files = openConfinedRoot(work);
    const env = {
        ...(manager === 'husky' ? { HUSKY: '1' } : {}),
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'core.hooksPath',
        GIT_CONFIG_VALUE_0: manager === 'lefthook' ? '.git/hooks' : '',
    };
    try {
        if (configuration !== undefined) files.write(installedConfig, configuration, undefined);
        const command =
            manager === 'lefthook'
                ? [executable, 'install']
                : manager === 'simple-git-hooks' || manager === 'husky'
                  ? [executable]
                  : [
                        executable,
                        'install',
                        '--config',
                        installedConfig,
                        ...HOOK_FILES.flatMap((name) => ['--hook-type', name]),
                    ];
        for (const argv of [
            ['git', 'init', '-q'],
            ...(manager === 'pre-commit' ? [[executable, 'validate-config', installedConfig]] : []),
            command,
        ]) {
            const result = await runToolCommand(undefined, argv, { cwd: work, env });
            if (result.code !== 0)
                throw new Error(`Hook manager preparation failed: ${result.stderr.trim() || result.stdout.trim()}`);
        }
        const generated = new Map<string, PreparedHook>(
            (manager === 'lefthook'
                ? files.list('.git/hooks').filter((name) => !name.endsWith('.sample'))
                : HOOK_FILES
            ).map((name) => {
                const hook = files.read(`${manager === 'husky' ? '.husky/_' : '.git/hooks'}/${name}`);
                if (hook === undefined)
                    throw new Error(`${manager} did not generate ${name}. Run gspot apply before installing.`);
                const generated = hook.bytes.toString('utf8');
                let text = generated;
                if (manager === 'pre-commit') {
                    text = [
                        '#!/usr/bin/env bash',
                        'gspot_work=$(mktemp -d "${TMPDIR:-/tmp}/gspot-pre-commit.XXXXXXXX") || exit 2',
                        `trap 'rm -rf "\${gspot_work}"' EXIT`,
                        "trap 'exit 129' HUP",
                        "trap 'exit 130' INT",
                        "trap 'exit 143' TERM",
                        'export GSPOT_PRE_COMMIT_RESULT="$gspot_work/result"',
                        `if ! '${executable.replaceAll("'", "'\"'\"'")}' validate-config '${installedConfig.replaceAll("'", "'\"'\"'")}'; then`,
                        String.raw`    printf "%s\n" "Cannot load pre-commit configuration. Check the dependency and configuration, then run gspot install." >&2`,
                        '    exit 2',
                        'fi',
                        ...(name === 'pre-commit'
                            ? [
                                  'gspot_unmerged=$(git ls-files --unmerged) || exit 2',
                                  String.raw`if [ -n "$gspot_unmerged" ]; then printf "%s\n" "Unmerged index entries prevent pre-commit checks. Resolve the conflicts before checking." >&2; exit 2; fi`,
                                  String.raw`if ! git diff --quiet --no-ext-diff -- '${installedConfig.replaceAll("'", "'\"'\"'")}'; then printf "%s\n" "Cannot use pre-commit configuration from the index. Stage the configuration and retry." >&2; exit 2; fi`,
                              ]
                            : []),
                        'gspot_native_status=0',
                        `SKIP= PRE_COMMIT_ALLOW_NO_CONFIG= bash -c '${generated.replaceAll("'", "'\"'\"'")}' "$0" "$@" || gspot_native_status=$?`,
                        'if [ -s "$GSPOT_PRE_COMMIT_RESULT" ]; then',
                        '    read -r gspot_status < "$GSPOT_PRE_COMMIT_RESULT"',
                        '    case "$gspot_status" in',
                        '        0) ;;',
                        '        1) if [ "$gspot_native_status" -eq 0 ]; then exit 1; fi ;;',
                        '        *) exit 2 ;;',
                        '    esac',
                        'fi',
                        ...(name === 'pre-commit'
                            ? [
                                  String.raw`if [ "$gspot_native_status" -eq 0 ] && [ ! -s "$GSPOT_PRE_COMMIT_RESULT" ]; then printf "%s\n" "The pre-commit integration did not run gspot. Run gspot apply, then gspot install." >&2; exit 2; fi`,
                              ]
                            : []),
                        'case "$gspot_native_status" in 3|126|127) exit 2 ;; *) exit "$gspot_native_status" ;; esac',
                        '',
                    ].join('\n');
                }
                if (manager === 'simple-git-hooks') {
                    const stage = HOOK_FILES.find((hook) => hook === name);
                    const prefix = hookPrefix(repository.root);
                    const invocation = simpleGitHookCommand(prefix, name);
                    if (stage === undefined || generated.split(invocation).length !== 2)
                        throw new Error(`Unsupported simple-git-hooks launcher for ${name}. No hooks were changed.`);
                    const args =
                        name === 'pre-push'
                            ? '"$GSPOT_SIMPLE_REMOTE_NAME" "$GSPOT_SIMPLE_REMOTE_LOCATION"'
                            : name === 'commit-msg'
                              ? '"$GSPOT_SIMPLE_MESSAGE"'
                              : '"$@"';
                    const native = generated.replace(invocation, () =>
                        [
                            'printf x > "$GSPOT_SIMPLE_ENTERED" || exit 2',
                            'cd "$GSPOT_SIMPLE_ROOT" || exit 2',
                            `exec ${invocation.replace('"$@"', args)}${name === 'pre-push' ? ' < "$GSPOT_SIMPLE_INPUT"' : ''}`,
                        ].join('\n'),
                    );
                    const fallback = simpleGitHookFallback(repository.root, stage, policy.runner?.tool, binaryPath());
                    text = [
                        '#!/usr/bin/env bash',
                        'gspot_work=$(mktemp -d "${TMPDIR:-/tmp}/gspot-simple-hooks.XXXXXXXX") || exit 2',
                        `trap 'rm -rf "\${gspot_work}"' EXIT`,
                        "trap 'exit 129' HUP",
                        "trap 'exit 130' INT",
                        "trap 'exit 143' TERM",
                        'export GSPOT_SIMPLE_ENTERED="$gspot_work/entered" GSPOT_SIMPLE_ROOT="$PWD"',
                        ...(name === 'pre-push'
                            ? [
                                  'export GSPOT_SIMPLE_REMOTE_NAME="$1" GSPOT_SIMPLE_REMOTE_LOCATION="$2" GSPOT_SIMPLE_INPUT="$gspot_work/input"',
                                  'cat > "$GSPOT_SIMPLE_INPUT" || exit 2',
                              ]
                            : name === 'commit-msg'
                              ? ['export GSPOT_SIMPLE_MESSAGE="$1"']
                              : []),
                        'gspot_native_status=0',
                        `SKIP_SIMPLE_GIT_HOOKS=0 sh -c '${native.replaceAll("'", "'\"'\"'")}' "$0" "$@"${name === 'pre-push' ? ' < "$GSPOT_SIMPLE_INPUT"' : ''} || gspot_native_status=$?`,
                        String.raw`case "$gspot_native_status" in 126|127) printf "%s\n" "The hook integration is unavailable. Run gspot apply, then gspot install." >&2; exit 2 ;; esac`,
                        'if [ "$gspot_native_status" -ne 0 ]; then exit "$gspot_native_status"; fi',
                        'if [ -f "$GSPOT_SIMPLE_ENTERED" ]; then exit 0; fi',
                        `bash -c '${fallback.replaceAll("'", "'\"'\"'")}' "$0" "$@"${name === 'pre-push' ? ' < "$GSPOT_SIMPLE_INPUT"' : ''}`,
                        '',
                    ].join('\n');
                }
                if (manager === 'husky') {
                    const runtime = files.read('.husky/_/h');
                    const command = huskyLines(repository.root, policy.runner?.tool, binaryPath()).find(
                        (entry) => entry.path === `.husky/${name}`,
                    );
                    if (runtime === undefined || command === undefined)
                        throw new Error(`Unsupported Husky installation for ${name}. No hooks were changed.`);
                    const nativePath = join(repository.root, '.husky', '_', name);
                    const script = join(repository.root, '.husky', name);
                    text = [
                        '#!/usr/bin/env bash',
                        String.raw`if [ ! -f '${script.replaceAll("'", "'\"'\"'")}' ]; then printf "%s\n" "Husky integration is missing. Run gspot apply, then gspot install." >&2; exit 2; fi`,
                        'gspot_work=$(mktemp -d "${TMPDIR:-/tmp}/gspot-husky.XXXXXXXX") || exit 2',
                        `trap 'rm -rf "\${gspot_work}"' EXIT`,
                        "trap 'exit 129' HUP",
                        "trap 'exit 130' INT",
                        "trap 'exit 143' TERM",
                        'export GSPOT_HUSKY_RESULT="$gspot_work/result" GSPOT_HUSKY_ROOT="$PWD"',
                        ...(name === 'pre-push'
                            ? ['export GSPOT_HUSKY_REMOTE_NAME="$1" GSPOT_HUSKY_REMOTE_LOCATION="$2"']
                            : name === 'commit-msg'
                              ? ['export GSPOT_HUSKY_MESSAGE="$1"']
                              : []),
                        ...(name === 'pre-push'
                            ? ['export GSPOT_HUSKY_INPUT="$gspot_work/input"', 'cat > "$GSPOT_HUSKY_INPUT" || exit 2']
                            : []),
                        'gspot_native_status=0',
                        `HUSKY=1 sh -c '${runtime.bytes.toString('utf8').replaceAll("'", "'\"'\"'")}' '${nativePath.replaceAll("'", "'\"'\"'")}' "$@"${name === 'pre-push' ? ' < "$GSPOT_HUSKY_INPUT"' : ''} || gspot_native_status=$?`,
                        'if [ -s "$GSPOT_HUSKY_RESULT" ]; then',
                        '    read -r gspot_status < "$GSPOT_HUSKY_RESULT"',
                        '    case "$gspot_status" in',
                        '        0) exit "$gspot_native_status" ;;',
                        '        1) if [ "$gspot_native_status" -eq 0 ]; then exit 1; else exit "$gspot_native_status"; fi ;;',
                        '        *) exit 2 ;;',
                        '    esac',
                        'fi',
                        'if [ "$gspot_native_status" -ne 0 ]; then exit "$gspot_native_status"; fi',
                        command.line,
                        '',
                    ].join('\n');
                }
                if (manager === 'lefthook') {
                    const invocation = `call_lefthook run "${name}" "$@"`;
                    if (text.split(invocation).length !== 2)
                        throw new Error(`Unsupported Lefthook hook format for ${name}. No hooks were changed.`);
                    const resolver = /call_lefthook\(\)\n\{[\s\S]*?\n\}\n/u;
                    if (!resolver.test(generated))
                        throw new Error(`Unsupported Lefthook resolver for ${name}. No hooks were changed.`);
                    // The native resolver embeds an unquoted absolute executable path.
                    const native = generated
                        .replace(
                            resolver,
                            () => `call_lefthook()\n{\n  '${executable.replaceAll("'", "'\"'\"'")}' "$@"\n}\n`,
                        )
                        .replace(invocation, `call_lefthook run --no-auto-install --no-tty "${name}" "$@"`);
                    const stage = HOOK_FILES.find((hook) => hook === name);
                    if (stage === undefined) return [name, { generated, installed: native }] as const;
                    text = [
                        '#!/usr/bin/env bash',
                        `export LEFTHOOK=1 LEFTHOOK_BIN='${executable.replaceAll("'", "'\"'\"'")}'`,
                        ...(name === 'pre-push'
                            ? ['export GSPOT_LEFTHOOK_REMOTE_NAME="$1" GSPOT_LEFTHOOK_REMOTE_LOCATION="$2"']
                            : name === 'commit-msg'
                              ? ['export GSPOT_LEFTHOOK_MESSAGE="$1"']
                              : []),
                        'gspot_work=$(mktemp -d "${TMPDIR:-/tmp}/gspot-lefthook.XXXXXXXX") || exit 2',
                        `trap 'rm -rf "\${gspot_work}"' EXIT`,
                        "trap 'exit 129' HUP",
                        "trap 'exit 130' INT",
                        "trap 'exit 143' TERM",
                        'export GSPOT_LEFTHOOK_RESULT="$gspot_work/result"',
                        'if ! "$LEFTHOOK_BIN" dump --format json > "$gspot_work/config"; then',
                        '    cat "$gspot_work/config" >&2',
                        String.raw`    printf "%s\n" "Cannot load Lefthook configuration. Check the dependency and configuration, then run gspot install." >&2`,
                        '    exit 2',
                        'fi',
                        ...(name === 'pre-push' ? ['cat > "$gspot_work/input" || exit 2'] : []),
                        'gspot_native_status=0',
                        `bash -c '${native.replaceAll("'", "'\"'\"'")}' "$0" "$@"${name === 'pre-push' ? ' < "$gspot_work/input"' : ''} || gspot_native_status=$?`,
                        'if [ "$gspot_native_status" -eq 126 ] || [ "$gspot_native_status" -eq 127 ]; then',
                        String.raw`    printf "%s\n" "The repository Lefthook executable is unavailable. Install the dependency, then run: gspot install" >&2`,
                        '    exit 2',
                        'fi',
                        'if [ -s "$GSPOT_LEFTHOOK_RESULT" ]; then',
                        '    read -r gspot_status < "$GSPOT_LEFTHOOK_RESULT"',
                        '    case "$gspot_status" in',
                        '        0|1) exit "$gspot_native_status" ;;',
                        '        *) exit 2 ;;',
                        '    esac',
                        'fi',
                        'if [ "$gspot_native_status" -ne 0 ]; then exit "$gspot_native_status"; fi',
                        `(${lefthookCommand(stage, policy.runner?.tool, binaryPath())})${name === 'pre-push' ? ' < "$gspot_work/input"' : ''}`,
                        '',
                    ].join('\n');
                }
                if (text.includes(work)) throw new Error(`Hook manager embedded a temporary path in ${name}.`);
                return [name, { generated, installed: text }] as const;
            }),
        );
        return installHooks({ policy, repository }, generated);
    } finally {
        files.close();
        rmSync(work, { recursive: true, force: true });
    }
}

export type PreparedHook = { generated: string; installed: string };
