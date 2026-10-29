import { readSettings } from '#cli/settings/read.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import { selectScopeSettings } from '#tests/setup/cli/settings.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import type { NamingSettings } from '#cli/types/checks/general/naming.ts';
import { readNamingSettings } from '#cli/checks/general/naming/settings.ts';

/**
Read the naming settings that apply in one scope of this settings text.
*/
export function buildScopeNamingSettings(text: string, scopePath = ''): NamingSettings {
    using sandbox = createTemporaryFolder();
    const settings = readSettings(text, sandbox.path);
    const { scopeSettings, configurations, availableSettings } = selectScopeSettings(settings, scopePath);
    return readNamingSettings(settings, {
        settings: scopeSettings,
        availableSettings,
        configurations,
        path: scopePath,
        origin: scopePath === '' ? 'root' : SETTINGS_FILE,
    });
}
