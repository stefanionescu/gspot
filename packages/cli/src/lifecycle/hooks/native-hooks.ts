// Installs a gspot hook beside the hook tool's copy and invokes that native hook.
// Runs gspot when the native hook did not report a gspot result.
import { join } from 'node:path';
import { binaryPath } from '#cli/platform/assets.ts';
import type { HookName } from '#cli/types/generation.ts';
import { huskyLines } from '#cli/generation/hooks/husky.ts';
import { HOOK_FILES } from '#cli/config/repository/repository.ts';
import { lefthookCommand } from '#cli/generation/hooks/lefthook.ts';
import { simpleGitDirectHook } from '#cli/generation/hooks/simple-git-hooks.ts';
import type { Dispatch, Preparation, PreparedHook } from '#cli/types/lifecycle/hooks.ts';
import { hookPrefix, commitPathLines, simpleGitHookCommand } from '#cli/generation/hooks/scripts.ts';

// The lines every gspot hook starts with: a work directory that is removed on exit, and signal exits.
const WORK_LINES = [
    `gspot_work=$(mktemp -d "\${TMPDIR:-/tmp}/gspot-hook.XXXXXXXX") || exit 2`,
    `trap 'rm -rf "\${gspot_work}"' EXIT`,
    "trap 'exit 129' HUP",
    "trap 'exit 130' INT",
    "trap 'exit 143' TERM",
];
const UNAVAILABLE_NOTE = 'The hook integration is unavailable. Run gspot apply, then gspot install.';

