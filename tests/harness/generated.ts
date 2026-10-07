// What a test repository's policy generates: the files its selected configurations write, and the ESLint instance its
// configuration produces.
import { ESLint } from 'eslint';
import { join } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { openSession } from '#cli/commands/session.ts';
import { writeOutputs } from '#cli/lifecycle/apply.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { linkInstalledModules } from '#tests/harness/platforms.ts';

/**
 * Links installed test packages, writes outputs through the managed lifecycle, and loads the ESLint configuration.
 * @param root the test repository with its gspot.toml
 * @returns ESLint reading the generated configuration
 */
export async function createEslint(root: string): Promise<ESLint> {
    linkInstalledModules(join(root, 'node_modules'));
    const session = await openSession(root);
    using log = openOwnership(root);
    writeOutputs(session, log);
    return new ESLint({ cwd: root, overrideConfigFile: join(root, '.gspot/config/eslint.config.mjs') });
}

/**
 * Creates a repository with the policy and files, and returns the content of one generated file.
 * @param policy the gspot.toml text
 * @param path the generated path to read
 * @param files further files the repository holds
 * @returns the generated content
 */
export async function emitFile(policy: string, path: string, files: Record<string, string> = {}): Promise<string> {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { ...files, 'gspot.toml': policy });
    const session = await openSession(sandbox.path);
    const output = emitAll(session);
    const file = output.files.find((entry) => entry.path === path);
    if (file === undefined) throw new Error(`The test repository generates no ${path}.`);
    return file.content;
}
