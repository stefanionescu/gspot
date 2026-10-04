/** Quotes, parameter modifiers, and escaped hashes remain code. */
export const COMMENT_CASES = [
    ['echo "a # b" # c', 'echo "a # b"'],
    ["printf '#'", "printf '#'"],
    ['test $# -eq 0 # no arguments', 'test $# -eq 0'],
    ['echo ${#name} a#b # comment', 'echo ${#name} a#b'],
    [String.raw`echo '\' # comment`, String.raw`echo '\'`],
    [String.raw`x=1 \# y`, String.raw`x=1 \# y`],
] as const;
