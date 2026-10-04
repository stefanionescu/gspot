import { isPrivateToolPath } from '#cli/repository/selectors.ts';
import type { EngineInput } from '#cli/types/execution/runtime.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { DOCUMENT_EXTENSIONS } from '#cli/config/checks/general/structure.ts';

/**
 * Read authored code for the four folder checks. Documentation and generated tool projects have their own layouts.
 * @param input the check's scope-owned inventory
 * @returns authored code files
 */
export function structureSources(input: EngineInput): TrackedFile[] {
    return input.files.filter(
        (file) =>
            file.kind === 'source' &&
            !isPrivateToolPath(file.path) &&
            DOCUMENT_EXTENSIONS.every((extension) => !file.path.endsWith(extension)),
    );
}
