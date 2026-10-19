import { posix } from 'node:path';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Finding, CheckInput } from '#cli/types/runs/check.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependency-files.ts';
import { JAVASCRIPT_LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import { readDeclaredSpecifiers } from '#cli/checks/dependencies/package-json.ts';
import { REACT_PACKAGE, REACT_DOM_PACKAGE } from '#cli/config/checks/dependencies.ts';
import { splitIdentity, readLockedPackages } from '#cli/parsers/lockfile-packages.ts';

function listVersions(locked: Set<string> | undefined, declared: Map<string, string>, name: string): string[] {
    if (locked === undefined) return [declared.get(name) ?? ''].filter(Boolean);
    return [...locked].flatMap((identity) => {
        const [lockedName, version] = splitIdentity(identity) ?? [];
        return lockedName === name && version !== undefined ? [version] : [];
    });
}

/**
 * Reports a project whose react and react-dom resolve to different versions.
 * @param input the scope and the run cache.
 * @returns a finding when the versions differ.
 */
export function checkReactVersions(input: CheckInput): Finding[] {
    const folder = input.selection.scope.path;
    const manifest = posix.join(folder, PACKAGE_JSON);
    const declared = readDeclaredSpecifiers(input, manifest);
    if (declared === undefined || !declared.has(REACT_PACKAGE) || !declared.has(REACT_DOM_PACKAGE)) return [];
    const locked = readLockedPackages(input.reads, folder, JAVASCRIPT_LOCKFILES);
    const react = [...new Set(listVersions(locked, declared, REACT_PACKAGE))].toSorted((left, right) =>
        left.localeCompare(right),
    );
    const reactDom = [...new Set(listVersions(locked, declared, REACT_DOM_PACKAGE))].toSorted((left, right) =>
        left.localeCompare(right),
    );
    if (react.join(' ') === reactDom.join(' ')) return [];
    return [
        buildFinding(
            input,
            { file: manifest, line: 1 },
            'react-versions',
            `react ${react.join(', ')} and react-dom ${reactDom.join(', ')} differ, and React stops at run time when they do. Install the same version of both.`,
        ),
    ];
}
