import { statSync } from 'node:fs';
import { stringify } from 'smol-toml';
import { join, posix } from 'node:path';
import type { Session } from '#cli/types/planning.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import type { EtaInputs } from '#cli/types/generation/eta.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import type { ScopeSelection } from '#cli/types/policy/settings.ts';
import { PYTHON_TOOL_PROJECT } from '#cli/config/parsers/packages.ts';
import { generatedIgnores } from '#cli/generation/ignore-patterns.ts';
import { pythonPins, pythonConstraints } from '#cli/configurations/pins.ts';
import { TOOL_PYTHON_PROJECT, CONFIGURATION_DIRECTORY } from '#cli/config/platform/locations.ts';

/**
 * Keep Python lint dependencies in a tool project owned by gspot.
 * @param manifests the selected manifests
 * @returns the Python tool project files, or none without Python tools
 */
export function pythonProject(manifests: Manifest[]): GeneratedFile[] {
    const dependencies = pythonPins(manifests);
    if (dependencies.length === 0) return [];
    const constraints = pythonConstraints(manifests);
    return [
        {
            path: TOOL_PYTHON_PROJECT,
            content: stringify({
                project: { ...PYTHON_TOOL_PROJECT, dependencies },
                tool: {
                    uv: {
                        package: false,
                        ...(constraints.length === 0 ? {} : { 'constraint-dependencies': constraints }),
                    },
                },
            }),
            kind: 'tool_file',
        },
    ];
}

/**
 * Resolve native Python configuration paths for both type and lint tools.
 * @param session the repository and policy
 * @param selection the scope being emitted
 * @returns the scope's environment and configuration-relative exclusions
 */
export function pythonInputs(
    session: Session,
    selection: ScopeSelection,
): Pick<EtaInputs, 'pythonVenv' | 'pythonScopePath' | 'pythonExcludes' | 'ruffRules'> {
    const root = session.installedRoot ?? session.root;
    const { policy } = session.policyFiles;
    const base = posix.relative(posix.join(CONFIGURATION_DIRECTORY, selection.scope.path), '.');
    const exclusions = generatedIgnores(
        policy.declarations.flatMap(({ paths }) => paths),
        policy.exclude,
    );
    return {
        ruffRules: selection.selected.flatMap((manifest) => [
            ...manifest.ruff_rules.recommended,
            ...(policy.level === 'all' ? manifest.ruff_rules.all : []),
        ]),
        pythonScopePath: posix.join(base, selection.scope.path),
        pythonVenv:
            statSync(join(root, selection.scope.path, '.venv'), { throwIfNoEntry: false })?.isDirectory() === true
                ? '.venv'
                : undefined,
        pythonExcludes: (check: string) =>
            [
                ...exclusions,
                ...selection.view
                    .ignoresFor(check)
                    .filter((entry) => entry.rule === undefined)
                    .flatMap((entry) => entry.paths),
            ].map((path) => `${base}/${path}`),
    };
}
