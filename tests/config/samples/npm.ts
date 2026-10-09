import type { YarnOperations } from '#tests/types/cli/npm.ts';

export const YARN_MANAGERS: YarnOperations[] = [
    {
        installer: { name: 'yarn', version: '1.22.22' },
        lockfile: ['yarn', 'install'],
        install: ['yarn', 'install', '--frozen-lockfile'],
        settings: false,
    },
    {
        installer: { name: 'yarn', version: '4.12.0' },
        lockfile: ['yarn', 'install', '--mode=update-lockfile'],
        install: ['yarn', 'install', '--immutable'],
        settings: true,
    },
];

/** Native-only sandboxes leave npm check consumers out of the selected installation. */
export const NATIVE_MISE_POLICY = `runner = "mise"
[[ignore]]
check = "files/v8r"
reason = "This sandbox exercises tools without JSON schema checks."
[[ignore]]
check = "format/editorconfig-checker"
reason = "This sandbox exercises tools without the npm editor checker."
`;
