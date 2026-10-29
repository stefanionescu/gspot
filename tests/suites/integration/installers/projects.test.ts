import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { parse } from '@decimalturn/toml-patch';
import { UV_TOOL } from '#cli/config/tools/uv.ts';
import { openSession } from '#cli/planning/session.ts';
import { openWriter } from '#cli/repository/writer.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { listMisePins } from '#cli/configurations/tools.ts';
import { generateFiles } from '#cli/generation/generate.ts';
import { runtimePinsSchema } from '#tests/schemas/runner.ts';
import { buildToolInstall } from '#tests/setup/cli/tools.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { writeGeneratedFiles } from '#cli/generation/write.ts';
import { TOOL_PINS_FILE } from '#tests/config/setup/runner.ts';
import { preparePythonLockfile } from '#cli/installers/pypi.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { type NpmToolInstall } from '#cli/types/installers/npm.ts';
import { prepareNpmLockfile } from '#cli/installers/npm/project.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { REPOSITORY_ROOT } from '#tests/setup/runner/run-folder.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { GSPOT_PATHS, GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import { readRegistryEnvironment } from '#cli/installers/npm/registry.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { toolAdvisoryReportSchema } from '#tests/schemas/tool-projects.ts';
import { readToolBinPaths, listExecutablePaths } from '#cli/tools/locate.ts';
import { TOOL_ADVISORY_EXCEPTIONS } from '#tests/config/integration/installers/projects.ts';

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
            join(root, GSPOT_FOLDER),
        ],
        { cwd: root },
    );
    expect([0, 1], scanned.stderr).toContain(scanned.code);
    expect(scanned.stdout.trim(), scanned.stderr).not.toBe('');
    return toolAdvisoryReportSchema.parse(JSON.parse(scanned.stdout) as unknown);
}

test('every shipped npm and Python tool lockfile has only dated accepted advisories', async () => {
    const { bun } = runtimePinsSchema.parse(parse(await readFile(join(REPOSITORY_ROOT, TOOL_PINS_FILE), 'utf8'))).tools;
    await using sandbox = await createGitSandbox({
        'package.json': JSON.stringify({ private: true, packageManager: `bun@${bun}` }),
        'gspot.toml': buildSandboxSettings(readConfigurations().keys().toArray(), { level: 'all' }),
    });
    const session = await openSession(sandbox.path);
    const generated = generateFiles(session);
    using writer = openWriter(sandbox.path);
    await writeGeneratedFiles(session, generated, writer);
    const install = {
        ...buildToolInstall(session, writer),
        registryEnvironment: await readRegistryEnvironment(session.root),
    } as NpmToolInstall;
    const projects = generated.files.filter(
        ({ path }) => path === GSPOT_PATHS.npmProject || path === GSPOT_PATHS.pythonProject,
    );
    expect(projects.map(({ path }) => path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual(
        [GSPOT_PATHS.npmProject, GSPOT_PATHS.pythonProject].toSorted((left, right) => left.localeCompare(right)),
    );
    const [uvPath = UV_TOOL] = listExecutablePaths(session.toolsRoot, UV_TOOL, {
        folders: [],
        miseBinPaths: readToolBinPaths(session),
        timeoutSeconds: session.timeoutSeconds,
    });
    for (const project of projects) {
        const lockfile =
            project.path === GSPOT_PATHS.npmProject
                ? await prepareNpmLockfile(install, project)
                : await preparePythonLockfile(install, project, uvPath);
        await writeFile(join(sandbox.path, lockfile.path), lockfile.next.bytes);
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
