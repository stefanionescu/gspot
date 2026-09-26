// Vale runs once for each extension over paths: ten Python files are one route group and one command line (K-176).
import { expect, test } from 'bun:test';
import { routeGroups } from '#cli/checks/prose/grammars.ts';
import { fileBatches } from '#cli/execution/file-batches.ts';
import type { TrackedFile } from '#cli/types/repository/repository.ts';

const file = (path: string): TrackedFile => ({
    path,
    prefix: Buffer.alloc(0),
    nature: 'source',
    tags: ['text'],
    executable: false,
    size: 1,
});

test('ten Python files form one path group and one Vale command line', () => {
    const files = Array.from({ length: 10 }, (_, index) => file(`src/module_${String(index)}.py`));
    const groups = routeGroups(files);
    const python = groups.filter((group) => group.some((route) => route.path.endsWith('.py')));
    expect(python).toHaveLength(1);
    expect(python[0]!.map((route) => route.mode)).toStrictEqual(Array.from({ length: 10 }, () => 'path'));
    const batches = fileBatches(
        python[0]!.map((route) => route.path),
        ['vale', '--config', 'vale.ini', '--output', 'JSON', '--no-exit'],
        'darwin',
    );
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(10);
});

test('a CSS file and a Python file take separate groups, each with its own extension', () => {
    const groups = routeGroups([file('site.css'), file('main.py')]);
    expect(groups.map((group) => group.map((route) => route.path))).toStrictEqual([['site.css'], ['main.py']]);
});
