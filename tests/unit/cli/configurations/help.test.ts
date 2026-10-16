import { test, expect } from 'bun:test';
import { createReadCache } from '#cli/system/files/cache.ts';
import { readManifests } from '#cli/configurations/manifests.ts';

test('shipped check help keeps flags and quoted reasons inside code spans', () => {
    const manifests = [...readManifests(createReadCache(process.cwd())).values()];
    const violations: string[] = [];
    for (const { checks } of manifests) {
        for (const check of checks) {
            const prose = check.help.replaceAll(/`[^`]*`/gu, (code) => ' '.repeat(code.length));
            const quotedReason = [...prose.matchAll(/"[^"]*"|'[^']*'/gu)].some((match) =>
                /--reason\s*$/u.test(check.help.slice(0, match.index).replaceAll('`', '')),
            );
            if (prose.includes('--') || quotedReason) violations.push(check.name);
        }
    }
    expect(violations).toStrictEqual([]);
});
