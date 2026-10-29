import { BASH_HEADER } from '#tests/config/bash.ts';

export const BASH_SAFETY_CASES = [
    {
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
    },
] as const;

export const COMMAND_SAFETY_CASES = [
    { source: 'rm -rf /etc', rule: 'recursive-remove' },
    { source: 'rm -Rf /etc', rule: 'recursive-remove' },
    { source: 'rm -r -f /etc', rule: 'recursive-remove' },
    { source: 'rm -r /etc', rule: 'recursive-remove' },
    { source: 'rm --recursive --force /etc', rule: 'recursive-remove' },
    { source: 'pkill -f node', rule: 'broad-kill' },
    { source: 'pkill node', rule: 'broad-kill' },
    { source: 'killall node', rule: 'broad-kill' },
    { source: 'false || true; next', rule: 'ignored-failure' },
    { source: 'false || :', rule: 'ignored-failure' },
    { source: "echo 'rm -rf /etc'", rule: undefined },
] as const;
