import { basename, dirname } from 'node:path';

import { parseToolOutput } from '#cli/parsers/formats/json.ts';
import { findLockedPackageLine, normalizePythonName } from '#cli/parsers/projects/lockfiles.ts';
import { osvScannerReportSchema } from '#cli/schemas/engine.ts';
import { findText } from '#cli/system/files/reads.ts';
import type { Finding } from '#cli/types/engine/run.ts';
import type { OsvPackage, ToolOutput } from '#cli/types/engine/tool-runs.ts';

/**
List the advisory IDs of each vulnerability of a package. OSV-Scanner groups the IDs that name one vulnerability, such
as a PYSEC ID and its GHSA alias. An advisory outside every group is its own vulnerability.
*/
function listAdvisoryGroups({ groups, vulnerabilities }: OsvPackage): Array<[string, ...string[]]> {
    const grouped = new Set(groups.flatMap(({ ids }) => ids));
    return [
        ...groups.map(({ ids }) => ids),
        ...vulnerabilities.filter(({ id }) => !grouped.has(id)).map(({ id }): [string] => [id]),
    ];
}

function formatVulnerability(reported: OsvPackage, [rule, ...aliases]: [string, ...string[]]): string {
    const { name, version } = reported.package;
    const ids = new Set([rule, ...aliases]);
    const advisories = reported.vulnerabilities.filter(({ id }) => ids.has(id));
    const summary = advisories.find((advisory) => advisory.summary !== undefined)?.summary ?? `Advisory ${rule}`;
    const fixed = new Set(
        advisories
            .flatMap(({ affected }) => affected)
            .filter((affected) => normalizePythonName(affected.package?.name ?? '') === normalizePythonName(name))
            .flatMap(({ ranges }) => ranges.flatMap(({ events }) => events.flatMap((event) => event.fixed ?? []))),
    );
    return [
        `${name}@${version}: ${summary.replace(/\.$/u, '')}.`,
        ...(aliases.length > 0 ? [`Also listed as ${aliases.join(', ')}.`] : []),
        fixed.size === 0 ? 'The advisory names no fixed version.' : `Fixed in ${[...fixed].join(', ')}.`,
    ].join(' ');
}

/**
Read the JSON report of OSV-Scanner. One vulnerability is one finding, whose rule is the first advisory ID of its
group, on the line of the package in its lockfile.
*/
export function parseOsvScannerFindings(output: ToolOutput): Finding[] {
    const { check, stdout } = output;
    const { results } = parseToolOutput('OSV-Scanner', stdout, osvScannerReportSchema);
    return results.flatMap(({ source, packages }) => {
        const text = findText(dirname(source.path), basename(source.path)) ?? '';
        return packages.flatMap((reported) =>
            listAdvisoryGroups(reported).map((ids) => ({
                check,
                file: source.path,
                line: findLockedPackageLine(text, reported.package.name, reported.package.version),
                rule: ids[0],
                message: formatVulnerability(reported, ids),
                fixable: false,
            })),
        );
    });
}
