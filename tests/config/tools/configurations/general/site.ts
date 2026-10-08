import { STATIC_SITE_FILES } from '#tests/config/samples/site.ts';
import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { InstalledScenario } from '#tests/types/harness/repository.ts';

export const COMMAND = ['check', '--only', 'site/svgo', '--json'];

export const REPOSITORY: InstalledScenario = {
    configurations: ['site'],

    files: STATIC_SITE_FILES,
};

export const CASES: FindingCase[] = [
    {
        check: 'site/build',
        files: { 'build.js': "throw new Error('the build is broken');\n" },
        expected: { file: '', rule: 'build', line: 1 },
    },
];
