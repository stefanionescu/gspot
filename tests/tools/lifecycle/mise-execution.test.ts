import { testdir, createFileTree } from 'testdirs';
import { join, dirname, delimiter } from 'node:path';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { writeOutputs } from '#cli/lifecycle/apply.ts';
import { gspot, spawnGspot } from '#tests/harness/gspot.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { test, expect, afterAll, beforeAll } from 'bun:test';
import { applyPlan } from '#cli/lifecycle/ownership/commit.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import type { InstallJson } from '#cli/types/commands/install.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { MISE_CONFIG_PATH } from '#cli/config/platform/locations.ts';
import { proposeReplacement } from '#cli/lifecycle/ownership/plans.ts';
import { CLI_PINS, GSPOT_MISE_TOOL } from '#cli/config/configurations.ts';
import { chmodSync, existsSync, readFileSync, realpathSync } from 'node:fs';
import type { MiseProject } from '#tests/types/tools/lifecycle/mise-execution.ts';
import { suiteTimeout, openTestBudget, runTestCommand } from '#tests/harness/command.ts';

const previousMiseVersion = `${String(Number(CLI_PINS.mise.split('.', 1)[0]) - 1)}.12.31`;

const resources = new AsyncDisposableStack();
let project: MiseProject;

beforeAll(async () => {
    if (!isPosix) return;
    const budget = openTestBudget(suiteTimeout());
    try {
        const repository = resources.use(await testdir());
        const state = resources.use(await testdir());
        const policy = buildPolicy([], {
            tables: 'run_with = "mise"\n[agent_rules]\nenabled = false\n',
            level: 'recommended',
        });
        await createFileTree(repository.path, { 'gspot.toml': policy, '.gspot/authored.txt': 'keep authored content' });
        await createFileTree(state.path, {
            'bin/gspot': '#!/bin/sh\nexec "$GSPOT_TEST_BUN" "$GSPOT_TEST_CLI" "$@"\n',
            'old/mise': `#!/bin/sh\nif [ "$1" = --version ]; then printf "${previousMiseVersion}\\n"; exit 0; fi\nexit 42\n`,
        });
        chmodSync(join(state.path, 'bin/gspot'), 0o755);
        chmodSync(join(state.path, 'old/mise'), 0o755);
        {
            using log = openOwnership(repository.path);
            writeOutputs(await openSession(repository.path), log);
        }
        project = {
            root: repository.path,
            state: state.path,
            policy,
            generated: readFileSync(join(repository.path, MISE_CONFIG_PATH)),
            environment: {
                PATH: `${join(state.path, 'bin')}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
                GSPOT_TEST_BUN: process.execPath,
                GSPOT_TEST_CLI: gspot,
                MISE_CONFIG_DIR: join(state.path, 'config'),
                MISE_DATA_DIR: join(state.path, 'data'),
                MISE_STATE_DIR: join(state.path, 'state'),
                MISE_CACHE_DIR: join(state.path, 'cache'),
                MISE_OFFLINE: '1',
                MISE_DISABLE_TOOLS: '',
                MISE_CEILING_PATHS: dirname(repository.path),
                MISE_TRUSTED_CONFIG_PATHS: repository.path,
            },
        };
        expect(
            await runTestCommand(['mise', 'link', `${GSPOT_MISE_TOOL}@${packageManifest.version}`, state.path], {
                cwd: project.root,
                env: project.environment,
            }),
        ).toMatchObject({ code: 0 });
    } finally {
        budget[Symbol.dispose]();
    }
});
afterAll(async () => {
    await resources.disposeAsync();
});

test.skipIf(!isPosix)('install rejects an old runner and succeeds with the pinned CLI selected', async () => {
    const { root, state, environment, generated, policy } = project;
    const refused = await spawnGspot(root, ['install', '--json'], {
        ...environment,
        PATH: `${join(state, 'old')}${delimiter}${environment['PATH']}`,
    });
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect((JSON.parse(refused.stdout) as InstallJson).message).toContain(CLI_PINS.mise);
    expect(readFileSync(join(root, MISE_CONFIG_PATH))).toStrictEqual(generated);
    const selected = await runTestCommand(['mise', 'which', 'gspot'], { cwd: root, env: environment });
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    expect(realpathSync(selected.stdout.trim())).toBe(realpathSync(join(state, 'bin/gspot')));
    const installed = await spawnGspot(root, ['install', '--json'], environment);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect((JSON.parse(installed.stdout) as InstallJson).installed).toBe(true);
    expect({
        generated: readFileSync(join(root, MISE_CONFIG_PATH)),
        policy: readFileSync(join(root, 'gspot.toml'), 'utf8'),
    }).toStrictEqual({ generated, policy });
});

test.skipIf(!isPosix)(
    'Mise forwards CLI arguments and apply removes obsolete outputs while preserving authored files',
    async () => {
        const { root, environment } = project;
        {
            using log = openOwnership(root);
            applyPlan(
                log,
                proposeReplacement(log, {
                    path: '.gspot/obsolete.json',
                    next: { bytes: Buffer.from('{}\n'), mode: 0o444 },
                    kind: 'config',
                }),
            );
        }
        const options = { cwd: root, env: environment };
        const invalid = await runTestCommand(['mise', 'exec', '--', 'gspot', 'apply', '--invalid'], options);
        expect(invalid.code, invalid.stdout + invalid.stderr).toBe(2);
        expect(invalid.stdout + invalid.stderr).toContain('--invalid');
        expect(existsSync(join(root, '.gspot/obsolete.json'))).toBe(true);
        const applied = await runTestCommand(['mise', 'exec', '--', 'gspot', 'apply'], options);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        expect(existsSync(join(root, '.gspot/obsolete.json'))).toBe(false);
        expect(readFileSync(join(root, '.gspot/authored.txt'), 'utf8')).toBe('keep authored content');
    },
);
