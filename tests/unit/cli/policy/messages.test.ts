import { expect, test } from 'bun:test';
import * as messages from '#cli/policy/messages.ts';
import { INTERNAL_WORDS } from '#tests/constants/unit/cli/policy.ts';

const cases = {
    fileMissing: () => messages.fileMissing('gspot.toml'),
    tomlSyntax: () => messages.tomlSyntax('gspot.toml', 'Expected a value'),
    unknownKey: () => messages.unknownKey('tools.example', 'unknown', ['rules']),
    refusedReason: () => messages.refusedReason('example/check', ''),
    missingReason: () => messages.missingReason('example/check', 'gspot ignore example/check'),
    unknownConfiguration: () => messages.unknownConfiguration('example', ['python']),
    withoutRequired: () => messages.withoutRequired('typescript', ['react', 'typescript']),
    configurationNotListed: () => messages.configurationNotListed('python', 'api'),
    dirtyTree: () => messages.dirtyTree(2),
    circularRequires: () => messages.circularRequires(['first', 'second', 'first']),
    scopeMissing: () => messages.scopeMissing('api'),
    settingNotExposed: () => messages.settingNotExposed('tools.shellcheck.severity', ['tools.shellcheck.rules']),
    ruleOffRefused: () => messages.ruleOffRefused('python/lint', 'F401'),
    extraCoversSlot: () => messages.extraCoversSlot('ruff', 'rules'),
    extraNeedsReason: () => messages.extraNeedsReason('ruff'),
    conflictingScalars: () => messages.conflictingScalars('tools.sqlfluff.dialect', 'sql', 'postgres'),
    loosenNeedsReason: () =>
        messages.loosenNeedsReason('limits.file_lines', '500', '300', 'gspot set limits.file_lines 500'),
    groupNotRemovable: () => messages.groupNotRemovable('example'),
    versionMismatch: () => messages.versionMismatch('1.0.0', '2.0.0'),
    unknownCheck: () => messages.unknownCheck('python/example', ['python/lint']),
    versionUnsupported: () => messages.versionUnsupported(2),
    checkEntryIncomplete: () => messages.checkEntryIncomplete('example/check', 'command'),
    limitUnknown: () => messages.limitUnknown('example', ['file_lines']),
    settingInScope: () => messages.settingInScope('tools.jest.coverage_lines', 'api'),
    unreadableValue: () => messages.unreadableValue('[unfinished'),
    quotedTable: () => messages.quotedTable('naming.allowed', '{name = "example"}'),
} satisfies Record<keyof typeof messages, () => string>;

test.each(Object.entries(cases))('%s uses configuration vocabulary', (_name, render) => {
    expect(render()).not.toMatch(INTERNAL_WORDS);
});

test('an unknown setting names the setting the reader wrote and where to see every one', () => {
    const text = messages.settingNotExposed('tools.shellcheck.severity', ['tools.shellcheck.rules']);
    expect(text).toContain('No selected configuration has the setting `tools.shellcheck.severity`.');
    expect(text).toContain('`tools.shellcheck.rules`');
    expect(text).toContain('gspot list settings');
});
