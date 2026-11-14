import type { RuleExplanations } from '#cli/types/tools.ts';
import { COVERAGE_RULE, FAILED_TEST_RULE, SWIFT_SECURITY_RULES } from '#cli/config/configurations/swift.ts';

export const SWIFT_SECURITY_EXPLANATIONS = {
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
    [SWIFT_SECURITY_RULES.sqlInterpolation]: {
        description: 'No SQLite call runs SQL text built by string interpolation.',
        why: 'A value pasted into the SQL text can end the statement and add one of its own.',
        fix: 'Write `?` in the SQL text, and pass each value with a `sqlite3_bind` function.',
        example:
            '`sqlite3_exec(db, "DELETE FROM notes WHERE id = \\(id)", nil, nil, nil)` reports `sql-interpolation`.',
    },
} as const satisfies RuleExplanations;

export const SWIFT_TEST_EXPLANATIONS = {
    [FAILED_TEST_RULE]: {
        description: 'Each Swift test passes.',
        why: 'A failing test shows a behavior that the change broke.',
        fix: 'Fix the code or the test at the reported line.',
        example: 'An `XCTAssertEqual` that fails reports `failed-test` at its line.',
    },
    [COVERAGE_RULE]: {
        description:
            'Each target covers at least `coverage.min_line_percent` of its lines, or the limit of its `[[coverage.swift_target]]` record.',
        why: 'Lines that no test runs can break without a failing test.',
        fix: 'Add tests for the lines that no test runs.',
        example: 'A target at 62 percent with a limit of 70 reports `coverage`.',
    },
} as const satisfies RuleExplanations;
