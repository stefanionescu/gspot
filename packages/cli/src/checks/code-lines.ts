/**
Count nonempty lines that do not start with the comment marker.

@param lines the source lines.
@param marker the comment prefix.
@returns the number of code lines.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
export function countCodeLines(lines: readonly string[], marker: string): number {
    return lines.filter((line) => line.trim() !== '' && !line.trimStart().startsWith(marker)).length;
}
