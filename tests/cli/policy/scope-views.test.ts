// What each scope's view reads from nested tables: the rules an ignore turns off, and the value of each setting.
import { planRun } from '#cli/planning/plan.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { test, expect, setSystemTime } from 'bun:test';
import { parseStrictPolicy } from '#cli/policy/read.ts';
import { knownSettings } from '#cli/policy/settings/known.ts';
import { selectForScope } from '#cli/configurations/select.ts';
import { POLICY } from '#tests/config/cli/policy/scope-views.ts';
import { emitPolicy, parseExpiryDate } from '#cli/policy/file.ts';
import { rootView, scopeView } from '#cli/policy/settings/view.ts';
import type { ScopeSelection } from '#cli/types/policy/settings.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

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
    expect(session.policyFiles.errors).toStrictEqual([]);
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
        return [
            view.limit('file_lines', 'bash'),
            view.options('swift').xcode_scheme,
            view.options('tools.swiftlint').keep_imports,
        ];
    };
    expect(read('')).toStrictEqual([100, '5.0', ['Foundation']]);
    expect(read('api')).toStrictEqual([80, '6.0', ['Foundation', 'UIKit']]);
    expect(read('api/v1')).toStrictEqual([60, '5.0', ['Foundation', 'UIKit', 'SwiftUI']]);
    expect(read('web')).toStrictEqual([100, '5.0', ['Foundation']]);
});

test('a per-scope generic limit overrides a root language limit in the scope view', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'configurations = ["python"]\n[limits.python]\nfile_lines = 300\n[scope."api"]\n[scope."api".limits]\nfile_lines = 100\n',
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
[scope."api"]
configurations = ["nextjs"]
[scope."web"]
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
            scopes.map((check) => [`${check.scope.scope.path}:${check.check.name}`, check.skip?.cause]),
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
    expect(view.options('swift').xcode_scheme).toBe('5.0');
    expect(() => rootView(scopes.filter((selection) => selection.scope.path !== ''))).toThrow(
        'The session has no root scope.',
    );
});

test('ignore expiry uses the UTC date and keeps expired authored policy saved', () => {
    setSystemTime(new Date('2030-05-20T23:59:59.000Z'));
    try {
        const entries = [
            { check: 'dependencies/osv', rule: 'permanent', reason: 'Reviewed upstream.' },
            {
                check: 'dependencies/osv',
                rule: 'past',
                reason: 'Reviewed upstream.',
                until: parseExpiryDate('2030-05-19'),
            },
            {
                check: 'dependencies/osv',
                rule: 'today',
                reason: 'Reviewed upstream.',
                until: parseExpiryDate('2030-05-20'),
            },
            {
                check: 'dependencies/osv',
                rule: 'future',
                reason: 'Reviewed upstream.',
                until: parseExpiryDate('2030-05-21'),
            },
        ] as const;
        const policy = parseStrictPolicy(emitPolicy('', { configurations: [], ignore: entries }));
        const selected = selectForScope(policy, '', configurationManifests());
        const view = scopeView(knownSettings(selected), policy, selected, '');
        expect(view.ignoresFor('dependencies/osv')).toStrictEqual([
            { ...entries[3], paths: [] },
            { ...entries[0], paths: [] },
        ]);
        expect(view.rulesOff('dependencies/osv')).toStrictEqual(['future', 'permanent']);
        expect(policy.ignore).toStrictEqual([entries[3], entries[1], entries[0], entries[2]]);
        setSystemTime(new Date('2030-05-21T00:00:00.000Z'));
        const next = scopeView(knownSettings(selected), policy, selected, '');
        expect(next.rulesOff('dependencies/osv')).toStrictEqual(['permanent']);
        expect(view.rulesOff('dependencies/osv')).toStrictEqual(['future', 'permanent']);
    } finally {
        setSystemTime();
    }
});
