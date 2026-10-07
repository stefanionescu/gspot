// What each scope's view reads from nested tables: the rules an ignore turns off, and the value of each setting.
import { test, expect } from 'bun:test';
import { planRun } from '#cli/planning/plan.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { rootView } from '#cli/policy/settings/view.ts';
import { POLICY } from '#tests/config/cli/policy/scope-views.ts';
import type { ScopeSelection } from '#cli/types/policy/settings.ts';

// The validated selections of a repository with inherited and overridden scope policy.
async function readScopeViews(): Promise<ScopeSelection[]> {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': POLICY,
        'entry.sh': 'echo root\n',
        'api/entry.sh': 'echo api\n',
        'api/v1/entry.sh': 'echo v1\n',
        'web/entry.sh': 'echo web\n',
    });
    const session = await openSession(sandbox.path);
    expect(session.policyFiles.problems).toStrictEqual([]);
    return session.scopes;
}

test('an ignore with a rule and paths turns the rule off in its scope and the scopes below only', async () => {
    const selections = await readScopeViews();
    const byScope = new Map(selections.map((selection) => [selection.scope.path, selection.view]));
    const off = Object.fromEntries([...byScope].map(([path, view]) => [path, view.rulesOff('bash/shellcheck')]));
    expect(off).toStrictEqual({ '': [], api: ['SC2086'], 'api/v1': ['SC2086'], web: [] });
});

test('the deepest scope sets a limit and a scalar setting, and a scope list adds to the lists above it', async () => {
    const selections = await readScopeViews();
    const byScope = new Map(selections.map((selection) => [selection.scope.path, selection.view]));
    const read = (path: string): unknown[] => {
        const view = byScope.get(path)!;
        const bash = view.options('bash');
        return [view.limit('file_lines', 'bash'), bash['doc_style'], bash['boundary_roots']];
    };
    expect(read('')).toStrictEqual([100, 'colon', ['root']]);
    expect(read('api')).toStrictEqual([80, 'dash', ['root', 'api']]);
    expect(read('api/v1')).toStrictEqual([60, 'colon', ['root', 'api', 'api/v1']]);
    expect(read('web')).toStrictEqual([100, 'colon', ['root']]);
});

test('a scoped generic limit overrides a root language limit in both explanations and checks', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'configurations = ["python"]\n[limits.python]\nfile_lines = 300\n[[scope]]\npath = "api"\n[scope.limits]\nfile_lines = 100\n',
        'api/source.py': 'value = 1\n',
    });
    const session = await openSession(sandbox.path);
    const scope = session.scopes.find((selection) => selection.scope.path === 'api')!;
    expect(scope.view.limit('file_lines', 'python')).toBe(100);
});

test.each([
    { paths: ['api/**'], ignored: true },
    { paths: ['api'], ignored: true },
    { paths: ['api/**', '!api/app/**'], ignored: false },
])(
    'a complete scope ignore keeps the compiler fallback and leaves other scopes active: %j',
    async ({ paths, ignored }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `configurations = ["typescript"]
[[scope]]
path = "api"
configurations = ["nextjs"]
[[scope]]
path = "web"
configurations = ["nextjs"]
[[ignore]]
check = "nextjs/tsc"
paths = ${JSON.stringify(paths)}
reason = "The API check is provided by its own native build pipeline."
`,
            'api/app/page.tsx': 'export default function Page() { return null; }',
            'web/app/page.tsx': 'export default function Page() { return null; }',
        });
        const session = await openSession(sandbox.path);
        const planned = planRun(session, { stage: 'all', skips: [], only: ['nextjs/tsc', 'typescript/tsc'] });
        const scopes = planned.filter((check) => ['api', 'web'].includes(check.scope.scope.path));
        const outcomes = new Map(
            scopes.map((check) => [`${check.scope.scope.path}:${check.spec.name}`, check.skip?.cause]),
        );
        expect(outcomes).toStrictEqual(
            new Map([
                ['api:nextjs/tsc', ignored ? 'ignore' : undefined],
                ['api:typescript/tsc', ignored ? undefined : 'replaced'],
                ['web:nextjs/tsc', undefined],
                ['web:typescript/tsc', 'replaced'],
            ]),
        );
    },
);

test('the root view follows its path despite scope order and refuses a selection without the root', async () => {
    const scopes = await readScopeViews();
    const view = rootView(scopes.toReversed());
    expect(view.options('bash')['doc_style']).toBe('colon');
    expect(() => rootView(scopes.filter((selection) => selection.scope.path !== ''))).toThrow(
        'The session has no root scope.',
    );
});
