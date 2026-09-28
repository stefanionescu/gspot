// The hook manager and hook status of a sandbox, driven from its session the way the install command drives them.
import { createFileTree } from 'testdirs';
import { join, delimiter } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import { openSession } from '#cli/execution/session.ts';
import { hookStatus } from '#cli/lifecycle/hooks/status.ts';
import { applyCommand } from '#cli/commands/apply/command.ts';
import { hookLocation } from '#cli/repository/hook-location.ts';
import type { Session } from '#cli/types/execution/execution.ts';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import type { PrepareHuskyResult } from '#tests/types/results.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { installNativeHooks } from '#cli/lifecycle/hooks/managers.ts';
import type { HookLocation } from '#cli/types/repository/repository.ts';
import { PRE_COMMIT_POLICY, SIMPLE_GIT_HOOKS_POLICY } from '#tests/config/integration/tools/hooks.ts';

/**
 * Read hook readiness and diagnostics from a fresh sandbox session.
 * @param root the sandbox repository
 * @returns the current hook status
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Eight test files read the hook status through it; one owner opens the session.
export async function readHookStatus(root: string): Promise<ReturnType<typeof hookStatus>> {
    const session = await openSession(root);
    return hookStatus({ policy: session.policyFiles.policy, repository: session.repository });
}

/**
 * Installs the native hook manager the sandbox's policy names.
 * @param root the sandbox
 * @returns the line that says what was installed
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Six test files install the hook tool through it; one owner opens the session.
export async function installHookTool(root: string): Promise<string> {
    const session = await openSession(root);
    return installNativeHooks({ policy: session.policyFiles.policy, repository: session.repository, tools: session });
}

/** Prepares authored package and local hooks for native simple-git-hooks adoption. */
export async function prepareSimpleGitHooks(
    root: string,
    repository: string,
): Promise<{ originalManifest: string; originalHook: string; location: HookLocation }> {
    await createFileTree(root, {
        'gspot.toml': SIMPLE_GIT_HOOKS_POLICY,
        'package.json':
            JSON.stringify(
                {
                    private: true,
                    devDependencies: { 'simple-git-hooks': '2.13.1' },
                    'simple-git-hooks': {
                        'pre-push': `${JSON.stringify(process.execPath)} ${JSON.stringify(join(root, 'original.js'))} "$@"`,
                    },
                },
                null,
                2,
            ) + '\n',
        'original.js':
            'await Bun.write("package-input", await Bun.stdin.text()); await Bun.write("package-args", JSON.stringify(process.argv.slice(2)));',
        'bin/gspot': `#!${process.execPath}\n(await import('node:fs')).appendFileSync('gspot-runs', 'x'); await Bun.write('gspot-input', await Bun.stdin.text()); await Bun.write('gspot-args', JSON.stringify(process.argv.slice(2))); process.exitCode = (await Bun.file('failed').exists()) ? 1 : 0;\n`,
    });
    chmodSync(join(root, 'bin/gspot'), 0o755);
    const ran = await run(['git', 'init', '-q', repository], { cwd: root });
    if (ran.code !== 0) throw new Error(`Hook fixture Git setup failed: ${ran.stderr}`);
    const installed = await run(['npm', 'install', '--ignore-scripts', '--no-audit', '--no-fund'], {
        cwd: root,
        timeoutMs: 60_000,
    });
    if (installed.code !== 0) throw new Error(`Hook fixture installation failed: ${installed.stderr}`);
    const originalManifest = readFileSync(join(root, 'package.json'), 'utf8');
    const location = hookLocation(root);
    const originalHook = '#!/bin/sh\ncat > local-input\nprintf "%s\\n" "$@" > local-args\n';
    writeFileSync(join(location.absolute, 'pre-push'), originalHook, { mode: 0o755 });
    const applied = await applyCommand({ cwd: root, isDryRun: false });
    if (applied.exitCode !== 0) throw new Error('Hook fixture apply failed.');
    return { originalManifest, originalHook, location };
}

