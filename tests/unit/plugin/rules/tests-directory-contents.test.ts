import { tester } from '#tests/harness/plugin/tester.ts';
import { plantedRoot } from '#tests/harness/plugin/planted.ts';
import { testsDirectoryContents } from '#plugin/rules/tests-directory-contents.ts';

const root = await plantedRoot({
    'tests/unit/a.test.ts': '',
    'tests/unit/builders.ts': '',
    'tests/unit/b.d.ts': '',
    'tests/support/factory.ts': '',
    'tests/only/one.ts': '',
    'src/a.ts': '',
    'tests/custom/a.test.ts': '',
    'tests/custom/factory.ts': '',
    'tests/mocks/a.test.ts': '',
    'tests/mocks/factory.ts': '',
});

const options: [{ harnessDirectory: string }] = [{ harnessDirectory: 'tests/support' }];

tester(root).run('tests-directory-contents', testsDirectoryContents, {
    valid: [
        { code: '', filename: `${root}/tests/custom/factory.ts`, options: [{ harnessDirectory: 'tests/custom' }] },
        { code: '', filename: `${root}/tests/unit/a.test.ts`, options },
        { code: '', filename: `${root}/tests/unit/b.d.ts`, options },
        { code: '', filename: `${root}/tests/support/factory.ts`, options },
        { code: '', filename: `${root}/tests/only/one.ts`, options },
        { code: '', filename: `${root}/src/a.ts`, options },
        // With no harness named, there is no folder to send a support file to, so the rule reports nothing.
        { code: '', filename: `${root}/tests/unit/builders.ts` },
    ],
    invalid: ['tests/mocks/factory.ts', 'tests/custom/factory.ts', 'tests/unit/builders.ts'].map((path) => ({
        code: '',
        filename: `${root}/${path}`,
        options,
        errors: [
            { messageId: 'misplaced' as const, data: { name: path.split('/').at(-1)!, harness: 'tests/support' } },
        ],
    })),
});
