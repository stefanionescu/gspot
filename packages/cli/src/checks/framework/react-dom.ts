import { posix } from 'node:path';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { readDependencySpecifiers } from '#cli/repository/dependencies.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects/dependencies.ts';
import { JAVASCRIPT_LOCKFILES } from '#cli/config/parsers/projects/lockfiles.ts';
import { splitIdentity, readLockedPackages } from '#cli/parsers/projects/lockfiles.ts';
import { REACT_PACKAGE, REACT_DOM_PACKAGE } from '#cli/config/checks/framework/react-dom.ts';

function listVersions(locked: Set<string> | undefined, specifiers: Map<string, string>, name: string): string[] {
    const versions =
        locked === undefined
            ? [specifiers.get(name) ?? ''].filter(Boolean)
            : [...locked].flatMap((identity) => {
                  const [lockedName, version] = splitIdentity(identity) ?? [];
                  return lockedName === name && version !== undefined ? [version] : [];
              });
    return [...new Set(versions)].toSorted((left, right) => left.localeCompare(right));
}

/**
 * Reports a project whose react and react-dom resolve to different versions.
 *
 * @param session the repository and its tools.
 * @param planned the scope and the run cache.
 * @returns a finding when the versions differ.
 */
export function checkReactVersions(session: Session, planned: PlannedCheck): Finding[] {
    const folder = planned.scope.folder.path;
    const packageJsonPath = posix.join(folder, PACKAGE_JSON);
    const specifiers = readDependencySpecifiers(session.reads, packageJsonPath);
    if (specifiers === undefined || !specifiers.has(REACT_PACKAGE) || !specifiers.has(REACT_DOM_PACKAGE)) return [];
    const locked = readLockedPackages(session.reads, folder, JAVASCRIPT_LOCKFILES);
    const react = listVersions(locked, specifiers, REACT_PACKAGE);
    const reactDom = listVersions(locked, specifiers, REACT_DOM_PACKAGE);
    if (react.join(' ') === reactDom.join(' ')) return [];
    return [
        buildFinding(
            planned,
            { file: packageJsonPath, line: 1 },
            'react-versions',
            `react ${react.join(', ')} and react-dom ${reactDom.join(', ')} differ, and React stops at run time when they do. Install the same version of both.`,
        ),
    ];
}
