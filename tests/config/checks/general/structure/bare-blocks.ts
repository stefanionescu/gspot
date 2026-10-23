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
