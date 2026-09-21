// Plants a directory tree for the rules that read the file system,.
import { afterAll } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

/**
 * Plants the files under a fresh temporary root.
 * @param files path to content
 * @returns the root the files sit under
 */
export async function plantedRoot(files: Record<string, string>): Promise<string> {
    const sandbox = await testdir();
    afterAll(() => sandbox[Symbol.asyncDispose]());
    await createFileTree(sandbox.path, files);
    return sandbox.path;
}
