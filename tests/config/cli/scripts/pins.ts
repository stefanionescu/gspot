export const REGISTRY_PIN = {
    tool: 'lint',
    installer: 'npm',
    name: 'lint',
    version: '1.0.0',
    url: 'https://registry.npmjs.org/lint/1.0.0',
};

export const ESLINT_PIN = '9.39.5';
export const INCOMPATIBLE_PEER = { peerDependencies: { eslint: '^8.0.0' } };
export const COMPATIBLE_PEER = { peerDependencies: { eslint: '^9.0.0' } };
export const MALFORMED_PEER = { peerDependencies: 'invalid' };
export const INVALID_TAG = { tag_name: 'invalid' };

export const RUNNER_IMAGE_CASES = [
    ['current', '| `ubuntu-24.04` |\n| `macos-26` |\n| `windows-2025` |', [], []],
    [
        'newer',
        '| `ubuntu-24.04` |\n| `ubuntu-26.04` |\n| `macos-26` |\n| `windows-2025` |',
        [],
        [['%s has a newer stable hosted image: %s.', 'ubuntu-24.04', 'ubuntu-26.04']],
    ],
    [
        'unavailable',
        '| `macos-26` |\n| `windows-2025` |',
        ['ubuntu-24.04 is absent from the stable hosted runner image list.'],
        [],
    ],
    [
        'retired',
        '| `ubuntu-24.04` | deprecated |\n| `macos-26` |\n| `windows-2025` |',
        ['ubuntu-24.04 is absent from the stable hosted runner image list.'],
        [],
    ],
] as const;
