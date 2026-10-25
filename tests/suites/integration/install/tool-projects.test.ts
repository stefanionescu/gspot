import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openWriter } from '#cli/write.ts';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { generate } from '#cli/generation/generate.ts';
import { listMisePins } from '#cli/configurations/tools.ts';
import { buildToolInstall } from '#tests/setup/cli/tools.ts';
import { writeGeneratedFiles } from '#cli/apply/generated.ts';
import { createGitSandbox } from '#tests/setup/system/git.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import type { NpmToolInstall } from '#cli/types/install/npm.ts';
import { prepareNpmLockfile } from '#cli/install/npm/project.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readRuntimePins } from '#tests/setup/runner/run-folder.ts';
import { DOT_GSPOT, GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { preparePythonLockfile } from '#cli/install/python/project.ts';
import { toolAdvisoryReportSchema } from '#tests/schemas/tool-projects.ts';
import { TOOL_ADVISORY_EXCEPTIONS } from '#tests/config/integration/install/tool-projects.ts';

async function scanToolProjects(root: string, configurations: Configuration[]) {
    const scanner = listMisePins(configurations)
        .filter(({ name }) => name === 'osv-scanner')
        .map(({ name, version }) => `${name}@${version}`);
    expect(scanner).toHaveLength(1);
    const scanned = await runCommand(
        [
            'mise',
            'exec',
            ...scanner,
            '--',
            'osv-scanner',
            'scan',
            'source',
            '--format',
            'json',
            '--recursive',
            join(root, DOT_GSPOT),
        ],
        { cwd: root },
    );
    expect([0, 1], scanned.stderr).toContain(scanned.code);
    expect(scanned.stdout.trim(), scanned.stderr).not.toBe('');
    return toolAdvisoryReportSchema.parse(JSON.parse(scanned.stdout) as unknown);
}

test('every shipped npm and Python tool lockfile has only dated accepted advisories', async () => {
    const { bun } = await readRuntimePins();
    await using sandbox = await createGitSandbox({
        'package.json': JSON.stringify({ private: true, packageManager: `bun@${bun}` }),
        'gspot.toml': buildSandboxSettings(readConfigurations().keys().toArray(), { level: 'all' }),
    });
    const session = await openSession(sandbox.path);
    const generated = generate(session);
    using writer = openWriter(sandbox.path);
    await writeGeneratedFiles(session, generated, writer);
    const install = buildToolInstall(session, writer) as NpmToolInstall;
    const projects = generated.files.filter(
        ({ path }) => path === GSPOT_PATHS.npmProject || path === GSPOT_PATHS.pythonProject,
    );
    expect(projects.map(({ path }) => path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual(
        [GSPOT_PATHS.npmProject, GSPOT_PATHS.pythonProject].toSorted((left, right) => left.localeCompare(right)),
    );
    for (const project of projects) {
        const lockfile =
            project.path === GSPOT_PATHS.npmProject
                ? await prepareNpmLockfile(install, project, undefined)
                : await preparePythonLockfile(install, project);
        await writeFile(join(sandbox.path, lockfile.path), lockfile.content);
    }
    const report = await scanToolProjects(sandbox.path, session.toolConfigurations);
    const today = new Date().toISOString().slice(0, 'YYYY-MM-DD'.length);
    expect(TOOL_ADVISORY_EXCEPTIONS.filter(({ recheck }) => recheck < today)).toStrictEqual([]);
    const accepted = new Set(TOOL_ADVISORY_EXCEPTIONS.map(({ package: name, advisory }) => `${name}/${advisory}`));
    const packages = (report.results ?? []).flatMap(({ source, packages: locked }) =>
        locked.map((lockedPackage) => ({ ...lockedPackage, file: source.path })),
    );
    const advisories = packages.flatMap(({ file, package: locked, vulnerabilities }) =>
        (vulnerabilities ?? []).map((advisory) => ({
            ...advisory,
            file,
            package: locked.name,
            version: locked.version,
        })),
    );
    const unexpected = advisories.filter(({ package: name, id, aliases }) =>
        [id, ...(aliases ?? [])].every((advisory) => !accepted.has(`${name}/${advisory}`)),
    );
    expect(unexpected).toStrictEqual([]);
});