/** Prepares a committed native pre-commit project and installs its dispatcher. */
export async function preparePreCommit(
    root: string,
    repository: string,
): Promise<{ session: Session; env: Record<string, string> }> {
    await createFileTree(root, {
        'gspot.toml': PRE_COMMIT_POLICY,
        '.gitignore': '.venv/\nbin/\npre-commit-cache/\nobserved\nfailed\n',
        'source.txt': 'input',
        'bin/gspot': `#!${process.execPath}\nconst {appendFileSync} = await import('node:fs'); appendFileSync('observed', JSON.stringify({args: process.argv.slice(2), input: await Bun.stdin.text()}) + '\\n'); process.exitCode = (await Bun.file('setup-failed').exists()) ? 2 : (await Bun.file('failed').exists()) ? 1 : 0;\n`,
    });
    chmodSync(join(root, 'bin/gspot'), 0o755);
    for (const command of [
        ['git', 'init', '-q', repository],
        ['uv', 'venv', '.venv'],
        ['uv', 'pip', 'install', '--python', '.venv/bin/python', 'pre-commit==4.5.1'],
    ]) {
        const result = await run(command, { cwd: root, timeoutMs: 60_000 });
        if (result.code !== 0) throw new Error(`Pre-commit fixture setup failed: ${result.stderr}`);
    }
    const applied = await applyCommand({ cwd: root, isDryRun: false });
    if (applied.exitCode !== 0) throw new Error('Pre-commit fixture apply failed.');
    const ran = await run(['git', 'add', 'source.txt', 'gspot.toml', '.pre-commit-config.yaml', '.gitignore'], {
        cwd: root,
    });
    if (ran.code !== 0) throw new Error(`Pre-commit fixture staging failed: ${ran.stderr}`);
    const committed = await run(
        ['git', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'fixture'],
        { cwd: root },
    );
    if (committed.code !== 0) throw new Error(`Pre-commit fixture commit failed: ${committed.stderr}`);
    const session = await openSession(root);
    await installNativeHooks({ policy: session.policyFiles.policy, repository: session.repository, tools: session });
    return {
        session,
        env: {
            PATH: `${join(root, 'bin')}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
            PRE_COMMIT_HOME: join(root, 'pre-commit-cache'),
        },
    };
}

/** Prepares authored Husky commands and either an existing native or local Git hook. */
export async function prepareHusky(root: string, top: string, kind: string): Promise<PrepareHuskyResult> {
    const authored = 'cat > authored-input\nprintf "%s\\n" "$@" > authored-args\nexit 0\n';
    await createFileTree(root, {
        'gspot.toml': 'version = 1\nconfigurations = []\n[rules]\ninstall = false\n[hooks]\ntool = "husky"\n',
        'package.json': '{"private":true,"devDependencies":{"husky":"9.1.7"}}\n',
        '.husky/pre-commit': 'printf retained > authored-commit\nexit 0\n',
        '.husky/pre-push': authored,
        '.husky/commit-msg': 'printf "%s" "$1" > authored-message\ncd authored-cwd\nset -- changed\n',
        'scratch/.keep': '',
        'config/husky/init.sh': 'printf initialized > initialized\n',
        'bin/gspot': `#!${process.execPath}\n(await import('node:fs')).appendFileSync('gspot-runs', 'x'); await Bun.write('captured.json', JSON.stringify({args:process.argv.slice(2), input:process.argv.includes('--push') ? await Bun.stdin.text() : ''})); process.exitCode = Number(await Bun.file('verdict').text());\n`,
        verdict: '0',
    });
    await createFileTree(top, { 'authored-cwd/.keep': '' });
    chmodSync(join(root, 'bin/gspot'), 0o755);
    const ran = await run(['git', 'init', '-q'], { cwd: top });
    if (ran.code !== 0) throw new Error(`Husky fixture Git setup failed: ${ran.stderr}`);
    const installed = await run(['npm', 'install', '--ignore-scripts', '--no-audit', '--no-fund'], {
        cwd: root,
        timeoutMs: 60_000,
    });
    if (installed.code !== 0)
        throw new Error(`Husky fixture installation failed: ${installed.stdout}${installed.stderr}`);
    const options = {
        cwd: top,
        timeoutMs: 5000,
        env: {
            PATH: `${join(root, 'bin')}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
            XDG_CONFIG_HOME: join(root, 'config'),
            TMPDIR: join(root, 'scratch'),
        },
    };
    if (kind === 'native') {
        const native = await run([join(root, 'node_modules/.bin/husky')], options);
        if (native.code !== 0) throw new Error(`Husky fixture native setup failed: ${native.stderr}`);
    }
    const location = hookLocation(root);
    if (kind !== 'native')
        writeFileSync(join(location.absolute, 'pre-push'), '#!/bin/sh\ncat > local-input\nexit 0\n', { mode: 0o755 });
    const original = readFileSync(join(location.absolute, 'pre-push'));
    const config = readFileSync(join(top, '.git/config'));
    const applied = await applyCommand({ cwd: root, isDryRun: false });
    if (applied.exitCode !== 0) throw new Error('Husky fixture apply failed.');
    return { authored, original, location, config, options };
}
