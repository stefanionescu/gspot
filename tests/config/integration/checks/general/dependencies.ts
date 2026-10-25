export const SYNCPACK_FILES = [
    {
        file: '.syncpackrc.yaml',
        source: `versionGroups:
  - dependencies: [shared-library]
    isIgnored: true
`,
    },
    {
        file: '.syncpackrc.yml',
        source: `versionGroups:
  - dependencies: [shared-library]
    isIgnored: true
`,
    },
    {
        file: '.syncpackrc.ts',
        source: 'export default { versionGroups: [{ dependencies: ["shared-library"], isIgnored: true }] };\n',
    },
    {
        file: '.syncpackrc.mjs',
        source: 'export default { versionGroups: [{ dependencies: ["shared-library"], isIgnored: true }] };\n',
    },
    {
        file: 'syncpack.config.ts',
        source: 'export default { versionGroups: [{ dependencies: ["shared-library"], isIgnored: true }] };\n',
    },
] as const;

export const SYNCPACK_PACKAGE_FILES = {
    'package.json': '{"name":"root","private":true,"dependencies":{"shared-library":"1.0.0"}}\n',
    'packages/app/package.json': '{"name":"app","private":true,"dependencies":{"shared-library":"2.0.0"}}\n',
} as const;
