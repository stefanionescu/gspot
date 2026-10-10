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
