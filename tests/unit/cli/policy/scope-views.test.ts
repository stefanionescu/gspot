// What each scope's view reads from nested tables: the rules an ignore turns off, and the value of each setting.
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/execution/session.ts';
import type { MergedView } from '#cli/types/policy/policy.ts';

const POLICY = `kits = ["bash", "structure"]
[rules]
install = false
[limits.bash]
file_lines = 100
[tools.bash]
boundary_roots = ["root"]
doc_style = "root"
[[ignore]]
check = "bash/shellcheck"
rule = "SC2086"
paths = ["api/**"]
reason = "The api scripts pass word lists on purpose."
[[scope]]
path = "api"
kits = ["bash"]
[scope.limits.bash]
file_lines = 80
[scope.tools.bash]
boundary_roots = ["api"]
doc_style = "api"
[[scope]]
path = "api/v1"
kits = ["bash"]
[scope.limits.bash]
file_lines = 60
[scope.tools.bash]
boundary_roots = ["api/v1"]
doc_style = "api/v1"
[[scope]]
path = "web"
kits = ["bash"]
`;

// The view of every scope by its path, from a session over the planted policy.
async function views(): Promise<Map<string, MergedView>> {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': POLICY,
        'entry.sh': 'echo root\n',
        'api/entry.sh': 'echo api\n',
        'api/v1/entry.sh': 'echo v1\n',
        'web/entry.sh': 'echo web\n',
    });
    const session = await openSession(sandbox.path);
    return new Map(session.scopes.map((selection) => [selection.scope.path, selection.view]));
}

test('an ignore with a rule and paths turns the rule off in its scope and the scopes below only', async () => {
    const byScope = await views();
    const off = Object.fromEntries([...byScope].map(([path, view]) => [path, view.rulesOff('bash/shellcheck')]));
    expect(off).toStrictEqual({ '': [], api: ['SC2086'], 'api/v1': ['SC2086'], web: [] });
});

test('the deepest scope sets a limit and a scalar setting, and a scope list adds to the lists above it', async () => {
    const byScope = await views();
    const read = (path: string): unknown[] => {
        const view = byScope.get(path)!;
        const bash = view.tool('bash');
        return [view.limit('file_lines', 'bash'), bash['doc_style'], bash['boundary_roots']];
    };
    expect(read('')).toStrictEqual([100, 'root', ['root']]);
    expect(read('api')).toStrictEqual([80, 'api', ['root', 'api']]);
    expect(read('api/v1')).toStrictEqual([60, 'api/v1', ['root', 'api', 'api/v1']]);
    expect(read('web')).toStrictEqual([100, 'root', ['root']]);
});
