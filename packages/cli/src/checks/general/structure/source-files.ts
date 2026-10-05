import { extensionsTagged } from '#cli/repository/tags.ts';
import { isPrivateToolPath } from '#cli/repository/selectors.ts';
import type { EngineInput } from '#cli/types/execution/runtime.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { DEPENDENCY_FOLDERS } from '#cli/config/repository/inventory.ts';

/**
 * Read authored code for the four folder checks. Documentation and generated tool projects have their own layouts.
 * @param input the check's scope-owned inventory
 * @returns authored code files
 */
export function structureSources(input: EngineInput): TrackedFile[] {
    const documents = extensionsTagged('markdown');
    return input.files.filter(
        (file) =>
            file.kind === 'source' &&
            !isPrivateToolPath(file.path) &&
            documents.every((extension) => !file.path.endsWith(extension)),
    );
}

/**
 * Test shared folder exclusions and both forms of an authored allowance.
 * @param directory the repository-relative directory
 * @param isAllowed the authored allowance matcher
 * @returns whether folder checks exempt the directory
 */
export function isAllowedFolder(directory: string, isAllowed: (path: string) => boolean): boolean {
    return (
        directory.split('/').some((segment) => DEPENDENCY_FOLDERS.includes(segment)) ||
        isAllowed(directory) ||
        isAllowed(`${directory}/`)
    );
}
