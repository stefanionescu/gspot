// The ESLint instance a planted repository's generated configuration produces, for tests of the emitted rules.
import { ESLint } from 'eslint';
import { join, dirname } from 'node:path';
import { emitAll } from '#cli/generation/outputs.ts';
import { openSession } from '#cli/execution/session.ts';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { INSTALLED_MODULES } from '#tests/support/cli/modules.ts';

/**
 * Links the installed packages into the sandbox, writes its generated ESLint configuration, and loads it.
 * @param root the planted repository with its gspot.toml
 * @returns ESLint reading the generated configuration
 */
export async function generatedEslint(root: string): Promise<ESLint> {
    symlinkSync(INSTALLED_MODULES, join(root, 'node_modules'), 'dir');
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
