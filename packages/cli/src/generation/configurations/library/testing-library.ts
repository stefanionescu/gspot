import { type EslintScope, type ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { CONFIGURATION_PLUGINS } from '#cli/config/generation/configurations/language/javascript/eslint/eslint.ts';

import {
    TESTING_LIBRARY_SCOPE,
    TESTING_LIBRARY_PRESETS,
    TESTING_LIBRARY_DEFAULT_PRESET,
} from '#cli/config/generation/configurations/library.ts';

/**
Apply the Testing Library presets of the frameworks in use.

@param scope the planned ESLint file of the scope.
*/
export function buildTestingLibraryBlocks(
    scope: Pick<EslintScope, 'eslintFiles' | 'dependencies'>,
): ConfigurationBlocks {
    const { eslintFiles, dependencies: scopeDependencies } = scope;
    const dependencies = scopeDependencies.filter((name) => name.startsWith(TESTING_LIBRARY_SCOPE));
    const presetNames = dependencies
        .map((name) => name.slice(TESTING_LIBRARY_SCOPE.length))
        .filter((name) => TESTING_LIBRARY_PRESETS.includes(name));
    const selected =
        dependencies.length === 0
            ? []
            : [...new Set(presetNames.length === 0 ? [TESTING_LIBRARY_DEFAULT_PRESET] : presetNames)];
    const blocks: ConfigurationBlocks['blocks'] = selected.map((name) => ({
        fields: { files: eslintFiles.tests },
        presets: [{ importName: 'testingLibrary', path: `configs.flat/${name}`, merge: 'rules' }],
        calls: [{ name: 'addPlugins', args: [{ imports: { 'testing-library': 'testingLibrary' } }] }],
    }));
    return {
        imports: CONFIGURATION_PLUGINS['testing-library'],
        blocks,
    };
}
