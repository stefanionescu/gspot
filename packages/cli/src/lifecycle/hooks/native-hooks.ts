// The hook gspot installs beside a native manager's copy: it runs the manager's own hook, reads what gspot
// reported through it, and runs gspot itself when the manager did not.
import { join } from 'node:path';
import { binaryPath } from '#cli/platform/assets.ts';
import { HOOK_FILES } from '#cli/repository/hooks.ts';
import type { Policy } from '#cli/policy/normalize.ts';
import type { ConfinedRoot } from '#cli/platform/filesystem.ts';
import { simpleGitHookFallback } from '#cli/generation/simple-git-hooks.ts';
import { hookPrefix, huskyLines, lefthookCommand, simpleGitHookCommand } from '#cli/generation/hooks.ts';

type HookName = (typeof HOOK_FILES)[number];

// The lines every gspot hook starts with: a work directory that is removed on exit, and signal exits.
const WORK_LINES = (name: string): string[] => [
    `gspot_work=$(mktemp -d "\${TMPDIR:-/tmp}/gspot-${name}.XXXXXXXX") || exit 2`,
    `trap 'rm -rf "\${gspot_work}"' EXIT`,
    "trap 'exit 129' HUP",
    "trap 'exit 130' INT",
    "trap 'exit 143' TERM",
];

