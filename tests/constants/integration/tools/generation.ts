// The literal values integration/tools/generation reads: names, patterns, limits, and tables.

export const SWIFT_DOCS_SOURCE =
    '/** Parses a fixture value. */\npublic func parsed(_ value: String) -> Int {\n    Int(value) ?? 0\n}\n\n/// The literal /** example */ is documentation syntax.\npublic let example = "/** not documentation */"\n\n/* Ordinary comment with a nested /** comment */ inside. */\n';
export const DEFECT = 'public func parsed(_ value: String) -> Int {\n    Int(value)! + 42\n}\n';
export const CORRECT =
    '/// Parses a fixture value.\npublic func parsed(_ value: String) -> Int {\n    Int(value) ?? 0\n}\n';
export const SCRIPTS = 'eval(code);\nexecSync(`build ${input}`);\n';
export const PLIST =
    '<plist><dict><key>NSAppTransportSecurity</key><dict><key>NSAllowsArbitraryLoads</key><true/></dict></dict></plist>\n';
export const IDS = [
    'ios-keychain-accessible-always',
    'ios-no-secrets-in-userdefaults',
    'ios-no-secrets-in-plist',
    'ios-hardcoded-api-key',
    'ios-hardcoded-url-with-credentials',
    'ios-insecure-http-url',
    'ios-unsafe-pointer-cast',
    'ios-weak-hash-algorithm',
    'ios-no-uiwebview',
    'ios-wkwebview-javascript-enabled',
    'ios-log-sensitive-data',
    'ios-no-ats-exception-in-plist',
    'ios-scripts-no-eval',
    'ios-scripts-no-unquoted-shell-var-in-exec',
];
