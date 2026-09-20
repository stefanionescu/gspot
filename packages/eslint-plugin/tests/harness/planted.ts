// Plants a directory tree for the rules that read the file system, and drops the caches they keep.
import { afterAll } from 'bun:test';
import { createSandbox } from '@gspot/testing';
import { resetDirectoryCache } from '#plugin/files.ts';
import { resetExportCache } from '#plugin/rules/no-duplicate-barrel-exports.ts';

/**
 * Plants the files under a fresh temporary root and clears every directory and export cache.
 * @param files path to content
 * @returns the root the files sit under
 */
export async function plantedRoot(files: Record<string, string>): Promise<string> {
    const sandbox = await createSandbox(files);
    afterAll(() => sandbox[Symbol.asyncDispose]());
    resetDirectoryCache();
    resetExportCache();
    return sandbox.path;
}
