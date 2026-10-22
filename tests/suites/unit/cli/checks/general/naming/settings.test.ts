import { test, expect } from 'bun:test';
import { splitParts } from '#cli/checks/general/naming/settings.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildScopeNamingSettings } from '#tests/setup/cli/naming.ts';
import { SCOPE_LIMITS, SWIFT_NAMING_LIMITS } from '#tests/config/checks/general/naming/settings.ts';

test('category limits inherit root and scope language settings while explicit categories take precedence', () => {
    const text = buildSandboxSettings(['naming'], {
        rules: true,
        tables: SWIFT_NAMING_LIMITS,
    });
    for (const { scope, characters, functions, words } of SCOPE_LIMITS) {
        const effective = buildScopeNamingSettings(text, scope);
        expect(effective.limitsFor('swift', 'functions')).toMatchObject({
            maxChars: functions,
            maxWords: words,
        });
        expect(effective.limitsFor('swift', 'variables')).toMatchObject({
            maxChars: characters,
            maxWords: words,
        });
    }
});
test('splitParts splits at case changes, separators and digit runs, and keeps an acronym or number word whole', () => {
    expect(splitParts('HTMLParser')).toStrictEqual(['html', 'parser']);
    expect(splitParts('user_id')).toStrictEqual(['user', 'id']);
    expect(splitParts('parseHttpUrl')).toStrictEqual(['parse', 'http', 'url']);
    expect(splitParts('edge-case.test')).toStrictEqual(['edge', 'case', 'test']);
    expect(splitParts('handlerV2')).toStrictEqual(['handler', 'v', '2']);
    expect(splitParts('user2')).toStrictEqual(['user', '2']);
    expect(splitParts('decodeBase64')).toStrictEqual(['decode', 'base64']);
    expect(splitParts('s3Client')).toStrictEqual(['s3', 'client']);
    expect(splitParts('I18N')).toStrictEqual(['i18n']);
    expect(splitParts('sha256_user')).toStrictEqual(['sha256', 'user']);
});
