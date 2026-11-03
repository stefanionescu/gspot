import type { LintRuleDocs } from '#cli/types/tools.ts';
import { SWIFT_SECURITY_RULES } from '#cli/config/configurations/swift.ts';
import { COVERAGE_RULE, FAILED_TEST_RULE } from '#cli/config/configurations/builds.ts';
import { PYTHON_RULES, PIP_INSTALL_MESSAGE } from '#cli/config/configurations/python.ts';
import type { COMPILER_OPTIONS, NESTJS_COMPILER_OPTIONS } from '#cli/config/configurations/registry.ts';

import {
    HTML_RULES,
    MISSING_TSCONFIG_RULE,
    UNREADABLE_TSCONFIG_RULE,
    type STRICT_FAMILY_OPTIONS,
} from '#cli/config/configurations/language.ts';

export const HTML_RULE_DOCS = {
    [HTML_RULES.inlineScript]: {
        description: 'No `<script>` element holds executable code inline.',
        why: 'A Content Security Policy without `unsafe-inline` blocks inline code, and a script file can be cached and checked.',
        fix: 'Put the code in a `.js` file, and load it with `<script src="...">`.',
        example: '`<script>start();</script>` reports `inline-script`; `<script src="/start.js"></script>` does not.',
    },
    [HTML_RULES.handlerAttribute]: {
        description: 'No element has an event handler attribute, such as `onclick`.',
        why: 'A handler attribute is inline script, which a strict Content Security Policy blocks.',
        fix: 'Call `addEventListener` in a script file, and remove the attribute.',
        example: '`<button onclick="save()">` reports `handler-attribute`.',
    },
    [HTML_RULES.scriptLink]: {
        description: 'No URL attribute runs code through a `javascript:` URL or a `data:` URL of a script or a page.',
        why: 'The URL runs code that a Content Security Policy and a reviewer cannot see as a file.',
        fix: 'Load the code from a script file, and link to a real page.',
        example: '`<a href="javascript:save()">` reports `script-link`.',
    },
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const PIP_INSTALL_RULE_DOCS = {
    [PYTHON_RULES.requirementsFile]: {
        description: 'The scope keeps no requirements file by hand beside its lockfile.',
        why: 'A second list of dependencies drifts from `pyproject.toml` and the lockfile.',
        fix: 'Generate the file from the lockfile and mark it generated in `.gitattributes`, or delete it.',
        example: 'A hand-written `requirements.txt` beside `uv.lock` reports `requirements-file`.',
    },
    [PYTHON_RULES.pipInstall]: {
        description: 'No shell script, YAML or TOML file, or Dockerfile installs a package with `pip install`.',
        why: 'A package that `pip install` adds is missing from `pyproject.toml` and the lockfile.',
        fix: PIP_INSTALL_MESSAGE,
        example: '`pip install requests` in `scripts/setup.sh` reports `pip-install`.',
    },
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const VULTURE_RULE_DOCS = {
    [PYTHON_RULES.unreachableCode]: {
        description: 'No code follows a `return`, `raise`, `break`, or `continue` in the same block.',
        why: 'Code that never runs misleads the reader about what the function does.',
        fix: 'Remove the lines after that statement, or move them before it.',
        example: 'A line after `return result` in the same block reports `unreachable-code`.',
    },
    'unused-attribute': {
        description: 'Code reads each attribute that it sets.',
        why: 'An attribute that nothing reads is dead code that a reader still has to understand.',
        fix: 'Delete the attribute. When code reads it by name, ignore the finding with a reason.',
        example: '`self.retries = 3`, which nothing reads, reports `unused-attribute`.',
    },
    'unused-class': {
        description: 'Code uses each class that it defines.',
        why: 'A class that nothing uses is dead code that a reader still has to understand.',
        fix: 'Delete the class. When code loads it by name, ignore the finding with a reason.',
        example: 'A `LegacyExporter` class that no module imports reports `unused-class`.',
    },
    'unused-function': {
        description: 'Code calls each function that it defines.',
        why: 'A function that nothing calls is dead code that a reader still has to understand.',
        fix: 'Delete the function. When code calls it by name, ignore the finding with a reason.',
        example: 'A `format_legacy_date()` that no module calls reports `unused-function`.',
    },
    'unused-method': {
        description: 'Code calls each method that a class defines.',
        why: 'A method that nothing calls is dead code that a reader still has to understand.',
        fix: 'Delete the method. When code calls it by name, ignore the finding with a reason.',
        example: 'A `Report.to_xml()` that nothing calls reports `unused-method`.',
    },
    'unused-property': {
        description: 'Code reads each property that a class defines.',
        why: 'A property that nothing reads is dead code that a reader still has to understand.',
        fix: 'Delete the property. When code reads it by name, ignore the finding with a reason.',
        example: 'A `@property def legacy_id(self)` that nothing reads reports `unused-property`.',
    },
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const SWIFT_SECURITY_RULE_DOCS = {
    [SWIFT_SECURITY_RULES.keychain]: {
        description: 'No Keychain item uses `kSecAttrAccessibleAlways`.',
        why: 'Anyone with the device can then read the item, even while it is locked.',
        fix: 'Use `kSecAttrAccessibleWhenUnlocked`, or a stricter class that fits the item.',
        example: '`kSecAttrAccessibleAlways` in the query of a Keychain item reports `keychain-accessible-always`.',
    },
    [SWIFT_SECURITY_RULES.weakHash]: {
        description: 'No code hashes with MD5 or SHA-1.',
        why: 'Attackers can make two inputs with the same MD5 or SHA-1 hash.',
        fix: 'Switch to `SHA256` or `SHA512` of CryptoKit.',
        example: '`Insecure.MD5.hash(data: payload)` reports `weak-hash-algorithm`.',
    },
    [SWIFT_SECURITY_RULES.log]: {
        description: 'No log call writes a token, password, secret, or credential in public.',
        why: 'Logs reach crash reports, consoles, and support tools that many people can read.',
        fix: 'Leave the value out of the log, or mark it with `privacy: .private`.',
        example: '`print("token: \\(authToken)")` reports `secret-in-log`.',
    },
    [SWIFT_SECURITY_RULES.defaults]: {
        description: 'No code stores a token, password, secret, or credential in `UserDefaults`.',
        why: 'Any process that reads the preferences file of the app sees the value in plain text.',
        fix: 'Save the value with the Keychain Services API.',
        example: '`UserDefaults.standard.set(token, forKey: "authToken")` reports `secret-in-userdefaults`.',
    },
    [SWIFT_SECURITY_RULES.plist]: {
        description: 'No code reads a secret, password, or private key from `Info.plist`.',
        why: 'Anyone who downloads the app can open its `Info.plist` and read the value.',
        fix: 'Fetch the secret at run time, and keep it in the Keychain.',
        example: '`Bundle.main.object(forInfoDictionaryKey: "ApiSecret")` reports `secret-in-plist`.',
    },
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const SWIFT_TEST_RULE_DOCS = {
    [FAILED_TEST_RULE]: {
        description: 'Each Swift test passes.',
        why: 'A failing test shows a behavior that the change broke.',
        fix: 'Fix the code or the test at the reported line, then run the tests again.',
        example: 'An `XCTAssertEqual` that fails reports `failed-test` at its line.',
    },
    [COVERAGE_RULE]: {
        description:
            'Each target covers at least `coverage.min_line_percent` of its lines, or the limit of its `[[coverage.swift_target]]` record.',
        why: 'Lines that no test runs can break without a failing test.',
        fix: 'Add tests for the lines that no test runs.',
        example: 'A target at 62 percent with a limit of 70 reports `coverage`.',
    },
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const TSCONFIG_RULE_DOCS = {
    [MISSING_TSCONFIG_RULE]: {
        description: 'A scope with TypeScript files has a `tsconfig.json`.',
        why: 'Without one, the type checks and the typed lint rules have no project to read.',
        fix: 'Create `tsconfig.json` in the scope folder; it can extend a shared tsconfig.',
        example: 'A scope with `src/index.ts` and no `tsconfig.json` reports `missing`.',
    },
    [UNREADABLE_TSCONFIG_RULE]: {
        description: 'Each tsconfig of the scope loads, with every config that it extends.',
        why: 'The type checks and the typed lint rules skip a project whose tsconfig fails to load.',
        fix: 'Install the package that the tsconfig extends, or correct the file. For a template that nobody installs, ignore its path with a reason.',
        example:
            'A tsconfig that extends `@tsconfig/svelte/tsconfig.json` while that package is not installed reports `unreadable`.',
    },
    strict: {
        description: '`strict` is on.',
        why: 'It turns on the strict family of type checks, such as `strictNullChecks`.',
        fix: 'Set `"strict": true` under `compilerOptions`.',
        example: 'A tsconfig without `"strict": true` reports `strict`.',
    },
    noUncheckedIndexedAccess: {
        description: 'At level `all`, `noUncheckedIndexedAccess` is on.',
        why: 'Without it, an index read has the element type even when the element is missing.',
        fix: 'Set `"noUncheckedIndexedAccess": true` under `compilerOptions`.',
        example: 'With the option on, `names[0]` has the type `string | undefined`.',
    },
    exactOptionalPropertyTypes: {
        description: 'At level `all`, `exactOptionalPropertyTypes` is on.',
        why: 'Without it, an optional property accepts `undefined`, so a missing key and an `undefined` value look alike.',
        fix: 'Set `"exactOptionalPropertyTypes": true` under `compilerOptions`.',
        example: 'With the option on, `{ title?: string }` refuses `{ title: undefined }`.',
    },
    noImplicitOverride: {
        description: 'At level `all`, `noImplicitOverride` is on.',
        why: 'Without it, a rename of a base method leaves the subclass method in place without an error.',
        fix: 'Set `"noImplicitOverride": true` under `compilerOptions`.',
        example: 'With the option on, a subclass method that replaces `render()` needs `override render()`.',
    },
    noFallthroughCasesInSwitch: {
        description: 'At level `all`, `noFallthroughCasesInSwitch` is on.',
        why: 'A `case` that runs into the next one runs code that the reader does not expect.',
        fix: 'Set `"noFallthroughCasesInSwitch": true` under `compilerOptions`.',
        example: 'With the option on, a `case` with statements and no `break` or `return` fails.',
    },
    noImplicitReturns: {
        description: 'At level `all`, `noImplicitReturns` is on.',
        why: 'A function that returns a value on some paths returns `undefined` on the others.',
        fix: 'Set `"noImplicitReturns": true` under `compilerOptions`.',
        example: 'With the option on, a function that returns only inside its `if` fails.',
    },
    noPropertyAccessFromIndexSignature: {
        description: 'At level `all`, `noPropertyAccessFromIndexSignature` is on.',
        why: 'Dot access hides that a key of an index signature can be missing.',
        fix: 'Set `"noPropertyAccessFromIndexSignature": true` under `compilerOptions`.',
        example: 'With the option on, `env: Record<string, string>` needs `env["HOME"]` instead of `env.HOME`.',
    },
    experimentalDecorators: {
        description: 'A NestJS scope turns `experimentalDecorators` on.',
        why: 'NestJS builds its modules and controllers with these decorators.',
        fix: 'Set `"experimentalDecorators": true` under `compilerOptions`.',
        example: 'A NestJS tsconfig without the option reports `experimentalDecorators`.',
    },
    emitDecoratorMetadata: {
        description: 'A NestJS scope turns `emitDecoratorMetadata` on.',
        why: 'NestJS reads the emitted type metadata to inject the dependencies of each class.',
        fix: 'Set `"emitDecoratorMetadata": true` under `compilerOptions`.',
        example: 'A NestJS tsconfig without the option reports `emitDecoratorMetadata`.',
    },
    alwaysStrict: {
        description: '`alwaysStrict` stays on under `strict`.',
        why: 'It parses each file in strict mode, which turns silent mistakes into errors.',
        fix: 'Remove `"alwaysStrict": false` from `compilerOptions`.',
        example: '`"strict": true` with `"alwaysStrict": false` reports `alwaysStrict`.',
    },
    noImplicitAny: {
        description: '`noImplicitAny` stays on under `strict`.',
        why: 'Without it, a value without a type becomes `any`, which skips every type check.',
        fix: 'Remove `"noImplicitAny": false` from `compilerOptions`.',
        example: '`"strict": true` with `"noImplicitAny": false` reports `noImplicitAny`.',
    },
    noImplicitThis: {
        description: '`noImplicitThis` stays on under `strict`.',
        why: 'Without it, a `this` without a type becomes `any`, so a call on the wrong object passes.',
        fix: 'Remove `"noImplicitThis": false` from `compilerOptions`.',
        example: '`"strict": true` with `"noImplicitThis": false` reports `noImplicitThis`.',
    },
    strictBindCallApply: {
        description: '`strictBindCallApply` stays on under `strict`.',
        why: 'Without it, calls through `bind`, `call`, and `apply` skip the argument checks.',
        fix: 'Remove `"strictBindCallApply": false` from `compilerOptions`.',
        example: '`"strict": true` with `"strictBindCallApply": false` reports `strictBindCallApply`.',
    },
    strictBuiltinIteratorReturn: {
        description: '`strictBuiltinIteratorReturn` stays on under `strict`.',
        why: 'Without it, the final result of a built-in iterator has the type `any`.',
        fix: 'Remove `"strictBuiltinIteratorReturn": false` from `compilerOptions`.',
        example: '`"strict": true` with `"strictBuiltinIteratorReturn": false` reports `strictBuiltinIteratorReturn`.',
    },
    strictFunctionTypes: {
        description: '`strictFunctionTypes` stays on under `strict`.',
        why: 'Without it, function parameters compare loosely, so a callback can receive a value that it cannot handle.',
        fix: 'Remove `"strictFunctionTypes": false` from `compilerOptions`.',
        example: '`"strict": true` with `"strictFunctionTypes": false` reports `strictFunctionTypes`.',
    },
    strictNullChecks: {
        description: '`strictNullChecks` stays on under `strict`.',
        why: 'Without it, `null` and `undefined` fit every type, so a missing value reaches code that does not expect it.',
        fix: 'Remove `"strictNullChecks": false` from `compilerOptions`.',
        example: '`"strict": true` with `"strictNullChecks": false` reports `strictNullChecks`.',
    },
    strictPropertyInitialization: {
        description: '`strictPropertyInitialization` stays on under `strict`.',
        why: 'Without it, a class property can stay unset after the constructor.',
        fix: 'Remove `"strictPropertyInitialization": false` from `compilerOptions`.',
        example:
            '`"strict": true` with `"strictPropertyInitialization": false` reports `strictPropertyInitialization`.',
    },
    useUnknownInCatchVariables: {
        description: '`useUnknownInCatchVariables` stays on under `strict`.',
        why: 'Without it, a caught error has the type `any` instead of `unknown`.',
        fix: 'Remove `"useUnknownInCatchVariables": false` from `compilerOptions`.',
        example: '`"strict": true` with `"useUnknownInCatchVariables": false` reports `useUnknownInCatchVariables`.',
    },
} as const satisfies Readonly<
    Record<
        | typeof MISSING_TSCONFIG_RULE
        | typeof UNREADABLE_TSCONFIG_RULE
        | keyof typeof COMPILER_OPTIONS
        | keyof typeof NESTJS_COMPILER_OPTIONS
        | (typeof STRICT_FAMILY_OPTIONS)[number],
        LintRuleDocs
    >
>;
