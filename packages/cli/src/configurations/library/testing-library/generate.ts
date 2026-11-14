import type { EslintScope, EslintBlockBuilder, ConfigurationBlocks } from '#cli/types/configurations/javascript.ts';

import {
    TESTING_LIBRARY_SCOPE,
    TESTING_LIBRARY_PRESETS,
    TESTING_LIBRARY_SETTINGS,
    TESTING_LIBRARY_DEFAULT_PRESET,
} from '#cli/config/configurations/library.ts';

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
