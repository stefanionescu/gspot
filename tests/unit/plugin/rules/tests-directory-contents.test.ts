import { tester } from '#tests/support/plugin/tester.ts';
import { plantedRoot } from '#tests/support/plugin/planted.ts';
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

tester(root).run('tests-directory-contents', testsDirectoryContents, {
    valid: [
        { code: '', filename: `${root}/tests/custom/factory.ts`, options: [{ harnessDirectory: 'tests/custom' }] },
        { code: '', filename: `${root}/tests/unit/a.test.ts` },
        { code: '', filename: `${root}/tests/unit/b.d.ts` },
        { code: '', filename: `${root}/tests/support/factory.ts` },
        { code: '', filename: `${root}/tests/only/one.ts` },
        { code: '', filename: `${root}/src/a.ts` },
    ],
    invalid: [
        {
            code: '',
            filename: `${root}/tests/mocks/factory.ts`,
            errors: [{ messageId: 'misplaced', data: { name: 'factory.ts', harness: 'tests/support' } }],
        },
        {
            code: '',
            filename: `${root}/tests/custom/factory.ts`,
            errors: [{ messageId: 'misplaced', data: { name: 'factory.ts', harness: 'tests/support' } }],
        },
        {
            code: '',
            filename: `${root}/tests/unit/builders.ts`,
            errors: [{ messageId: 'misplaced', data: { name: 'builders.ts', harness: 'tests/support' } }],
        },
    ],
});