// A value quoted for a POSIX shell.
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Builds a template; inlining it nests a template inside a template.
function quoted(value: string): string {
    return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

// The stage a hook name is, or undefined when the manager generated a hook gspot has no stage for.
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Builds a template; inlining it nests a template inside a template.
function stageOf(name: string): HookName | undefined {
    return HOOK_FILES.find((hook) => hook === name);
}

// The environment every dispatcher exports for a stage: the Git arguments, the saved push input, or the message path.
function stageExports(name: string): string[] {
    if (name === 'pre-push')
        return [
            'export GSPOT_HOOK_REMOTE_NAME="$1" GSPOT_HOOK_REMOTE_LOCATION="$2" GSPOT_HOOK_INPUT="$gspot_work/input"',
            'cat > "$GSPOT_HOOK_INPUT" || exit 2',
        ];
    if (name !== 'commit-msg') return [];
    return [
        'gspot_message="$1"',
        ...commitPathLines('gspot_message', false),
        'export GSPOT_HOOK_MESSAGE="$gspot_message"',
    ];
}

// The dispatcher: one script shape for every manager, filled with what the manager needs.
function dispatcherScript(name: string, dispatch: Dispatch): string {
    const input = name === 'pre-push' ? ' < "$GSPOT_HOOK_INPUT"' : '';
    const unavailable =
        dispatch.unavailable.length === 0
            ? []
            : [
                  `case "$gspot_native_status" in ${dispatch.unavailable.join('|')}) echo ${quoted(dispatch.unavailableNote ?? UNAVAILABLE_NOTE)} >&2; exit 2 ;; esac`,
              ];
    const missing = quoted(`The ${dispatch.tool} integration did not run gspot. Run gspot apply, then gspot install.`);
    const silence = dispatch.isRunRequired
        ? [`if [ "$gspot_native_status" -eq 0 ] && [ ! -s "$GSPOT_HOOK_RESULT" ]; then echo ${missing} >&2; exit 2; fi`]
        : [];
    return [
        '#!/usr/bin/env bash',
        ...dispatch.preamble,
        ...WORK_LINES,
        'export GSPOT_HOOK_RESULT="$gspot_work/result" GSPOT_HOOK_ROOT="$PWD"',
        ...stageExports(name),
        ...dispatch.checks,
        'gspot_native_status=0',
        `${dispatch.native}${input} || gspot_native_status=$?`,
        ...unavailable,
        'if [ -s "$GSPOT_HOOK_RESULT" ]; then',
        '    read -r gspot_status < "$GSPOT_HOOK_RESULT"',
        '    case "$gspot_status" in',
        '        0) exit "$gspot_native_status" ;;',
        '        1) if [ "$gspot_native_status" -eq 0 ]; then exit 1; else exit "$gspot_native_status"; fi ;;',
        '        *) exit 2 ;;',
        '    esac',
        'fi',
        ...silence,
        'if [ "$gspot_native_status" -ne 0 ]; then exit "$gspot_native_status"; fi',
        dispatch.direct === undefined ? 'exit 0' : `${dispatch.direct}${input}`,
        '',
    ].join('\n');
}

// pre-commit: its configuration is validated first; at the commit stage the index must be clean and it must run gspot.
function preCommitDispatch(preparation: Preparation, name: string, generated: string): Dispatch {
    const validate = `${quoted(preparation.executable)} validate-config ${quoted(preparation.installedConfig)}`;
    const commitLines =
        name === 'pre-commit'
            ? [
                  'gspot_unmerged=$(git ls-files --unmerged) || exit 2',
                  'if [ -n "$gspot_unmerged" ]; then echo "Unmerged index entries prevent pre-commit checks. Resolve the conflicts before checking." >&2; exit 2; fi',
                  `if ! git diff --quiet --no-ext-diff -- ${quoted(preparation.installedConfig)}; then echo "Cannot use pre-commit configuration from the index. Stage the configuration and retry." >&2; exit 2; fi`,
              ]
            : [];
    return {
        tool: 'pre-commit',
        preamble: [],
        checks: [
            `if ! ${validate}; then`,
            '    echo "Cannot load pre-commit configuration. Check the dependency and configuration, then run gspot install." >&2',
            '    exit 2',
            'fi',
            ...commitLines,
        ],
        native: `SKIP= PRE_COMMIT_ALLOW_NO_CONFIG= bash -c ${quoted(generated)} "$0" "$@"`,
        unavailable: ['3', '126', '127'],
        isRunRequired: name === 'pre-commit',
        direct: undefined,
    };
}

// The arguments the simple-git-hooks launcher hands gspot for each stage.
function simpleArguments(name: string): string {
    if (name === 'pre-push') return '"$GSPOT_HOOK_REMOTE_NAME" "$GSPOT_HOOK_REMOTE_LOCATION"';
    return name === 'commit-msg' ? '"$GSPOT_HOOK_MESSAGE"' : '"$@"';
}

// simple-git-hooks: its launcher runs from the repository root, and gspot runs directly when it never entered.
function simpleGitDispatch(preparation: Preparation, name: string, generated: string): Dispatch {
    const { root, policy } = preparation;
    const stage = stageOf(name);
    const invocation = simpleGitHookCommand(hookPrefix(root), name);
    if (stage === undefined || generated.split(invocation).length - 1 !== 1)
        throw new Error(`Unsupported simple-git-hooks launcher for ${name}. No hooks were changed.`);
    // The saved input is handed over again here: a launcher rc file may have read the hook's stdin already.
    const input = name === 'pre-push' ? ' < "$GSPOT_HOOK_INPUT"' : '';
    const native = generated.replace(invocation, () =>
        ['cd "$GSPOT_HOOK_ROOT" || exit 2', `exec ${invocation.replace('"$@"', simpleArguments(name))}${input}`].join(
            '\n',
        ),
    );
    return {
        tool: 'simple-git-hooks',
        preamble: [],
        checks: [],
        native: `SKIP_SIMPLE_GIT_HOOKS=0 sh -c ${quoted(native)} "$0" "$@"`,
        unavailable: ['126', '127'],
        isRunRequired: false,
        direct: `bash -c ${quoted(simpleGitDirectHook(root, stage, policy.runner?.tool, binaryPath()))} "$0" "$@"`,
    };
}

// Husky: its runtime runs the repository's script, and the gspot line runs when the script did not.
function huskyDispatch(preparation: Preparation, name: string): Dispatch {
    const { root, policy, files } = preparation;
    const runtime = files.read('.husky/_/h');
    const command = huskyLines(root, policy.runner?.tool, binaryPath()).find(
        (entry) => entry.path === `.husky/${name}`,
    );
    if (runtime === undefined || command === undefined)
        throw new Error(`Unsupported Husky installation for ${name}. No hooks were changed.`);
    const script = join(root, '.husky', name);
    const nativePath = join(root, '.husky', '_', name);
    return {
        tool: 'husky',
        preamble: [
            `if [ ! -f ${quoted(script)} ]; then echo "Husky integration is missing. Run gspot apply, then gspot install." >&2; exit 2; fi`,
        ],
        checks: [],
        native: `HUSKY=1 sh -c ${quoted(runtime.bytes.toString('utf8'))} ${quoted(nativePath)} "$@"`,
        unavailable: [],
        isRunRequired: false,
        direct: command.line,
    };
}

// Lefthook's native hook with its resolver pointed at the repository executable and auto-install turned off.
function lefthookNative(preparation: Preparation, name: string, generated: string): string {
    const invocation = `call_lefthook run "${name}" "$@"`;
    if (generated.split(invocation).length - 1 !== 1)
        throw new Error(`Unsupported Lefthook hook format for ${name}. No hooks were changed.`);
    const resolver = /call_lefthook\(\)\n\{[\s\S]*?\n\}\n/u;
    if (!resolver.test(generated)) throw new Error(`Unsupported Lefthook resolver for ${name}. No hooks were changed.`);
    // The native resolver embeds an unquoted absolute executable path.
    return generated
        .replace(resolver, () => `call_lefthook()\n{\n  ${quoted(preparation.executable)} "$@"\n}\n`)
        .replace(invocation, `call_lefthook run --no-auto-install --no-tty "${name}" "$@"`);
}

// Lefthook: its configuration is dumped first, and the gspot command runs when the configuration did not run it.
function lefthookDispatch(preparation: Preparation, stage: HookName, native: string): Dispatch {
    const checks = [
        'if ! "$LEFTHOOK_BIN" dump --format json > "$gspot_work/config"; then',
        '    cat "$gspot_work/config" >&2',
        '    echo "Cannot load Lefthook configuration. Check the dependency and configuration, then run gspot install." >&2',
        '    exit 2',
        'fi',
    ];
    const direct = `(${lefthookCommand(stage, preparation.policy.runner?.tool, binaryPath())})`;
    return {
        tool: 'lefthook',
        preamble: [`export LEFTHOOK=1 LEFTHOOK_BIN=${quoted(preparation.executable)}`],
        checks,
        native: `bash -c ${quoted(native)} "$0" "$@"`,
        unavailable: ['126', '127'],
        unavailableNote:
            'The repository Lefthook executable is unavailable. Install the dependency, then run: gspot install',
        isRunRequired: false,
        direct,
    };
}

// The text gspot installs for one manager's hook: a dispatcher, or the manager's own hook for a stage gspot has none for.
function installedHook(preparation: Preparation, name: string, generated: string): string {
    const { hookTool } = preparation;
    if (hookTool === 'pre-commit') return dispatcherScript(name, preCommitDispatch(preparation, name, generated));
    if (hookTool === 'simple-git-hooks') return dispatcherScript(name, simpleGitDispatch(preparation, name, generated));
    if (hookTool === 'husky') return dispatcherScript(name, huskyDispatch(preparation, name));
    const native = lefthookNative(preparation, name, generated);
    const stage = stageOf(name);
    return stage === undefined ? native : dispatcherScript(name, lefthookDispatch(preparation, stage, native));
}

/**
 * The hook gspot installs for one hook the manager generated in the prepared Git directory.
 * @param preparation the manager, its executable, and the prepared directory
 * @param name the hook
 * @returns the manager's generated text and the text gspot installs
 */
export function nativeHook(preparation: Preparation, name: string): PreparedHook {
    const { hookTool, files, work } = preparation;
    const hook = files.read(`${hookTool === 'husky' ? '.husky/_' : '.git/hooks'}/${name}`);
    if (hook === undefined) throw new Error(`${hookTool} did not generate ${name}. Run gspot apply before installing.`);
    const generated = hook.bytes.toString('utf8');
    const installed = installedHook(preparation, name, generated);
    if (installed.includes(work)) throw new Error(`Hook manager embedded a temporary path in ${name}.`);
    return { generated, installed };
}
