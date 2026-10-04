import { stringify } from 'smol-toml';
import { test, expect, setSystemTime } from 'bun:test';
import { parseStrictPolicy } from '#cli/policy/read.ts';
import { scopeView } from '#cli/policy/settings/view.ts';
import { knownSettings } from '#cli/policy/settings/known.ts';

test('ignore expiry uses the UTC date and keeps expired authored policy saved', () => {
    setSystemTime(new Date('2030-05-20T23:59:59.000Z'));
    try {
        const entries = [
            { check: 'dependencies/osv', rule: 'permanent', reason: 'Reviewed upstream.' },
            { check: 'dependencies/osv', rule: 'past', until: '2030-05-19' },
            { check: 'dependencies/osv', rule: 'today', until: '2030-05-20' },
            { check: 'dependencies/osv', rule: 'future', until: '2030-05-21' },
        ] as const;
        const policy = parseStrictPolicy(stringify({ configurations: [], ignore: entries }));
        const view = scopeView(knownSettings([]), policy, [], '');
        expect(view.ignoresFor('dependencies/osv')).toStrictEqual([entries[0], entries[3]]);
        expect(view.rulesOff('dependencies/osv')).toStrictEqual(['permanent', 'future']);
        expect(policy.ignores).toStrictEqual([...entries]);
        setSystemTime(new Date('2030-05-21T00:00:00.000Z'));
        const next = scopeView(knownSettings([]), policy, [], '');
        expect(next.rulesOff('dependencies/osv')).toStrictEqual(['permanent']);
        expect(view.rulesOff('dependencies/osv')).toStrictEqual(['permanent', 'future']);
    } finally {
        setSystemTime();
    }
});
