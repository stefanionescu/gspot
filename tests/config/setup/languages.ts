export const BASH_HEADER = `#!/usr/bin/env bash
#
# Builds the thing.
# Runtime: Bash 4.4+, macOS and Linux.
set -euo pipefail
shopt -s inherit_errexit

`;

export const CLEAN_BASH_SCRIPT = `${BASH_HEADER}# main: runs the script.
main() {
    local name="world"
    local greeting="hello \${name}"
    printf '%s\\n' "\${greeting}"
}

main "$@"
`;

export const BROKEN_IF_SCRIPT = 'if then\n';

export const NESTJS_CONTROLLER = `// The routes that greet.
import { GreetingService } from './greeting.service.js';
import { Get, Param, Controller } from '@nestjs/common';

/**
Answers greeting requests.
*/
@Controller('greetings')
export class GreetingController {
    /**
    Takes the service that builds greetings.

    @param greetings dependency that formats the response
    */
    // eslint-disable-next-line gspot/no-trivial-functions -- reason: NestJS injects the service through this constructor.
    constructor(private readonly greetings: GreetingService) {}

    /**
    Greets the person the route names.

    @param name route text to trim and include in the response
    @returns trimmed visitor text with a hello prefix
    */
    @Get(':name')
    // eslint-disable-next-line gspot/no-trivial-functions -- reason: NestJS routes each request to this method.
    greet(@Param('name') name: string): string {
        return this.greetings.greet(name);
    }
}
`;

export const NESTJS_CONTROLLER_UNSUPPRESSED = NESTJS_CONTROLLER.replaceAll(
    /^ {4}\/\/ eslint-disable-next-line gspot\/no-trivial-functions -- reason: .*\n/gmu,
    '',
);

const STRICT_TYPE_FLAGS = {
    strict: true,
    noFallthroughCasesInSwitch: true,
    noUncheckedIndexedAccess: true,
    noImplicitOverride: true,
    exactOptionalPropertyTypes: true,
    noImplicitReturns: true,
    noPropertyAccessFromIndexSignature: true,
} as const;

export const STRICT_COMPILER_OPTIONS = {
    ...STRICT_TYPE_FLAGS,
    target: 'ES2022',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    types: [],
    skipLibCheck: true,
} as const;

export const NESTJS_SANDBOX = {
    configurations: ['typescript', 'nestjs'],
    json: {
        'tsconfig.json': {
            compilerOptions: { ...STRICT_COMPILER_OPTIONS, experimentalDecorators: true, emitDecoratorMetadata: true },
            include: ['src'],
        },
    },
    files: {
        'src/greeting.service.ts': `// The greetings the service knows.
import { Injectable } from '@nestjs/common';

/**
Builds greetings.
*/
@Injectable()
export class GreetingService {
    /**
    Greets one person.

    @param name route text to trim and include in the response
    @returns trimmed visitor text with a hello prefix
    */
    greet(name: string): string {
        if (name.trim() === '') {
            throw new Error('A greeting requires a name.');
        }
        return \`hello \${name.trim()}\`;
    }
}
`,
        'src/greeting.controller.ts': NESTJS_CONTROLLER_UNSUPPRESSED,
        'src/greeting.module.ts': `// The greeting feature.
import { Module } from '@nestjs/common';
import { GreetingService } from './greeting.service.js';
import { GreetingController } from './greeting.controller.js';

/**
Wires the greeting feature together.
*/
@Module({ controllers: [GreetingController], providers: [GreetingService] })
export class GreetingModule {}
`,
    },
} as const;

export const CONTINUED_TRAP_SOURCE = String.raw`tmp=$(mktemp -d)
trap "\
rm -rf -- \"\$tmp\"; \
false || :" EXIT
`;

const PYTHON_PROJECT_OPTIONS = `requires-python = ">=3.12"
dependencies = []
`;

const PYDOCLINT_GOOGLE = `[tool.pydoclint]
style = "google"
`;

export const PYPROJECT = `[project]
name = "example"
version = "1.0.0"
${PYTHON_PROJECT_OPTIONS}`;

export const GOOGLE_PYPROJECT = `${PYPROJECT}\n${PYDOCLINT_GOOGLE}`;

export const PYVENV_HOME = 'home = /usr/bin\n';

export const SWIFT_PACKAGE_HEADER = '// swift-tools-version: 6.0\nimport PackageDescription\n';

export const SWIFT_LANGUAGE_PACKAGE = `${SWIFT_PACKAGE_HEADER}let package = Package(name: "Example", targets: [.target(name: "Example")])
`;

export const CLEAN_SWIFT = String.raw`import Foundation

/// Builds the greeting for a person.
public func greeting(for name: String) -> String {
    let person = name.trimmingCharacters(in: .whitespacesAndNewlines)
    if person.isEmpty {
        return "hello"
    }
    return "hello \(person)"
}
`;

export const SWIFT_VALUE_SOURCE = 'let value = 1\n';

export const XCTEST_SOURCE = 'import XCTest\n';

export const APP_SCOPE_SETTINGS = `[[scope]]
path = "app"
configurations = ["typescript"]
`;

export const APP_PYPROJECT = '[project]\nname = "app"\nversion = "1.0.0"\n';

export const BUN_SCANNER_SETTINGS = 'dependencies.bun_scanner = "@socketsecurity/bun-security-scanner"\n';

export const STRICT_TSCONFIG_TEXT = JSON.stringify({ compilerOptions: STRICT_TYPE_FLAGS });

export const COMPILER_SOURCE = 'export const value = missing;\n';

export const TERMS_SOURCE = 'export default function Terms() { return null; }\n';

export const EMPTY_DEFAULT_SOURCE = 'export default {};\n';

export const NODE_SCRIPT = '#!/usr/bin/env node\nconsole.log(1);\n';

export const GREETING_SOURCE = 'const greeting="hello";';

export const NATIVE_TARGET_SOURCE = 'T = {isa = PBXNativeTarget;';

export const NAMED_TARGET_SOURCE = 'T = {isa = PBXNativeTarget; name = "App Kit";';

export const UNCLOSED_SEQUENCE = 'invalid: [\n';

export const UNCLOSED_PACKAGES = 'packages: [';
