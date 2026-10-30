export const BASH_SIZE_CASES = [
    {
        file: 'scripts/tall.sh',
        rule: 'function-lines',
        line: 9,
        limit: 12,
        message: 'main has 13 code lines, over the limit of 12.',
    },
    {
        file: 'scripts/branchy.sh',
        rule: 'function-branches',
        line: 9,
        limit: 4,
        message: 'main has 5 branches, over the limit of 4.',
    },
    {
        file: 'scripts/deep.sh',
        rule: 'block-nesting',
        line: 9,
        limit: 2,
        message: 'main has 3 levels of nesting, over the limit of 2.',
    },
    {
        file: 'scripts/mutable.sh',
        rule: 'function-assignments',
        line: 9,
        limit: 3,
        message: 'main has 4 assignments, over the limit of 3.',
    },
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

export const CORRECTED_LOOPS = `main() {
    local declared=0
    for ((i=0; i<2; i=i+1)); do
        if [[ -n "$1" ]]; then
            first=1
        fi
    done
}
`;
