/** A Swift function with a bare do block, a do block with catch, and a top-level bare do block. */
export const SWIFT_BARE_BLOCKS = `func report(_ value: Int) {
    do {
        print(value)
    }
    do {
        try check(value)
    } catch {
        print(error)
    }
}
do { print(1) }
`;

/** The same source after each bare do block gives way to its statements. */
export const SWIFT_BLOCKS_FIXED = `func report(_ value: Int) {
    print(value)
    do {
        try check(value)
    } catch {
        print(error)
    }
}
print(1)
`;
