// Builds the naming settings, file naming, and identifiers of the naming tests.
import { parseSettings } from '#cli/settings/read.ts';
import { SETTINGS_FILE } from '#cli/config/gspot-paths.ts';
import { buildKnownSettings } from '#cli/settings/known.ts';
import { selectForScope } from '#cli/settings/scope-settings.ts';
import { readNamingSettings } from '#cli/checks/naming/settings.ts';
import { getShippedCheck } from '#tests/setup/cli/configurations.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { buildRootScopeSettings } from '#tests/setup/cli/settings.ts';
import type { FileNaming, Identifier, NamingSettings } from '#cli/types/checks/naming.ts';

/** Read the naming settings that apply in one scope of this settings text. */
export function buildScopeNamingSettings(text: string, scope = ''): NamingSettings {
    const settings = parseSettings(text, undefined);
    const configurations = selectForScope(settings, scope, readConfigurations());
    const knownSettings = buildKnownSettings(configurations, 'recommended');
    const scopeSettings = buildRootScopeSettings(settings, scope);
    return readNamingSettings(settings, {
        settings: scopeSettings,
        knownSettings,
        configurations,
        folder: {
            path: scope,
            configurations: scopeSettings.configurations,
            origin: scope === '' ? 'root' : SETTINGS_FILE,
        },
    });
}

/** Build the settings and check declaration for one naming test. */
export function buildFileNaming(settings: NamingSettings): FileNaming {
    return { check: getShippedCheck('naming/identifiers'), settings, isTestFile: false };
}

/** An identifier with the source location and category defaults used by naming tests. */
export function buildIdentifier(fields: Pick<Identifier, 'name'> & Partial<Identifier>): Identifier {
    const { file = 'src/a.ts', language = 'typescript', category = 'functions', line = 1, column = 1 } = fields;
    return { file, language, category, line, column, label: `${language} ${category}`, ...fields };
}
