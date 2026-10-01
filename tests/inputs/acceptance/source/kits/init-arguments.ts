// Initialization arguments for the configuration acceptance tests.
export const SECURITY_INIT = [
    'init',
    '--yes',
    '--kits',
    'typescript',
    'security',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-guides',
    '--no-install',
];
export const LICENSES_INIT = [
    'init',
    '--yes',
    '--kits',
    'licenses',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-guides',
    '--no-install',
];
export const NGINX_INIT = [
    'init',
    '--yes',
    '--kits',
    'nginx',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-guides',
    '--no-install',
];
export const DUPLICATION_INIT = [
    'init',
    '--yes',
    '--kits',
    'bash',
    'duplication',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-guides',
    '--no-install',
];
export const CONFIGS_INIT = [
    'init',
    '--yes',
    '--kits',
    'files',
    '--no-runner',
    '--no-ci',
    '--no-guides',
    '--no-install',
];
export const DEPENDENCIES_INIT = [
    'init',
    '--yes',
    '--kits',
    'dependencies',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-guides',
    '--no-install',
];
export const ANSIBLE_INIT = [
    'init',
    '--yes',
    '--kits',
    'ansible',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-guides',
    '--no-install',
];
/** The kits the duplication sandbox leaves out after init. */
export const DUPLICATION_LEFT_OUT = ['naming'];
/** The kits the ansible sandbox leaves out after init. */
export const ANSIBLE_LEFT_OUT = ['spelling'];
