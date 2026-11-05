import { expect, test } from 'bun:test';

import { compareText } from '#cli/system/text.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('swift/security reports secrets in logs and plist reads, weak hashes, and open Keychain items', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['swift']),
        'Logging.swift': String.raw`print("Token refreshed")
print("Signed in with \(token)")
logger.info("Signed in with \(password)")
auditLogger.notice("Signed in with \(credentials.token)")
NSLog("Signed in with \(secret)")
os_log("Signed in with %@", token)
os_log("Signed in with %@", log: auditLogger, type: .info, password)
print("Signed in with \(user.name)")
auditLogger.info("Token refreshed")
os_log("Token refreshed")
print(token)
auditLogger.info("Signed in with \(token, privacy: .public)")
auditLogger.info("Signed in with \(token, privacy: .private)")
`,
        'Names.swift': `let access = kSecAttrAccessibleAlways
let hash = Insecure.MD5
let older = Insecure.SHA1.hash(data: input)
CC_MD5(input, length, output)
let background = kSecAttrAccessibleAfterFirstUnlock
let strong = SHA256.hash(data: input)
let key = Bundle.main.infoDictionary?["ApiSecret"]
let other = Bundle.main.object(forInfoDictionaryKey: "PrivateKey")
let name = Bundle.main.object(forInfoDictionaryKey: "CFBundleName")
`,
    });

    const findings = await runSandboxCheck(sandbox.path, 'swift/security');
    expect(
        findings.map(({ file, line, rule }) => `${file}:${String(line)} ${String(rule)}`).toSorted(compareText),
    ).toStrictEqual(
        [
            ...[2, 3, 4, 5, 6, 7, 11, 12].map((line) => `Logging.swift:${String(line)} secret-in-log`),
            'Names.swift:1 keychain-accessible-always',
            'Names.swift:2 weak-hash-algorithm',
            'Names.swift:3 weak-hash-algorithm',
            'Names.swift:4 weak-hash-algorithm',
            'Names.swift:7 secret-in-plist',
            'Names.swift:8 secret-in-plist',
        ].toSorted(compareText),
    );
});

test('swift/security reports each secret that reaches UserDefaults, and only UserDefaults', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['swift']),
        'Preferences.swift': `import Foundation
UserDefaults.standard.set(token, forKey: "accessToken")
UserDefaults.standard.set(3, forKey: "sessionCount")
let preferences = UserDefaults.standard
preferences.set(password, forKey: "password")
let shared = UserDefaults(suiteName: "example")!
shared.set(secret, forKey: "secret")
func save(_ defaults: UserDefaults) {
    defaults.set(token, forKey: "token")
    defaults.set(3, forKey: "sessionCount")
}
var mutable = UserDefaults.standard
mutable.set(credential, forKey: "credential")
let typed: UserDefaults = configuredDefaults()
typed.set(token, forKey: "token")
let other = DictionaryStore()
other.set(token, forKey: "token")
`,
    });

    const findings = await runSandboxCheck(sandbox.path, 'swift/security');
    expect(findings.map(({ line, rule }) => ({ line, rule }))).toStrictEqual(
        [2, 5, 7, 9, 13, 15].map((line) => ({ line, rule: 'secret-in-userdefaults' })),
    );
});
