import { GITHUB_REFUSAL } from '#cli/constants/tools/packages.ts';
/**
 * The one line that names the cause of a failed package installation when the output shows it.
 * @param output what the package manager printed on both streams
 * @returns the note, or undefined when the output names no cause gspot knows
 */
export function acquisitionNote(output: string): string | undefined {
    if (!GITHUB_REFUSAL.test(output)) return undefined;
    return 'A tool fetches its binary from GitHub at install time and GitHub refused the anonymous request. Set GITHUB_TOKEN to a token that reads public releases and retry.';
}
