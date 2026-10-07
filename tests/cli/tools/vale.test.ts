import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { throws, rejects } from 'node:assert/strict';
import { toolPin } from '#cli/configurations/pins.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { rootView } from '#cli/policy/settings/view.ts';
import { EXECUTABLE_FILE } from '#cli/config/platform/modes.ts';
import { VALE_PACKAGE_FOLDERS } from '#cli/config/tools/vale.ts';
import { hasValePackages, removeValePackages, installValePackages } from '#cli/tools/vale.ts';
import { chmodSync, mkdirSync, existsSync, unlinkSync, symlinkSync, readFileSync, writeFileSync } from 'node:fs';

import {
    CONFIG,
    VALE_REMOVAL_LINKS,
    VALE_DETECTION_LINKS,
    VALE_ACQUISITION_FAILURES,
    CORRECTED_VALE_ACQUISITION,
} from '#tests/config/cli/tools/vale.ts';

test.each(VALE_ACQUISITION_FAILURES)(
    'Vale acquisition preserves installed styles after %s and succeeds after correction',
    async (failure, script, expected, tables) => {
        await using directory = await testdir();
        const installed = '.gspot/config/vale/styles/Google/terms.yml';
        await createFileTree(directory.path, {
            'gspot.toml': buildPolicy(['prose'], { level: 'all', tables }),
            '.gspot/config/vale.ini': CONFIG,
            [installed]: 'original bytes\n',
            'guide.md': 'Authored text.\n',
        });
        const session = await openSession(directory.path);
        const tool = toolPin(session.manifests.values(), 'vale');
        const version = tool.version;
        const request = {
            search: session,
            level: session.policyFiles.policy.level,
            tool,
            timeoutSeconds: Number(rootView(session.scopes).settings['tool_timeout_seconds']),
        };
        const executable = join(directory.path, 'node_modules/.bin/vale');
        const launcher = `#!${process.execPath}\nif (process.argv.includes('--version')) console.log(${JSON.stringify(version)});\nelse {\nawait Bun.write(${JSON.stringify(join(directory.path, 'sync-root'))}, process.cwd());\n${script}\n}\n`;
        await createFileTree(directory.path, { 'node_modules/.bin/vale': launcher });
        chmodSync(executable, EXECUTABLE_FILE);
        if (failure === 'cancellation') session.cancelSignal = AbortSignal.abort();
        expect(await installValePackages({ ...request, cancelSignal: session.cancelSignal })).toBe(expected);
        expect(readFileSync(join(directory.path, installed), 'utf8')).toBe('original bytes\n');
        expect(readFileSync(join(directory.path, 'guide.md'), 'utf8')).toBe('Authored text.\n');
        const recordedWork = join(directory.path, 'sync-root');
        if (existsSync(recordedWork)) expect(existsSync(readFileSync(recordedWork, 'utf8'))).toBe(false);
        delete session.cancelSignal;
        writeFileSync(executable, launcher.replace(script, CORRECTED_VALE_ACQUISITION));
        expect(await installValePackages({ ...request, cancelSignal: session.cancelSignal })).toBeUndefined();
        expect(readFileSync(join(directory.path, installed), 'utf8')).toBe('corrected bytes\n');
        expect(hasValePackages(directory.path, 'all')).toBe(true);
        expect(readFileSync(join(directory.path, 'guide.md'), 'utf8')).toBe('Authored text.\n');
    },
);

// A repository whose Vale configuration, package, or nested package folder links to a folder beside it.
async function linkedStyles(directory: string, kind: string): Promise<string> {
    await createFileTree(directory, {
        'project/.gspot/config/vale.ini': CONFIG,
        'project/.gspot/config/vale/styles/.keep': '',
        'outside/vale.ini': CONFIG,
        'outside/terms.yml': 'external bytes\n',
    });
    const root = join(directory, 'project');
    if (kind === 'configuration') {
        unlinkSync(join(root, '.gspot/config/vale.ini'));
        symlinkSync('../../outside/vale.ini', join(root, '.gspot/config/vale.ini'));
    } else if (kind === 'package') {
        symlinkSync('../../../../outside', join(root, '.gspot/config/vale/styles/Google'));
    } else {
        await createFileTree(root, { '.gspot/config/vale/styles/Google/.keep': '' });
        symlinkSync('../../../../../outside', join(root, '.gspot/config/vale/styles/Google/nested'));
    }
    return root;
}

test.each(VALE_DETECTION_LINKS)('Vale package detection rejects a linked %s', async (kind, message) => {
    await using directory = await testdir();
    const root = await linkedStyles(directory.path, kind);
    throws(() => hasValePackages(root, 'all'), { message });
});

test.each(VALE_REMOVAL_LINKS)(
    'Vale package removal refuses a linked %s without deleting outside styles',
    async (kind, message) => {
        await using directory = await testdir();
        const root = await linkedStyles(directory.path, kind);
        throws(
            () => {
                removeValePackages(root);
            },
            { message },
        );
        expect(readFileSync(join(directory.path, 'outside/terms.yml'), 'utf8')).toBe('external bytes\n');
    },
);

test.each(['recommended', 'all'] as const)('package readiness requires the generated config at %s', async (level) => {
    await using sandbox = await testdir();
    expect(hasValePackages(sandbox.path, level)).toBe(false);
    await createFileTree(sandbox.path, { '.gspot/config/vale.ini': CONFIG });
    expect(hasValePackages(sandbox.path, level)).toBe(level === 'recommended');
    for (const folder of VALE_PACKAGE_FOLDERS)
        mkdirSync(join(sandbox.path, '.gspot/config/vale/styles', folder), { recursive: true });
    expect(hasValePackages(sandbox.path, level)).toBe(true);
});

test.each(VALE_PACKAGE_FOLDERS)(
    'all requires the shipped %s folder regardless of an edited Packages option',
    async (missing) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { '.gspot/config/vale.ini': 'Packages = \n' });
        for (const folder of VALE_PACKAGE_FOLDERS.filter((folder) => folder !== missing))
            mkdirSync(join(sandbox.path, '.gspot/config/vale/styles', folder), { recursive: true });
        expect(hasValePackages(sandbox.path, 'all')).toBe(false);
    },
);

test.each([false, true])(
    'recommended acquisition checks config presence=%s without native sync',
    async (configured) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'gspot.toml': buildPolicy(['prose'], { level: 'recommended' }),
            ...(configured ? { '.gspot/config/vale.ini': CONFIG } : {}),
        });
        const session = await openSession(directory.path);
        const request = {
            search: session,
            level: session.policyFiles.policy.level,
            tool: toolPin(session.manifests.values(), 'vale'),
            timeoutSeconds: Number(rootView(session.scopes).settings['tool_timeout_seconds']),
        };
        if (configured) expect(await installValePackages(request)).toBeUndefined();
        else
            await rejects(installValePackages(request), {
                message: 'Vale setup input is missing: .gspot/config/vale.ini',
            });
        expect(existsSync(join(directory.path, '.gspot/config/vale/styles'))).toBe(false);
    },
);
