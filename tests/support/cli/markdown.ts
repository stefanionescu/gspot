import { join } from 'node:path';
import { emitAll } from '#cli/generation/outputs.ts';
import { openSession } from '#cli/execution/session.ts';
import { proposeText } from '#cli/commands/init/propose.ts';
import type { AdoptionResult } from '#cli/types/policy/adoption.ts';

/** Writes the adopted Markdown policy and its standalone native configuration. */
export async function writeAdoptedMarkdown(root: string, adoption: AdoptionResult): Promise<void> {
    await Bun.write(
        join(root, 'gspot.toml'),
        proposeText({
            kits: ['markdown'],
            scopes: [],
            kept: adoption,
            hooks: 'none',
            ci: 'none',
            rules: false,
            runner: 'none',
        }),
    );
    const session = await openSession(root);
    const generated = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    }).files.find(({ path }) => path === '.gspot/config/markdownlint.jsonc')!;
    await Bun.write(join(root, 'generated.jsonc'), generated.content);
}
