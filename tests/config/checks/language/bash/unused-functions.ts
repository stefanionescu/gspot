import { BASH_HEADER } from '#tests/config/checks/samples.ts';

export const TRAP_SCRIPT_FORMS = ['_cleanup', "'_cleanup'", '"_cleanup"', "'_cleanup; exit 1'"];

const BASH_MAIN = `# main: runs the script.
main() {
    echo "hello"
}

main "$@"
`;

export const UNUSED_FUNCTION_CASES = [
    {
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
    },
] as const;

export const TRAP_FUNCTION_SOURCE = String.raw`${BASH_HEADER}_cleanup() {
    rm -f -- "$work"
}

main() {
    work=$(mktemp)
    trap _cleanup EXIT
    printf '%s\n' "$work"
}

main "$@"
`;
