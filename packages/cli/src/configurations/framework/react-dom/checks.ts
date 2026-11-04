import { posix } from 'node:path';
import { intersects, validRange } from 'semver';
import type { Session } from '#cli/types/tools.ts';
import { PACKAGE_JSON } from '#cli/config/parsers.ts';
import type { CheckCode } from '#cli/types/engine/run.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { readPackageJson } from '#cli/repository/dependencies.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { listSpecifiers, readLockedVersions } from '#cli/parsers/projects/lockfiles.ts';
import { REACT_PACKAGE, REACT_DOM_PACKAGE, REACT_VERSIONS_RULE } from '#cli/config/configurations/framework.ts';

function canRangesMeet(react: string, reactDom: string): boolean {
    const first = validRange(react);
    const second = validRange(reactDom);
    return first === null || second === null || intersects(first, second);
}

/**
Reports a project whose react and react-dom resolve to different versions.

@param session the repository and its tools.
@param planned the scope to check.
*/
function checkReactVersions(session: Session, planned: PlannedCheck): CheckFinding[] {
    const folder = planned.scope.path;
    const packageJsonPath = posix.join(folder, PACKAGE_JSON);
    const specifiers = listSpecifiers(readPackageJson(session.cache, packageJsonPath));
    if ([REACT_PACKAGE, REACT_DOM_PACKAGE].some((name) => !specifiers.has(name))) return [];
    const locked = readLockedVersions(session.cache, folder);
    const versions = locked ?? specifiers;
    const react = versions.get(REACT_PACKAGE) ?? '';
    const reactDom = versions.get(REACT_DOM_PACKAGE) ?? '';
    const isCompatible = locked === undefined ? canRangesMeet(react, reactDom) : react === reactDom;
    if (isCompatible) return [];
    return [
        {
            file: packageJsonPath,
            line: 1,
            rule: REACT_VERSIONS_RULE,
            message: `react ${react} and react-dom ${reactDom} differ, and React stops at run time when they do. Install the same version of both.`,
        },
    ];
}

export const REACT_DOM_CHECKS: Readonly<Record<string, CheckCode>> = {
    'react-dom/react-versions': { check: checkReactVersions },
};
