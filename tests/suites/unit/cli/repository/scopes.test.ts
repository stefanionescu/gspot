import { test, expect } from 'bun:test';
import { listOwnFiles, joinScopeGlob } from '#cli/repository/scopes.ts';

test('joinScopeGlob escapes the glob characters of the scope path', () => {
    expect(joinScopeGlob('app[1]', '**/*.ts')).toBe(String.raw`app\[1\]/**/*.ts`);
    expect(joinScopeGlob('', '**/*.ts')).toBe('**/*.ts');
});

test('listOwnFiles keeps the files whose deepest scope is the named one', () => {
    const files = [{ path: 'root.ts' }, { path: 'app/source.ts' }, { path: 'app/child/source.ts' }];
    const scopes = [{ path: '' }, { path: 'app' }, { path: 'app/child' }];
    expect(listOwnFiles(files, scopes, 'app')).toStrictEqual([{ path: 'app/source.ts' }]);
    expect(listOwnFiles(files, scopes, '')).toStrictEqual([{ path: 'root.ts' }]);
});
