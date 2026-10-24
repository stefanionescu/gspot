import { BASH_HEADER } from '#tests/config/checks/samples.ts';

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
