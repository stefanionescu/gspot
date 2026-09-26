import type { CoverageReport } from '#cli/execution/coverage.ts';

/**
 * Shared source-ending coverage rows for doctor and the configuration listing.
 * @param report the coverage report
 * @returns one line per file ending, or none when nothing is unchecked
 */
export function coverageLines(report: CoverageReport): string[] {
    if (report.endings.length === 0) return [];
    return [
        'source check coverage',
        ...report.endings.map((entry) => {
            const ending = entry.ending === '' ? '(no extension)' : entry.ending;
            const scope = entry.scope === '' ? 'root' : entry.scope;
            const kinds =
                entry.kinds.length === 0 ? 'no format, syntax, style, or types check' : entry.kinds.join(', ');
            return `  ${ending}  [scope ${scope}]  ${String(entry.files)} file${entry.files === 1 ? '' : 's'}  ${kinds}`;
        }),
        '',
    ];
}
