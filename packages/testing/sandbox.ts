import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';

/**
 * Creates an isolated directory of test inputs and removes it at the end of its scope.
 * @param files relative paths and their contents
 * @param parent the parent directory for the isolated checkout
 * @returns the directory path and its asynchronous cleanup
 */
export async function createSandbox(
    files: Record<string, string | null>,
    parent = tmpdir(),
): Promise<{ path: string } & AsyncDisposable> {
    const path = await mkdtemp(join(await realpath(parent), 'gspot-'));
    try {
        for (const [name, content] of Object.entries(files)) {
            const target = join(path, name);
            await mkdir(content === null ? target : dirname(target), { recursive: true });
            if (content !== null) await writeFile(target, content);
        }
    } catch (error) {
        await rm(path, { recursive: true, force: true });
        throw error;
    }
    return {
        path,
        [Symbol.asyncDispose]: () => rm(path, { recursive: true, force: true }),
    };
}
