import { test, expect } from 'bun:test';
import { parseSettings } from '#cli/settings/read.ts';
import { REASON } from '#tests/config/settings/errors.ts';
import { selectForScope } from '#cli/repository/coverage.ts';
import { scopeView, knownSettings } from '#cli/settings/view.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

test('a tool option named reason is passed on and is not a gspot reason', () => {
    const settings = parseSettings(
        `configurations = ["javascript"]\n[tools.prettier]\nextra = { value = { reason = false }, reason = "${REASON}" }\n`,
    );
    const selected = selectForScope(settings, '', configurationManifests());
    expect(scopeView(knownSettings(selected), settings, selected, '').extra('prettier')).toStrictEqual({
        reason: false,
    });
});

test('a record without a reason is refused at its reason field', () => {
    const text = 'configurations = ["bash"]\n[[ignore]]\ncheck = "bash/shellcheck"\n';
    expect(() => parseSettings(text)).toThrow('ignore.0.reason:');
    expect(() => parseSettings(text + `reason = "${REASON}"\n`)).not.toThrow();
});

test('an extra tool options table needs a reason', () => {
    expect(() =>
        parseSettings('configurations = ["javascript"]\n[tools.prettier]\nextra = { useTabs = false }\n'),
    ).toThrow('extra');
});

test.each(['', 'because', 'Codex'])('a word with the reason %s is refused', (reason) => {
    expect(() =>
        parseSettings(
            `configurations = ["prose"]\nallowed_words = { value = ["Codex"], reason = ${JSON.stringify(reason)} }\n`,
        ),
    ).toThrow('reason');
});
