// Discovers the start command and settings used by generated hooks.
import { openSession } from '#cli/commands/session.ts';
import type { HookContext } from '#cli/types/install.ts';

// The settings, repository and start command that installation and doctor read.

export async function hookContext(root: string): Promise<HookContext> {
    const session = await openSession(root);
    return { settings: session.settingsFile.settings, repository: session.repository, runner: session.startRunner };
}
