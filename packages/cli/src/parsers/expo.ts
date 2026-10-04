import { stripVTControlCharacters } from 'node:util';
import { FAILED_CHECK, PASSED_CHECKS } from '#cli/config/parsers/expo.ts';

// Whether a Doctor line ends the issues of a failed check: a blank, advice, another check, or the summary.
function isBlockEnd(line: string): boolean {
    if (line === '' || line.startsWith('Advice:')) return true;
    if (line.startsWith('✔ ') || line.startsWith('✖ ')) return true;
    return PASSED_CHECKS.test(line);
}

/**
 * Reads the report Expo Doctor prints.
 * @param stdout what Doctor printed
 * @returns one finding for each check Doctor reports as failed, with its issues
 */
export function parseExpoDoctor(stdout: string): string[] {
    const lines = stripVTControlCharacters(stdout)
        .split('\n')
        .map((line) => line.trim());
    return lines.flatMap((line, index): string[] => {
        const description = FAILED_CHECK.exec(line)?.groups?.['description'];
        if (description === undefined) return [];
        const rest = lines.slice(index + 1);
        const end = rest.findIndex((next) => isBlockEnd(next));
        const issues = end === -1 ? rest : rest.slice(0, end);
        return [[description, ...issues].join(' ')];
    });
}
