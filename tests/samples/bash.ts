// The planted Bash scripts of the bash kit tests: one defect per check, each with a corrected script.
import type { FindingCase } from '#tests/types/cli.ts';

const NESTED =
    '    if [[ -n "$1" ]]; then\n        for item in "$@"; do\n            while true; do\n                if [[ -n "${item}" ]]; then\n                    case "${item}" in\n                        a) echo a ;;\n                    esac\n                fi\n                break\n            done\n        done\n    fi';

const HEAD =
    '#!/usr/bin/env bash\n#\n# Builds the thing.\n# Runtime: Bash 4.4+, macOS and Linux.\nset -euo pipefail\nshopt -s inherit_errexit\n\n';

const BRANCHES = Array.from(
    { length: 12 },
    (_, index) => `    if [[ "$1" == "${String(index)}" ]]; then echo ${String(index)}; fi`,
).join('\n');

const ASSIGNMENTS = Array.from({ length: 14 }, (_, index) => `    total="\${total}${String(index)}"`).join('\n');

const LONG_BODY = Array.from({ length: 70 }, (_, index) => `    echo "line ${String(index)}"`).join('\n');

const LONG_FILE = Array.from({ length: 320 }, (_, index) => `readonly VALUE_${String(index)}=${String(index)}`).join(
    '\n',
);

export const BASH_CASES_MAIN = '# main: runs the script.\nmain() {\n    echo "hello $1"\n}\n\nmain "$@"\n';

