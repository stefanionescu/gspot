import { BASH_HEADER } from '#tests/config/setup/languages.ts';

export const BASH_SIZE_CASES = [
    { rule: 'function-lines', line: 9, limit: 12 },
    { rule: 'function-branches', line: 9, limit: 4 },
    { rule: 'block-nesting', line: 9, limit: 2 },
    { rule: 'function-assignments', line: 9, limit: 3 },
] as const;

export const COUNTED_LOOPS = `main() {
    local declared=0
    for ((i=0; i<2; i=i+1)); do
        if [[ -n "$1" ]]; then
            for ((j=0; j<2; j=j+1)); do
                if [[ -n "$2" ]]; then
                    first=1
                    second=2
                fi
            done
        fi
    done
}
`;

export const INLINE_SCRIPT_SAMPLE = {
    check: 'bash/inline-scripts',
    files: {
        'scripts/python.sh': `${BASH_HEADER}# main: runs the script.
main() {
    python3 - <<'PY'
print(1)
PY
}

main "$@"
`,
    },
    expected: { file: 'scripts/python.sh', rule: 'runtime-embed', line: 10 },
} as const;

export const BASH_SAFETY_SAMPLE = {
    check: 'bash/safety',
    files: {
        'scripts/unsafe.sh': `${BASH_HEADER}# main: runs the script.
main() {
    cd "\${HOME}"
    touch "\${HOME}/x" || true
}

main "$@"
`,
    },
    expected: { file: 'scripts/unsafe.sh', rule: 'ignored-failure', line: 11 },
} as const;

export const COMMAND_SAFETY_CASES = [
    { source: 'rm -rf /etc', rule: 'recursive-remove' },
    { source: 'rm --recursive --force /etc', rule: 'recursive-remove' },
    { source: 'pkill -f node', rule: 'broad-kill' },
    { source: 'false || :', rule: 'ignored-failure' },
    { source: String.raw`printf '%s\n' 'rm -rf /etc'`, rule: undefined },
    { source: 'eval "$1"', rule: 'eval' },
    { source: 'function greet { :; }', rule: 'function-keyword' },
    { source: 'greet() { :; }', rule: undefined },
    { source: 'typeset value=1', rule: 'typeset' },
    { source: 'ls &>/dev/null', rule: 'combined-redirect' },
    { source: 'ls &>>out.log', rule: 'combined-redirect' },
    { source: 'ls >out.log 2>&1', rule: undefined },
    { source: 'ls |& cat', rule: 'combined-pipe' },
    { source: 'for arg; { :; }', rule: 'brace-for' },
    { source: 'for arg in "$@"; do :; done', rule: undefined },
    { source: 'echo done', rule: 'echo' },
    { source: "bash -lc 'ls'", rule: 'login-shell' },
    { source: "bash -l -c 'ls'", rule: 'login-shell' },
    { source: "bash --login -c 'ls'", rule: 'login-shell' },
    { source: "bash -c 'ls'", rule: undefined },
    { source: 'timeout 5 ls', rule: 'gnu-timeout' },
    { source: 'curl -s https://example.com', rule: 'curl-fail' },
    { source: 'curl --fail https://example.com', rule: undefined },
    { source: 'curl --fail-with-body https://example.com', rule: undefined },
    { source: 'curl -fsSL https://example.com', rule: undefined },
    { source: 'set -x', rule: 'trace-mode' },
    { source: 'set -ex', rule: 'trace-mode' },
    { source: 'set -o xtrace', rule: 'trace-mode' },
    { source: 'set -e', rule: undefined },
    { source: 'for index in $(seq 1 3); do :; done', rule: 'seq-loop' },
    { source: 'for (( index = 0; index < 3; index++ )); do :; done', rule: undefined },
    { source: 'IFS=,', rule: 'script-ifs' },
    { source: 'old_ifs="${IFS}"', rule: 'script-ifs' },
    { source: 'IFS= read -r line', rule: undefined },
    { source: "(IFS=,; printf '%s' x)", rule: undefined },
    { source: 'join() { local IFS=,; printf \'%s\' "$*"; }', rule: undefined },
] as const;

