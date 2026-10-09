import type { InstalledScenario } from '#tests/types/harness/repository.ts';

/** Native installation is separate from the authored pre-init configuration under test. */
export const REPOSITORY: InstalledScenario = { configurations: ['dependencies'], dependencies: {}, files: {} };

/** Native Syncpack filenames that were absent from the takeover declarations. */
export const SYNCPACK_TAKEOVERS = [
    { file: '.syncpackrc.yaml', source: 'versionGroups:\n  - dependencies: [fixture]\n    isIgnored: true\n' },
    { file: '.syncpackrc.yml', source: 'versionGroups:\n  - dependencies: [fixture]\n    isIgnored: true\n' },
    {
        file: '.syncpackrc.ts',
        source: 'export default { versionGroups: [{ dependencies: ["fixture"], isIgnored: true }] };\n',
    },
    {
        file: '.syncpackrc.mjs',
        source: 'export default { versionGroups: [{ dependencies: ["fixture"], isIgnored: true }] };\n',
    },
    {
        file: 'syncpack.config.ts',
        source: 'export default { versionGroups: [{ dependencies: ["fixture"], isIgnored: true }] };\n',
    },
];
