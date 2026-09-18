import { tester } from '#plugin-tests/harness/tester.ts';
import { plantedRoot } from '#plugin-tests/harness/planted.ts';
import { testsDirectoryContents } from '#plugin/rules/tests-directory-contents.ts';

const root = await plantedRoot({
    'tests/unit/a.test.ts': '',
    'tests/unit/builders.ts': '',
    'tests/unit/b.d.ts': '',
    'tests/harness/factory.ts': '',
    'tests/only/one.ts': '',
    'src/a.ts': '',
});

tester(root).run('tests-directory-contents', testsDirectoryContents, {
    valid: [
        { code: '', filename: `${root}/tests/unit/a.test.ts` },
        { code: '', filename: `${root}/tests/unit/b.d.ts` },
        { code: '', filename: `${root}/tests/harness/factory.ts` },
        { code: '', filename: `${root}/tests/only/one.ts` },
        { code: '', filename: `${root}/src/a.ts` },
    ],
    invalid: [
        {
            code: '',
            filename: `${root}/tests/unit/builders.ts`,
            errors: [{ messageId: 'misplaced', data: { name: 'builders.ts', harness: 'tests/harness' } }],
        },
    ],
});
