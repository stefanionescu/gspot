import {
    TESTING_LIBRARY_DEFAULT_PRESET,
    TESTING_LIBRARY_PRESETS,
    TESTING_LIBRARY_SCOPE,
    TESTING_LIBRARY_SETTINGS,
} from '#cli/config/configurations/framework.ts';
import {
    type ConfigurationBlocks,
    type EslintBlockBuilder,
    type EslintScope,
} from '#cli/types/configurations/javascript.ts';

function buildTestingLibraryBlocks(scope: Pick<EslintScope, 'eslintFiles' | 'dependencies'>): ConfigurationBlocks {
    const { eslintFiles, dependencies: scopeDependencies } = scope;
    const dependencies = scopeDependencies.filter((name) => name.startsWith(TESTING_LIBRARY_SCOPE));
    const presetNames = dependencies
        .map((name) => name.slice(TESTING_LIBRARY_SCOPE.length))
        .filter((name) => TESTING_LIBRARY_PRESETS.includes(name));
    const selected =
        dependencies.length === 0
            ? []
            : [...new Set(presetNames.length === 0 ? [TESTING_LIBRARY_DEFAULT_PRESET] : presetNames)];
    return selected.map((name) => ({
        fields: { files: eslintFiles.tests, settings: TESTING_LIBRARY_SETTINGS },
        presets: [{ package: 'eslint-plugin-testing-library', path: `configs.flat/${name}`, merge: 'rules' }],
        calls: [{ name: 'addPlugins', args: [{ plugins: ['eslint-plugin-testing-library'] }] }],
    }));
}

export const TESTING_LIBRARY_BLOCK_BUILDERS: Readonly<Record<string, EslintBlockBuilder>> = {
    'testing-library': buildTestingLibraryBlocks,
};
