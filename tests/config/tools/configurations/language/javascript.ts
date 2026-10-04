import type { RepositoryScenario } from '#tests/types/harness/repository.ts';

export const CLEAN_MODULE =
    '// Doubles numbers.\n\n/**\n * Doubles a number.\n * @param {number} value the value\n * @returns {number} twice the value\n */\nexport function twice(value) {\n    return value * 2;\n}\n';

/** A JavaScript repository with no TypeScript source or compiler config file. */
export const REPOSITORY: RepositoryScenario = {
    configurations: ['javascript'],
    without: [],
    files: {
        'package.json': '{"name":"example","version":"1.0.0","private":true,"type":"module"}\n',
        'src/main.js': CLEAN_MODULE,
        'src/index.js': "// The entry point.\nexport { twice } from './main.js';\n",
    },
};