// A value quoted for a POSIX shell.
function quoted(value: string): string {
    return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

// The redirection that hands a pre-push hook its saved input.
function pushInput(name: string, path: string): string {
    return name === 'pre-push' ? ` < "${path}"` : '';
}

// The stage a hook name is, or undefined when the manager generated a hook gspot has no stage for.
function stageOf(name: string): HookName | undefined {
    return HOOK_FILES.find((hook) => hook === name);
}

// The gspot hook that runs pre-commit's native hook and relays the result gspot wrote through it.
function preCommitHook(preparation: Preparation, name: string, generated: string): string {
    const validate = `${quoted(preparation.executable)} validate-config ${quoted(preparation.installedConfig)}`;
    const commitLines =
        name === 'pre-commit'
            ? [
                  'gspot_unmerged=$(git ls-files --unmerged) || exit 2',
                  String.raw`if [ -n "$gspot_unmerged" ]; then printf "%s\n" "Unmerged index entries prevent pre-commit checks. Resolve the conflicts before checking." >&2; exit 2; fi`,
                  String.raw`if ! git diff --quiet --no-ext-diff -- ${quoted(preparation.installedConfig)}; then printf "%s\n" "Cannot use pre-commit configuration from the index. Stage the configuration and retry." >&2; exit 2; fi`,
              ]
            : [];
    const ranLines =
        name === 'pre-commit'
            ? [
                  String.raw`if [ "$gspot_native_status" -eq 0 ] && [ ! -s "$GSPOT_PRE_COMMIT_RESULT" ]; then printf "%s\n" "The pre-commit integration did not run gspot. Run gspot apply, then gspot install." >&2; exit 2; fi`,
              ]
            : [];
    return [
        '#!/usr/bin/env bash',
        ...WORK_LINES('pre-commit'),
        'export GSPOT_PRE_COMMIT_RESULT="$gspot_work/result"',
        `if ! ${validate}; then`,
        String.raw`    printf "%s\n" "Cannot load pre-commit configuration. Check the dependency and configuration, then run gspot install." >&2`,
        '    exit 2',
        'fi',
        ...commitLines,
        'gspot_native_status=0',
        `SKIP= PRE_COMMIT_ALLOW_NO_CONFIG= bash -c ${quoted(generated)} "$0" "$@" || gspot_native_status=$?`,
        'if [ -s "$GSPOT_PRE_COMMIT_RESULT" ]; then',
        '    read -r gspot_status < "$GSPOT_PRE_COMMIT_RESULT"',
        '    case "$gspot_status" in',
        '        0) ;;',
        '        1) if [ "$gspot_native_status" -eq 0 ]; then exit 1; fi ;;',
        '        *) exit 2 ;;',
        '    esac',
        'fi',
        ...ranLines,
        'case "$gspot_native_status" in 3|126|127) exit 2 ;; *) exit "$gspot_native_status" ;; esac',
        '',
    ].join('\n');
}

// The arguments the simple-git-hooks launcher hands gspot for each stage.
function simpleArguments(name: string): string {
    if (name === 'pre-push') return '"$GSPOT_SIMPLE_REMOTE_NAME" "$GSPOT_SIMPLE_REMOTE_LOCATION"';
    return name === 'commit-msg' ? '"$GSPOT_SIMPLE_MESSAGE"' : '"$@"';
}

// The environment lines a simple-git-hooks stage exports before its native launcher runs.
function simpleExports(name: string): string[] {
    if (name === 'pre-push')
        return [
            'export GSPOT_SIMPLE_REMOTE_NAME="$1" GSPOT_SIMPLE_REMOTE_LOCATION="$2" GSPOT_SIMPLE_INPUT="$gspot_work/input"',
            'cat > "$GSPOT_SIMPLE_INPUT" || exit 2',
        ];
    return name === 'commit-msg' ? ['export GSPOT_SIMPLE_MESSAGE="$1"'] : [];
}

// The gspot hook that runs the simple-git-hooks launcher, then gspot itself when the launcher did not enter it.
function simpleGitHook(preparation: Preparation, name: string, generated: string): string {
    const { root, policy } = preparation;
    const stage = stageOf(name);
    const invocation = simpleGitHookCommand(hookPrefix(root), name);
    if (stage === undefined || generated.split(invocation).length !== 2)
        throw new Error(`Unsupported simple-git-hooks launcher for ${name}. No hooks were changed.`);
    const input = pushInput(name, '$GSPOT_SIMPLE_INPUT');
    const native = generated.replace(invocation, () =>
        [
            'printf x > "$GSPOT_SIMPLE_ENTERED" || exit 2',
            'cd "$GSPOT_SIMPLE_ROOT" || exit 2',
            `exec ${invocation.replace('"$@"', simpleArguments(name))}${input}`,
        ].join('\n'),
    );
    const fallback = simpleGitHookFallback(root, stage, policy.runner?.tool, binaryPath());
    return [
        '#!/usr/bin/env bash',
        ...WORK_LINES('simple-hooks'),
        'export GSPOT_SIMPLE_ENTERED="$gspot_work/entered" GSPOT_SIMPLE_ROOT="$PWD"',
        ...simpleExports(name),
        'gspot_native_status=0',
        `SKIP_SIMPLE_GIT_HOOKS=0 sh -c ${quoted(native)} "$0" "$@"${input} || gspot_native_status=$?`,
        String.raw`case "$gspot_native_status" in 126|127) printf "%s\n" "The hook integration is unavailable. Run gspot apply, then gspot install." >&2; exit 2 ;; esac`,
        'if [ "$gspot_native_status" -ne 0 ]; then exit "$gspot_native_status"; fi',
        'if [ -f "$GSPOT_SIMPLE_ENTERED" ]; then exit 0; fi',
        `bash -c ${quoted(fallback)} "$0" "$@"${input}`,
        '',
    ].join('\n');
}

// The environment lines a Husky or Lefthook stage exports for the arguments Git passed it.
function stageExports(prefix: string, name: string): string[] {
    if (name === 'pre-push') return [`export ${prefix}_REMOTE_NAME="$1" ${prefix}_REMOTE_LOCATION="$2"`];
    return name === 'commit-msg' ? [`export ${prefix}_MESSAGE="$1"`] : [];
}

// The gspot hook that runs Husky's runtime for the repository's script, then gspot when the script did not.
function huskyHook(preparation: Preparation, name: string): string {
    const { root, policy, files } = preparation;
    const runtime = files.read('.husky/_/h');
    const command = huskyLines(root, policy.runner?.tool, binaryPath()).find(
        (entry) => entry.path === `.husky/${name}`,
    );
    if (runtime === undefined || command === undefined)
        throw new Error(`Unsupported Husky installation for ${name}. No hooks were changed.`);
    const script = join(root, '.husky', name);
    const nativePath = join(root, '.husky', '_', name);
    const inputLines =
        name === 'pre-push'
            ? ['export GSPOT_HUSKY_INPUT="$gspot_work/input"', 'cat > "$GSPOT_HUSKY_INPUT" || exit 2']
            : [];
    return [
        '#!/usr/bin/env bash',
        String.raw`if [ ! -f ${quoted(script)} ]; then printf "%s\n" "Husky integration is missing. Run gspot apply, then gspot install." >&2; exit 2; fi`,
        ...WORK_LINES('husky'),
        'export GSPOT_HUSKY_RESULT="$gspot_work/result" GSPOT_HUSKY_ROOT="$PWD"',
        ...stageExports('GSPOT_HUSKY', name),
        ...inputLines,
        'gspot_native_status=0',
        `HUSKY=1 sh -c ${quoted(runtime.bytes.toString('utf8'))} ${quoted(nativePath)} "$@"${pushInput(name, '$GSPOT_HUSKY_INPUT')} || gspot_native_status=$?`,
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

// Lefthook's native hook with its resolver pointed at the repository executable and auto-install turned off.
function lefthookNative(preparation: Preparation, name: string, generated: string): string {
    const invocation = `call_lefthook run "${name}" "$@"`;
    if (generated.split(invocation).length !== 2)
        throw new Error(`Unsupported Lefthook hook format for ${name}. No hooks were changed.`);
    const resolver = /call_lefthook\(\)\n\{[\s\S]*?\n\}\n/u;
    if (!resolver.test(generated)) throw new Error(`Unsupported Lefthook resolver for ${name}. No hooks were changed.`);
    // The native resolver embeds an unquoted absolute executable path.
    return generated
        .replace(resolver, () => `call_lefthook()\n{\n  ${quoted(preparation.executable)} "$@"\n}\n`)
        .replace(invocation, `call_lefthook run --no-auto-install --no-tty "${name}" "$@"`);
}

// The gspot hook that runs Lefthook's native hook, then gspot when the configuration did not run it.
function lefthookHook(preparation: Preparation, name: string, generated: string): string {
    const native = lefthookNative(preparation, name, generated);
    const stage = stageOf(name);
    if (stage === undefined) return native;
    const input = pushInput(name, '$gspot_work/input');
    return [
        '#!/usr/bin/env bash',
        `export LEFTHOOK=1 LEFTHOOK_BIN=${quoted(preparation.executable)}`,
        ...stageExports('GSPOT_LEFTHOOK', name),
        ...WORK_LINES('lefthook'),
        'export GSPOT_LEFTHOOK_RESULT="$gspot_work/result"',
        'if ! "$LEFTHOOK_BIN" dump --format json > "$gspot_work/config"; then',
        '    cat "$gspot_work/config" >&2',
        String.raw`    printf "%s\n" "Cannot load Lefthook configuration. Check the dependency and configuration, then run gspot install." >&2`,
        '    exit 2',
        'fi',
        ...(name === 'pre-push' ? ['cat > "$gspot_work/input" || exit 2'] : []),
        'gspot_native_status=0',
        `bash -c ${quoted(native)} "$0" "$@"${input} || gspot_native_status=$?`,
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
        `(${lefthookCommand(stage, preparation.policy.runner?.tool, binaryPath())})${input}`,
        '',
    ].join('\n');
}

/**
 * The hook gspot installs for one hook the manager generated in the prepared Git directory.
 * @param preparation the manager, its executable, and the prepared directory
 * @param name the hook
 * @returns the manager's generated text and the text gspot installs
 */
export function nativeHook(preparation: Preparation, name: string): PreparedHook {
    const { manager, files, work } = preparation;
    const hook = files.read(`${manager === 'husky' ? '.husky/_' : '.git/hooks'}/${name}`);
    if (hook === undefined) throw new Error(`${manager} did not generate ${name}. Run gspot apply before installing.`);
    const generated = hook.bytes.toString('utf8');
    const builders: Record<HookManager, () => string> = {
        'pre-commit': () => preCommitHook(preparation, name, generated),
        'simple-git-hooks': () => simpleGitHook(preparation, name, generated),
        husky: () => huskyHook(preparation, name),
        lefthook: () => lefthookHook(preparation, name, generated),
    };
    const installed = builders[manager]();
    if (installed.includes(work)) throw new Error(`Hook manager embedded a temporary path in ${name}.`);
    return { generated, installed };
}

/** A native hook manager gspot integrates with. */
export type HookManager = 'simple-git-hooks' | 'pre-commit' | 'lefthook' | 'husky';

/** The prepared Git directory a manager generated its hooks into, and what the generation needs. */
export type Preparation = {
    manager: HookManager;
    policy: Policy;
    root: string;
    executable: string;
    installedConfig: string;
    work: string;
    files: ConfinedRoot;
};

/** A hook a native manager generated, and the text gspot installs in its place. */
export type PreparedHook = { generated: string; installed: string };
