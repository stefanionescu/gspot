import { NPM_TOOL_PROJECT } from '#cli/config/generation/tool-projects.ts';

export const PACKAGE_MANAGER_TIMEOUT = {
    code: 1,
    missing: false,
    duration: 0,
    stdout: '',
    stderr: '',
    timedOut: true,
} as const;

export const FAILED_INSTALL_CASES = [
    { operation: 'installation', frozen: true },
    { operation: 'lockfile resolution', frozen: false },
] as const;

export const PACKAGE_MANAGER_AGE_CASES = [
    { name: 'npm', version: '11.18.0', minimum: '11.19.0', accepted: false },
    { name: 'npm', version: '11.19.0', minimum: '11.19.0', accepted: true },
    { name: 'pnpm', version: '9.9.0', minimum: '10.16.0', accepted: false },
    { name: 'pnpm', version: '10.15.0', minimum: '10.16.0', accepted: false },
    { name: 'pnpm', version: '10.16.0', minimum: '10.16.0', accepted: true },
    { name: 'bun', version: '1.2.22', minimum: '1.3.0', accepted: false },
    { name: 'bun', version: '1.3.0', minimum: '1.3.0', accepted: true },
    { name: 'yarn', version: '4.9.0', minimum: '4.10.0', accepted: false },
    { name: 'yarn', version: '4.10.0', minimum: '4.10.0', accepted: true },
];

const CREDENTIAL_TOKEN = 'synthetic-generated-lockfile-token';

export const CREDENTIAL_NPMRC = `registry=https://registry.example.com/\n//registry.example.com/:_authToken=${CREDENTIAL_TOKEN}\n`;

export const CREDENTIAL_PACKAGE_JSON = JSON.stringify({ ...NPM_TOOL_PROJECT, devDependencies: { prettier: '3.8.1' } });

export const CREDENTIAL_LOCKFILE = JSON.stringify({
    workspaces: { '': { devDependencies: { prettier: '3.8.1' } } },
    packages: { prettier: ['prettier@3.8.1', `https://registry.example.com/${CREDENTIAL_TOKEN}`, {}, 'integrity'] },
});
