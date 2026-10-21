// Decide which tool file declarations each scope needs, before gspot builds any text.
import type { Session } from '#cli/types/planning.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import type { ToolFileDeclaration } from '#cli/types/configurations.ts';
import { listScopeChecks, listRequiredTools } from '#cli/planning/needed-tools.ts';
import type { NeededToolFiles, ToolFileSelection } from '#cli/types/generation/files.ts';

// Constraints select declarations without treating an empty constraint as a requirement.
function isToolFileNeeded(session: Session, file: ToolFileDeclaration, needed: NeededToolFiles): boolean {
    if (file.level === 'all' && session.settingsFile.settings.level !== 'all') return false;
    const constraints = [
        [file.tool, needed.tools],
        [file.check, needed.checks],
    ] as const;
    if (constraints.some(([names, available]) => names.length > 0 && !names.some((name) => available.has(name))))
        return false;
    return true;
}

// Each scope uses its own checks for scoped declarations and the repository programs for shared declarations.
function listScopeDeclarations(
    session: Session,
    selection: ScopeSelection,
    repository: NeededToolFiles,
): ToolFileSelection[] {
    const checks = listScopeChecks(session, selection);
    const needed = {
        tools: new Set(checks.flatMap((planned) => listRequiredTools(planned))),
        checks: new Set(checks.map((planned) => planned.check.name)),
    };
    return selection.selected.flatMap((manifest) =>
        manifest.toolFiles
            .filter((file) => isToolFileNeeded(session, file, file.per_scope ? needed : repository))
            .map((toolFile) => ({
                toolFile,
                owner: {
                    session,
                    selection,
                    manifest,
                },
            })),
    );
}

/**
 * List the tool file declarations that this run writes, with the scope that owns each.
 *
 * @param session the repository to build for.
 * @returns each needed declaration and its owner.
 */
function listToolFileDeclarations(session: Session): ToolFileSelection[] {
    const repository = {
        tools: new Set(session.neededToolManifests.flatMap((manifest) => manifest.tools.map((tool) => tool.name))),
        checks: new Set(session.configuredChecks.map((planned) => planned.check.name)),
    };
    return session.scopes.flatMap((selection) => listScopeDeclarations(session, selection, repository));
}

export { listToolFileDeclarations };
