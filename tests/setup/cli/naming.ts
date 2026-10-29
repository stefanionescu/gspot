import { testdir } from 'testdirs';
import { openSession } from '#cli/planning/session.ts';
import type { NamingSettings } from '#cli/types/checks/general/naming.ts';
import { readNamingSettings } from '#cli/checks/general/naming/settings.ts';

/**
Read the naming settings that apply in one scope of this settings text.
*/
export async function buildScopeNamingSettings(text: string, scopePath = ''): Promise<NamingSettings> {
    await using sandbox = await testdir({
        'gspot.toml': text,
        ...(scopePath !== '' && { [`${scopePath}/.keep`]: '' }),
    });
    const session = await openSession(sandbox.path);
    const scope = session.scopes.find(({ path }) => path === scopePath);
    if (scope === undefined) throw new Error(`The settings declare no scope at ${scopePath}.`);
    return readNamingSettings(session.settings, scope);
}
