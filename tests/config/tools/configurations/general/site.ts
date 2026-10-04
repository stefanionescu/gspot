import { STATIC_SITE_FILES } from '#tests/config/samples/site.ts';
import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { RepositoryScenario } from '#tests/types/harness/repository.ts';

export const COMMAND = ['check', '--only', 'site/svgo', '--json'];

/** Authored inputs and configuration selection for this scenario. */
export const REPOSITORY: RepositoryScenario = {
    configurations: ['site'],
    without: ['spelling', 'naming'],
    files: STATIC_SITE_FILES,
};

/** Defects, expected findings, and explicit corrections. */
export const CASES: FindingCase[] = [
    {
        check: 'site/build',
        files: { 'build.js': "throw new Error('the build is broken');\n" },
        expected: { file: '', rule: 'build', line: 1 },
    },
];
