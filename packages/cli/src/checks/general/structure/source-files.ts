import { extensionsTagged } from '#cli/repository/tags.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { isToolProjectPath } from '#cli/repository/selectors.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { DEPENDENCY_FOLDERS } from '#cli/config/repository/inventory.ts';

/**
 * Read authored code for the four folder checks. Documentation and generated tool projects have their own layouts.
 * @param input the check's scope-owned inventory
 * @returns authored code files
 */
export function structureSources(input: CheckInput): TrackedFile[] {
    const documents = extensionsTagged('markdown');
    return input.files.filter(
        (file) =>
            file.kind === 'source' &&
            !isToolProjectPath(file.path) &&
            documents.every((extension) => !file.path.endsWith(extension)),
    );
}

/**
 * Identify dependency directories that native tools own.
 * @param directory the repository-relative directory
 * @returns whether a dependency folder contains the directory
 */
export function isDependencyFolder(directory: string): boolean {
    return directory.split('/').some((segment) => DEPENDENCY_FOLDERS.includes(segment));
}
