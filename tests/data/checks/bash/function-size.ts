/** Source locations for the generated Bash size samples. */
export const BASH_SIZE_CASES = [
    { file: 'scripts/tall.sh', rule: 'function-lines', line: 9 },
    { file: 'scripts/branchy.sh', rule: 'function-branches', line: 9 },
    { file: 'scripts/deep.sh', rule: 'block-nesting', line: 9 },
    { file: 'scripts/mutable.sh', rule: 'function-assignments', line: 9 },
] as const;

/** Loop headers do not count as body assignments; both loop forms count as branches and nesting. */
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
export const LOOP_COUNTS = [
    { rule: 'function-branches', message: 'main has 4 branches, over the limit of 3.' },
    { rule: 'block-nesting', message: 'main has 4 levels of nesting, over the limit of 3.' },
    { rule: 'function-assignments', message: 'main has 2 assignments, over the limit of 1.' },
] as const;
export const NESTED_CONDITION = 'if [[ -n "$1" ]]; then';