export const BASH_CASES: FindingCase[] = [
    {
        check: 'bash/syntax',
        files: { 'scripts/broken.sh': `${HEAD}main() {\n    if then\n}\n\nmain "$@"\n` },
        expected: { file: 'scripts/broken.sh', line: 9 },
    },
    {
        check: 'bash/shellcheck',
        files: { 'scripts/unquoted.sh': `${HEAD}# main: runs the script.\nmain() {\n    echo $1\n}\n\nmain "$@"\n` },
        expected: { file: 'scripts/unquoted.sh', rule: 'SC2086', line: 10 },
    },
    {
        check: 'bash/shfmt',
        files: {
            'scripts/indent.sh': `${HEAD}# main: runs the script.\nmain() {\n  echo "two spaces"\n}\n\nmain "$@"\n`,
        },
        expected: { file: 'scripts/indent.sh' },
    },
    {
        check: 'bash/contract',
        files: { 'scripts/headless.sh': '#!/usr/bin/env bash\nmain() {\n    echo hi\n}\n\nmain "$@"\n' },
        policy: '[tools.bash]\nplatforms = "macOS and Linux"\n',
        expected: { file: 'scripts/headless.sh', rule: 'runtime-header', line: 4 },
        executable: ['scripts/headless.sh'],
    },
    {
        check: 'bash/doc-comments',
        files: {
            'scripts/silent.sh': `${HEAD}_quiet() {\n    echo one\n    echo "$1"\n    echo three\n}\n\n${BASH_CASES_MAIN.replace('echo "hello $1"', () => '_quiet "$1"\n    _quiet "$1"')}`,
        },
        expected: { file: 'scripts/silent.sh', rule: 'missing-comment', line: 8 },
    },
    {
        check: 'bash/duplicate-functions',
        files: {
            'scripts/twice.sh': `${HEAD}# _first: prints three lines.\n_first() {\n    echo one\n    echo two\n    echo "$1"\n}\n\n# _second: prints three lines again.\n_second() {\n    echo one\n    echo two\n    echo "$1"\n}\n\n${BASH_CASES_MAIN}`,
        },
        expected: { file: 'scripts/twice.sh', rule: 'same-body', line: 9 },
    },
    {
        check: 'bash/unused-functions',
        files: {
            'scripts/orphan.sh': `${HEAD}# _orphan: nobody calls this.\n_orphan() {\n    echo a\n    echo b\n    echo "$1"\n}\n\n${BASH_CASES_MAIN}`,
        },
        expected: { file: 'scripts/orphan.sh', rule: 'never-called', line: 9 },
    },
    {
        check: 'bash/unread-arguments',
        files: {
            'scripts/deaf.sh': `${HEAD}# _deaf: reads nothing.\n_deaf() {\n    echo a\n    echo b\n    echo c\n}\n\n# main: runs the script.\nmain() {\n    _deaf "$1" two\n    _deaf "$1" four\n}\n\nmain "$@"\n`,
        },
        expected: { file: 'scripts/deaf.sh', rule: 'unread-arguments', line: 9 },
    },
    {
        check: 'bash/unread-arguments',
        files: {
            'scripts/half.sh': `${HEAD}# _half: reads the first argument only.\n_half() {\n    echo a\n    echo b\n    echo "$1"\n}\n\n# main: runs the script.\nmain() {\n    _half "$1" two\n    _half "$1" four\n}\n\nmain "$@"\n`,
        },
        expected: { file: 'scripts/half.sh', rule: 'unread-arguments', line: 9 },
    },
    {
        check: 'bash/source-comments',
        files: {
            'scripts/noted.sh': `${HEAD}source ./lib/a.sh\n# the b library\nsource ./lib/bb.sh\n\n${BASH_CASES_MAIN}`,
            'scripts/lib/a.sh': `${HEAD}# a_step: one step.\na_step() {\n    echo a\n    echo b\n    echo "$1"\n}\n`,
            'scripts/lib/bb.sh': `${HEAD}# b_step: one step.\nb_step() {\n    echo a\n    echo b\n    echo "$1"\n}\n`,
        },
        expected: { file: 'scripts/noted.sh', rule: 'source-comment', line: 9 },
    },
    {
        check: 'bash/source-order',
        files: {
            'scripts/ordered.sh': `${HEAD}source ./lib/bb.sh\nsource ./lib/a.sh\n\n${BASH_CASES_MAIN}`,
            'scripts/lib/a.sh': `${HEAD}# a_step: one step.\na_step() {\n    echo a\n    echo b\n    echo "$1"\n}\n`,
            'scripts/lib/bb.sh': `${HEAD}# b_step: one step.\nb_step() {\n    echo a\n    echo b\n    echo "$1"\n}\n`,
        },
        expected: { file: 'scripts/ordered.sh', rule: 'source-order', line: 8 },
    },
    {
        check: 'bash/private-prefix',
        files: {
            'scripts/local.sh': `${HEAD}# build_it: only this file calls it.\nbuild_it() {\n    echo a\n    echo b\n    echo "$1"\n}\n\n# main: runs the script.\nmain() {\n    build_it "$1"\n    build_it "$1"\n}\n\nmain "$@"\n`,
        },
        expected: { file: 'scripts/local.sh', rule: 'unprefixed', line: 9 },
    },
    {
        check: 'bash/private-before-public',
        files: {
            'scripts/lib.sh': `${HEAD}# shared_step: other files call this one.\nshared_step() {\n    echo a\n    echo b\n    echo "$1"\n}\n\n# _late: a private function below a public one.\n_late() {\n    echo a\n    echo c\n    echo "$1"\n}\n\n# main: runs the script.\nmain() {\n    _late "$1"\n    _late "$1"\n    shared_step "$1"\n}\n\nmain "$@"\n`,
            'scripts/user.sh': `${HEAD}# main: runs the script.\nmain() {\n    shared_step "$1"\n}\n\nmain "$@"\n`,
        },
        expected: { file: 'scripts/lib.sh', rule: 'private-before-public', line: 16 },
    },
    {
        check: 'bash/trivial-functions',
        files: {
            'scripts/tiny.sh': `${HEAD}# _tiny: one line, one caller.\n_tiny() {\n    echo "$1"\n}\n\n# main: runs the script.\nmain() {\n    _tiny "$1"\n}\n\nmain "$@"\n`,
        },
        expected: { file: 'scripts/tiny.sh', rule: 'trivial-function', line: 9 },
    },
    {
        check: 'bash/trivial-functions',
        files: {
            'scripts/forward.sh': `${HEAD}# _forward: hands everything on.\n_forward() {\n    printf "$@"\n}\n\n# main: runs the script.\nmain() {\n    _forward "$1"\n    _forward "$1"\n}\n\nmain "$@"\n`,
        },
        expected: { file: 'scripts/forward.sh', rule: 'trivial-function', line: 9 },
    },
    {
        check: 'bash/limits',
        files: { 'scripts/long.sh': `${HEAD}${LONG_FILE}\n\n${BASH_CASES_MAIN}` },
        expected: { file: 'scripts/long.sh', rule: 'file-lines', line: 1 },
    },
    {
        check: 'bash/limits',
        files: {
            'scripts/tall.sh': `${HEAD}# main: runs the script.\nmain() {\n    echo "$1"\n${LONG_BODY}\n}\n\nmain "$@"\n`,
        },
        expected: { file: 'scripts/tall.sh', rule: 'function-lines', line: 9 },
    },
    {
        check: 'bash/wrappers',
        files: {
            'scripts/node.sh': `${HEAD}# main: runs the script.\nmain() {\n    node -e 'console.log(1)' "$1"\n}\n\nmain "$@"\n`,
        },
        expected: { file: 'scripts/node.sh', rule: 'inline-node', line: 10 },
    },
    {
        check: 'bash/embeds',
        files: {
            'scripts/python.sh': `${HEAD}# main: runs the script.\nmain() {\n    python3 - <<'PY'\nprint(1)\nPY\n}\n\nmain "$@"\n`,
        },
        expected: { file: 'scripts/python.sh', rule: 'runtime-embed', line: 10 },
    },
    {
        check: 'bash/ssh-blocks',
        files: {
            'scripts/remote.sh': `${HEAD}# main: runs the script.\nmain() {\n    ssh "$1" <<'REMOTE'\nuptime\nREMOTE\n}\n\nmain "$@"\n`,
        },
        expected: { file: 'scripts/remote.sh', rule: 'undocumented-block', line: 10 },
    },
    {
        check: 'bash/defaults',
        files: {
            'scripts/defaults.sh': `${HEAD}# main: runs the script.\nmain() {\n    local port="\${PORT:-8080}"\n    echo "\${port} $1"\n}\n\nmain "$@"\n`,
        },
        expected: { file: 'scripts/defaults.sh', rule: 'default-outside-owner', line: 10 },
    },
    {
        check: 'bash/guards',
        files: {
            'scripts/settings.sh':
                '#!/usr/bin/env bash\n#\n# Holds the settings.\n# Runtime: Bash 4.0+, macOS and Linux.\n\nreadonly PORT=8080\n',
        },
        policy: '[tools.bash]\nconfig_owners = ["scripts/settings.sh"]\n',
        expected: { file: 'scripts/settings.sh', rule: 'guard-first', line: 6 },
    },
    {
        check: 'bash/boundaries',
        files: { 'deploy/step.sh': `${HEAD}${BASH_CASES_MAIN}` },
        policy: '[tools.bash]\nboundary_roots = ["deploy"]\n',
        expected: { file: 'deploy/step.sh', rule: 'boundary-header', line: 1 },
        executable: ['deploy/step.sh'],
    },
    {
        check: 'bash/env-owner',
        files: {
            'scripts/environment.sh':
                '#!/usr/bin/env bash\n#\n# Owns the environment.\n# Runtime: Bash 4.0+, macOS and Linux.\n\nreadonly DEPLOY_TARGET="${1:-}"\n',
            'scripts/reader.sh': `${HEAD}# main: runs the script.\nmain() {\n    echo "\${DEPLOY_TARGET} $1"\n}\n\nmain "$@"\n`,
        },
        policy: '[architecture]\nroles = { env = "scripts/environment.sh" }\n',
        expected: { file: 'scripts/reader.sh', rule: 'read-outside-owner', line: 10 },
    },
    {
        check: 'bash/limits',
        files: { 'scripts/branchy.sh': `${HEAD}# main: runs the script.\nmain() {\n${BRANCHES}\n}\n\nmain "$@"\n` },
        expected: { file: 'scripts/branchy.sh', rule: 'function-branches', line: 9 },
    },
    {
        check: 'bash/limits',
        files: { 'scripts/deep.sh': `${HEAD}# main: runs the script.\nmain() {\n${NESTED}\n}\n\nmain "$@"\n` },
        expected: { file: 'scripts/deep.sh', rule: 'function-nesting', line: 9 },
    },
    {
        check: 'bash/limits',
        files: {
            'scripts/mutable.sh': `${HEAD}# main: runs the script.\nmain() {\n    local total="$1"\n${ASSIGNMENTS}\n    echo "\${total}"\n}\n\nmain "$@"\n`,
        },
        expected: { file: 'scripts/mutable.sh', rule: 'mutable-assignments', line: 9 },
    },
    {
        check: 'bash/safety',
        files: {
            'scripts/unsafe.sh': `${HEAD}# main: runs the script.\nmain() {\n    cd "$1"\n    rm -rf "\${HOME}/x" || true\n}\n\nmain "$@"\n`,
        },
        expected: { file: 'scripts/unsafe.sh', rule: 'blanket-success', line: 11 },
    },
];

/** The checks of the table that run a tool, ShellCheck, shfmt, Bash, or ast-grep, rather than gspot alone. */
export const TOOL_CHECKS = ['bash/shellcheck', 'bash/shfmt', 'bash/syntax', 'bash/limits'];
