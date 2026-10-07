// Every flag a manifest command passes exists in the pinned tool: the tool's own help text says so.
import { join } from 'node:path';
import { readPolicy } from '#cli/policy/read.ts';
import { testdir, createFileTree } from 'testdirs';
import { inspectTool } from '#cli/tools/inspect.ts';
import { npmProject } from '#cli/generation/npm.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { pythonProject } from '#cli/generation/python.ts';
import { hasToolBuild } from '#tests/harness/platforms.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { test, expect, afterAll, beforeAll } from 'bun:test';
import { packageToolProject } from '#cli/tools/npm/project.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { pythonToolProject } from '#cli/tools/python/project.ts';
import { toolProjectPackage } from '#cli/configurations/pins.ts';
import { workspaceRoot as root } from '#automation/workspace.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import type { FlagCommand } from '#tests/types/tools/manifest-flags-in-help.ts';
import { HELP_TIMEOUT_MS } from '#tests/config/tools/manifest-flags-in-help.ts';
import { installToolProject, prepareToolProjects } from '#cli/tools/project.ts';
import { installTree, readInstalledTree } from '#cli/lifecycle/ownership/installations.ts';

const manifests = [...configurationManifests().values()];
const context = { root, inspections: new Map(), policyFiles: readPolicy(root) };
// Host tools such as vitest are dependencies of the tests workspace; the search walks up to the root store.
const hostContext = { root: join(root, 'tests'), inspections: new Map(), policyFiles: readPolicy(root) };

// The flags of a command: every dashed token before any `=`, and the flag a {each:--flag:setting} placeholder repeats.
function flagsOf(argv: string[]): string[] {
    return [
        ...new Set(
            argv.slice(1).flatMap((part) => {
                const each = /^\{each:(?<flag>-[^:]+):/u.exec(part)?.groups?.['flag'];
                if (each !== undefined) return [each];
                const workspace = /^\{workspace:(?<flag>-[^}]+)\}$/u.exec(part)?.groups?.['flag'];
                if (workspace !== undefined) return [workspace];
                return part.startsWith('-') ? [part.split('=', 1)[0]!] : [];
            }),
        ),
    ];
}

function subcommandsOf(argv: string[]): string[] {
    const words: string[] = [];
    for (const part of argv.slice(1)) {
        if (part.startsWith('-') || part.startsWith('{') || part === '.' || part.includes('/')) break;
        words.push(part);
    }
    return words;
}

// The help of a tool, and of each option group a dotted flag such as --coverage.reporter belongs to.
async function helpText(executable: string, subcommands: string[], flags: string[]): Promise<string> {
    const groups = [...new Set(flags.filter((flag) => flag.includes('.')).map((flag) => flag.split('.', 1)[0]!))];
    const pages = await Promise.all(
        [[], ...groups.map((group) => [group])].map((verbatim) =>
            runTestCommand([executable, ...subcommands, '--help', ...verbatim], {
                cwd: sandbox.path,
                timeoutMs: HELP_TIMEOUT_MS,
            }),
        ),
    );
    const text = pages.map((page) => `${page.stdout}\n${page.stderr}`).join('\n');
    // eslint-disable-next-line no-control-regex, sonarjs/no-control-regex -- reason: A man page overstrike is a character, a backspace, and the character again.
    return text.replaceAll(/.\u0008/gu, '');
}

const commands: FlagCommand[] = [];
const checks = manifests.flatMap((manifest) => manifest.checks.map((check) => ({ manifest, check })));
for (const { manifest, check } of checks)
    for (const argv of [check.command, check.fix]) {
        if (argv === undefined) continue;
        const tool = manifest.tools.find((entry) => entry.name === (check.tool ?? argv[0]));
        if (tool === undefined || tool.system === true) continue;
        const flags = flagsOf(argv);
        if (flags.length > 0) commands.push({ tool, argv, subcommands: subcommandsOf(argv), flags });
    }

const seen = new Set<string>();
const distinct = commands.filter((command) => {
    const key = `${command.tool.name} ${command.subcommands.join(' ')} ${command.flags.join(' ')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
});

// Flag verification owns private installations for every exercised tool, including unselected configurations.
const sandbox = await testdir();
const privateContext = { root: sandbox.path, inspections: new Map(), policyFiles: readPolicy(root) };
afterAll(async () => {
    await sandbox[Symbol.asyncDispose]();
});
beforeAll(async () => {
    if (!isPosix) return;
    const supported = distinct.filter(({ tool }) => hasToolBuild(tool.name));
    const names = new Set(supported.map(({ tool }) => tool.name));
    const selected = manifests.map((manifest) => ({
        ...manifest,
        tools: manifest.tools.filter((tool) => names.has(tool.name)),
    }));
    await createFileTree(sandbox.path, { 'gspot.toml': buildPolicy([], { tables: 'run_with = "mise"\n' }) });
    privateContext.policyFiles = readPolicy(sandbox.path);
    const files = [...pythonProject(selected), ...npmProject(selected, { name: 'bun', version: Bun.version }, 'mise')];
    {
        using log = openOwnership(sandbox.path);
        await prepareToolProjects(
            { root: sandbox.path, pythonInstaller: () => Promise.resolve('uv') },
            files,
            log.files,
            {
                refreshLockfiles: false,
            },
        );
    }
    for (const file of files) await Bun.write(join(sandbox.path, file.path), file.content);
    {
        using log = openOwnership(sandbox.path);
        await installToolProject(
            pythonToolProject,
            {
                read: log.files.read.bind(log.files),
                installTree: (kind, directory) => {
                    installTree(log, kind, readInstalledTree(directory, kind));
                },
            },
            { root: sandbox.path, executable: 'uv' },
        );
    }
    {
        using log = openOwnership(sandbox.path);
        await installToolProject(
            packageToolProject,
            {
                read: log.files.read.bind(log.files),
                installTree: (kind, directory) => {
                    installTree(log, kind, readInstalledTree(directory, kind));
                },
            },
            { root: sandbox.path, tools: supported.map(({ tool }) => tool) },
        );
    }
}, NATIVE_TEST_TIMEOUT_MS);

// On the Windows runner the version inspection times out before the help runs, so these run on POSIX systems.
for (const command of distinct) {
    const title = `${command.tool.name} ${command.subcommands.join(' ')}`.trim();
    test.skipIf(!isPosix || !hasToolBuild(command.tool.name))(
        `the help of ${title} names ${command.flags.join(' ')}`,
        async () => {
            const { tool } = command;
            let log = privateContext;
            if (toolProjectPackage(tool, 'mise') === undefined)
                log = tool.system === true || tool.version === undefined ? hostContext : context;
            const inspection = inspectTool(log, command.tool);
            expect(inspection.state, `${title}: ${inspection.hint ?? ''} ${inspection.note ?? ''}`).toBe(
                command.tool.version === undefined ? 'host' : 'ok',
            );
            expect(inspection.path).toBeDefined();
            const text = await helpText(inspection.path!, command.subcommands, command.flags);
            // A whole token, so a one-letter flag such as -q does not match inside --quiet.
            const missing = command.flags.filter((flag) => {
                const escaped = flag.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
                return !new RegExp(String.raw`(?<![\w-])${escaped}(?![\w-])`, 'u').test(text);
            });
            expect(missing, `${title}: ${text.slice(0, 400)}`).toStrictEqual([]);
        },
        HELP_TIMEOUT_MS,
    );
}
