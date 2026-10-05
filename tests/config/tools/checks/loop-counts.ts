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
    { rule: 'branches', message: 'main has 4 branches, over the ceiling of 3.' },
    { rule: 'nesting', message: 'main has 4 levels of nesting, over the ceiling of 3.' },
    { rule: 'assignments', message: 'main has 2 assignments, over the ceiling of 1.' },
];