export const UNREAD_ARGUMENT_CASES = [
    {
        files: {
            'scripts/deaf.sh': `${BASH_HEADER}# _deaf: reads nothing.
_deaf() {
    echo a
    echo b
    echo c
}

# main: runs the script.
main() {
    _deaf one two
    _deaf one four
}

main "$@"
`,
        },
        expected: { file: 'scripts/deaf.sh', rule: 'unread-arguments', line: 9 },
    },
    {
        files: {
            'scripts/half.sh': `${BASH_HEADER}# _half: reads the first argument only.
_half() {
    echo a
    echo b
    echo "$1"
}

# main: runs the script.
main() {
    _half one two
    _half one four
}

main "$@"
`,
        },
        expected: { file: 'scripts/half.sh', rule: 'unread-arguments', line: 9 },
    },
] as const;

const BASH_MAIN = `# main: runs the script.
main() {
    echo "hello"
}

main "$@"
`;

export const UNUSED_FUNCTION_SAMPLE = {
    check: 'bash/unused-functions',
    files: {
        'scripts/orphan.sh': `${BASH_HEADER}# _orphan: nobody calls this.
_orphan() {
    echo a
    echo b
    echo orphan
}

${BASH_MAIN}`,
    },
    expected: { file: 'scripts/orphan.sh', rule: 'never-called', line: 9 },
} as const;

export const LITERAL_FUNCTION_REFERENCES = ['xargs -n1 _each', 'export -f _each'] as const;

export const SCRIPT_LAYOUT_SAMPLE = {
    check: 'bash/script-layout',
    files: {
        'scripts/headless.sh': `#!/usr/bin/env bash
main() {
    echo hi
}

main "$@"
`,
    },
    expected: { file: 'scripts/headless.sh', rule: 'strict-mode', line: 2 },
    executable: ['scripts/headless.sh'],
} as const;

export const ENVIRONMENT_READER_SCOPE_TABLES = `[[scope]]
path = "tools"
configurations = ["bash"]
[scope.structure]
environment_readers = ["env.sh"]
`;

export const LAYOUT_RULE_CASES = [
    { rule: 'shebang', source: 'VALUE=1\n', corrected: '#!/usr/bin/env bash\nVALUE=1\n', executable: false },
    {
        rule: 'main-function',
        source: '#!/usr/bin/env bash\nset -euo pipefail\nrun() { true; }\nmain "$@"\n',
        corrected: '#!/usr/bin/env bash\nset -euo pipefail\nmain() { true; }\nmain "$@"\n',
        executable: true,
    },
    {
        rule: 'main-call',
        source: '#!/usr/bin/env bash\nset -euo pipefail\nmain() { true; }\nmain\n',
        corrected: '#!/usr/bin/env bash\nset -euo pipefail\nmain() { true; }\nmain "$@"\n',
        executable: true,
    },
    {
        rule: 'library-options',
        source: '#!/usr/bin/env bash\nset -euo pipefail\n',
        corrected: '#!/usr/bin/env bash\nVALUE=1\n',
        executable: false,
    },
    {
        rule: 'library-main',
        source: '#!/usr/bin/env bash\nmain() { true; }\n',
        corrected: '#!/usr/bin/env bash\nrun() { true; }\n',
        executable: false,
    },
    {
        rule: 'library-exit',
        source: '#!/usr/bin/env bash\nexit 0\n',
        corrected: '#!/usr/bin/env bash\nVALUE=1\n',
        executable: false,
    },
    {
        rule: 'executable-bit',
        source: '#!/usr/bin/env bash\nset -euo pipefail\nmain() { true; }\nmain "$@"\n',
        corrected: '#!/usr/bin/env bash\nset -euo pipefail\nmain() { true; }\nmain "$@"\n',
        executable: false,
    },
] as const;
