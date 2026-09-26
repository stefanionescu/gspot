// The files a planted repository's policy generates, for tests of what its selected configurations put in them.
import { createFileTree, testdir } from 'testdirs';
import { emitAll } from '#cli/generation/render.ts';
import { openSession } from '#cli/execution/session.ts';

/**
 * Plants a repository with the policy and files, and returns the content of one generated file.
 * @param policy the gspot.toml text
 * @param path the generated path to read
 * @param files further files the repository holds
 * @returns the generated content
 */
export async function generatedFile(policy: string, path: string, files: Record<string, string> = {}): Promise<string> {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, ...files });
    const session = await openSession(sandbox.path);
    const output = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageManager: session.packageManager,
    });
    const file = output.files.find((entry) => entry.path === path);
    if (file === undefined) throw new Error(`The planted repository generates no ${path}.`);
    return file.content;
}
