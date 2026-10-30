import { BASH_HEADER } from '#tests/config/bash.ts';

export const SHEBANG_DOC_SCRIPT = String.raw`#!/usr/bin/env bash
# log_line: print a timestamped message to standard error.
# Arguments:
#   Message text.
log_line() {
    printf '%s\n' "$1" >&2
}
`;

export const DOC_COMMENT_CASES = [
    {
        check: 'bash/doc-comments',
        files: {
            'scripts/silent.sh': `${BASH_HEADER}_quiet() {
    echo one
    echo "$1"
    echo three
}

# main: runs the script.
main() {
    _quiet "$1"
    _quiet "$1"
}

main "$@"
`,
        },
        expected: { file: 'scripts/silent.sh', rule: 'missing-comment', line: 8 },
    },
] as const;
