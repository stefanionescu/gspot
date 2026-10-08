export const SENSITIVE_FILES = {
    'package.json': '{"private":true,"dependencies":{"jsonwebtoken":"9.0.2"}}',
    'javascript.js': `console.info(process.env.API_TOKEN);
auditLogger.warn(process.env.API_SECRET);
this.logger.error(process.env.PASSWORD);
applicationLog.trace(process.env.CREDENTIAL);
console.info(process.env.PORT);
storage.write(process.env.API_TOKEN);
logger.info("Token refreshed");
jwt.verify(token, key);
jwt.verify(token, key, { algorithms: ["RS256"] });
`,
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
};

export const SENSITIVE_FINDINGS = [
    {
        file: 'Logging.swift',
        line: 2,
        rule: 'gspot.swift.log-sensitive-data',
    },
    {
        file: 'Logging.swift',
        line: 3,
        rule: 'gspot.swift.log-sensitive-data',
    },
    {
        file: 'Logging.swift',
        line: 4,
        rule: 'gspot.swift.log-sensitive-data',
    },
    {
        file: 'Logging.swift',
        line: 5,
        rule: 'gspot.swift.log-sensitive-data',
    },
    {
        file: 'Logging.swift',
        line: 6,
        rule: 'gspot.swift.log-sensitive-data',
    },
    {
        file: 'Logging.swift',
        line: 7,
        rule: 'gspot.swift.log-sensitive-data',
    },
    {
        file: 'Logging.swift',
        line: 11,
        rule: 'gspot.swift.log-sensitive-data',
    },
    {
        file: 'Logging.swift',
        line: 12,
        rule: 'gspot.swift.log-sensitive-data',
    },
    {
        file: 'Preferences.swift',
        line: 2,
        rule: 'gspot.swift.no-secrets-in-userdefaults',
    },
    {
        file: 'Preferences.swift',
        line: 5,
        rule: 'gspot.swift.no-secrets-in-userdefaults',
    },
    {
        file: 'Preferences.swift',
        line: 7,
        rule: 'gspot.swift.no-secrets-in-userdefaults',
    },
    {
        file: 'Preferences.swift',
        line: 9,
        rule: 'gspot.swift.no-secrets-in-userdefaults',
    },
    {
        file: 'Preferences.swift',
        line: 13,
        rule: 'gspot.swift.no-secrets-in-userdefaults',
    },
    {
        file: 'Preferences.swift',
        line: 15,
        rule: 'gspot.swift.no-secrets-in-userdefaults',
    },
    {
        file: 'javascript.js',
        line: 1,
        rule: 'gspot.javascript.no-secret-in-log',
    },
    {
        file: 'javascript.js',
        line: 2,
        rule: 'gspot.javascript.no-secret-in-log',
    },
    {
        file: 'javascript.js',
        line: 3,
        rule: 'gspot.javascript.no-secret-in-log',
    },
    {
        file: 'javascript.js',
        line: 4,
        rule: 'gspot.javascript.no-secret-in-log',
    },
    {
        file: 'javascript.js',
        line: 8,
        rule: 'gspot.javascript.jwt-no-algorithm-none',
    },
];

export const SENSITIVE_CORRECTIONS = {
    'javascript.js': `console.info("[redacted]");
auditLogger.warn("[redacted]");
this.logger.error("[redacted]");
applicationLog.trace("[redacted]");
console.info(process.env.PORT);
storage.write(process.env.API_TOKEN);
logger.info("Token refreshed");
jwt.verify(token, key, { algorithms: ["RS256"] });
jwt.verify(token, key, { algorithms: ["RS256"] });
`,
    'Logging.swift': String.raw`print("Token refreshed")
print("Signed in with [redacted]")
logger.info("Signed in with [redacted]")
auditLogger.notice("Signed in with [redacted]")
NSLog("Signed in with [redacted]")
os_log("Signed in with %@", "[redacted]")
os_log("Signed in with %@", log: auditLogger, type: .info, "[redacted]")
print("Signed in with \(user.name)")
auditLogger.info("Token refreshed")
os_log("Token refreshed")
print("[redacted]")
auditLogger.info("Signed in with [redacted]")
auditLogger.info("Signed in with \(token, privacy: .private)")
`,
    'Preferences.swift': `import Foundation
keychain.store(token, forKey: "accessToken")
UserDefaults.standard.set(3, forKey: "sessionCount")
let preferences = UserDefaults.standard
keychain.store(password, forKey: "password")
let shared = UserDefaults(suiteName: "example")!
keychain.store(secret, forKey: "secret")
func save(_ defaults: UserDefaults) {
    keychain.store(token, forKey: "token")
    defaults.set(3, forKey: "sessionCount")
}
var mutable = UserDefaults.standard
keychain.store(credential, forKey: "credential")
let typed: UserDefaults = configuredDefaults()
keychain.store(token, forKey: "token")
let other = DictionaryStore()
other.set(token, forKey: "token")
`,
};
