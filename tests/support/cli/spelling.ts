import { join } from 'node:path';
import { createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { openSession } from '#cli/execution/session.ts';
import { readRepository } from '#cli/repository/tree.ts';
import { proposeText } from '#cli/commands/init/propose.ts';
import { collectCarried } from '#cli/policy/adoption/collect.ts';
import { existingTooling } from '#cli/repository/existing-tooling.ts';

/** Authors nested spelling inputs and renders their adopted configuration without retiring the originals. */
export async function prepareSpelling(root: string, existing: boolean) {
    const original =
        '[default]\nlocale = "en-gb"\n[default.extend-words]\n# An imported name requires its exact spelling.\nteh = "teh"\n[files]\nextend-exclude = ["src/**", "*.skip", "!keep.skip"]\n';
    await createFileTree(root, {
        'nested/typos.toml': original,
        'nested/sample.txt': 'colour teh\n',
        'nested/src/ignored.txt': 'recieve\n',
        'nested/ignored.skip': 'recieve\n',
        'nested/keep.skip': 'recieve\n',
        'sample.txt': 'colour teh\n',
    });
    const repository = await readRepository(root, [], [], []);
    const discovered = existingTooling(root, repository.files, []);
    const carried = await collectCarried(root, discovered, new Set(['spelling']), []);
    const policy = proposeText({
        configurations: ['spelling'],
        scopes: existing ? [{ path: 'nested', configurations: ['markdown'] }] : [],
        carried,
        hooks: 'none',
        ci: 'none',
        rules: false,
        runner: 'none',
    });
    await Bun.write(join(root, 'gspot.toml'), policy);
    const session = await openSession(root);
    const outputs = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    }).files;
    for (const config of outputs.filter(({ path }) => path.startsWith('.gspot/') && path.endsWith('typos.toml')))
        await Bun.write(join(root, config.path), config.content);
    return { original, carried, session, outputs };
}
