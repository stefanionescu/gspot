// ci jobs
export const LINUX_PIPELINE = {
    version: '1.2.3',
    node: 'node@22.0.0',
    packageManager: { name: 'npm' as const, version: '11.10.1' },
    operatingSystems: ['linux' as const],
    linuxRunner: 'ubuntu-24.04' as const,
    projectInstall: [],
    testChecks: [],
};
/**
The body of a fake mise that runs the command after `--` of `mise exec`. mise exec loads the variables of the mise
config files, so the fake sets one for the command it runs.
*/
export const MISE_EXEC =
    '[ "$1" = exec ] || exit 0\nwhile [ "$1" != -- ]; do shift; done\nshift\nMISE_LOADED=1 exec "$@"\n';
export const SETUP_CASES = [
    ['github', 0],
    ['github', 29],
    ['gitlab', 0],
    ['gitlab', 29],
] as const;

// git hooks
const BIN_FOLDER_START = { program: 'node', launcher: 'node_modules/.bin/gspot', prefix: [] } as const;
export const HOOK_CASES = [
    ['pre-commit', []],
    ['pre-push', ['origin', 'https://example.com/repository.git']],
    ['commit-msg', ['message']],
] as const;
export const START_COMMANDS = [
    { manager: 'npm', packageManager: 'npm@11.10.1', ...BIN_FOLDER_START },
    {
        manager: 'yarn',
        packageManager: 'yarn@4.13.0',
        program: 'yarn',
        launcher: 'bin/yarn',
        prefix: ['exec', '--', 'gspot'],
    },
    {
        manager: 'mise',
        packageManager: undefined,
        program: 'mise',
        launcher: 'bin/mise',
        prefix: ['exec', '--', 'gspot'],
    },
] as const;

// rule files
export const PLAYWRIGHT_RULE_CASES = [
    {
        name: 'a scope that depends on playwright without the test runner gets no PLAYWRIGHT.md',
        files: { 'package.json': '{"devDependencies":{"playwright":"1.0.0"}}' },
        rules: [],
    },
    {
        name: 'a scope that depends on @playwright/test gets PLAYWRIGHT.md',
        files: { 'package.json': '{"devDependencies":{"@playwright/test":"1.0.0"}}' },
        rules: ['PLAYWRIGHT.md'],
    },
    {
        name: 'a scope with a Playwright config file gets PLAYWRIGHT.md',
        files: { 'package.json': '{}', 'e2e/playwright.config.ts': 'export default {};\n' },
        rules: ['PLAYWRIGHT.md'],
    },
] as const;
export const RUNTIME_RULE_CASES = [
    { name: 'a Deno script', runtime: 'deno', rules: ['DENO.md'] },
    { name: 'a Node.js script', runtime: 'node', rules: [] },
] as const;
