import { posix } from 'node:path';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { readLockedVersions } from '#cli/parsers/projects/lockfiles.ts';
import { readDependencySpecifiers } from '#cli/repository/dependencies.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects/dependencies.ts';
import { JAVASCRIPT_LOCKFILES } from '#cli/config/parsers/projects/lockfiles.ts';
import { REACT_PACKAGE, REACT_DOM_PACKAGE } from '#cli/config/checks/framework/react-dom.ts';

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
    const versions = readLockedVersions(session.reads, folder, JAVASCRIPT_LOCKFILES) ?? specifiers;
    const react = versions.get(REACT_PACKAGE) ?? '';
    const reactDom = versions.get(REACT_DOM_PACKAGE) ?? '';
    if (react === reactDom) return [];
    return [
        buildFinding(
            planned,
            { file: packageJsonPath, line: 1 },
            'react-versions',
            `react ${react} and react-dom ${reactDom} differ, and React stops at run time when they do. Install the same version of both.`,
        ),
    ];
}
