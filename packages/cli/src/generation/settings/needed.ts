import type { Session } from '#cli/types/session.ts';
import type { ToolFile } from '#cli/types/configurations.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { listScopeChecks, listNeededTools } from '#cli/planning/needed-tools.ts';
import type { UsedNames, OwnedToolFile, ToolFileGeneration } from '#cli/types/generation/files.ts';

/**
 * Find the repository-relative path of the tool file for a scope.
 *
 * @param scope the folder, empty for the root.
 * @param toolFile the declaration from the manifest.
 * @param targets the generated paths by scope and file stem.
 * @returns the file of the scope, or the root file as a fallback.
 */
export function getToolFileTarget(scope: string, toolFile: ToolFile, targets: ToolFileGeneration['targets']): string {
    return toolFile.per_scope ? (targets.get(scope)?.get(toolFile.target) ?? toolFile.target) : toolFile.target;
}

// Constraints select declarations without treating an empty constraint as a requirement.
function isToolFileNeeded(session: Session, file: ToolFile, used: UsedNames): boolean {
    if (file.level === 'all' && session.settingsFile.settings.level !== 'all') return false;
    const constraints = [
        [file.tool, used.tools],
        [file.check, used.checks],
    ] as const;
    if (constraints.some(([names, available]) => names.length > 0 && !names.some((name) => available.has(name))))
        return false;
    return true;
}

// Each scope uses its own checks for scoped declarations and the repository programs for shared declarations.
function listScopeToolFiles(session: Session, scope: Scope, repositoryNames: UsedNames): OwnedToolFile[] {
    const checks = listScopeChecks(session, scope);
    const used = {
        tools: new Set(checks.flatMap((planned) => listNeededTools(planned))),
        checks: new Set(checks.map((planned) => planned.check.id)),
    };
    return scope.configurations.flatMap((configuration) =>
        configuration.toolFiles
            .filter((file) => isToolFileNeeded(session, file, file.per_scope ? used : repositoryNames))
            .map((toolFile) => ({
                toolFile,
                owner: { session, scope, configuration },
            })),
    );
}

/**
 * List the tool file declarations that this run writes, with the scope that owns each.
 *
 * @param session the repository to build for.
 * @returns each needed declaration and its owner.
 */
export function listOwnedToolFiles(session: Session): OwnedToolFile[] {
    const repositoryNames = {
        tools: new Set(
            session.neededToolConfigurations.flatMap((configuration) => configuration.tools.map((tool) => tool.name)),
        ),
        checks: new Set(session.configuredChecks.map((planned) => planned.check.id)),
    };
    return session.scopes.flatMap((scope) => listScopeToolFiles(session, scope, repositoryNames));
}
