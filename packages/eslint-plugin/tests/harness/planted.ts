// Plants a directory tree for the rules that read the file system,.
import { afterAll } from 'bun:test';
import { createSandbox } from '@gspot/testing';

/**
 * Plants the files under a fresh temporary root.
 * @param files path to content
 * @returns the root the files sit under
 */
export async function plantedRoot(files: Record<string, string>): Promise<string> {
    const sandbox = await createSandbox(files);
    afterAll(() => sandbox[Symbol.asyncDispose]());
    return sandbox.path;
}
