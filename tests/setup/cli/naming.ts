import { parseSettings } from '#cli/settings/read.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import { selectScopeSettings } from '#tests/setup/cli/settings.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import type { NamingSettings } from '#cli/types/checks/general/naming.ts';
import { readNamingSettings } from '#cli/checks/general/naming/settings.ts';

/**
Read the naming settings that apply in one scope of this settings text.
*/
export function buildScopeNamingSettings(text: string, scope = ''): NamingSettings {
    using sandbox = createTemporaryFolder();
    const settings = parseSettings(text, sandbox.path);
    const { scopeSettings, configurations, availableSettings } = selectScopeSettings(settings, scope);
    return readNamingSettings(settings, {
        settings: scopeSettings,
        availableSettings,
        configurations,
        folder: {
            path: scope,
            configurations: scopeSettings.configurations,
            origin: scope === '' ? 'root' : SETTINGS_FILE,
        },
    });
}
