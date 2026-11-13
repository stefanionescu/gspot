import { noUnsafeSanitizerBypass } from '#eslint-plugin/rules/web/no-unsafe-sanitizer-bypass.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-unsafe-sanitizer-bypass', noUnsafeSanitizerBypass, {
    valid: [
        'sanitizer.bypassSecurityTrustStyle(`color: blue`);',
        'const text = "Trusted"; const value = text; sanitizer.bypassSecurityTrustHtml(value);',
        'const options = { text: "Trusted" }; const settings = { ...options }; sanitizer.bypassSecurityTrustHtml(settings.text);',
        'const options = { text: "Trusted" } as const; sanitizer.bypassSecurityTrustHtml(options.text);',
        'sanitizer.sanitize(dynamic);',
        'sanitizer.bypassSecurityTrustHtml();',
    ],
    invalid: [
        'sanitizer.bypassSecurityTrustHtml(`Trusted ${dynamic}`);',
        'let text = "Trusted"; text = dynamic; sanitizer.bypassSecurityTrustHtml(text);',
        'const options = { text: dynamic }; sanitizer.bypassSecurityTrustHtml(options.text);',
        'const options = { text: options.text }; sanitizer.bypassSecurityTrustHtml(options.text);',
        'const options = { ...options }; sanitizer.bypassSecurityTrustHtml(options.text);',
    ].map((code) => ({ code, errors: [{ messageId: 'bypass' as const }] })),
});
