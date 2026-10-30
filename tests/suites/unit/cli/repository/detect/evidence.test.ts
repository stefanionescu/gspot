import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { createRunCache } from '#cli/system/cache.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { detectConfigurations } from '#cli/repository/detect.ts';
import { readTestRepository } from '#tests/setup/cli/repository.ts';
import { readDependencyFiles } from '#cli/repository/dependencies.ts';
import { CONFIGURATION_EVIDENCE_CASES } from '#tests/config/repository/detect.ts';

test.each(CONFIGURATION_EVIDENCE_CASES)(
    'configuration detection recognizes $name',
    async ({ files, selected, configuration }) => {
        await using sandbox = await testdir(files);
        const repository = await readTestRepository(sandbox.path);
        const dependencyFiles = await readDependencyFiles(createRunCache(sandbox.path), repository.files);
        const found = detectConfigurations(
            { root: sandbox.path, files: repository.files, dependencyFiles },
            readConfigurations(),
        );
        expect(
            found.filter((row) => row.configuration === configuration).map((row) => row.configuration),
        ).toStrictEqual(selected ? [configuration] : []);
    },
);
