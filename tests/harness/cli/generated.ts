// What a planted repository's policy generates: the files its selected kits write, and the ESLint instance its
// configuration produces.
import { ESLint } from 'eslint';
import { join, dirname } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { openSession } from '#cli/execution/session.ts';
import type { Session } from '#cli/types/tools/tools.ts';
import type { Generated } from '#cli/types/generation/generation.ts';
import { linkInstalledModules } from '#tests/harness/cli/platforms.ts';

/**
 * Links the installed packages into the sandbox, writes its generated ESLint configuration, and loads it.
 * @param root the planted repository with its gspot.toml
 * @returns ESLint reading the generated configuration
 */
export async function generatedEslint(root: string): Promise<ESLint> {
    linkInstalledModules(join(root, 'node_modules'));
    const session = await openSession(root);
    const config = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    }).files.find((file) => file.path === '.gspot/config/eslint.config.mjs');
    if (config === undefined) throw new Error('The planted repository generates no ESLint configuration.');
    mkdirSync(join(root, dirname(config.path)), { recursive: true });
    writeFileSync(join(root, config.path), config.content);
    return new ESLint({ cwd: root, overrideConfigFile: join(root, config.path) });
}

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
        packageClient: session.packageClient,
    });
    const file = output.files.find((entry) => entry.path === path);
    if (file === undefined) throw new Error(`The planted repository generates no ${path}.`);
    return file.content;
}

/**
 * Everything the policy of a session generates, rendered the way apply renders it.
 * @param session the open session
 * @returns the generated files
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Generation tests render a session the one way apply does.
export function emitted(session: Session): Generated {
    return emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    });
}

/**
 * Writes the generated configuration files of a session into its repository, the way apply writes them.
 * @param session the open session
 * @param root the repository root
 */
export async function writeConfigs(session: Session, root: string): Promise<void> {
    for (const file of emitted(session).files.filter((entry) => entry.kind === 'config'))
        await Bun.write(join(root, file.path), file.content);
}
