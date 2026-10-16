import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { readRepository } from '#cli/repository/read.ts';
import { buildManifest } from '#tests/setup/builders.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { detectConfigurations } from '#cli/repository/detect.ts';
import type { RuntimeDetectionRow } from '#tests/types/sandbox.ts';
import { readDependencyFiles } from '#cli/repository/dependency-files.ts';
import { JAVASCRIPT_RUNTIMES } from '#cli/config/parsers/dependency-files.ts';

test.each(runtimeDetectionRows())('$name decides runtime detection within its project', async (entry) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': JSON.stringify({ engines: { [entry.runtime]: '>=1' } }),
        'api/package.json': JSON.stringify(entry.package),
        'api/entry.js': entry.source,
        '.gspot/package.json': JSON.stringify('toolProjectManifest' in entry ? entry.toolProjectManifest : {}),
    });
    const repository = await readRepository(createReadCache(sandbox.path), {
        declarations: [],
        scopes: [],
        manifests: readManifests(createReadCache(process.cwd())),
    });
    const dependencyFiles = await readDependencyFiles(createReadCache(sandbox.path), repository.files);
    const manifest = buildManifest('runtime', {
        group: 'general',
        tables: `[configuration]\ntitle = "Runtime"\ndescription = "Detects the runtime declared by this project."\n[detect]\nruntimes = ["${entry.runtime}"]\n`.replace(
            /^\s*\[configuration\][\s\S]*?(?=\n\[|$)/u,
            '',
        ),
    });
    const detected = detectConfigurations(
        sandbox.path,
        repository.files,
        new Map([['runtime', { ...manifest, tools: [] }]]),
        dependencyFiles,
        'api',
    );
    expect(detected.map(({ configuration }) => configuration)).toStrictEqual(entry.detected ? ['runtime'] : []);
});

function runtimeDetectionRows(): RuntimeDetectionRow[] {
    return [
        ...JAVASCRIPT_RUNTIMES.flatMap((runtime) => [
            {
                name: `${runtime} engine`,
                runtime,
                package: { engines: { [runtime]: '>=1' } },
                source: '',
                detected: true,
            },
            {
                name: `${runtime} script`,
                runtime,
                package: { scripts: { start: `${runtime} run entry.js` } },
                source: '',
                detected: true,
            },
            {
                name: `${runtime} shebang`,
                runtime,
                package: {},
                source: `#!/usr/bin/env ${runtime}\nconsole.log(1);\n`,
                detected: true,
            },
            {
                name: `${runtime} quoted script text`,
                runtime,
                package: { scripts: { start: `echo "${runtime} entry.js"` } },
                source: '',
                detected: false,
            },
            {
                name: `${runtime} type dependency`,
                runtime,
                package: { devDependencies: { [`@types/${runtime}`]: '1.0.0' } },
                source: '',
                detected: false,
            },
            {
                name: `${runtime} tool-project manifest`,
                runtime,
                package: {},
                source: '',
                toolProjectManifest: { engines: { [runtime]: '>=1' } },
                detected: false,
            },
        ]),
        {
            name: 'JavaScript without a declared runtime',
            runtime: 'node',
            package: {},
            source: 'console.log(1);\n',
            detected: false,
        },
    ];
}
