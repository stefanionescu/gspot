import { posix } from 'node:path';
import { intersects, validRange } from 'semver';
import type { Session } from '#cli/types/session.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { readLockedVersions } from '#cli/parsers/projects/lockfiles.ts';
import { readDependencySpecifiers } from '#cli/repository/dependencies.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects/dependencies.ts';
import { JAVASCRIPT_LOCKFILES } from '#cli/config/parsers/projects/lockfiles.ts';
import { REACT_PACKAGE, REACT_DOM_PACKAGE, REACT_VERSIONS_RULE } from '#cli/config/checks/framework/react-dom.ts';

function rangesCanMeet(react: string, reactDom: string): boolean {
    const first = validRange(react);
    const second = validRange(reactDom);
    return first === null || second === null || intersects(first, second);
}

/**
Reports a project whose react and react-dom resolve to different versions.

@param session the repository and its tools.
@param planned the scope to check.
*/
export function checkReactDomReactVersions(session: Session, planned: PlannedCheck): CheckFinding[] {
    const folder = planned.scope.path;
    const packageJsonPath = posix.join(folder, PACKAGE_JSON);
    const specifiers = readDependencySpecifiers(session.cache, packageJsonPath);
    if (specifiers === undefined) return [];
    if (![REACT_PACKAGE, REACT_DOM_PACKAGE].every((name) => specifiers.has(name))) return [];
    const locked = readLockedVersions(session.cache, folder, JAVASCRIPT_LOCKFILES);
    const versions = locked ?? specifiers;
    const react = versions.get(REACT_PACKAGE) ?? '';
    const reactDom = versions.get(REACT_DOM_PACKAGE) ?? '';
    const matches = locked === undefined ? rangesCanMeet(react, reactDom) : react === reactDom;
    if (matches) return [];
    return [
        {
            file: packageJsonPath,
            line: 1,
            rule: REACT_VERSIONS_RULE,
            message: `react ${react} and react-dom ${reactDom} differ, and React stops at run time when they do. Install the same version of both.`,
        },
    ];
}
