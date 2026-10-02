// Every flag a manifest command passes exists in the pinned tool: the tool's own help text says so.
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPolicy } from '#cli/policy/read.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { inspectTool } from '#cli/tools/inspect.ts';
import { kitManifests } from '#cli/kits/manifests.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { privateToolInstallation } from '#cli/tools/pins.ts';
import { test, expect, afterAll, beforeAll } from 'bun:test';
import { toolPackages } from '#cli/generation/tools/packages.ts';
import type { ToolCommand } from '#tests/types/integration/tools.ts';
import { runOwnedLifecycle } from '#cli/lifecycle/ownership/owner.ts';
import { toolEnvironment } from '#cli/generation/tools/environment.ts';
import { onPosix, toolShipsHere } from '#tests/harness/cli/platforms.ts';
import { HELP_TIMEOUT_MS, INSTALL_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { installPythonProject, preparePythonProject } from '#cli/tools/python.ts';
import { installPackageProject, preparePackageProject } from '#cli/tools/packages/project.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const manifests = [...kitManifests().values()];
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
        [[], ...groups.map((group) => [group])].map((extra) =>
            processes.run([executable, ...subcommands, '--help', ...extra], { cwd: root, timeoutMs: HELP_TIMEOUT_MS }),
        ),
    );
    const text = pages.map((page) => `${page.stdout}\n${page.stderr}`).join('\n');
    // eslint-disable-next-line no-control-regex, sonarjs/no-control-regex -- reason: A man page overstrike is a character, a backspace, and the character again.
    return text.replaceAll(/.\u0008/gu, '');
}

function ownerOf(tool: ToolCommand['tool']): typeof context {
    if (privateToolInstallation(tool, 'mise') !== undefined) return privateContext;
    return tool.provider === 'host' || tool.version === undefined ? hostContext : context;
}

const commands: ToolCommand[] = [];
const checks = manifests.flatMap((manifest) => manifest.checks.map((check) => ({ manifest, check })));
for (const { manifest, check } of checks)
    for (const argv of [check.command, check.fix_command]) {
        if (argv === undefined) continue;
        const tool = manifest.tools.find((entry) => entry.name === (check.tool ?? argv[0]));
        if (tool === undefined || tool.provider === 'host') continue;
        const flags = flagsOf(argv);
        if (flags.length > 0) commands.push({ tool, argv, subcommands: subcommandsOf(argv), flags });
    }

const seen = new Set<string>();
const distinct = commands.filter((command) => {
    if (!toolShipsHere(command.tool.name)) return false;
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
    const names = new Set(distinct.map(({ tool }) => tool.name));
    const selected = manifests.map((manifest) => ({
        ...manifest,
        tools: manifest.tools.filter((tool) => names.has(tool.name)),
    }));
    await createFileTree(sandbox.path, { 'gspot.toml': policyOf([], '[runner]\ntool = "mise"\n') });
    privateContext.policyFiles = readPolicy(sandbox.path);
    const files = [
        ...toolEnvironment(selected),
        ...toolPackages(selected, { name: 'bun', version: Bun.version }, 'mise'),
    ];
    await runOwnedLifecycle(sandbox.path, async (owner) => {
        await preparePythonProject(sandbox.path, files, owner);
        await preparePackageProject(sandbox.path, files, owner);
    });
    for (const file of files) await Bun.write(join(sandbox.path, file.path), file.content);
    await runOwnedLifecycle(sandbox.path, (owner) => installPythonProject(sandbox.path, owner));
    await runOwnedLifecycle(sandbox.path, (owner) =>
        installPackageProject(
            sandbox.path,
            owner,
            distinct.map(({ tool }) => tool),
        ),
    );
}, INSTALL_TIMEOUT_MS);

test('every pinned tool a manifest command names is defined in that manifest', () => {
    const declared = new Set(manifests.flatMap((manifest) => manifest.tools.map((tool) => tool.name)));
    const undefinedTools = manifests.flatMap((manifest) =>
        manifest.checks
            .flatMap((check) => (check.command === undefined ? [] : [check.tool ?? check.command[0]!]))
            .filter((name) => !declared.has(name)),
    );
    expect([...new Set(undefinedTools)]).toStrictEqual([]);
});

// On the Windows runner the version inspection times out before the help runs. The stage that moves acceptance cases to
// faster tiers runs this in a temporary folder and brings Windows back.
for (const command of distinct) {
    const title = `${command.tool.name} ${command.subcommands.join(' ')}`.trim();
    if (onPosix)
        test(
            `the help of ${title} names ${command.flags.join(' ')}`,
            async () => {
                const owner = ownerOf(command.tool);
                const inspection = inspectTool(owner, command.tool);
                expect(inspection.state, `${title}: ${inspection.hint ?? ''} ${inspection.note ?? ''}`).toBe(
                    command.tool.version === undefined ? 'host' : 'ok',
                );
                expect(inspection.path).toBeDefined();
                const text = await helpText(inspection.path!, command.subcommands, command.flags);
                const missing = command.flags.filter((flag) => !text.includes(flag));
                expect(missing, `${title}: ${text.slice(0, 400)}`).toStrictEqual([]);
            },
            HELP_TIMEOUT_MS,
        );
}
