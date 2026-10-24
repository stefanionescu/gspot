import { parseSettings } from '#cli/settings/read.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { getShippedCheck } from '#tests/setup/cli/configurations.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { readNamingSettings } from '#cli/checks/general/naming/settings.ts';
import { selectForScope, buildScopeSettings } from '#cli/settings/scopes.ts';
import type { FileNaming, Identifier, NamingSettings } from '#cli/types/checks/general/naming.ts';

/**
Read the naming settings that apply in one scope of this settings text.
*/
export function buildScopeNamingSettings(text: string, scope = ''): NamingSettings {
    using sandbox = createTemporaryFolder();
    const settings = parseSettings(text, sandbox.path);
    const configurations = selectForScope(settings, scope, readConfigurations());
    const availableSettings = buildAvailableSettings(configurations, 'recommended');
    const scopeSettings = buildScopeSettings(availableSettings, settings, configurations, scope);
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

/**
Build the settings and check declaration for one naming test.
*/

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 4 calls in 1 file share it.
export function buildFileNaming(settings: NamingSettings): FileNaming {
    return { check: getShippedCheck('naming/identifiers'), settings, isTestFile: false };
}

/**
An identifier with the source location and category defaults used by naming tests.
*/

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 28 calls in 1 file share it.
export function buildIdentifier(fields: Pick<Identifier, 'name'> & Partial<Identifier>): Identifier {
    const { file = 'src/a.ts', language = 'typescript', category = 'functions', line = 1, column = 1 } = fields;
    return { file, language, category, line, column, label: `${language} ${category}`, ...fields };
}
