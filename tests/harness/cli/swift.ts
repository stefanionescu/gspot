// The engine input of a Swift check in a planted repository, with its build folders removed after each test.
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { buildFolder } from '#cli/platform/paths.ts';
import { openSession } from '#cli/execution/session.ts';
import { emitted } from '#tests/harness/cli/generated.ts';
import { sessionInput } from '#tests/harness/cli/input.ts';
import type { EngineInput } from '#cli/types/execution/execution.ts';

const folders = new Set<string>();

/**
 * Opens the planted repository and builds the engine input of one Swift check in its root scope.
 * @param root the planted repository
 * @param check the check name
 * @returns the engine input
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Every Swift build case registers its build folder for removal as it opens the input.
export async function swiftInput(root: string, check: string): Promise<EngineInput> {
    folders.add(buildFolder(root));
    return sessionInput(root, check);
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

/**
 * Writes the native SwiftLint configuration of every selected scope in a planted repository.
 * @param root the planted repository
 */
export async function writeSwiftlint(root: string): Promise<void> {
    const session = await openSession(root);
    for (const file of emitted(session).files.filter(({ path }) => path.endsWith('swiftlint.yml')))
        await Bun.write(join(root, file.path), file.content);
}
