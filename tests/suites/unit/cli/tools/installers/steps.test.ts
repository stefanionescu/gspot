import http from 'node:http';

import { expect, spyOn, test } from 'bun:test';

import { openSession } from '#cli/engine/session.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { downloadArchive, explainReleaseAgeHold, runRequiredInstallStep } from '#cli/tools/installers/steps.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildSandboxToolInstall } from '#tests/setup/cli/tools.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

const ESLINT_RELEASE = {
    label: 'eslint@10.13.0',
    kind: 'npm',
    version: '10.13.0',
    url: 'https://registry.example.com/eslint',
} as const;

const HOLD_ADVICE =
    'eslint@10.13.0 came out less than 7 days ago. The setting dependencies.min_release_age_days holds back each release for 7 days. Wait for the release to age, or lower the setting with gspot set dependencies.min_release_age_days <days> --reason "<why>".\n';

test.each([
    { name: 'a release inside the hold', status: 200, published: { '10.13.0': new Date() }, expected: HOLD_ADVICE },
    { name: 'a release older than the hold', status: 200, published: { '10.13.0': new Date(0) }, expected: '' },
    { name: 'a failed lookup', status: 500, published: {}, expected: '' },
    {
        name: 'a registry without the package',
        status: 404,
        published: {},
        expected: 'The registry has no release eslint@10.13.0.\n',
    },
    {
        name: 'a package without the release',
        status: 200,
        published: { '1.0.0': new Date(0) },
        expected: 'The registry has no release eslint@10.13.0.\n',
    },
])('$name gives its explanation', async ({ status, published, expected }) => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const install = await buildSandboxToolInstall(await openSession(sandbox.path), openFiles(sandbox.path));
    using _registry = spyOn(globalThis, 'fetch').mockImplementation(
        Object.assign(() => Promise.resolve(Response.json({ time: published }, { status })), {
            preconnect: fetch.preconnect,
        }),
    );
    const output = 'npm error notarget No matching version found for eslint@10.13.0 with a date before 10/23/2026.';
    const prettier = { ...ESLINT_RELEASE, label: 'prettier@3.8.1' };
    expect(await explainReleaseAgeHold(install, output, [ESLINT_RELEASE, prettier])).toBe(expected);
});

test.each([
    { name: 'an unreachable registry', failure: new TypeError('Fetch failed.') },
    { name: 'a registry that does not answer in time', failure: new DOMException('Timed out.', 'TimeoutError') },
])('$name adds no explanation', async ({ failure }) => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const install = await buildSandboxToolInstall(await openSession(sandbox.path), openFiles(sandbox.path));
    using _registry = spyOn(globalThis, 'fetch').mockImplementation(
        Object.assign(() => Promise.reject(failure), { preconnect: fetch.preconnect }),
    );
    const output = 'npm error notarget No matching version found for eslint@10.13.0.';
    expect(await explainReleaseAgeHold(install, output, [ESLINT_RELEASE])).toBe('');
});

test('a registry reply that does not fit the release schema reaches the caller as its error', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const install = await buildSandboxToolInstall(await openSession(sandbox.path), openFiles(sandbox.path));
    using _registry = spyOn(globalThis, 'fetch').mockImplementation(
        Object.assign(() => Promise.resolve(Response.json({ time: 'soon' })), { preconnect: fetch.preconnect }),
    );
    const output = 'npm error notarget No matching version found for eslint@10.13.0.';
    const error = await captureRejection(explainReleaseAgeHold(install, output, [ESLINT_RELEASE]));
    expect(error.name).toBe('ZodError');
});

test.skipIf(isWindows)('an install step that a signal stops names the signal in place of an exit code', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const install = await buildSandboxToolInstall(await openSession(sandbox.path), openFiles(sandbox.path));
    const command = buildProgramCommand('fakes/tool', '--signal', 'SIGKILL');
    const error = await captureRejection(
        runRequiredInstallStep(install, command, { cwd: sandbox.path, step: 'installing', name: 'npm installation' }),
    );
    expect(error).toMatchObject({ name: 'GspotError', code: 'install' });
    expect(error.message).toContain('SIGKILL');
});

test('an oversized archive cancels its response stream before reporting the size error', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const session = await openSession(sandbox.path);
    const writer = openFiles(sandbox.path);
    const install = await buildSandboxToolInstall(session, writer);
    let isCanceled = false;
    const stream = new ReadableStream<Uint8Array>({
        start: (controller) => {
            controller.enqueue(new Uint8Array([1, 2, 3]));
        },
        cancel: () => {
            isCanceled = true;
        },
    });
    using _request = spyOn(globalThis, 'fetch').mockImplementation(
        Object.assign(() => Promise.resolve(new Response(stream)), { preconnect: fetch.preconnect }),
    );
    const error = await captureRejection(
        downloadArchive(install.session, {
            url: 'https://example.com/styles.zip',
            name: 'styles',
            limit: 2,
        }),
    );
    expect(error).toMatchObject({ name: 'GspotError', code: 'install' });
    expect(error.message).toContain('https://example.com/styles.zip');
    expect(isCanceled).toBe(true);
});

test('a failed download behind a proxy says how to turn the proxy on', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const install = await buildSandboxToolInstall(await openSession(sandbox.path), openFiles(sandbox.path));
    using _environment = overrideEnvironment({ HTTPS_PROXY: 'https://proxy.example.com:8080' });
    const refuse = Object.assign(() => Promise.reject(new Error('The proxy refused the connection.')), {
        preconnect: fetch.preconnect,
    });
    using _fetch = spyOn(globalThis, 'fetch').mockImplementation(refuse);
    const setProxy: unknown = Reflect.get(http, 'setGlobalProxyFromEnv');
    Reflect.deleteProperty(http, 'setGlobalProxyFromEnv');
    const failure = await captureRejection(
        downloadArchive(install.session, { url: 'https://example.com/a.zip', name: 'the archive', limit: 1 }),
    );
    Reflect.set(http, 'setGlobalProxyFromEnv', setProxy);
    expect(failure).toMatchObject({ name: 'GspotError', code: 'install' });
    expect(failure.message).toContain('NODE_USE_ENV_PROXY=1');
});
