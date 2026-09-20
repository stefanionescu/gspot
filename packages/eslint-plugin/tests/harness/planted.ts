// Plants a directory tree for the rules that read the file system, and clears directory observations.
import { afterAll } from 'bun:test';
import { createSandbox } from '@gspot/testing';
import { resetDirectoryCache } from '#plugin/files.ts';

/**
 * Plants the files under a fresh temporary root and clears the directory cache.
 * @param files path to content
 * @returns the root the files sit under
 */
export async function plantedRoot(files: Record<string, string>): Promise<string> {
    const sandbox = await createSandbox(files);
    afterAll(() => sandbox[Symbol.asyncDispose]());
    resetDirectoryCache();
    return sandbox.path;
}
