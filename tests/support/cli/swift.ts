// The engine input of a Swift check in a planted repository, with its build folders removed after each test.
import { rmSync } from 'node:fs';
import { buildFolder } from '#cli/platform/paths.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';

const folders = new Set<string>();

/**
 * Opens the planted repository and builds the engine input of one Swift check in its root scope.
 * @param root the planted repository
 * @param check the check name
 * @returns the engine input
 */
export async function swiftInput(root: string, check: string): Promise<EngineInput> {
    folders.add(buildFolder(root));
    const session = await openSession(root);
    const selection = session.scopes[0]!;
    const spec = selection.selected.flatMap((manifest) => manifest.checks).find((entry) => entry.name === check)!;
    return engineInput(session, {
        scope: session.scopes.find((entry) => entry.scope.path === '')!,
        spec: spec,
        files: session.repository.files,
    });
}

/**
 * Removes every build folder a Swift input of this test file created.
 * @param root a planted repository whose folder is removed even when no input was built
 */
export function removeBuildFolders(root?: string): void {
    if (root !== undefined) folders.add(buildFolder(root));
    for (const folder of folders) rmSync(folder, { recursive: true, force: true });
    folders.clear();
}
