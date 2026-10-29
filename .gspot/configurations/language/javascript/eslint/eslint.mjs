import { root, runtimeMatches } from "./functions.mjs";
import globals from "globals";
import { join } from "node:path";
import eslint from "@eslint/js";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import packageJson from "eslint-plugin-package-json";
import prettierConfig from "eslint-config-prettier";
import gspot from "@gspothq/eslint-plugin";
import importX from "eslint-plugin-import-x";
import jsdoc from "eslint-plugin-jsdoc";
import nodePlugin from "eslint-plugin-n";
import regexp from "eslint-plugin-regexp";
import security from "eslint-plugin-security";
import perfectionist from "eslint-plugin-perfectionist";
import boundaries from "eslint-plugin-boundaries";
import localPlugin0 from "../../../../../packages/eslint-plugin/local/plugin.mjs";
import typescriptBlocks from "../../typescript/eslint.mjs";
import astroBlocks from "../../../framework/astro/eslint.mjs";
import zodBlocks from "../../../library/zod/eslint.mjs";
const runtimeDeclarations = [
    {
        "scope": "",
        "runtime": "node",
        "includes": [
            "**/*"
        ],
        "excludes": [
            "docs/**",
            "packages/cli/**",
            "packages/eslint-plugin/**",
            "tests/**"
        ]
    },
    {
        "scope": "",
        "runtime": "commonjs",
        "includes": [
            "**/*.{cjs,cts}"
        ],
        "excludes": [
            "docs/**",
            "packages/cli/**",
            "packages/eslint-plugin/**",
            "tests/**"
        ]
    },
    {
        "scope": "docs",
        "runtime": "node",
        "includes": [
            "docs/**/*"
        ],
        "excludes": []
    },
    {
        "scope": "docs",
        "runtime": "commonjs",
        "includes": [
            "docs/**/*.{cjs,cts}"
        ],
        "excludes": []
    },
    {
        "scope": "tests",
        "runtime": "node",
        "includes": [
            "tests/**/*"
        ],
        "excludes": []
    },
    {
        "scope": "tests",
        "runtime": "commonjs",
        "includes": [
            "tests/**/*.{cjs,cts}"
        ],
        "excludes": []
    },
    {
        "scope": "packages/cli",
        "runtime": "node",
        "includes": [
            "packages/cli/**/*"
        ],
        "excludes": []
    },
    {
        "scope": "packages/cli",
        "runtime": "commonjs",
        "includes": [
            "packages/cli/**/*.{cjs,cts}"
        ],
        "excludes": []
    },
    {
        "scope": "packages/eslint-plugin",
        "runtime": "node",
        "includes": [
            "packages/eslint-plugin/**/*"
        ],
        "excludes": []
    },
    {
        "scope": "packages/eslint-plugin",
        "runtime": "commonjs",
        "includes": [
            "packages/eslint-plugin/**/*.{cjs,cts}"
        ],
        "excludes": []
    }
];
export default [
    // Files that ESLint skips.
    {
        "ignores": [
            "**/build/**",
            "**/node_modules/**",
            "**/.env",
            "**/.env.*",
            "**/*.log",
            "packages/*/dist/**",
            "packages/cli/grammars/**",
            "docs/dist/**",
            "docs/.astro/**",
            "docs/.wrangler/**",
            "findings/**",
            ".gspot/**",
            "eslint.config.mjs",
            ".markdownlint.jsonc",
            ".editorconfig",
            "prettier.config.mjs",
            ".prettierignore",
            "docs/.markdownlint.jsonc",
            "docs/.stylelintrc.json",
            "packages/cli/.markdownlint.jsonc",
            "packages/eslint-plugin/.markdownlint.jsonc",
            "tests/.markdownlint.jsonc",
            "packages/cli/configurations/**/eslint-presets.json",
            "packages/cli/configurations/**/*-names.json",
            "packages/cli/README.md",
            "packages/cli/LICENSE.md",
            "packages/eslint-plugin/LICENSE.md",
            "docs/worker-configuration.d.ts",
            "docs/cloudflare-env.d.ts",
            "**/bower_components/**",
            "**/.dev.vars",
            "**/.dev.vars.*",
            "**/bun.lock",
            "**/.env*"
        ]
    },
    // javascript: eslint["configs"]["recommended"].rules
    {
        ...eslint["configs"]["recommended"],
        rules: {
            ...eslint["configs"]["recommended"].rules
        },
        files: [
            "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
            "**/*.astro"
        ]
    },
    // javascript: sonarjs["configs"]["recommended"].rules
    {
        ...sonarjs["configs"]["recommended"],
        rules: {
            ...sonarjs["configs"]["recommended"].rules
        },
        files: [
            "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
            "**/*.astro"
        ]
    },
    // javascript: unicorn["configs"]["recommended"].rules
    {
        ...unicorn["configs"]["recommended"],
        rules: {
            ...unicorn["configs"]["recommended"].rules
        },
        files: [
            "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
            "**/*.astro"
        ]
    },
    // javascript: gspot.configs.all.rules
    {
        plugins: {
            "gspot": gspot,
            "import-x": importX,
            "jsdoc": jsdoc,
            "n": nodePlugin,
            "regexp": regexp,
            "security": security,
            "perfectionist": perfectionist,
            "boundaries": boundaries,
            "local": localPlugin0
        },
        linterOptions: {
            reportUnusedDisableDirectives: 'error'
        },
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: globals.es2024
        },
        settings: {
            gspot: {
                root
            },
            'import-x/ignore': [
                "[\\\\/]build[\\\\/]",
                "[\\\\/]node_modules[\\\\/]",
                "[\\\\/]packages[\\\\/]cli[\\\\/]grammars[\\\\/]",
                "[\\\\/]docs[\\\\/]dist[\\\\/]",
                "[\\\\/]docs[\\\\/]\\.astro[\\\\/]",
                "[\\\\/]docs[\\\\/]\\.wrangler[\\\\/]",
                "[\\\\/]findings[\\\\/]",
                "[\\\\/]\\.gspot[\\\\/]",
                "[\\\\/]bower_components[\\\\/]"
            ],
            'boundaries/root-path': root
        },
        rules: {
            ...gspot.configs.all.rules,
            "no-empty-character-class": "off",
            "no-useless-constructor": "error",
            "no-useless-return": "error",
            "no-useless-call": "error",
            "no-useless-rename": "error",
            "no-duplicate-imports": "off",
            "eqeqeq": [
                "error",
                "always"
            ],
            "prefer-const": "error",
            "no-empty": [
                "error",
                {
                    "allowEmptyCatch": false
                }
            ],
            "no-param-reassign": "error",
            "perfectionist/sort-imports": [
                "error",
                {
                    "type": "line-length",
                    "order": "asc",
                    "ignoreCase": false,
                    "groups": [
                        "singleline-import",
                        "multiline-import"
                    ],
                    "fallbackSort": {
                        "type": "alphabetical",
                        "order": "asc"
                    },
                    "newlinesBetween": 1,
                    "newlinesInside": 0,
                    "sortSideEffects": false,
                    "useExperimentalDependencyDetection": false
                }
            ],
            "perfectionist/sort-named-imports": [
                "error",
                {
                    "type": "line-length",
                    "ignoreCase": false
                }
            ],
            "perfectionist/sort-exports": [
                "error",
                {
                    "type": "line-length",
                    "groups": [
                        "singleline-export",
                        "multiline-export"
                    ],
                    "newlinesBetween": 1,
                    "ignoreCase": false
                }
            ],
            "perfectionist/sort-named-exports": [
                "error",
                {
                    "type": "line-length",
                    "ignoreCase": false
                }
            ],
            "sonarjs/assertions-in-tests": "off",
            "sonarjs/async-test-assertions": "off",
            "sonarjs/slow-regex": "off",
            "sonarjs/no-unused-vars": "off",
            "sonarjs/unused-import": "off",
            "sonarjs/no-empty-character-class": "off",
            "sonarjs/no-control-regex": "off",
            "sonarjs/no-useless-catch": "off",
            "sonarjs/no-parameter-reassignment": "off",
            "sonarjs/for-loop-increment-sign": "off",
            "sonarjs/no-hardcoded-passwords": "off",
            "sonarjs/no-hardcoded-secrets": "off",
            "sonarjs/no-empty-test-file": "off",
            "sonarjs/no-collapsible-if": "error",
            "sonarjs/no-nested-switch": "error",
            "sonarjs/prefer-object-literal": "error",
            "sonarjs/no-commented-code": "error",
            "sonarjs/prefer-immediate-return": "error",
            "unicorn/no-lonely-if": "off",
            "unicorn/prevent-abbreviations": "off",
            "unicorn/filename-case": "off",
            "unicorn/no-null": "off",
            "unicorn/no-useless-undefined": "off",
            "unicorn/import-style": "off",
            "unicorn/prefer-export-from": "off",
            "unicorn/prefer-ternary": [
                "error",
                "only-single-line"
            ],
            "unicorn/expiring-todo-comments": [
                "error",
                {
                    "allowWarningComments": false
                }
            ],
            "security/detect-disable-mustache-escape": "error",
            "security/detect-eval-with-expression": "off",
            "security/detect-new-buffer": "off",
            "security/detect-non-literal-regexp": "off",
            "security/detect-non-literal-require": "error",
            "security/detect-pseudoRandomBytes": "error",
            "security/detect-unsafe-regex": "off",
            "security/detect-object-injection": "off",
            "security/detect-non-literal-fs-filename": "off",
            "security/detect-child-process": "error",
            "security/detect-possible-timing-attacks": "error",
            "jsdoc/require-param-name": "error",
            "jsdoc/check-param-names": "error",
            "jsdoc/check-tag-names": "error",
            "jsdoc/no-types": "off",
            "jsdoc/require-jsdoc": [
                "error",
                {
                    "enableFixer": false,
                    "publicOnly": true,
                    "require": {
                        "FunctionDeclaration": true,
                        "ArrowFunctionExpression": true,
                        "FunctionExpression": true,
                        "MethodDefinition": true
                    }
                }
            ],
            "jsdoc/require-description": "error",
            "jsdoc/require-param": [
                "error",
                {
                    "enableFixer": false
                }
            ],
            "jsdoc/match-name": [
                "error",
                {
                    "match": [
                        {
                            "tags": [
                                "param"
                            ],
                            "disallowName": "/^root\\d+$/",
                            "message": "Name the parameter for its role, such as options."
                        }
                    ]
                }
            ],
            "jsdoc/informative-docs": "error",
            "jsdoc/require-param-description": "error",
            "jsdoc/tag-lines": [
                "error",
                "any",
                {
                    "startLines": 1
                }
            ],
            "regexp/no-super-linear-backtracking": "error",
            "regexp/no-empty-alternative": "error",
            "regexp/no-empty-capturing-group": "error",
            "regexp/no-empty-character-class": "error",
            "regexp/no-empty-group": "error",
            "regexp/no-empty-lookarounds-assertion": "error",
            "regexp/no-useless-assertions": "error",
            "regexp/no-useless-backreference": "error",
            "regexp/no-useless-character-class": "error",
            "regexp/no-useless-dollar-replacements": "error",
            "regexp/no-useless-lazy": "error",
            "regexp/no-useless-quantifier": "error",
            "regexp/no-useless-range": "error",
            "regexp/no-lazy-ends": "error",
            "regexp/no-optional-assertion": "error",
            "regexp/no-invalid-regexp": "error",
            "regexp/no-misleading-capturing-group": "error",
            "regexp/no-contradiction-with-assertion": "error",
            "regexp/strict": "error",
            "import-x/export": "error",
            "import-x/no-cycle": [
                "error",
                {
                    "ignoreExternal": false
                }
            ],
            "import-x/no-self-import": "error",
            "import-x/no-useless-path-segments": "error",
            "import-x/no-empty-named-blocks": "error",
            "import-x/no-duplicates": "error",
            "no-restricted-syntax": [
                "error",
                {
                    "selector": ":matches(Program, BlockStatement, StaticBlock) > BlockStatement",
                    "message": "A block that stands alone hides a step. Name the step as a function, or remove the braces."
                },
                {
                    "selector": "TSEnumDeclaration",
                    "message": "Use a literal union or an as-const object instead of an enum."
                },
                {
                    "selector": "TSAsExpression[expression.type=\"TSAsExpression\"]",
                    "message": "Do not assert twice. Narrow the value, fix its type, or check it at run time."
                },
                {
                    "selector": "TSTypeAssertion[expression.type=\"TSTypeAssertion\"]",
                    "message": "Do not assert twice. Narrow the value, fix its type, or check it at run time."
                },
                {
                    "selector": "TSAsExpression > TSAnyKeyword",
                    "message": "Do not assert to any. Give the value a real type, or check it at run time."
                },
                {
                    "selector": "TSTypeAssertion > TSAnyKeyword",
                    "message": "Do not assert to any. Give the value a real type, or check it at run time."
                },
                {
                    "selector": "TSAsExpression > TSNeverKeyword",
                    "message": "Do not assert to never to silence the type system."
                },
                {
                    "selector": "TSTypeAssertion > TSNeverKeyword",
                    "message": "Do not assert to never to silence the type system."
                },
                {
                    "selector": "LogicalExpression[operator=\"||\"][right.type=\"ObjectExpression\"][right.properties.length=0]",
                    "message": "An empty-object fallback hides a missing value. Handle the missing case."
                },
                {
                    "selector": "LogicalExpression[operator=\"??\"][right.type=\"ObjectExpression\"][right.properties.length=0]",
                    "message": "An empty-object fallback hides a missing value. Handle the missing case."
                },
                {
                    "selector": "NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > Literal.arguments:first-child[value=/^[a-z]/]",
                    "message": "Start an error message with a capital letter."
                },
                {
                    "selector": "NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > TemplateLiteral.arguments:first-child[quasis.0.value.raw=/^[a-z]/]",
                    "message": "Start an error message with a capital letter."
                },
                {
                    "selector": "CallExpression:matches([callee.property.name=/^(debug|info|warn|error|fatal|trace)$/], [callee.property.name=\"log\"][callee.object.name!=\"console\"]) > TemplateLiteral.arguments:first-child[expressions.length>0]",
                    "message": "Log a stable message and pass the values as fields."
                }
            ],
            "max-lines": [
                "error",
                {
                    "max": 300,
                    "skipBlankLines": true,
                    "skipComments": true
                }
            ],
            "max-lines-per-function": [
                "error",
                {
                    "max": 60,
                    "skipBlankLines": true,
                    "skipComments": true,
                    "IIFEs": true
                }
            ],
            "max-params": [
                "error",
                {
                    "max": 7,
                    "countVoidThis": false
                }
            ],
            "max-depth": [
                "error",
                3
            ],
            "max-statements": [
                "error",
                30
            ],
            "max-nested-callbacks": [
                "error",
                3
            ],
            "complexity": [
                "error",
                8
            ],
            "sonarjs/cognitive-complexity": [
                "error",
                8
            ],
            "sonarjs/no-identical-functions": [
                "error",
                8
            ],
            "gspot/import-boundaries": [
                gspot.configs.all.rules["gspot/import-boundaries"] ?? 'off',
                {
                    "folders": [
                        "*/*",
                        "docs",
                        "packages/cli",
                        "packages/eslint-plugin",
                        "tests"
                    ],
                    "aliases": {
                        "#cli/*": "packages/cli/src/*",
                        "#cli-configurations/*": "packages/cli/configurations/*",
                        "#tests/*": "tests/*",
                        "#cli-package": "packages/cli/package.json",
                        "#eslint-plugin/*": "packages/eslint-plugin/src/*",
                        "#eslint-plugin-local/*": "packages/eslint-plugin/local/*",
                        "#eslint-plugin-package": "packages/eslint-plugin/package.json",
                        "#root-package": "package.json",
                        "#docs/*": "docs/src/*"
                    }
                }
            ],
            "import-x/first": "error",
            "import-x/newline-after-import": [
                "error",
                {
                    "count": 1,
                    "considerComments": true
                }
            ]
        },
        files: [
            "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
            "**/*.astro"
        ]
    },
    // javascript
    {
        rules: {
            "no-unused-vars": [
                "error",
                {
                    "args": "all",
                    "argsIgnorePattern": "^_",
                    "varsIgnorePattern": "^_",
                    "destructuredArrayIgnorePattern": "^_"
                }
            ],
            "jsdoc/require-param-type": "error",
            "jsdoc/require-returns-type": "error",
            "jsdoc/check-types": "error",
            "jsdoc/no-undefined-types": "error",
            "jsdoc/valid-types": "error"
        },
        files: [
            "**/*.{js,mjs,cjs,jsx}"
        ]
    },
    // javascript
    {
        settings: {
            "n": {
                "tryExtensions": [
                    ".js",
                    ".ts",
                    ".jsx",
                    ".tsx",
                    ".mjs",
                    ".mts",
                    ".cjs",
                    ".cts",
                    ".json",
                    ".node"
                ],
                "typescriptExtensionMap": []
            }
        },
        "ignores": [],
        rules: {
            "n/file-extension-in-import": [
                "error",
                "always"
            ]
        },
        files: [
            [
                "**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ]
        ]
    },
    // javascript
    {
        rules: {
            "gspot/import-boundaries": [
                gspot.configs.all.rules["gspot/import-boundaries"] ?? 'off',
                {
                    "folders": [
                        "*/*",
                        "docs",
                        "packages/cli",
                        "packages/eslint-plugin",
                        "tests"
                    ],
                    "aliases": {
                        "#cli/*": "packages/cli/src/*",
                        "#cli-configurations/*": "packages/cli/configurations/*",
                        "#tests/*": "tests/*",
                        "#cli-package": "packages/cli/package.json",
                        "#eslint-plugin/*": "packages/eslint-plugin/src/*",
                        "#eslint-plugin-local/*": "packages/eslint-plugin/local/*",
                        "#eslint-plugin-package": "packages/eslint-plugin/package.json",
                        "#root-package": "package.json",
                        "#docs/*": "docs/src/*"
                    }
                }
            ]
        },
        files: [
            "docs/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
        ]
    },
    // javascript
    {
        rules: {
            "gspot/import-boundaries": [
                gspot.configs.all.rules["gspot/import-boundaries"] ?? 'off',
                {
                    "folders": [
                        "*/*",
                        "docs",
                        "packages/cli",
                        "packages/eslint-plugin",
                        "tests"
                    ],
                    "aliases": {
                        "#cli/*": "packages/cli/src/*",
                        "#cli-configurations/*": "packages/cli/configurations/*",
                        "#tests/*": "tests/*",
                        "#cli-package": "packages/cli/package.json",
                        "#eslint-plugin/*": "packages/eslint-plugin/src/*",
                        "#eslint-plugin-local/*": "packages/eslint-plugin/local/*",
                        "#eslint-plugin-package": "packages/eslint-plugin/package.json",
                        "#root-package": "package.json",
                        "#docs/*": "docs/src/*"
                    }
                }
            ]
        },
        files: [
            "packages/cli/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
        ]
    },
    // javascript
    {
        rules: {
            "gspot/import-boundaries": [
                gspot.configs.all.rules["gspot/import-boundaries"] ?? 'off',
                {
                    "folders": [
                        "*/*",
                        "docs",
                        "packages/cli",
                        "packages/eslint-plugin",
                        "tests"
                    ],
                    "aliases": {}
                }
            ]
        },
        files: [
            "packages/eslint-plugin/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
        ]
    },
    // javascript
    {
        rules: {
            "gspot/import-boundaries": [
                gspot.configs.all.rules["gspot/import-boundaries"] ?? 'off',
                {
                    "folders": [
                        "*/*",
                        "docs",
                        "packages/cli",
                        "packages/eslint-plugin",
                        "tests"
                    ],
                    "aliases": {}
                }
            ]
        },
        files: [
            "tests/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
        ]
    },
    // javascript
    {
        settings: {
            "n": {
                "tryExtensions": [
                    ".js",
                    ".ts",
                    ".jsx",
                    ".tsx",
                    ".mjs",
                    ".mts",
                    ".cjs",
                    ".cts",
                    ".json",
                    ".node"
                ],
                "typescriptExtensionMap": []
            }
        },
        "ignores": [
            "docs/**",
            "packages/cli/**",
            "packages/eslint-plugin/**",
            "tests/**"
        ],
        rules: {
            "n/file-extension-in-import": [
                "error",
                "always"
            ],
            "gspot/import-boundaries": [
                gspot.configs.all.rules["gspot/import-boundaries"] ?? 'off',
                {
                    "folders": [
                        "*/*",
                        "docs",
                        "packages/cli",
                        "packages/eslint-plugin",
                        "tests"
                    ],
                    "aliases": {}
                }
            ]
        },
        files: [
            "**/*.mjs",
            "**/*.cjs"
        ]
    },
    // javascript
    {
        settings: {
            "n": {
                "tryExtensions": [
                    ".js",
                    ".ts",
                    ".jsx",
                    ".tsx",
                    ".mjs",
                    ".mts",
                    ".cjs",
                    ".cts",
                    ".json",
                    ".node"
                ],
                "typescriptExtensionMap": []
            }
        },
        "ignores": [],
        rules: {
            "n/file-extension-in-import": [
                "error",
                "always"
            ],
            "gspot/import-boundaries": [
                gspot.configs.all.rules["gspot/import-boundaries"] ?? 'off',
                {
                    "folders": [
                        "*/*",
                        "docs",
                        "packages/cli",
                        "packages/eslint-plugin",
                        "tests"
                    ],
                    "aliases": {}
                }
            ]
        },
        files: [
            "docs/**/*.mjs",
            "docs/**/*.cjs"
        ]
    },
    // javascript
    {
        settings: {
            "n": {
                "tryExtensions": [
                    ".js",
                    ".ts",
                    ".jsx",
                    ".tsx",
                    ".mjs",
                    ".mts",
                    ".cjs",
                    ".cts",
                    ".json",
                    ".node"
                ],
                "typescriptExtensionMap": []
            }
        },
        "ignores": [],
        rules: {
            "n/file-extension-in-import": [
                "error",
                "always"
            ],
            "gspot/import-boundaries": [
                gspot.configs.all.rules["gspot/import-boundaries"] ?? 'off',
                {
                    "folders": [
                        "*/*",
                        "docs",
                        "packages/cli",
                        "packages/eslint-plugin",
                        "tests"
                    ],
                    "aliases": {}
                }
            ]
        },
        files: [
            "packages/cli/**/*.mjs",
            "packages/cli/**/*.cjs"
        ]
    },
    // javascript
    {
        settings: {
            "n": {
                "tryExtensions": [
                    ".js",
                    ".ts",
                    ".jsx",
                    ".tsx",
                    ".mjs",
                    ".mts",
                    ".cjs",
                    ".cts",
                    ".json",
                    ".node"
                ],
                "typescriptExtensionMap": []
            }
        },
        "ignores": [],
        rules: {
            "n/file-extension-in-import": [
                "error",
                "always"
            ],
            "gspot/import-boundaries": [
                gspot.configs.all.rules["gspot/import-boundaries"] ?? 'off',
                {
                    "folders": [
                        "*/*",
                        "docs",
                        "packages/cli",
                        "packages/eslint-plugin",
                        "tests"
                    ],
                    "aliases": {}
                }
            ]
        },
        files: [
            "packages/eslint-plugin/**/*.mjs",
            "packages/eslint-plugin/**/*.cjs"
        ]
    },
    // javascript
    {
        settings: {
            "n": {
                "tryExtensions": [
                    ".js",
                    ".ts",
                    ".jsx",
                    ".tsx",
                    ".mjs",
                    ".mts",
                    ".cjs",
                    ".cts",
                    ".json",
                    ".node"
                ],
                "typescriptExtensionMap": []
            }
        },
        "ignores": [],
        rules: {
            "n/file-extension-in-import": [
                "error",
                "always"
            ],
            "gspot/import-boundaries": [
                gspot.configs.all.rules["gspot/import-boundaries"] ?? 'off',
                {
                    "folders": [
                        "*/*",
                        "docs",
                        "packages/cli",
                        "packages/eslint-plugin",
                        "tests"
                    ],
                    "aliases": {}
                }
            ]
        },
        files: [
            "tests/**/*.mjs",
            "tests/**/*.cjs"
        ]
    },
    // javascript
    {
        settings: {
            ...{
                "boundaries/files": [
                    {
                        "category": "tests",
                        "pattern": [
                            "**/test/**",
                            "**/tests/**",
                            "**/__tests__/**",
                            "**/*.test.*",
                            "**/*.spec.*",
                            "**/test_*.py",
                            "**/*_test.py",
                            "**/conftest.py",
                            "**/Tests/**",
                            "**/*Tests.swift",
                            "docs/**/test/**",
                            "docs/**/tests/**",
                            "docs/**/__tests__/**",
                            "docs/**/*.test.*",
                            "docs/**/*.spec.*",
                            "docs/**/test_*.py",
                            "docs/**/*_test.py",
                            "docs/**/conftest.py",
                            "docs/**/Tests/**",
                            "docs/**/*Tests.swift",
                            "packages/cli/**/test/**",
                            "packages/cli/**/tests/**",
                            "packages/cli/**/__tests__/**",
                            "packages/cli/**/*.test.*",
                            "packages/cli/**/*.spec.*",
                            "packages/cli/**/test_*.py",
                            "packages/cli/**/*_test.py",
                            "packages/cli/**/conftest.py",
                            "packages/cli/**/Tests/**",
                            "packages/cli/**/*Tests.swift",
                            "packages/eslint-plugin/**/test/**",
                            "packages/eslint-plugin/**/tests/**",
                            "packages/eslint-plugin/**/__tests__/**",
                            "packages/eslint-plugin/**/*.test.*",
                            "packages/eslint-plugin/**/*.spec.*",
                            "packages/eslint-plugin/**/test_*.py",
                            "packages/eslint-plugin/**/*_test.py",
                            "packages/eslint-plugin/**/conftest.py",
                            "packages/eslint-plugin/**/Tests/**",
                            "packages/eslint-plugin/**/*Tests.swift",
                            "tests/**/test/**",
                            "tests/**/tests/**",
                            "tests/**/__tests__/**",
                            "tests/**/*.test.*",
                            "tests/**/*.spec.*",
                            "tests/**/test_*.py",
                            "tests/**/*_test.py",
                            "tests/**/conftest.py",
                            "tests/**/Tests/**",
                            "tests/**/*Tests.swift"
                        ],
                        "stopMatching": true
                    },
                    {
                        "category": "import-rule:cli-config",
                        "pattern": [
                            "packages/cli/src/config/**"
                        ]
                    },
                    {
                        "category": "import-rule:cli-types",
                        "pattern": [
                            "packages/cli/src/types/**"
                        ]
                    },
                    {
                        "category": "import-rule:system",
                        "pattern": [
                            "packages/cli/src/system/**"
                        ]
                    },
                    {
                        "category": "import-rule:parsers",
                        "pattern": [
                            "packages/cli/src/parsers/**",
                            "packages/cli/src/schemas/parsers/**"
                        ]
                    },
                    {
                        "category": "import-rule:configurations",
                        "pattern": [
                            "packages/cli/src/configurations/**",
                            "packages/cli/src/schemas/configurations/**"
                        ]
                    },
                    {
                        "category": "import-rule:repository",
                        "pattern": [
                            "packages/cli/src/repository/**",
                            "packages/cli/src/schemas/repository/**"
                        ]
                    },
                    {
                        "category": "import-rule:settings",
                        "pattern": [
                            "packages/cli/src/settings/**",
                            "packages/cli/src/schemas/settings/**"
                        ]
                    },
                    {
                        "category": "import-rule:planning",
                        "pattern": [
                            "packages/cli/src/planning/**"
                        ]
                    },
                    {
                        "category": "import-rule:tools",
                        "pattern": [
                            "packages/cli/src/tools/**"
                        ]
                    },
                    {
                        "category": "import-rule:installers",
                        "pattern": [
                            "packages/cli/src/installers/**",
                            "packages/cli/src/schemas/installers/**"
                        ]
                    },
                    {
                        "category": "import-rule:generation",
                        "pattern": [
                            "packages/cli/src/generation/**"
                        ]
                    },
                    {
                        "category": "import-rule:runs",
                        "pattern": [
                            "packages/cli/src/runs/**",
                            "packages/cli/src/schemas/runs/**"
                        ]
                    },
                    {
                        "category": "import-rule:checks",
                        "pattern": [
                            "packages/cli/src/checks/**",
                            "packages/cli/src/schemas/checks/**"
                        ]
                    },
                    {
                        "category": "import-rule:commands",
                        "pattern": [
                            "packages/cli/src/commands/**",
                            "packages/cli/src/schemas/commands.ts"
                        ]
                    },
                    {
                        "category": "import-rule:main",
                        "pattern": [
                            "packages/cli/src/main.ts",
                            "packages/cli/src/bin.ts",
                            "packages/cli/linter-exports.ts",
                            "packages/cli/pin-ages.ts",
                            "packages/cli/src/schemas/linter-exports.ts"
                        ]
                    },
                    {
                        "category": "import-rule:plugin-config",
                        "pattern": [
                            "packages/eslint-plugin/src/config/**"
                        ]
                    },
                    {
                        "category": "import-rule:plugin-types",
                        "pattern": [
                            "packages/eslint-plugin/src/types/**"
                        ]
                    },
                    {
                        "category": "import-rule:plugin",
                        "pattern": [
                            "packages/eslint-plugin/src/*.ts",
                            "packages/eslint-plugin/src/rules/**",
                            "packages/eslint-plugin/plugin.d.ts"
                        ]
                    },
                    {
                        "category": "import-rule:plugin-local",
                        "pattern": [
                            "packages/eslint-plugin/local/**"
                        ]
                    },
                    {
                        "category": "import-rule:docs-config",
                        "pattern": [
                            "docs/src/config/**"
                        ]
                    },
                    {
                        "category": "import-rule:docs-types",
                        "pattern": [
                            "docs/src/types/**"
                        ]
                    },
                    {
                        "category": "import-rule:docs",
                        "pattern": [
                            "docs/src/*.*",
                            "docs/src/!(config|types)/**"
                        ]
                    },
                    {
                        "category": "import-rule:tests-data",
                        "pattern": [
                            "tests/config/**"
                        ]
                    },
                    {
                        "category": "import-rule:tests-types",
                        "pattern": [
                            "tests/types/**"
                        ]
                    },
                    {
                        "category": "import-rule:tests-setup",
                        "pattern": [
                            "tests/setup/**",
                            "tests/schemas/**"
                        ]
                    },
                    {
                        "category": "import-rule:tests",
                        "pattern": [
                            "tests/suites/**"
                        ]
                    },
                    {
                        "category": "import-rule:config-files",
                        "pattern": [
                            "packages/cli/configurations/**/config-files/**"
                        ]
                    },
                    {
                        "category": "other",
                        "pattern": [
                            "**/*"
                        ]
                    }
                ],
                "boundaries/ignore": [],
                "boundaries/elements": [
                    {
                        "type": "other",
                        "pattern": "**",
                        "partialMatch": false
                    }
                ],
                "boundaries/dependency-nodes": [
                    "require",
                    "dynamic-import"
                ],
                "boundaries/additional-dependency-nodes": [
                    {
                        "selector": "ImportDeclaration:not([importKind=type]):matches([specifiers.length=0], :has(ImportSpecifier:not([importKind=type]), ImportDefaultSpecifier, ImportNamespaceSpecifier)) > Literal",
                        "kind": "value",
                        "name": "import"
                    },
                    {
                        "selector": "ImportDeclaration:matches([importKind=type], [specifiers.length>0]:not(:has(ImportSpecifier:not([importKind=type]), ImportDefaultSpecifier, ImportNamespaceSpecifier))) > Literal",
                        "kind": "type",
                        "name": "import"
                    },
                    {
                        "selector": ":matches(ExportAllDeclaration:not([exportKind=type]), ExportNamedDeclaration:not([exportKind=type]):matches([specifiers.length=0], :has(ExportSpecifier:not([exportKind=type])))) > Literal",
                        "kind": "value",
                        "name": "export"
                    },
                    {
                        "selector": ":matches(ExportAllDeclaration[exportKind=type], ExportNamedDeclaration:matches([exportKind=type], [specifiers.length>0]:not(:has(ExportSpecifier:not([exportKind=type]))))) > Literal",
                        "kind": "type",
                        "name": "export"
                    }
                ]
            },
            'import/resolver': {
                typescript: {
                    project: [
                        join(root, "docs/tsconfig.json"), join(root, "packages/cli/tsconfig.json"), join(root, "packages/eslint-plugin/tsconfig.json"), join(root, "tsconfig.json")
                    ]
                }
            }
        },
        rules: {
            "boundaries/dependencies": [
                "error",
                {
                    "default": "disallow",
                    "policies": [
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:cli-config"
                                }
                            },
                            "disallow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            },
                            "message": "Import rule \"cli-config\" may import its own files and \"cli-types\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:cli-config"
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "categories": {
                                            "anyOf": [
                                                "import-rule:cli-config",
                                                "import-rule:cli-types"
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:cli-types"
                                }
                            },
                            "disallow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            },
                            "message": "Import rule \"cli-types\" may import its own files and \"cli-config\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:cli-types"
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "categories": {
                                            "anyOf": [
                                                "import-rule:cli-types",
                                                "import-rule:cli-config"
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:system"
                                }
                            },
                            "disallow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            },
                            "message": "Import rule \"system\" may import its own files and \"cli-config\", \"cli-types\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:system"
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "categories": {
                                            "anyOf": [
                                                "import-rule:system",
                                                "import-rule:cli-config",
                                                "import-rule:cli-types"
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:parsers"
                                }
                            },
                            "disallow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            },
                            "message": "Import rule \"parsers\" may import its own files and \"cli-config\", \"cli-types\", \"system\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:parsers"
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "categories": {
                                            "anyOf": [
                                                "import-rule:parsers",
                                                "import-rule:cli-config",
                                                "import-rule:cli-types",
                                                "import-rule:system"
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:configurations"
                                }
                            },
                            "disallow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            },
                            "message": "Import rule \"configurations\" may import its own files and \"cli-config\", \"cli-types\", \"system\", \"parsers\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:configurations"
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "categories": {
                                            "anyOf": [
                                                "import-rule:configurations",
                                                "import-rule:cli-config",
                                                "import-rule:cli-types",
                                                "import-rule:system",
                                                "import-rule:parsers"
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:repository"
                                }
                            },
                            "disallow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            },
                            "message": "Import rule \"repository\" may import its own files and \"cli-config\", \"cli-types\", \"system\", \"parsers\", \"configurations\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:repository"
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "categories": {
                                            "anyOf": [
                                                "import-rule:repository",
                                                "import-rule:cli-config",
                                                "import-rule:cli-types",
                                                "import-rule:system",
                                                "import-rule:parsers",
                                                "import-rule:configurations"
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:settings"
                                }
                            },
                            "disallow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            },
                            "message": "Import rule \"settings\" may import its own files and \"cli-config\", \"cli-types\", \"system\", \"parsers\", \"configurations\", \"repository\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:settings"
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "categories": {
                                            "anyOf": [
                                                "import-rule:settings",
                                                "import-rule:cli-config",
                                                "import-rule:cli-types",
                                                "import-rule:system",
                                                "import-rule:parsers",
                                                "import-rule:configurations",
                                                "import-rule:repository"
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:planning"
                                }
                            },
                            "disallow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            },
                            "message": "Import rule \"planning\" may import its own files and \"cli-config\", \"cli-types\", \"system\", \"parsers\", \"configurations\", \"repository\", \"settings\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:planning"
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "categories": {
                                            "anyOf": [
                                                "import-rule:planning",
                                                "import-rule:cli-config",
                                                "import-rule:cli-types",
                                                "import-rule:system",
                                                "import-rule:parsers",
                                                "import-rule:configurations",
                                                "import-rule:repository",
                                                "import-rule:settings"
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:tools"
                                }
                            },
                            "disallow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            },
                            "message": "Import rule \"tools\" may import its own files and \"cli-config\", \"cli-types\", \"system\", \"parsers\", \"configurations\", \"repository\", \"settings\", \"planning\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:tools"
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "categories": {
                                            "anyOf": [
                                                "import-rule:tools",
                                                "import-rule:cli-config",
                                                "import-rule:cli-types",
                                                "import-rule:system",
                                                "import-rule:parsers",
                                                "import-rule:configurations",
                                                "import-rule:repository",
                                                "import-rule:settings",
                                                "import-rule:planning"
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:installers"
                                }
                            },
                            "disallow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            },
                            "message": "Import rule \"installers\" may import its own files and \"cli-config\", \"cli-types\", \"system\", \"parsers\", \"configurations\", \"repository\", \"settings\", \"planning\", \"tools\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:installers"
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "categories": {
                                            "anyOf": [
                                                "import-rule:installers",
                                                "import-rule:cli-config",
                                                "import-rule:cli-types",
                                                "import-rule:system",
                                                "import-rule:parsers",
                                                "import-rule:configurations",
                                                "import-rule:repository",
                                                "import-rule:settings",
                                                "import-rule:planning",
                                                "import-rule:tools"
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:generation"
                                }
                            },
                            "disallow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            },
                            "message": "Import rule \"generation\" may import its own files and \"cli-config\", \"cli-types\", \"system\", \"parsers\", \"configurations\", \"repository\", \"settings\", \"planning\", \"tools\", \"installers\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:generation"
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "categories": {
                                            "anyOf": [
                                                "import-rule:generation",
                                                "import-rule:cli-config",
                                                "import-rule:cli-types",
                                                "import-rule:system",
                                                "import-rule:parsers",
                                                "import-rule:configurations",
                                                "import-rule:repository",
                                                "import-rule:settings",
                                                "import-rule:planning",
                                                "import-rule:tools",
                                                "import-rule:installers"
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:runs"
                                }
                            },
                            "disallow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            },
                            "message": "Import rule \"runs\" may import its own files and \"cli-config\", \"cli-types\", \"system\", \"parsers\", \"configurations\", \"repository\", \"settings\", \"planning\", \"tools\", \"installers\", \"generation\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:runs"
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "categories": {
                                            "anyOf": [
                                                "import-rule:runs",
                                                "import-rule:cli-config",
                                                "import-rule:cli-types",
                                                "import-rule:system",
                                                "import-rule:parsers",
                                                "import-rule:configurations",
                                                "import-rule:repository",
                                                "import-rule:settings",
                                                "import-rule:planning",
                                                "import-rule:tools",
                                                "import-rule:installers",
                                                "import-rule:generation"
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:checks"
                                }
                            },
                            "disallow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            },
                            "message": "Import rule \"checks\" may import its own files and \"cli-config\", \"cli-types\", \"system\", \"parsers\", \"configurations\", \"repository\", \"settings\", \"planning\", \"tools\", \"installers\", \"generation\", \"runs\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:checks"
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "categories": {
                                            "anyOf": [
                                                "import-rule:checks",
                                                "import-rule:cli-config",
                                                "import-rule:cli-types",
                                                "import-rule:system",
                                                "import-rule:parsers",
                                                "import-rule:configurations",
                                                "import-rule:repository",
                                                "import-rule:settings",
                                                "import-rule:planning",
                                                "import-rule:tools",
                                                "import-rule:installers",
                                                "import-rule:generation",
                                                "import-rule:runs"
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:commands"
                                }
                            },
                            "disallow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            },
                            "message": "Import rule \"commands\" may import its own files and \"cli-config\", \"cli-types\", \"system\", \"parsers\", \"configurations\", \"repository\", \"settings\", \"planning\", \"tools\", \"installers\", \"generation\", \"runs\", \"checks\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:commands"
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "categories": {
                                            "anyOf": [
                                                "import-rule:commands",
                                                "import-rule:cli-config",
                                                "import-rule:cli-types",
                                                "import-rule:system",
                                                "import-rule:parsers",
                                                "import-rule:configurations",
                                                "import-rule:repository",
                                                "import-rule:settings",
                                                "import-rule:planning",
                                                "import-rule:tools",
                                                "import-rule:installers",
                                                "import-rule:generation",
                                                "import-rule:runs",
                                                "import-rule:checks"
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:main"
                                }
                            },
                            "disallow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            },
                            "message": "Import rule \"main\" may import its own files and \"cli-config\", \"cli-types\", \"system\", \"parsers\", \"configurations\", \"repository\", \"settings\", \"planning\", \"tools\", \"installers\", \"generation\", \"runs\", \"checks\", \"commands\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:main"
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "categories": {
                                            "anyOf": [
                                                "import-rule:main",
                                                "import-rule:cli-config",
                                                "import-rule:cli-types",
                                                "import-rule:system",
                                                "import-rule:parsers",
                                                "import-rule:configurations",
                                                "import-rule:repository",
                                                "import-rule:settings",
                                                "import-rule:planning",
                                                "import-rule:tools",
                                                "import-rule:installers",
                                                "import-rule:generation",
                                                "import-rule:runs",
                                                "import-rule:checks",
                                                "import-rule:commands"
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:plugin-config"
                                }
                            },
                            "disallow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            },
                            "message": "Import rule \"plugin-config\" may import only its own files, not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:plugin-config"
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "categories": {
                                            "anyOf": [
                                                "import-rule:plugin-config"
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:plugin-types"
                                }
                            },
                            "disallow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            },
                            "message": "Import rule \"plugin-types\" may import only its own files, not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:plugin-types"
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "categories": {
                                            "anyOf": [
                                                "import-rule:plugin-types"
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:plugin"
                                }
                            },
                            "disallow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            },
                            "message": "Import rule \"plugin\" may import its own files and \"plugin-config\", \"plugin-types\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:plugin"
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "categories": {
                                            "anyOf": [
                                                "import-rule:plugin",
                                                "import-rule:plugin-config",
                                                "import-rule:plugin-types"
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:plugin-local"
                                }
                            },
                            "disallow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            },
                            "message": "Import rule \"plugin-local\" may import its own files and \"plugin\", \"plugin-config\", \"plugin-types\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:plugin-local"
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "categories": {
                                            "anyOf": [
                                                "import-rule:plugin-local",
                                                "import-rule:plugin",
                                                "import-rule:plugin-config",
                                                "import-rule:plugin-types"
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:docs-config"
                                }
                            },
                            "disallow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            },
                            "message": "Import rule \"docs-config\" may import its own files and \"cli-config\", \"docs-types\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:docs-config"
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "categories": {
                                            "anyOf": [
                                                "import-rule:docs-config",
                                                "import-rule:cli-config",
                                                "import-rule:docs-types"
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:docs-types"
                                }
                            },
                            "disallow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            },
                            "message": "Import rule \"docs-types\" may import its own files and \"cli-types\", \"settings\", \"docs-config\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:docs-types"
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "categories": {
                                            "anyOf": [
                                                "import-rule:docs-types",
                                                "import-rule:cli-types",
                                                "import-rule:settings",
                                                "import-rule:docs-config"
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:docs"
                                }
                            },
                            "disallow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            },
                            "message": "Import rule \"docs\" may import its own files and \"cli-config\", \"cli-types\", \"system\", \"parsers\", \"configurations\", \"repository\", \"settings\", \"planning\", \"tools\", \"installers\", \"generation\", \"runs\", \"checks\", \"commands\", \"main\", \"plugin-config\", \"plugin-types\", \"plugin\", \"plugin-local\", \"docs-config\", \"docs-types\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:docs"
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "categories": {
                                            "anyOf": [
                                                "import-rule:docs",
                                                "import-rule:cli-config",
                                                "import-rule:cli-types",
                                                "import-rule:system",
                                                "import-rule:parsers",
                                                "import-rule:configurations",
                                                "import-rule:repository",
                                                "import-rule:settings",
                                                "import-rule:planning",
                                                "import-rule:tools",
                                                "import-rule:installers",
                                                "import-rule:generation",
                                                "import-rule:runs",
                                                "import-rule:checks",
                                                "import-rule:commands",
                                                "import-rule:main",
                                                "import-rule:plugin-config",
                                                "import-rule:plugin-types",
                                                "import-rule:plugin",
                                                "import-rule:plugin-local",
                                                "import-rule:docs-config",
                                                "import-rule:docs-types"
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:tests-data"
                                }
                            },
                            "disallow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            },
                            "message": "Import rule \"tests-data\" may import its own files and \"cli-config\", \"tests-setup\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:tests-data"
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "categories": {
                                            "anyOf": [
                                                "import-rule:tests-data",
                                                "import-rule:cli-config",
                                                "import-rule:tests-setup"
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:tests-types"
                                }
                            },
                            "disallow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            },
                            "message": "Import rule \"tests-types\" may import its own files and \"cli-types\", \"plugin-types\", \"tests-data\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:tests-types"
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "categories": {
                                            "anyOf": [
                                                "import-rule:tests-types",
                                                "import-rule:cli-types",
                                                "import-rule:plugin-types",
                                                "import-rule:tests-data"
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:tests-setup"
                                }
                            },
                            "disallow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            },
                            "message": "Import rule \"tests-setup\" may import its own files and \"cli-config\", \"cli-types\", \"system\", \"parsers\", \"configurations\", \"repository\", \"settings\", \"planning\", \"tools\", \"installers\", \"generation\", \"runs\", \"checks\", \"commands\", \"main\", \"plugin-config\", \"plugin-types\", \"plugin\", \"plugin-local\", \"docs-config\", \"docs-types\", \"docs\", \"tests-data\", \"tests-types\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:tests-setup"
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "categories": {
                                            "anyOf": [
                                                "import-rule:tests-setup",
                                                "import-rule:cli-config",
                                                "import-rule:cli-types",
                                                "import-rule:system",
                                                "import-rule:parsers",
                                                "import-rule:configurations",
                                                "import-rule:repository",
                                                "import-rule:settings",
                                                "import-rule:planning",
                                                "import-rule:tools",
                                                "import-rule:installers",
                                                "import-rule:generation",
                                                "import-rule:runs",
                                                "import-rule:checks",
                                                "import-rule:commands",
                                                "import-rule:main",
                                                "import-rule:plugin-config",
                                                "import-rule:plugin-types",
                                                "import-rule:plugin",
                                                "import-rule:plugin-local",
                                                "import-rule:docs-config",
                                                "import-rule:docs-types",
                                                "import-rule:docs",
                                                "import-rule:tests-data",
                                                "import-rule:tests-types"
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:tests"
                                }
                            },
                            "disallow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            },
                            "message": "Import rule \"tests\" may import its own files and \"cli-config\", \"cli-types\", \"system\", \"parsers\", \"configurations\", \"repository\", \"settings\", \"planning\", \"tools\", \"installers\", \"generation\", \"runs\", \"checks\", \"commands\", \"main\", \"plugin-config\", \"plugin-types\", \"plugin\", \"plugin-local\", \"docs-config\", \"docs-types\", \"docs\", \"tests-data\", \"tests-types\", \"tests-setup\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:tests"
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "categories": {
                                            "anyOf": [
                                                "import-rule:tests",
                                                "import-rule:cli-config",
                                                "import-rule:cli-types",
                                                "import-rule:system",
                                                "import-rule:parsers",
                                                "import-rule:configurations",
                                                "import-rule:repository",
                                                "import-rule:settings",
                                                "import-rule:planning",
                                                "import-rule:tools",
                                                "import-rule:installers",
                                                "import-rule:generation",
                                                "import-rule:runs",
                                                "import-rule:checks",
                                                "import-rule:commands",
                                                "import-rule:main",
                                                "import-rule:plugin-config",
                                                "import-rule:plugin-types",
                                                "import-rule:plugin",
                                                "import-rule:plugin-local",
                                                "import-rule:docs-config",
                                                "import-rule:docs-types",
                                                "import-rule:docs",
                                                "import-rule:tests-data",
                                                "import-rule:tests-types",
                                                "import-rule:tests-setup"
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:config-files"
                                }
                            },
                            "disallow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            },
                            "message": "Import rule \"config-files\" may import its own files and \"cli-types\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:config-files"
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "categories": {
                                            "anyOf": [
                                                "import-rule:config-files",
                                                "import-rule:cli-types"
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "from": {
                                "file": {
                                    "isUnknown": true
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            }
                        },
                        {
                            "allow": {
                                "to": {
                                    "file": {
                                        "isUnknown": true
                                    }
                                }
                            }
                        },
                        {
                            "from": {
                                "file": {
                                    "path": [
                                        "**/test/**",
                                        "**/tests/**",
                                        "**/__tests__/**",
                                        "**/*.test.*",
                                        "**/*.spec.*",
                                        "**/test_*.py",
                                        "**/*_test.py",
                                        "**/conftest.py",
                                        "**/Tests/**",
                                        "**/*Tests.swift",
                                        "docs/**/test/**",
                                        "docs/**/tests/**",
                                        "docs/**/__tests__/**",
                                        "docs/**/*.test.*",
                                        "docs/**/*.spec.*",
                                        "docs/**/test_*.py",
                                        "docs/**/*_test.py",
                                        "docs/**/conftest.py",
                                        "docs/**/Tests/**",
                                        "docs/**/*Tests.swift",
                                        "packages/cli/**/test/**",
                                        "packages/cli/**/tests/**",
                                        "packages/cli/**/__tests__/**",
                                        "packages/cli/**/*.test.*",
                                        "packages/cli/**/*.spec.*",
                                        "packages/cli/**/test_*.py",
                                        "packages/cli/**/*_test.py",
                                        "packages/cli/**/conftest.py",
                                        "packages/cli/**/Tests/**",
                                        "packages/cli/**/*Tests.swift",
                                        "packages/eslint-plugin/**/test/**",
                                        "packages/eslint-plugin/**/tests/**",
                                        "packages/eslint-plugin/**/__tests__/**",
                                        "packages/eslint-plugin/**/*.test.*",
                                        "packages/eslint-plugin/**/*.spec.*",
                                        "packages/eslint-plugin/**/test_*.py",
                                        "packages/eslint-plugin/**/*_test.py",
                                        "packages/eslint-plugin/**/conftest.py",
                                        "packages/eslint-plugin/**/Tests/**",
                                        "packages/eslint-plugin/**/*Tests.swift",
                                        "tests/**/test/**",
                                        "tests/**/tests/**",
                                        "tests/**/__tests__/**",
                                        "tests/**/*.test.*",
                                        "tests/**/*.spec.*",
                                        "tests/**/test_*.py",
                                        "tests/**/*_test.py",
                                        "tests/**/conftest.py",
                                        "tests/**/Tests/**",
                                        "tests/**/*Tests.swift"
                                    ]
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            }
                        },
                        {
                            "allow": {
                                "to": {
                                    "file": {
                                        "path": [
                                            "**/test/**",
                                            "**/tests/**",
                                            "**/__tests__/**",
                                            "**/*.test.*",
                                            "**/*.spec.*",
                                            "**/test_*.py",
                                            "**/*_test.py",
                                            "**/conftest.py",
                                            "**/Tests/**",
                                            "**/*Tests.swift",
                                            "docs/**/test/**",
                                            "docs/**/tests/**",
                                            "docs/**/__tests__/**",
                                            "docs/**/*.test.*",
                                            "docs/**/*.spec.*",
                                            "docs/**/test_*.py",
                                            "docs/**/*_test.py",
                                            "docs/**/conftest.py",
                                            "docs/**/Tests/**",
                                            "docs/**/*Tests.swift",
                                            "packages/cli/**/test/**",
                                            "packages/cli/**/tests/**",
                                            "packages/cli/**/__tests__/**",
                                            "packages/cli/**/*.test.*",
                                            "packages/cli/**/*.spec.*",
                                            "packages/cli/**/test_*.py",
                                            "packages/cli/**/*_test.py",
                                            "packages/cli/**/conftest.py",
                                            "packages/cli/**/Tests/**",
                                            "packages/cli/**/*Tests.swift",
                                            "packages/eslint-plugin/**/test/**",
                                            "packages/eslint-plugin/**/tests/**",
                                            "packages/eslint-plugin/**/__tests__/**",
                                            "packages/eslint-plugin/**/*.test.*",
                                            "packages/eslint-plugin/**/*.spec.*",
                                            "packages/eslint-plugin/**/test_*.py",
                                            "packages/eslint-plugin/**/*_test.py",
                                            "packages/eslint-plugin/**/conftest.py",
                                            "packages/eslint-plugin/**/Tests/**",
                                            "packages/eslint-plugin/**/*Tests.swift",
                                            "tests/**/test/**",
                                            "tests/**/tests/**",
                                            "tests/**/__tests__/**",
                                            "tests/**/*.test.*",
                                            "tests/**/*.spec.*",
                                            "tests/**/test_*.py",
                                            "tests/**/*_test.py",
                                            "tests/**/conftest.py",
                                            "tests/**/Tests/**",
                                            "tests/**/*Tests.swift"
                                        ]
                                    }
                                }
                            }
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": {
                                        "noneOf": [
                                            "import-rule:cli-config",
                                            "import-rule:cli-types",
                                            "import-rule:system",
                                            "import-rule:parsers",
                                            "import-rule:configurations",
                                            "import-rule:repository",
                                            "import-rule:settings",
                                            "import-rule:planning",
                                            "import-rule:tools",
                                            "import-rule:installers",
                                            "import-rule:generation",
                                            "import-rule:runs",
                                            "import-rule:checks",
                                            "import-rule:commands",
                                            "import-rule:main",
                                            "import-rule:plugin-config",
                                            "import-rule:plugin-types",
                                            "import-rule:plugin",
                                            "import-rule:plugin-local",
                                            "import-rule:docs-config",
                                            "import-rule:docs-types",
                                            "import-rule:docs",
                                            "import-rule:tests-data",
                                            "import-rule:tests-types",
                                            "import-rule:tests-setup",
                                            "import-rule:tests",
                                            "import-rule:config-files"
                                        ]
                                    }
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            }
                        },
                        {
                            "allow": {
                                "to": {
                                    "file": {
                                        "categories": {
                                            "noneOf": [
                                                "import-rule:cli-config",
                                                "import-rule:cli-types",
                                                "import-rule:system",
                                                "import-rule:parsers",
                                                "import-rule:configurations",
                                                "import-rule:repository",
                                                "import-rule:settings",
                                                "import-rule:planning",
                                                "import-rule:tools",
                                                "import-rule:installers",
                                                "import-rule:generation",
                                                "import-rule:runs",
                                                "import-rule:checks",
                                                "import-rule:commands",
                                                "import-rule:main",
                                                "import-rule:plugin-config",
                                                "import-rule:plugin-types",
                                                "import-rule:plugin",
                                                "import-rule:plugin-local",
                                                "import-rule:docs-config",
                                                "import-rule:docs-types",
                                                "import-rule:docs",
                                                "import-rule:tests-data",
                                                "import-rule:tests-types",
                                                "import-rule:tests-setup",
                                                "import-rule:tests",
                                                "import-rule:config-files"
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": {
                                        "noneOf": [
                                            "tests"
                                        ]
                                    }
                                }
                            },
                            "disallow": {
                                "to": {
                                    "file": {
                                        "categories": "tests"
                                    }
                                }
                            }
                        }
                    ],
                    "checkInternals": true
                }
            ]
        },
        files: [
            "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
        ]
    },
    ...typescriptBlocks,
    ...astroBlocks,
    ...zodBlocks,
    // javascript
    {
        languageOptions: {
            sourceType: "module",
            globals: globals["nodeBuiltin"]
        },
        rules: {
            "n/no-unsupported-features/node-builtins": [
                "error",
                {
                    "allowExperimental": true
                }
            ],
            "n/no-unsupported-features/es-builtins": "error",
            "n/no-deprecated-api": "error",
            "unicorn/no-process-exit": "off",
            "n/no-unsupported-features/es-syntax": "off",
            "n/no-sync": "off",
            "n/no-callback-literal": "error",
            "n/no-new-require": "error",
            "n/no-path-concat": "error",
            "n/no-missing-import": "off",
            "n/no-missing-require": "off",
            "n/no-unpublished-import": [
                "error",
                {
                    "ignoreTypeImport": true
                }
            ],
            "n/no-unpublished-require": "error",
            "n/no-extraneous-import": "error",
            "n/no-extraneous-require": "error",
            "n/prefer-global/url-search-params": [
                "error",
                "always"
            ],
            "n/prefer-global/url": [
                "error",
                "always"
            ],
            "n/prefer-global/process": [
                "error",
                "always"
            ],
            "n/prefer-global/console": [
                "error",
                "always"
            ],
            "n/prefer-global/buffer": [
                "error",
                "always"
            ],
            "n/no-process-exit": "error",
            "n/prefer-promises/dns": "error",
            "n/prefer-promises/fs": "error"
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                runtimeMatches(0, runtimeDeclarations)
            ],
            [
                "**/*.astro",
                runtimeMatches(0, runtimeDeclarations)
            ]
        ]
    },
    // javascript: your own rule options
    {
        "ignores": [],
        rules: {
            "n/no-unsupported-features/node-builtins": [
                "error",
                {
                    "version": ">=24",
                    "allowExperimental": true
                }
            ]
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                runtimeMatches(0, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts"
            ],
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                runtimeMatches(0, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts/**"
            ],
            [
                "**/*.astro",
                runtimeMatches(0, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts"
            ],
            [
                "**/*.astro",
                runtimeMatches(0, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts/**"
            ]
        ]
    },
    // javascript
    {
        languageOptions: {
            sourceType: "commonjs",
            globals: globals["node"]
        },
        rules: {
            "n/no-unsupported-features/node-builtins": [
                "error",
                {
                    "allowExperimental": true
                }
            ],
            "n/no-unsupported-features/es-builtins": "error",
            "n/no-deprecated-api": "error",
            "unicorn/no-process-exit": "off",
            "n/no-unsupported-features/es-syntax": "off",
            "n/no-sync": "off",
            "n/no-callback-literal": "error",
            "n/no-new-require": "error",
            "n/no-path-concat": "error",
            "n/no-missing-import": "off",
            "n/no-missing-require": "off",
            "n/no-unpublished-import": [
                "error",
                {
                    "ignoreTypeImport": true
                }
            ],
            "n/no-unpublished-require": "error",
            "n/no-extraneous-import": "error",
            "n/no-extraneous-require": "error",
            "n/prefer-global/url-search-params": [
                "error",
                "always"
            ],
            "n/prefer-global/url": [
                "error",
                "always"
            ],
            "n/prefer-global/process": [
                "error",
                "always"
            ],
            "n/prefer-global/console": [
                "error",
                "always"
            ],
            "n/prefer-global/buffer": [
                "error",
                "always"
            ],
            "n/no-process-exit": "error",
            "n/prefer-promises/dns": "error",
            "n/prefer-promises/fs": "error",
            "unicorn/prefer-module": "off"
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                runtimeMatches(1, runtimeDeclarations)
            ],
            [
                "**/*.astro",
                runtimeMatches(1, runtimeDeclarations)
            ]
        ]
    },
    // javascript: your own rule options
    {
        "ignores": [],
        rules: {
            "n/no-unsupported-features/node-builtins": [
                "error",
                {
                    "version": ">=24",
                    "allowExperimental": true
                }
            ]
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                runtimeMatches(1, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts"
            ],
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                runtimeMatches(1, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts/**"
            ],
            [
                "**/*.astro",
                runtimeMatches(1, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts"
            ],
            [
                "**/*.astro",
                runtimeMatches(1, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts/**"
            ]
        ]
    },
    // javascript
    {
        languageOptions: {
            sourceType: "module",
            globals: globals["nodeBuiltin"]
        },
        rules: {
            "n/no-unsupported-features/node-builtins": [
                "error",
                {
                    "allowExperimental": true
                }
            ],
            "n/no-unsupported-features/es-builtins": "error",
            "n/no-deprecated-api": "error",
            "unicorn/no-process-exit": "off",
            "n/no-unsupported-features/es-syntax": "off",
            "n/no-sync": "off",
            "n/no-callback-literal": "error",
            "n/no-new-require": "error",
            "n/no-path-concat": "error",
            "n/no-missing-import": "off",
            "n/no-missing-require": "off",
            "n/no-unpublished-import": [
                "error",
                {
                    "ignoreTypeImport": true
                }
            ],
            "n/no-unpublished-require": "error",
            "n/no-extraneous-import": "error",
            "n/no-extraneous-require": "error",
            "n/prefer-global/url-search-params": [
                "error",
                "always"
            ],
            "n/prefer-global/url": [
                "error",
                "always"
            ],
            "n/prefer-global/process": [
                "error",
                "always"
            ],
            "n/prefer-global/console": [
                "error",
                "always"
            ],
            "n/prefer-global/buffer": [
                "error",
                "always"
            ],
            "n/no-process-exit": "error",
            "n/prefer-promises/dns": "error",
            "n/prefer-promises/fs": "error"
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                runtimeMatches(2, runtimeDeclarations)
            ],
            [
                "**/*.astro",
                runtimeMatches(2, runtimeDeclarations)
            ]
        ]
    },
    // javascript: your own rule options
    {
        "ignores": [],
        rules: {
            "n/no-unsupported-features/node-builtins": [
                "error",
                {
                    "version": ">=24",
                    "allowExperimental": true
                }
            ]
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                runtimeMatches(2, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts"
            ],
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                runtimeMatches(2, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts/**"
            ],
            [
                "**/*.astro",
                runtimeMatches(2, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts"
            ],
            [
                "**/*.astro",
                runtimeMatches(2, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts/**"
            ]
        ]
    },
    // javascript
    {
        languageOptions: {
            sourceType: "commonjs",
            globals: globals["node"]
        },
        rules: {
            "n/no-unsupported-features/node-builtins": [
                "error",
                {
                    "allowExperimental": true
                }
            ],
            "n/no-unsupported-features/es-builtins": "error",
            "n/no-deprecated-api": "error",
            "unicorn/no-process-exit": "off",
            "n/no-unsupported-features/es-syntax": "off",
            "n/no-sync": "off",
            "n/no-callback-literal": "error",
            "n/no-new-require": "error",
            "n/no-path-concat": "error",
            "n/no-missing-import": "off",
            "n/no-missing-require": "off",
            "n/no-unpublished-import": [
                "error",
                {
                    "ignoreTypeImport": true
                }
            ],
            "n/no-unpublished-require": "error",
            "n/no-extraneous-import": "error",
            "n/no-extraneous-require": "error",
            "n/prefer-global/url-search-params": [
                "error",
                "always"
            ],
            "n/prefer-global/url": [
                "error",
                "always"
            ],
            "n/prefer-global/process": [
                "error",
                "always"
            ],
            "n/prefer-global/console": [
                "error",
                "always"
            ],
            "n/prefer-global/buffer": [
                "error",
                "always"
            ],
            "n/no-process-exit": "error",
            "n/prefer-promises/dns": "error",
            "n/prefer-promises/fs": "error",
            "unicorn/prefer-module": "off"
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                runtimeMatches(3, runtimeDeclarations)
            ],
            [
                "**/*.astro",
                runtimeMatches(3, runtimeDeclarations)
            ]
        ]
    },
    // javascript: your own rule options
    {
        "ignores": [],
        rules: {
            "n/no-unsupported-features/node-builtins": [
                "error",
                {
                    "version": ">=24",
                    "allowExperimental": true
                }
            ]
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                runtimeMatches(3, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts"
            ],
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                runtimeMatches(3, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts/**"
            ],
            [
                "**/*.astro",
                runtimeMatches(3, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts"
            ],
            [
                "**/*.astro",
                runtimeMatches(3, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts/**"
            ]
        ]
    },
    // javascript
    {
        languageOptions: {
            sourceType: "module",
            globals: globals["nodeBuiltin"]
        },
        rules: {
            "n/no-unsupported-features/node-builtins": [
                "error",
                {
                    "allowExperimental": true
                }
            ],
            "n/no-unsupported-features/es-builtins": "error",
            "n/no-deprecated-api": "error",
            "unicorn/no-process-exit": "off",
            "n/no-unsupported-features/es-syntax": "off",
            "n/no-sync": "off",
            "n/no-callback-literal": "error",
            "n/no-new-require": "error",
            "n/no-path-concat": "error",
            "n/no-missing-import": "off",
            "n/no-missing-require": "off",
            "n/no-unpublished-import": [
                "error",
                {
                    "ignoreTypeImport": true
                }
            ],
            "n/no-unpublished-require": "error",
            "n/no-extraneous-import": "error",
            "n/no-extraneous-require": "error",
            "n/prefer-global/url-search-params": [
                "error",
                "always"
            ],
            "n/prefer-global/url": [
                "error",
                "always"
            ],
            "n/prefer-global/process": [
                "error",
                "always"
            ],
            "n/prefer-global/console": [
                "error",
                "always"
            ],
            "n/prefer-global/buffer": [
                "error",
                "always"
            ],
            "n/no-process-exit": "error",
            "n/prefer-promises/dns": "error",
            "n/prefer-promises/fs": "error"
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                runtimeMatches(4, runtimeDeclarations)
            ],
            [
                "**/*.astro",
                runtimeMatches(4, runtimeDeclarations)
            ]
        ]
    },
    // javascript: your own rule options
    {
        "ignores": [],
        rules: {
            "n/no-unsupported-features/node-builtins": [
                "error",
                {
                    "version": ">=24",
                    "allowExperimental": true
                }
            ]
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                runtimeMatches(4, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts"
            ],
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                runtimeMatches(4, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts/**"
            ],
            [
                "**/*.astro",
                runtimeMatches(4, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts"
            ],
            [
                "**/*.astro",
                runtimeMatches(4, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts/**"
            ]
        ]
    },
    // javascript
    {
        languageOptions: {
            sourceType: "commonjs",
            globals: globals["node"]
        },
        rules: {
            "n/no-unsupported-features/node-builtins": [
                "error",
                {
                    "allowExperimental": true
                }
            ],
            "n/no-unsupported-features/es-builtins": "error",
            "n/no-deprecated-api": "error",
            "unicorn/no-process-exit": "off",
            "n/no-unsupported-features/es-syntax": "off",
            "n/no-sync": "off",
            "n/no-callback-literal": "error",
            "n/no-new-require": "error",
            "n/no-path-concat": "error",
            "n/no-missing-import": "off",
            "n/no-missing-require": "off",
            "n/no-unpublished-import": [
                "error",
                {
                    "ignoreTypeImport": true
                }
            ],
            "n/no-unpublished-require": "error",
            "n/no-extraneous-import": "error",
            "n/no-extraneous-require": "error",
            "n/prefer-global/url-search-params": [
                "error",
                "always"
            ],
            "n/prefer-global/url": [
                "error",
                "always"
            ],
            "n/prefer-global/process": [
                "error",
                "always"
            ],
            "n/prefer-global/console": [
                "error",
                "always"
            ],
            "n/prefer-global/buffer": [
                "error",
                "always"
            ],
            "n/no-process-exit": "error",
            "n/prefer-promises/dns": "error",
            "n/prefer-promises/fs": "error",
            "unicorn/prefer-module": "off"
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                runtimeMatches(5, runtimeDeclarations)
            ],
            [
                "**/*.astro",
                runtimeMatches(5, runtimeDeclarations)
            ]
        ]
    },
    // javascript: your own rule options
    {
        "ignores": [],
        rules: {
            "n/no-unsupported-features/node-builtins": [
                "error",
                {
                    "version": ">=24",
                    "allowExperimental": true
                }
            ]
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                runtimeMatches(5, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts"
            ],
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                runtimeMatches(5, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts/**"
            ],
            [
                "**/*.astro",
                runtimeMatches(5, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts"
            ],
            [
                "**/*.astro",
                runtimeMatches(5, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts/**"
            ]
        ]
    },
    // javascript
    {
        languageOptions: {
            sourceType: "module",
            globals: globals["nodeBuiltin"]
        },
        rules: {
            "n/no-unsupported-features/node-builtins": [
                "error",
                {
                    "allowExperimental": true
                }
            ],
            "n/no-unsupported-features/es-builtins": "error",
            "n/no-deprecated-api": "error",
            "unicorn/no-process-exit": "off",
            "n/no-unsupported-features/es-syntax": "off",
            "n/no-sync": "off",
            "n/no-callback-literal": "error",
            "n/no-new-require": "error",
            "n/no-path-concat": "error",
            "n/no-missing-import": "off",
            "n/no-missing-require": "off",
            "n/no-unpublished-import": [
                "error",
                {
                    "ignoreTypeImport": true
                }
            ],
            "n/no-unpublished-require": "error",
            "n/no-extraneous-import": "error",
            "n/no-extraneous-require": "error",
            "n/prefer-global/url-search-params": [
                "error",
                "always"
            ],
            "n/prefer-global/url": [
                "error",
                "always"
            ],
            "n/prefer-global/process": [
                "error",
                "always"
            ],
            "n/prefer-global/console": [
                "error",
                "always"
            ],
            "n/prefer-global/buffer": [
                "error",
                "always"
            ],
            "n/no-process-exit": "error",
            "n/prefer-promises/dns": "error",
            "n/prefer-promises/fs": "error"
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                runtimeMatches(6, runtimeDeclarations)
            ],
            [
                "**/*.astro",
                runtimeMatches(6, runtimeDeclarations)
            ]
        ]
    },
    // javascript: your own rule options
    {
        "ignores": [],
        rules: {
            "n/no-unsupported-features/node-builtins": [
                "error",
                {
                    "version": ">=24",
                    "allowExperimental": true
                }
            ]
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                runtimeMatches(6, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts"
            ],
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                runtimeMatches(6, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts/**"
            ],
            [
                "**/*.astro",
                runtimeMatches(6, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts"
            ],
            [
                "**/*.astro",
                runtimeMatches(6, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts/**"
            ]
        ]
    },
    // javascript
    {
        languageOptions: {
            sourceType: "commonjs",
            globals: globals["node"]
        },
        rules: {
            "n/no-unsupported-features/node-builtins": [
                "error",
                {
                    "allowExperimental": true
                }
            ],
            "n/no-unsupported-features/es-builtins": "error",
            "n/no-deprecated-api": "error",
            "unicorn/no-process-exit": "off",
            "n/no-unsupported-features/es-syntax": "off",
            "n/no-sync": "off",
            "n/no-callback-literal": "error",
            "n/no-new-require": "error",
            "n/no-path-concat": "error",
            "n/no-missing-import": "off",
            "n/no-missing-require": "off",
            "n/no-unpublished-import": [
                "error",
                {
                    "ignoreTypeImport": true
                }
            ],
            "n/no-unpublished-require": "error",
            "n/no-extraneous-import": "error",
            "n/no-extraneous-require": "error",
            "n/prefer-global/url-search-params": [
                "error",
                "always"
            ],
            "n/prefer-global/url": [
                "error",
                "always"
            ],
            "n/prefer-global/process": [
                "error",
                "always"
            ],
            "n/prefer-global/console": [
                "error",
                "always"
            ],
            "n/prefer-global/buffer": [
                "error",
                "always"
            ],
            "n/no-process-exit": "error",
            "n/prefer-promises/dns": "error",
            "n/prefer-promises/fs": "error",
            "unicorn/prefer-module": "off"
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                runtimeMatches(7, runtimeDeclarations)
            ],
            [
                "**/*.astro",
                runtimeMatches(7, runtimeDeclarations)
            ]
        ]
    },
    // javascript: your own rule options
    {
        "ignores": [],
        rules: {
            "n/no-unsupported-features/node-builtins": [
                "error",
                {
                    "version": ">=24",
                    "allowExperimental": true
                }
            ]
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                runtimeMatches(7, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts"
            ],
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                runtimeMatches(7, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts/**"
            ],
            [
                "**/*.astro",
                runtimeMatches(7, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts"
            ],
            [
                "**/*.astro",
                runtimeMatches(7, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts/**"
            ]
        ]
    },
    // javascript
    {
        languageOptions: {
            sourceType: "module",
            globals: globals["nodeBuiltin"]
        },
        rules: {
            "n/no-unsupported-features/node-builtins": [
                "error",
                {
                    "allowExperimental": true
                }
            ],
            "n/no-unsupported-features/es-builtins": "error",
            "n/no-deprecated-api": "error",
            "unicorn/no-process-exit": "off",
            "n/no-unsupported-features/es-syntax": "off",
            "n/no-sync": "off",
            "n/no-callback-literal": "error",
            "n/no-new-require": "error",
            "n/no-path-concat": "error",
            "n/no-missing-import": "off",
            "n/no-missing-require": "off",
            "n/no-unpublished-import": [
                "error",
                {
                    "ignoreTypeImport": true
                }
            ],
            "n/no-unpublished-require": "error",
            "n/no-extraneous-import": "error",
            "n/no-extraneous-require": "error",
            "n/prefer-global/url-search-params": [
                "error",
                "always"
            ],
            "n/prefer-global/url": [
                "error",
                "always"
            ],
            "n/prefer-global/process": [
                "error",
                "always"
            ],
            "n/prefer-global/console": [
                "error",
                "always"
            ],
            "n/prefer-global/buffer": [
                "error",
                "always"
            ],
            "n/no-process-exit": "error",
            "n/prefer-promises/dns": "error",
            "n/prefer-promises/fs": "error"
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                runtimeMatches(8, runtimeDeclarations)
            ],
            [
                "**/*.astro",
                runtimeMatches(8, runtimeDeclarations)
            ]
        ]
    },
    // javascript: your own rule options
    {
        "ignores": [],
        rules: {
            "n/no-unsupported-features/node-builtins": [
                "error",
                {
                    "version": ">=24",
                    "allowExperimental": true
                }
            ]
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                runtimeMatches(8, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts"
            ],
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                runtimeMatches(8, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts/**"
            ],
            [
                "**/*.astro",
                runtimeMatches(8, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts"
            ],
            [
                "**/*.astro",
                runtimeMatches(8, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts/**"
            ]
        ]
    },
    // javascript
    {
        languageOptions: {
            sourceType: "commonjs",
            globals: globals["node"]
        },
        rules: {
            "n/no-unsupported-features/node-builtins": [
                "error",
                {
                    "allowExperimental": true
                }
            ],
            "n/no-unsupported-features/es-builtins": "error",
            "n/no-deprecated-api": "error",
            "unicorn/no-process-exit": "off",
            "n/no-unsupported-features/es-syntax": "off",
            "n/no-sync": "off",
            "n/no-callback-literal": "error",
            "n/no-new-require": "error",
            "n/no-path-concat": "error",
            "n/no-missing-import": "off",
            "n/no-missing-require": "off",
            "n/no-unpublished-import": [
                "error",
                {
                    "ignoreTypeImport": true
                }
            ],
            "n/no-unpublished-require": "error",
            "n/no-extraneous-import": "error",
            "n/no-extraneous-require": "error",
            "n/prefer-global/url-search-params": [
                "error",
                "always"
            ],
            "n/prefer-global/url": [
                "error",
                "always"
            ],
            "n/prefer-global/process": [
                "error",
                "always"
            ],
            "n/prefer-global/console": [
                "error",
                "always"
            ],
            "n/prefer-global/buffer": [
                "error",
                "always"
            ],
            "n/no-process-exit": "error",
            "n/prefer-promises/dns": "error",
            "n/prefer-promises/fs": "error",
            "unicorn/prefer-module": "off"
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                runtimeMatches(9, runtimeDeclarations)
            ],
            [
                "**/*.astro",
                runtimeMatches(9, runtimeDeclarations)
            ]
        ]
    },
    // javascript: your own rule options
    {
        "ignores": [],
        rules: {
            "n/no-unsupported-features/node-builtins": [
                "error",
                {
                    "version": ">=24",
                    "allowExperimental": true
                }
            ]
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                runtimeMatches(9, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts"
            ],
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                runtimeMatches(9, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts/**"
            ],
            [
                "**/*.astro",
                runtimeMatches(9, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts"
            ],
            [
                "**/*.astro",
                runtimeMatches(9, runtimeDeclarations),
                "**/*",
                "packages/eslint-plugin/local/source-hook.ts/**"
            ]
        ]
    },
    // javascript
    {
        "ignores": [
            "docs/**",
            "packages/cli/**",
            "packages/eslint-plugin/**",
            "tests/**"
        ],
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    "selector": ":matches(Program, BlockStatement, StaticBlock) > BlockStatement",
                    "message": "A block that stands alone hides a step. Name the step as a function, or remove the braces."
                },
                {
                    "selector": "TSEnumDeclaration",
                    "message": "Use a literal union or an as-const object instead of an enum."
                },
                {
                    "selector": "TSAsExpression[expression.type=\"TSAsExpression\"]",
                    "message": "Do not assert twice. Narrow the value, fix its type, or check it at run time."
                },
                {
                    "selector": "TSTypeAssertion[expression.type=\"TSTypeAssertion\"]",
                    "message": "Do not assert twice. Narrow the value, fix its type, or check it at run time."
                },
                {
                    "selector": "TSAsExpression > TSAnyKeyword",
                    "message": "Do not assert to any. Give the value a real type, or check it at run time."
                },
                {
                    "selector": "TSTypeAssertion > TSAnyKeyword",
                    "message": "Do not assert to any. Give the value a real type, or check it at run time."
                },
                {
                    "selector": "TSAsExpression > TSNeverKeyword",
                    "message": "Do not assert to never to silence the type system."
                },
                {
                    "selector": "TSTypeAssertion > TSNeverKeyword",
                    "message": "Do not assert to never to silence the type system."
                },
                {
                    "selector": "LogicalExpression[operator=\"||\"][right.type=\"ObjectExpression\"][right.properties.length=0]",
                    "message": "An empty-object fallback hides a missing value. Handle the missing case."
                },
                {
                    "selector": "LogicalExpression[operator=\"??\"][right.type=\"ObjectExpression\"][right.properties.length=0]",
                    "message": "An empty-object fallback hides a missing value. Handle the missing case."
                },
                {
                    "selector": "NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > Literal.arguments:first-child[value=/^[a-z]/]",
                    "message": "Start an error message with a capital letter."
                },
                {
                    "selector": "NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > TemplateLiteral.arguments:first-child[quasis.0.value.raw=/^[a-z]/]",
                    "message": "Start an error message with a capital letter."
                },
                {
                    "selector": "CallExpression:matches([callee.property.name=/^(debug|info|warn|error|fatal|trace)$/], [callee.property.name=\"log\"][callee.object.name!=\"console\"]) > TemplateLiteral.arguments:first-child[expressions.length>0]",
                    "message": "Log a stable message and pass the values as fields."
                },
                {
                    "selector": "ExportAllDeclaration",
                    "message": "Export values at their declaration instead of re-exporting them."
                },
                {
                    "selector": "ExportNamedDeclaration[source!=null]",
                    "message": "Export values at their declaration instead of re-exporting them."
                },
                {
                    "selector": ":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#[^/]+\\/|@\\/)/][source.value!=/\\.[^/?.]+$/]:not([source.value=/\\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))",
                    "message": "Give an alias import its file extension."
                }
            ]
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "**/*",
                "packages/cli/src/system/environment.ts"
            ],
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "**/*",
                "tests/setup/system/environment.ts"
            ],
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "**/*",
                "tests/setup/runner/unit.ts"
            ],
            [
                "**/*.astro",
                "**/*",
                "packages/cli/src/system/environment.ts"
            ],
            [
                "**/*.astro",
                "**/*",
                "tests/setup/system/environment.ts"
            ],
            [
                "**/*.astro",
                "**/*",
                "tests/setup/runner/unit.ts"
            ]
        ]
    },
    // javascript
    {
        "ignores": [
            "docs/**",
            "packages/cli/**",
            "packages/eslint-plugin/**",
            "tests/**",
            "packages/cli/src/system/environment.ts",
            "tests/setup/system/environment.ts",
            "tests/setup/runner/unit.ts"
        ],
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    "selector": ":matches(Program, BlockStatement, StaticBlock) > BlockStatement",
                    "message": "A block that stands alone hides a step. Name the step as a function, or remove the braces."
                },
                {
                    "selector": "TSEnumDeclaration",
                    "message": "Use a literal union or an as-const object instead of an enum."
                },
                {
                    "selector": "TSAsExpression[expression.type=\"TSAsExpression\"]",
                    "message": "Do not assert twice. Narrow the value, fix its type, or check it at run time."
                },
                {
                    "selector": "TSTypeAssertion[expression.type=\"TSTypeAssertion\"]",
                    "message": "Do not assert twice. Narrow the value, fix its type, or check it at run time."
                },
                {
                    "selector": "TSAsExpression > TSAnyKeyword",
                    "message": "Do not assert to any. Give the value a real type, or check it at run time."
                },
                {
                    "selector": "TSTypeAssertion > TSAnyKeyword",
                    "message": "Do not assert to any. Give the value a real type, or check it at run time."
                },
                {
                    "selector": "TSAsExpression > TSNeverKeyword",
                    "message": "Do not assert to never to silence the type system."
                },
                {
                    "selector": "TSTypeAssertion > TSNeverKeyword",
                    "message": "Do not assert to never to silence the type system."
                },
                {
                    "selector": "LogicalExpression[operator=\"||\"][right.type=\"ObjectExpression\"][right.properties.length=0]",
                    "message": "An empty-object fallback hides a missing value. Handle the missing case."
                },
                {
                    "selector": "LogicalExpression[operator=\"??\"][right.type=\"ObjectExpression\"][right.properties.length=0]",
                    "message": "An empty-object fallback hides a missing value. Handle the missing case."
                },
                {
                    "selector": "NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > Literal.arguments:first-child[value=/^[a-z]/]",
                    "message": "Start an error message with a capital letter."
                },
                {
                    "selector": "NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > TemplateLiteral.arguments:first-child[quasis.0.value.raw=/^[a-z]/]",
                    "message": "Start an error message with a capital letter."
                },
                {
                    "selector": "CallExpression:matches([callee.property.name=/^(debug|info|warn|error|fatal|trace)$/], [callee.property.name=\"log\"][callee.object.name!=\"console\"]) > TemplateLiteral.arguments:first-child[expressions.length>0]",
                    "message": "Log a stable message and pass the values as fields."
                },
                {
                    "selector": "ExportAllDeclaration",
                    "message": "Export values at their declaration instead of re-exporting them."
                },
                {
                    "selector": "ExportNamedDeclaration[source!=null]",
                    "message": "Export values at their declaration instead of re-exporting them."
                },
                {
                    "selector": "MemberExpression[object.type=\"MetaProperty\"][object.meta.name=\"import\"][object.property.name=\"meta\"][property.name=\"env\"]",
                    "message": "Read environment variables only in the files that structure.environment_readers lists, and pass the value in."
                },
                {
                    "selector": ":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#[^/]+\\/|@\\/)/][source.value!=/\\.[^/?.]+$/]:not([source.value=/\\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))",
                    "message": "Give an alias import its file extension."
                }
            ]
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "**/*",
                "**/*"
            ],
            [
                "**/*.astro",
                "**/*",
                "**/*"
            ]
        ]
    },
    // javascript
    {
        "ignores": [],
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    "selector": ":matches(Program, BlockStatement, StaticBlock) > BlockStatement",
                    "message": "A block that stands alone hides a step. Name the step as a function, or remove the braces."
                },
                {
                    "selector": "TSEnumDeclaration",
                    "message": "Use a literal union or an as-const object instead of an enum."
                },
                {
                    "selector": "TSAsExpression[expression.type=\"TSAsExpression\"]",
                    "message": "Do not assert twice. Narrow the value, fix its type, or check it at run time."
                },
                {
                    "selector": "TSTypeAssertion[expression.type=\"TSTypeAssertion\"]",
                    "message": "Do not assert twice. Narrow the value, fix its type, or check it at run time."
                },
                {
                    "selector": "TSAsExpression > TSAnyKeyword",
                    "message": "Do not assert to any. Give the value a real type, or check it at run time."
                },
                {
                    "selector": "TSTypeAssertion > TSAnyKeyword",
                    "message": "Do not assert to any. Give the value a real type, or check it at run time."
                },
                {
                    "selector": "TSAsExpression > TSNeverKeyword",
                    "message": "Do not assert to never to silence the type system."
                },
                {
                    "selector": "TSTypeAssertion > TSNeverKeyword",
                    "message": "Do not assert to never to silence the type system."
                },
                {
                    "selector": "LogicalExpression[operator=\"||\"][right.type=\"ObjectExpression\"][right.properties.length=0]",
                    "message": "An empty-object fallback hides a missing value. Handle the missing case."
                },
                {
                    "selector": "LogicalExpression[operator=\"??\"][right.type=\"ObjectExpression\"][right.properties.length=0]",
                    "message": "An empty-object fallback hides a missing value. Handle the missing case."
                },
                {
                    "selector": "NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > Literal.arguments:first-child[value=/^[a-z]/]",
                    "message": "Start an error message with a capital letter."
                },
                {
                    "selector": "NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > TemplateLiteral.arguments:first-child[quasis.0.value.raw=/^[a-z]/]",
                    "message": "Start an error message with a capital letter."
                },
                {
                    "selector": "CallExpression:matches([callee.property.name=/^(debug|info|warn|error|fatal|trace)$/], [callee.property.name=\"log\"][callee.object.name!=\"console\"]) > TemplateLiteral.arguments:first-child[expressions.length>0]",
                    "message": "Log a stable message and pass the values as fields."
                },
                {
                    "selector": "ExportAllDeclaration",
                    "message": "Export values at their declaration instead of re-exporting them."
                },
                {
                    "selector": "ExportNamedDeclaration[source!=null]",
                    "message": "Export values at their declaration instead of re-exporting them."
                },
                {
                    "selector": ":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#[^/]+\\/|@\\/)/][source.value!=/\\.[^/?.]+$/]:not([source.value=/\\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))",
                    "message": "Give an alias import its file extension."
                }
            ]
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "docs/**/*",
                "packages/cli/src/system/environment.ts"
            ],
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "docs/**/*",
                "tests/setup/system/environment.ts"
            ],
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "docs/**/*",
                "tests/setup/runner/unit.ts"
            ],
            [
                "**/*.astro",
                "docs/**/*",
                "packages/cli/src/system/environment.ts"
            ],
            [
                "**/*.astro",
                "docs/**/*",
                "tests/setup/system/environment.ts"
            ],
            [
                "**/*.astro",
                "docs/**/*",
                "tests/setup/runner/unit.ts"
            ]
        ]
    },
    // javascript
    {
        "ignores": [
            "packages/cli/src/system/environment.ts",
            "tests/setup/system/environment.ts",
            "tests/setup/runner/unit.ts"
        ],
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    "selector": ":matches(Program, BlockStatement, StaticBlock) > BlockStatement",
                    "message": "A block that stands alone hides a step. Name the step as a function, or remove the braces."
                },
                {
                    "selector": "TSEnumDeclaration",
                    "message": "Use a literal union or an as-const object instead of an enum."
                },
                {
                    "selector": "TSAsExpression[expression.type=\"TSAsExpression\"]",
                    "message": "Do not assert twice. Narrow the value, fix its type, or check it at run time."
                },
                {
                    "selector": "TSTypeAssertion[expression.type=\"TSTypeAssertion\"]",
                    "message": "Do not assert twice. Narrow the value, fix its type, or check it at run time."
                },
                {
                    "selector": "TSAsExpression > TSAnyKeyword",
                    "message": "Do not assert to any. Give the value a real type, or check it at run time."
                },
                {
                    "selector": "TSTypeAssertion > TSAnyKeyword",
                    "message": "Do not assert to any. Give the value a real type, or check it at run time."
                },
                {
                    "selector": "TSAsExpression > TSNeverKeyword",
                    "message": "Do not assert to never to silence the type system."
                },
                {
                    "selector": "TSTypeAssertion > TSNeverKeyword",
                    "message": "Do not assert to never to silence the type system."
                },
                {
                    "selector": "LogicalExpression[operator=\"||\"][right.type=\"ObjectExpression\"][right.properties.length=0]",
                    "message": "An empty-object fallback hides a missing value. Handle the missing case."
                },
                {
                    "selector": "LogicalExpression[operator=\"??\"][right.type=\"ObjectExpression\"][right.properties.length=0]",
                    "message": "An empty-object fallback hides a missing value. Handle the missing case."
                },
                {
                    "selector": "NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > Literal.arguments:first-child[value=/^[a-z]/]",
                    "message": "Start an error message with a capital letter."
                },
                {
                    "selector": "NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > TemplateLiteral.arguments:first-child[quasis.0.value.raw=/^[a-z]/]",
                    "message": "Start an error message with a capital letter."
                },
                {
                    "selector": "CallExpression:matches([callee.property.name=/^(debug|info|warn|error|fatal|trace)$/], [callee.property.name=\"log\"][callee.object.name!=\"console\"]) > TemplateLiteral.arguments:first-child[expressions.length>0]",
                    "message": "Log a stable message and pass the values as fields."
                },
                {
                    "selector": "ExportAllDeclaration",
                    "message": "Export values at their declaration instead of re-exporting them."
                },
                {
                    "selector": "ExportNamedDeclaration[source!=null]",
                    "message": "Export values at their declaration instead of re-exporting them."
                },
                {
                    "selector": "MemberExpression[object.type=\"MetaProperty\"][object.meta.name=\"import\"][object.property.name=\"meta\"][property.name=\"env\"]",
                    "message": "Read environment variables only in the files that structure.environment_readers lists, and pass the value in."
                },
                {
                    "selector": ":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#[^/]+\\/|@\\/)/][source.value!=/\\.[^/?.]+$/]:not([source.value=/\\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))",
                    "message": "Give an alias import its file extension."
                }
            ]
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "docs/**/*",
                "**/*"
            ],
            [
                "**/*.astro",
                "docs/**/*",
                "**/*"
            ]
        ]
    },
    // javascript
    {
        "ignores": [],
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    "selector": ":matches(Program, BlockStatement, StaticBlock) > BlockStatement",
                    "message": "A block that stands alone hides a step. Name the step as a function, or remove the braces."
                },
                {
                    "selector": "TSEnumDeclaration",
                    "message": "Use a literal union or an as-const object instead of an enum."
                },
                {
                    "selector": "TSAsExpression[expression.type=\"TSAsExpression\"]",
                    "message": "Do not assert twice. Narrow the value, fix its type, or check it at run time."
                },
                {
                    "selector": "TSTypeAssertion[expression.type=\"TSTypeAssertion\"]",
                    "message": "Do not assert twice. Narrow the value, fix its type, or check it at run time."
                },
                {
                    "selector": "TSAsExpression > TSAnyKeyword",
                    "message": "Do not assert to any. Give the value a real type, or check it at run time."
                },
                {
                    "selector": "TSTypeAssertion > TSAnyKeyword",
                    "message": "Do not assert to any. Give the value a real type, or check it at run time."
                },
                {
                    "selector": "TSAsExpression > TSNeverKeyword",
                    "message": "Do not assert to never to silence the type system."
                },
                {
                    "selector": "TSTypeAssertion > TSNeverKeyword",
                    "message": "Do not assert to never to silence the type system."
                },
                {
                    "selector": "LogicalExpression[operator=\"||\"][right.type=\"ObjectExpression\"][right.properties.length=0]",
                    "message": "An empty-object fallback hides a missing value. Handle the missing case."
                },
                {
                    "selector": "LogicalExpression[operator=\"??\"][right.type=\"ObjectExpression\"][right.properties.length=0]",
                    "message": "An empty-object fallback hides a missing value. Handle the missing case."
                },
                {
                    "selector": "NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > Literal.arguments:first-child[value=/^[a-z]/]",
                    "message": "Start an error message with a capital letter."
                },
                {
                    "selector": "NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > TemplateLiteral.arguments:first-child[quasis.0.value.raw=/^[a-z]/]",
                    "message": "Start an error message with a capital letter."
                },
                {
                    "selector": "CallExpression:matches([callee.property.name=/^(debug|info|warn|error|fatal|trace)$/], [callee.property.name=\"log\"][callee.object.name!=\"console\"]) > TemplateLiteral.arguments:first-child[expressions.length>0]",
                    "message": "Log a stable message and pass the values as fields."
                },
                {
                    "selector": "ExportAllDeclaration",
                    "message": "Export values at their declaration instead of re-exporting them."
                },
                {
                    "selector": "ExportNamedDeclaration[source!=null]",
                    "message": "Export values at their declaration instead of re-exporting them."
                },
                {
                    "selector": ":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#[^/]+\\/|@\\/)/][source.value!=/\\.[^/?.]+$/]:not([source.value=/\\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))",
                    "message": "Give an alias import its file extension."
                }
            ]
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/cli/**/*",
                "packages/cli/src/system/environment.ts"
            ],
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/cli/**/*",
                "tests/setup/system/environment.ts"
            ],
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/cli/**/*",
                "tests/setup/runner/unit.ts"
            ],
            [
                "**/*.astro",
                "packages/cli/**/*",
                "packages/cli/src/system/environment.ts"
            ],
            [
                "**/*.astro",
                "packages/cli/**/*",
                "tests/setup/system/environment.ts"
            ],
            [
                "**/*.astro",
                "packages/cli/**/*",
                "tests/setup/runner/unit.ts"
            ]
        ]
    },
    // javascript
    {
        "ignores": [
            "packages/cli/src/system/environment.ts",
            "tests/setup/system/environment.ts",
            "tests/setup/runner/unit.ts"
        ],
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    "selector": ":matches(Program, BlockStatement, StaticBlock) > BlockStatement",
                    "message": "A block that stands alone hides a step. Name the step as a function, or remove the braces."
                },
                {
                    "selector": "TSEnumDeclaration",
                    "message": "Use a literal union or an as-const object instead of an enum."
                },
                {
                    "selector": "TSAsExpression[expression.type=\"TSAsExpression\"]",
                    "message": "Do not assert twice. Narrow the value, fix its type, or check it at run time."
                },
                {
                    "selector": "TSTypeAssertion[expression.type=\"TSTypeAssertion\"]",
                    "message": "Do not assert twice. Narrow the value, fix its type, or check it at run time."
                },
                {
                    "selector": "TSAsExpression > TSAnyKeyword",
                    "message": "Do not assert to any. Give the value a real type, or check it at run time."
                },
                {
                    "selector": "TSTypeAssertion > TSAnyKeyword",
                    "message": "Do not assert to any. Give the value a real type, or check it at run time."
                },
                {
                    "selector": "TSAsExpression > TSNeverKeyword",
                    "message": "Do not assert to never to silence the type system."
                },
                {
                    "selector": "TSTypeAssertion > TSNeverKeyword",
                    "message": "Do not assert to never to silence the type system."
                },
                {
                    "selector": "LogicalExpression[operator=\"||\"][right.type=\"ObjectExpression\"][right.properties.length=0]",
                    "message": "An empty-object fallback hides a missing value. Handle the missing case."
                },
                {
                    "selector": "LogicalExpression[operator=\"??\"][right.type=\"ObjectExpression\"][right.properties.length=0]",
                    "message": "An empty-object fallback hides a missing value. Handle the missing case."
                },
                {
                    "selector": "NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > Literal.arguments:first-child[value=/^[a-z]/]",
                    "message": "Start an error message with a capital letter."
                },
                {
                    "selector": "NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > TemplateLiteral.arguments:first-child[quasis.0.value.raw=/^[a-z]/]",
                    "message": "Start an error message with a capital letter."
                },
                {
                    "selector": "CallExpression:matches([callee.property.name=/^(debug|info|warn|error|fatal|trace)$/], [callee.property.name=\"log\"][callee.object.name!=\"console\"]) > TemplateLiteral.arguments:first-child[expressions.length>0]",
                    "message": "Log a stable message and pass the values as fields."
                },
                {
                    "selector": "ExportAllDeclaration",
                    "message": "Export values at their declaration instead of re-exporting them."
                },
                {
                    "selector": "ExportNamedDeclaration[source!=null]",
                    "message": "Export values at their declaration instead of re-exporting them."
                },
                {
                    "selector": "MemberExpression[object.type=\"MetaProperty\"][object.meta.name=\"import\"][object.property.name=\"meta\"][property.name=\"env\"]",
                    "message": "Read environment variables only in the files that structure.environment_readers lists, and pass the value in."
                },
                {
                    "selector": ":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#[^/]+\\/|@\\/)/][source.value!=/\\.[^/?.]+$/]:not([source.value=/\\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))",
                    "message": "Give an alias import its file extension."
                }
            ]
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/cli/**/*",
                "**/*"
            ],
            [
                "**/*.astro",
                "packages/cli/**/*",
                "**/*"
            ]
        ]
    },
    // javascript
    {
        "ignores": [],
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    "selector": ":matches(Program, BlockStatement, StaticBlock) > BlockStatement",
                    "message": "A block that stands alone hides a step. Name the step as a function, or remove the braces."
                },
                {
                    "selector": "TSEnumDeclaration",
                    "message": "Use a literal union or an as-const object instead of an enum."
                },
                {
                    "selector": "TSAsExpression[expression.type=\"TSAsExpression\"]",
                    "message": "Do not assert twice. Narrow the value, fix its type, or check it at run time."
                },
                {
                    "selector": "TSTypeAssertion[expression.type=\"TSTypeAssertion\"]",
                    "message": "Do not assert twice. Narrow the value, fix its type, or check it at run time."
                },
                {
                    "selector": "TSAsExpression > TSAnyKeyword",
                    "message": "Do not assert to any. Give the value a real type, or check it at run time."
                },
                {
                    "selector": "TSTypeAssertion > TSAnyKeyword",
                    "message": "Do not assert to any. Give the value a real type, or check it at run time."
                },
                {
                    "selector": "TSAsExpression > TSNeverKeyword",
                    "message": "Do not assert to never to silence the type system."
                },
                {
                    "selector": "TSTypeAssertion > TSNeverKeyword",
                    "message": "Do not assert to never to silence the type system."
                },
                {
                    "selector": "LogicalExpression[operator=\"||\"][right.type=\"ObjectExpression\"][right.properties.length=0]",
                    "message": "An empty-object fallback hides a missing value. Handle the missing case."
                },
                {
                    "selector": "LogicalExpression[operator=\"??\"][right.type=\"ObjectExpression\"][right.properties.length=0]",
                    "message": "An empty-object fallback hides a missing value. Handle the missing case."
                },
                {
                    "selector": "NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > Literal.arguments:first-child[value=/^[a-z]/]",
                    "message": "Start an error message with a capital letter."
                },
                {
                    "selector": "NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > TemplateLiteral.arguments:first-child[quasis.0.value.raw=/^[a-z]/]",
                    "message": "Start an error message with a capital letter."
                },
                {
                    "selector": "CallExpression:matches([callee.property.name=/^(debug|info|warn|error|fatal|trace)$/], [callee.property.name=\"log\"][callee.object.name!=\"console\"]) > TemplateLiteral.arguments:first-child[expressions.length>0]",
                    "message": "Log a stable message and pass the values as fields."
                },
                {
                    "selector": "ExportAllDeclaration",
                    "message": "Export values at their declaration instead of re-exporting them."
                },
                {
                    "selector": "ExportNamedDeclaration[source!=null]",
                    "message": "Export values at their declaration instead of re-exporting them."
                },
                {
                    "selector": ":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#[^/]+\\/|@\\/)/][source.value!=/\\.[^/?.]+$/]:not([source.value=/\\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))",
                    "message": "Give an alias import its file extension."
                }
            ]
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/eslint-plugin/**/*",
                "packages/cli/src/system/environment.ts"
            ],
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/eslint-plugin/**/*",
                "tests/setup/system/environment.ts"
            ],
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/eslint-plugin/**/*",
                "tests/setup/runner/unit.ts"
            ],
            [
                "**/*.astro",
                "packages/eslint-plugin/**/*",
                "packages/cli/src/system/environment.ts"
            ],
            [
                "**/*.astro",
                "packages/eslint-plugin/**/*",
                "tests/setup/system/environment.ts"
            ],
            [
                "**/*.astro",
                "packages/eslint-plugin/**/*",
                "tests/setup/runner/unit.ts"
            ]
        ]
    },
    // javascript
    {
        "ignores": [
            "packages/cli/src/system/environment.ts",
            "tests/setup/system/environment.ts",
            "tests/setup/runner/unit.ts"
        ],
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    "selector": ":matches(Program, BlockStatement, StaticBlock) > BlockStatement",
                    "message": "A block that stands alone hides a step. Name the step as a function, or remove the braces."
                },
                {
                    "selector": "TSEnumDeclaration",
                    "message": "Use a literal union or an as-const object instead of an enum."
                },
                {
                    "selector": "TSAsExpression[expression.type=\"TSAsExpression\"]",
                    "message": "Do not assert twice. Narrow the value, fix its type, or check it at run time."
                },
                {
                    "selector": "TSTypeAssertion[expression.type=\"TSTypeAssertion\"]",
                    "message": "Do not assert twice. Narrow the value, fix its type, or check it at run time."
                },
                {
                    "selector": "TSAsExpression > TSAnyKeyword",
                    "message": "Do not assert to any. Give the value a real type, or check it at run time."
                },
                {
                    "selector": "TSTypeAssertion > TSAnyKeyword",
                    "message": "Do not assert to any. Give the value a real type, or check it at run time."
                },
                {
                    "selector": "TSAsExpression > TSNeverKeyword",
                    "message": "Do not assert to never to silence the type system."
                },
                {
                    "selector": "TSTypeAssertion > TSNeverKeyword",
                    "message": "Do not assert to never to silence the type system."
                },
                {
                    "selector": "LogicalExpression[operator=\"||\"][right.type=\"ObjectExpression\"][right.properties.length=0]",
                    "message": "An empty-object fallback hides a missing value. Handle the missing case."
                },
                {
                    "selector": "LogicalExpression[operator=\"??\"][right.type=\"ObjectExpression\"][right.properties.length=0]",
                    "message": "An empty-object fallback hides a missing value. Handle the missing case."
                },
                {
                    "selector": "NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > Literal.arguments:first-child[value=/^[a-z]/]",
                    "message": "Start an error message with a capital letter."
                },
                {
                    "selector": "NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > TemplateLiteral.arguments:first-child[quasis.0.value.raw=/^[a-z]/]",
                    "message": "Start an error message with a capital letter."
                },
                {
                    "selector": "CallExpression:matches([callee.property.name=/^(debug|info|warn|error|fatal|trace)$/], [callee.property.name=\"log\"][callee.object.name!=\"console\"]) > TemplateLiteral.arguments:first-child[expressions.length>0]",
                    "message": "Log a stable message and pass the values as fields."
                },
                {
                    "selector": "ExportAllDeclaration",
                    "message": "Export values at their declaration instead of re-exporting them."
                },
                {
                    "selector": "ExportNamedDeclaration[source!=null]",
                    "message": "Export values at their declaration instead of re-exporting them."
                },
                {
                    "selector": "MemberExpression[object.type=\"MetaProperty\"][object.meta.name=\"import\"][object.property.name=\"meta\"][property.name=\"env\"]",
                    "message": "Read environment variables only in the files that structure.environment_readers lists, and pass the value in."
                },
                {
                    "selector": ":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#[^/]+\\/|@\\/)/][source.value!=/\\.[^/?.]+$/]:not([source.value=/\\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))",
                    "message": "Give an alias import its file extension."
                }
            ]
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/eslint-plugin/**/*",
                "**/*"
            ],
            [
                "**/*.astro",
                "packages/eslint-plugin/**/*",
                "**/*"
            ]
        ]
    },
    // javascript
    {
        "ignores": [],
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    "selector": ":matches(Program, BlockStatement, StaticBlock) > BlockStatement",
                    "message": "A block that stands alone hides a step. Name the step as a function, or remove the braces."
                },
                {
                    "selector": "TSEnumDeclaration",
                    "message": "Use a literal union or an as-const object instead of an enum."
                },
                {
                    "selector": "TSAsExpression[expression.type=\"TSAsExpression\"]",
                    "message": "Do not assert twice. Narrow the value, fix its type, or check it at run time."
                },
                {
                    "selector": "TSTypeAssertion[expression.type=\"TSTypeAssertion\"]",
                    "message": "Do not assert twice. Narrow the value, fix its type, or check it at run time."
                },
                {
                    "selector": "TSAsExpression > TSAnyKeyword",
                    "message": "Do not assert to any. Give the value a real type, or check it at run time."
                },
                {
                    "selector": "TSTypeAssertion > TSAnyKeyword",
                    "message": "Do not assert to any. Give the value a real type, or check it at run time."
                },
                {
                    "selector": "TSAsExpression > TSNeverKeyword",
                    "message": "Do not assert to never to silence the type system."
                },
                {
                    "selector": "TSTypeAssertion > TSNeverKeyword",
                    "message": "Do not assert to never to silence the type system."
                },
                {
                    "selector": "LogicalExpression[operator=\"||\"][right.type=\"ObjectExpression\"][right.properties.length=0]",
                    "message": "An empty-object fallback hides a missing value. Handle the missing case."
                },
                {
                    "selector": "LogicalExpression[operator=\"??\"][right.type=\"ObjectExpression\"][right.properties.length=0]",
                    "message": "An empty-object fallback hides a missing value. Handle the missing case."
                },
                {
                    "selector": "NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > Literal.arguments:first-child[value=/^[a-z]/]",
                    "message": "Start an error message with a capital letter."
                },
                {
                    "selector": "NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > TemplateLiteral.arguments:first-child[quasis.0.value.raw=/^[a-z]/]",
                    "message": "Start an error message with a capital letter."
                },
                {
                    "selector": "CallExpression:matches([callee.property.name=/^(debug|info|warn|error|fatal|trace)$/], [callee.property.name=\"log\"][callee.object.name!=\"console\"]) > TemplateLiteral.arguments:first-child[expressions.length>0]",
                    "message": "Log a stable message and pass the values as fields."
                },
                {
                    "selector": "ExportAllDeclaration",
                    "message": "Export values at their declaration instead of re-exporting them."
                },
                {
                    "selector": "ExportNamedDeclaration[source!=null]",
                    "message": "Export values at their declaration instead of re-exporting them."
                },
                {
                    "selector": ":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#[^/]+\\/|@\\/)/][source.value!=/\\.[^/?.]+$/]:not([source.value=/\\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))",
                    "message": "Give an alias import its file extension."
                }
            ]
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "tests/**/*",
                "packages/cli/src/system/environment.ts"
            ],
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "tests/**/*",
                "tests/setup/system/environment.ts"
            ],
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "tests/**/*",
                "tests/setup/runner/unit.ts"
            ],
            [
                "**/*.astro",
                "tests/**/*",
                "packages/cli/src/system/environment.ts"
            ],
            [
                "**/*.astro",
                "tests/**/*",
                "tests/setup/system/environment.ts"
            ],
            [
                "**/*.astro",
                "tests/**/*",
                "tests/setup/runner/unit.ts"
            ]
        ]
    },
    // javascript
    {
        "ignores": [
            "packages/cli/src/system/environment.ts",
            "tests/setup/system/environment.ts",
            "tests/setup/runner/unit.ts"
        ],
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    "selector": ":matches(Program, BlockStatement, StaticBlock) > BlockStatement",
                    "message": "A block that stands alone hides a step. Name the step as a function, or remove the braces."
                },
                {
                    "selector": "TSEnumDeclaration",
                    "message": "Use a literal union or an as-const object instead of an enum."
                },
                {
                    "selector": "TSAsExpression[expression.type=\"TSAsExpression\"]",
                    "message": "Do not assert twice. Narrow the value, fix its type, or check it at run time."
                },
                {
                    "selector": "TSTypeAssertion[expression.type=\"TSTypeAssertion\"]",
                    "message": "Do not assert twice. Narrow the value, fix its type, or check it at run time."
                },
                {
                    "selector": "TSAsExpression > TSAnyKeyword",
                    "message": "Do not assert to any. Give the value a real type, or check it at run time."
                },
                {
                    "selector": "TSTypeAssertion > TSAnyKeyword",
                    "message": "Do not assert to any. Give the value a real type, or check it at run time."
                },
                {
                    "selector": "TSAsExpression > TSNeverKeyword",
                    "message": "Do not assert to never to silence the type system."
                },
                {
                    "selector": "TSTypeAssertion > TSNeverKeyword",
                    "message": "Do not assert to never to silence the type system."
                },
                {
                    "selector": "LogicalExpression[operator=\"||\"][right.type=\"ObjectExpression\"][right.properties.length=0]",
                    "message": "An empty-object fallback hides a missing value. Handle the missing case."
                },
                {
                    "selector": "LogicalExpression[operator=\"??\"][right.type=\"ObjectExpression\"][right.properties.length=0]",
                    "message": "An empty-object fallback hides a missing value. Handle the missing case."
                },
                {
                    "selector": "NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > Literal.arguments:first-child[value=/^[a-z]/]",
                    "message": "Start an error message with a capital letter."
                },
                {
                    "selector": "NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > TemplateLiteral.arguments:first-child[quasis.0.value.raw=/^[a-z]/]",
                    "message": "Start an error message with a capital letter."
                },
                {
                    "selector": "CallExpression:matches([callee.property.name=/^(debug|info|warn|error|fatal|trace)$/], [callee.property.name=\"log\"][callee.object.name!=\"console\"]) > TemplateLiteral.arguments:first-child[expressions.length>0]",
                    "message": "Log a stable message and pass the values as fields."
                },
                {
                    "selector": "ExportAllDeclaration",
                    "message": "Export values at their declaration instead of re-exporting them."
                },
                {
                    "selector": "ExportNamedDeclaration[source!=null]",
                    "message": "Export values at their declaration instead of re-exporting them."
                },
                {
                    "selector": "MemberExpression[object.type=\"MetaProperty\"][object.meta.name=\"import\"][object.property.name=\"meta\"][property.name=\"env\"]",
                    "message": "Read environment variables only in the files that structure.environment_readers lists, and pass the value in."
                },
                {
                    "selector": ":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#[^/]+\\/|@\\/)/][source.value!=/\\.[^/?.]+$/]:not([source.value=/\\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))",
                    "message": "Give an alias import its file extension."
                }
            ]
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "tests/**/*",
                "**/*"
            ],
            [
                "**/*.astro",
                "tests/**/*",
                "**/*"
            ]
        ]
    },
    // javascript
    {
        "ignores": [
            "docs/**",
            "packages/cli/**",
            "packages/eslint-plugin/**",
            "tests/**",
            "**/test/**",
            "**/tests/**",
            "**/__tests__/**",
            "**/*.test.*",
            "**/*.spec.*",
            "**/test_*.py",
            "**/*_test.py",
            "**/conftest.py",
            "**/Tests/**",
            "**/*Tests.swift",
            "scripts/**",
            "**/*.config.{js,mjs,cjs,ts}",
            ".mise/tasks/**"
        ],
        rules: {
            "no-console": "error"
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "**/*",
                "**/*"
            ],
            [
                "**/*.astro",
                "**/*",
                "**/*"
            ]
        ]
    },
    // javascript
    {
        "ignores": [
            "docs/**/test/**",
            "docs/**/tests/**",
            "docs/**/__tests__/**",
            "docs/**/*.test.*",
            "docs/**/*.spec.*",
            "docs/**/test_*.py",
            "docs/**/*_test.py",
            "docs/**/conftest.py",
            "docs/**/Tests/**",
            "docs/**/*Tests.swift",
            "docs/scripts/**",
            "docs/**/*.config.{js,mjs,cjs,ts}",
            "docs/.mise/tasks/**"
        ],
        rules: {
            "no-console": "error"
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "docs/**/*",
                "**/*"
            ],
            [
                "**/*.astro",
                "docs/**/*",
                "**/*"
            ]
        ]
    },
    // javascript
    {
        "ignores": [
            "packages/cli/**/test/**",
            "packages/cli/**/tests/**",
            "packages/cli/**/__tests__/**",
            "packages/cli/**/*.test.*",
            "packages/cli/**/*.spec.*",
            "packages/cli/**/test_*.py",
            "packages/cli/**/*_test.py",
            "packages/cli/**/conftest.py",
            "packages/cli/**/Tests/**",
            "packages/cli/**/*Tests.swift",
            "packages/cli/scripts/**",
            "packages/cli/**/*.config.{js,mjs,cjs,ts}",
            "packages/cli/.mise/tasks/**"
        ],
        rules: {
            "no-console": "error"
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/cli/**/*",
                "**/*"
            ],
            [
                "**/*.astro",
                "packages/cli/**/*",
                "**/*"
            ]
        ]
    },
    // javascript
    {
        "ignores": [
            "packages/eslint-plugin/**/test/**",
            "packages/eslint-plugin/**/tests/**",
            "packages/eslint-plugin/**/__tests__/**",
            "packages/eslint-plugin/**/*.test.*",
            "packages/eslint-plugin/**/*.spec.*",
            "packages/eslint-plugin/**/test_*.py",
            "packages/eslint-plugin/**/*_test.py",
            "packages/eslint-plugin/**/conftest.py",
            "packages/eslint-plugin/**/Tests/**",
            "packages/eslint-plugin/**/*Tests.swift",
            "packages/eslint-plugin/scripts/**",
            "packages/eslint-plugin/**/*.config.{js,mjs,cjs,ts}",
            "packages/eslint-plugin/.mise/tasks/**"
        ],
        rules: {
            "no-console": "error"
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/eslint-plugin/**/*",
                "**/*"
            ],
            [
                "**/*.astro",
                "packages/eslint-plugin/**/*",
                "**/*"
            ]
        ]
    },
    // javascript
    {
        "ignores": [
            "tests/**/test/**",
            "tests/**/tests/**",
            "tests/**/__tests__/**",
            "tests/**/*.test.*",
            "tests/**/*.spec.*",
            "tests/**/test_*.py",
            "tests/**/*_test.py",
            "tests/**/conftest.py",
            "tests/**/Tests/**",
            "tests/**/*Tests.swift",
            "tests/scripts/**",
            "tests/**/*.config.{js,mjs,cjs,ts}",
            "tests/.mise/tasks/**"
        ],
        rules: {
            "no-console": "error"
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "tests/**/*",
                "**/*"
            ],
            [
                "**/*.astro",
                "tests/**/*",
                "**/*"
            ]
        ]
    },
    // javascript
    {
        rules: {
            "n/no-process-exit": "off",
            "unicorn/no-process-exit": "off"
        },
        files: [
            [
                "scripts/**",
                "**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "scripts/**",
                "**/*",
                "**/*.astro"
            ],
            [
                "**/*.config.{js,mjs,cjs,ts}",
                "**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "**/*.config.{js,mjs,cjs,ts}",
                "**/*",
                "**/*.astro"
            ],
            [
                ".mise/tasks/**",
                "**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                ".mise/tasks/**",
                "**/*",
                "**/*.astro"
            ],
            [
                "docs/scripts/**",
                "docs/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "docs/scripts/**",
                "docs/**/*",
                "**/*.astro"
            ],
            [
                "docs/**/*.config.{js,mjs,cjs,ts}",
                "docs/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "docs/**/*.config.{js,mjs,cjs,ts}",
                "docs/**/*",
                "**/*.astro"
            ],
            [
                "docs/.mise/tasks/**",
                "docs/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "docs/.mise/tasks/**",
                "docs/**/*",
                "**/*.astro"
            ],
            [
                "packages/cli/scripts/**",
                "packages/cli/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "packages/cli/scripts/**",
                "packages/cli/**/*",
                "**/*.astro"
            ],
            [
                "packages/cli/**/*.config.{js,mjs,cjs,ts}",
                "packages/cli/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "packages/cli/**/*.config.{js,mjs,cjs,ts}",
                "packages/cli/**/*",
                "**/*.astro"
            ],
            [
                "packages/cli/.mise/tasks/**",
                "packages/cli/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "packages/cli/.mise/tasks/**",
                "packages/cli/**/*",
                "**/*.astro"
            ],
            [
                "packages/eslint-plugin/scripts/**",
                "packages/eslint-plugin/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "packages/eslint-plugin/scripts/**",
                "packages/eslint-plugin/**/*",
                "**/*.astro"
            ],
            [
                "packages/eslint-plugin/**/*.config.{js,mjs,cjs,ts}",
                "packages/eslint-plugin/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "packages/eslint-plugin/**/*.config.{js,mjs,cjs,ts}",
                "packages/eslint-plugin/**/*",
                "**/*.astro"
            ],
            [
                "packages/eslint-plugin/.mise/tasks/**",
                "packages/eslint-plugin/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "packages/eslint-plugin/.mise/tasks/**",
                "packages/eslint-plugin/**/*",
                "**/*.astro"
            ],
            [
                "tests/scripts/**",
                "tests/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "tests/scripts/**",
                "tests/**/*",
                "**/*.astro"
            ],
            [
                "tests/**/*.config.{js,mjs,cjs,ts}",
                "tests/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "tests/**/*.config.{js,mjs,cjs,ts}",
                "tests/**/*",
                "**/*.astro"
            ],
            [
                "tests/.mise/tasks/**",
                "tests/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "tests/.mise/tasks/**",
                "tests/**/*",
                "**/*.astro"
            ]
        ]
    },
    // javascript
    {
        rules: {
            "jsdoc/require-jsdoc": "off",
            "jsdoc/require-param": "off",
            "jsdoc/require-description": "off",
            "jsdoc/require-param-description": "off",
            "n/no-unpublished-import": "off",
            "n/no-unpublished-require": "off"
        },
        files: [
            [
                "**/test/**",
                "**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "**/test/**",
                "**/*",
                "**/*.astro"
            ],
            [
                "**/tests/**",
                "**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "**/tests/**",
                "**/*",
                "**/*.astro"
            ],
            [
                "**/__tests__/**",
                "**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "**/__tests__/**",
                "**/*",
                "**/*.astro"
            ],
            [
                "**/*.test.*",
                "**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "**/*.test.*",
                "**/*",
                "**/*.astro"
            ],
            [
                "**/*.spec.*",
                "**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "**/*.spec.*",
                "**/*",
                "**/*.astro"
            ],
            [
                "**/test_*.py",
                "**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "**/test_*.py",
                "**/*",
                "**/*.astro"
            ],
            [
                "**/*_test.py",
                "**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "**/*_test.py",
                "**/*",
                "**/*.astro"
            ],
            [
                "**/conftest.py",
                "**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "**/conftest.py",
                "**/*",
                "**/*.astro"
            ],
            [
                "**/Tests/**",
                "**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "**/Tests/**",
                "**/*",
                "**/*.astro"
            ],
            [
                "**/*Tests.swift",
                "**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "**/*Tests.swift",
                "**/*",
                "**/*.astro"
            ],
            [
                "docs/**/test/**",
                "docs/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "docs/**/test/**",
                "docs/**/*",
                "**/*.astro"
            ],
            [
                "docs/**/tests/**",
                "docs/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "docs/**/tests/**",
                "docs/**/*",
                "**/*.astro"
            ],
            [
                "docs/**/__tests__/**",
                "docs/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "docs/**/__tests__/**",
                "docs/**/*",
                "**/*.astro"
            ],
            [
                "docs/**/*.test.*",
                "docs/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "docs/**/*.test.*",
                "docs/**/*",
                "**/*.astro"
            ],
            [
                "docs/**/*.spec.*",
                "docs/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "docs/**/*.spec.*",
                "docs/**/*",
                "**/*.astro"
            ],
            [
                "docs/**/test_*.py",
                "docs/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "docs/**/test_*.py",
                "docs/**/*",
                "**/*.astro"
            ],
            [
                "docs/**/*_test.py",
                "docs/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "docs/**/*_test.py",
                "docs/**/*",
                "**/*.astro"
            ],
            [
                "docs/**/conftest.py",
                "docs/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "docs/**/conftest.py",
                "docs/**/*",
                "**/*.astro"
            ],
            [
                "docs/**/Tests/**",
                "docs/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "docs/**/Tests/**",
                "docs/**/*",
                "**/*.astro"
            ],
            [
                "docs/**/*Tests.swift",
                "docs/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "docs/**/*Tests.swift",
                "docs/**/*",
                "**/*.astro"
            ],
            [
                "packages/cli/**/test/**",
                "packages/cli/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "packages/cli/**/test/**",
                "packages/cli/**/*",
                "**/*.astro"
            ],
            [
                "packages/cli/**/tests/**",
                "packages/cli/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "packages/cli/**/tests/**",
                "packages/cli/**/*",
                "**/*.astro"
            ],
            [
                "packages/cli/**/__tests__/**",
                "packages/cli/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "packages/cli/**/__tests__/**",
                "packages/cli/**/*",
                "**/*.astro"
            ],
            [
                "packages/cli/**/*.test.*",
                "packages/cli/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "packages/cli/**/*.test.*",
                "packages/cli/**/*",
                "**/*.astro"
            ],
            [
                "packages/cli/**/*.spec.*",
                "packages/cli/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "packages/cli/**/*.spec.*",
                "packages/cli/**/*",
                "**/*.astro"
            ],
            [
                "packages/cli/**/test_*.py",
                "packages/cli/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "packages/cli/**/test_*.py",
                "packages/cli/**/*",
                "**/*.astro"
            ],
            [
                "packages/cli/**/*_test.py",
                "packages/cli/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "packages/cli/**/*_test.py",
                "packages/cli/**/*",
                "**/*.astro"
            ],
            [
                "packages/cli/**/conftest.py",
                "packages/cli/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "packages/cli/**/conftest.py",
                "packages/cli/**/*",
                "**/*.astro"
            ],
            [
                "packages/cli/**/Tests/**",
                "packages/cli/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "packages/cli/**/Tests/**",
                "packages/cli/**/*",
                "**/*.astro"
            ],
            [
                "packages/cli/**/*Tests.swift",
                "packages/cli/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "packages/cli/**/*Tests.swift",
                "packages/cli/**/*",
                "**/*.astro"
            ],
            [
                "packages/eslint-plugin/**/test/**",
                "packages/eslint-plugin/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "packages/eslint-plugin/**/test/**",
                "packages/eslint-plugin/**/*",
                "**/*.astro"
            ],
            [
                "packages/eslint-plugin/**/tests/**",
                "packages/eslint-plugin/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "packages/eslint-plugin/**/tests/**",
                "packages/eslint-plugin/**/*",
                "**/*.astro"
            ],
            [
                "packages/eslint-plugin/**/__tests__/**",
                "packages/eslint-plugin/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "packages/eslint-plugin/**/__tests__/**",
                "packages/eslint-plugin/**/*",
                "**/*.astro"
            ],
            [
                "packages/eslint-plugin/**/*.test.*",
                "packages/eslint-plugin/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "packages/eslint-plugin/**/*.test.*",
                "packages/eslint-plugin/**/*",
                "**/*.astro"
            ],
            [
                "packages/eslint-plugin/**/*.spec.*",
                "packages/eslint-plugin/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "packages/eslint-plugin/**/*.spec.*",
                "packages/eslint-plugin/**/*",
                "**/*.astro"
            ],
            [
                "packages/eslint-plugin/**/test_*.py",
                "packages/eslint-plugin/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "packages/eslint-plugin/**/test_*.py",
                "packages/eslint-plugin/**/*",
                "**/*.astro"
            ],
            [
                "packages/eslint-plugin/**/*_test.py",
                "packages/eslint-plugin/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "packages/eslint-plugin/**/*_test.py",
                "packages/eslint-plugin/**/*",
                "**/*.astro"
            ],
            [
                "packages/eslint-plugin/**/conftest.py",
                "packages/eslint-plugin/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "packages/eslint-plugin/**/conftest.py",
                "packages/eslint-plugin/**/*",
                "**/*.astro"
            ],
            [
                "packages/eslint-plugin/**/Tests/**",
                "packages/eslint-plugin/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "packages/eslint-plugin/**/Tests/**",
                "packages/eslint-plugin/**/*",
                "**/*.astro"
            ],
            [
                "packages/eslint-plugin/**/*Tests.swift",
                "packages/eslint-plugin/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "packages/eslint-plugin/**/*Tests.swift",
                "packages/eslint-plugin/**/*",
                "**/*.astro"
            ],
            [
                "tests/**/test/**",
                "tests/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "tests/**/test/**",
                "tests/**/*",
                "**/*.astro"
            ],
            [
                "tests/**/tests/**",
                "tests/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "tests/**/tests/**",
                "tests/**/*",
                "**/*.astro"
            ],
            [
                "tests/**/__tests__/**",
                "tests/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "tests/**/__tests__/**",
                "tests/**/*",
                "**/*.astro"
            ],
            [
                "tests/**/*.test.*",
                "tests/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "tests/**/*.test.*",
                "tests/**/*",
                "**/*.astro"
            ],
            [
                "tests/**/*.spec.*",
                "tests/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "tests/**/*.spec.*",
                "tests/**/*",
                "**/*.astro"
            ],
            [
                "tests/**/test_*.py",
                "tests/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "tests/**/test_*.py",
                "tests/**/*",
                "**/*.astro"
            ],
            [
                "tests/**/*_test.py",
                "tests/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "tests/**/*_test.py",
                "tests/**/*",
                "**/*.astro"
            ],
            [
                "tests/**/conftest.py",
                "tests/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "tests/**/conftest.py",
                "tests/**/*",
                "**/*.astro"
            ],
            [
                "tests/**/Tests/**",
                "tests/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "tests/**/Tests/**",
                "tests/**/*",
                "**/*.astro"
            ],
            [
                "tests/**/*Tests.swift",
                "tests/**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "tests/**/*Tests.swift",
                "tests/**/*",
                "**/*.astro"
            ]
        ]
    },
    // javascript: packageJson["configs"]["recommended"].rules
    {
        ...packageJson["configs"]["recommended"],
        rules: {
            ...packageJson["configs"]["recommended"].rules
        },
        files: [
            "**/package.json"
        ]
    },
    // javascript: prettierConfig.rules
    {
        ...prettierConfig,
        rules: {
            ...prettierConfig.rules
        },
        files: [
            "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
            "**/*.astro"
        ]
    },
    // javascript
    {
        rules: {
            "package-json/restrict-dependency-ranges": [
                "error",
                {
                    "rangeType": "pin"
                }
            ]
        },
        files: [
            "**/package.json"
        ]
    },
    // javascript
    {
        rules: {
            "package-json/require-packageManager": "error"
        },
        files: [
            "package.json"
        ]
    },
    // javascript
    {
        rules: {
            "max-lines": [
                "error",
                {
                    "max": 300,
                    "skipBlankLines": true,
                    "skipComments": true
                }
            ],
            "max-lines-per-function": [
                "error",
                {
                    "max": 60,
                    "skipBlankLines": true,
                    "skipComments": true,
                    "IIFEs": true
                }
            ],
            "max-params": [
                "error",
                {
                    "max": 7,
                    "countVoidThis": false
                }
            ],
            "max-depth": [
                "error",
                3
            ],
            "max-statements": [
                "error",
                30
            ],
            "max-nested-callbacks": [
                "error",
                3
            ],
            "complexity": [
                "error",
                8
            ],
            "sonarjs/cognitive-complexity": [
                "error",
                8
            ]
        },
        files: [
            "**/*.{js,mjs,cjs,jsx}"
        ]
    },
    // javascript
    {
        "ignores": [
            "packages/cli/src/system/environment.ts",
            "packages/cli/src/system/environment.ts/**",
            "tests/setup/system/environment.ts",
            "tests/setup/system/environment.ts/**",
            "tests/setup/runner/unit.ts",
            "tests/setup/runner/unit.ts/**"
        ],
        rules: {
            "n/no-process-env": [
                "error",
                {
                    "allowedVariables": [
                        "NODE_ENV"
                    ]
                }
            ],
            "no-restricted-properties": [
                "error",
                {
                    "object": "Bun",
                    "property": "env"
                },
                {
                    "object": "Deno",
                    "property": "env"
                }
            ]
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,vue,svelte,astro}"
            ],
            [
                "**/*.astro",
                "**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,vue,svelte,astro}"
            ]
        ]
    },
    // javascript: your own rule options
    {
        "ignores": [
            "packages/cli/src/system/environment.ts",
            "packages/cli/src/system/environment.ts/**",
            "tests/setup/system/environment.ts",
            "tests/setup/system/environment.ts/**",
            "tests/setup/runner/unit.ts",
            "tests/setup/runner/unit.ts/**"
        ],
        rules: {
            "no-restricted-properties": [
                "error",
                {
                    "object": "Bun",
                    "property": "env"
                },
                {
                    "object": "Deno",
                    "property": "env"
                },
                {
                    "property": "localeCompare",
                    "message": "Use compareText for stable ordering."
                }
            ]
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,vue,svelte,astro}",
                "**/*",
                "packages/cli/src/**"
            ],
            [
                "**/*.astro",
                "**/*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,vue,svelte,astro}",
                "**/*",
                "packages/cli/src/**"
            ]
        ]
    },
    // javascript
    {
        "ignores": [],
        rules: {
            "gspot/no-trivial-files": [
                gspot.configs.all.rules["gspot/no-trivial-files"] ?? 'off',
                {
                    "allowIndex": false
                }
            ],
            "gspot/no-trivial-functions": [
                gspot.configs.all.rules["gspot/no-trivial-functions"] ?? 'off',
                {
                    "trivialFunctionStatements": 2
                }
            ]
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "**/*",
                "**/*.{js,mjs,cjs,jsx}"
            ],
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "**/*",
                "**/*.{ts,mts,cts,tsx,vue,svelte,astro}"
            ],
            [
                "**/*.astro",
                "**/*",
                "**/*.{js,mjs,cjs,jsx}"
            ],
            [
                "**/*.astro",
                "**/*",
                "**/*.{ts,mts,cts,tsx,vue,svelte,astro}"
            ]
        ]
    },
    // javascript
    {
        "ignores": [],
        rules: {
            "gspot/no-trivial-files": "off"
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "docs/**/*",
                "**/*.astro"
            ],
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "docs/**/*",
                "**/*.astro/*.ts"
            ],
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "docs/**/*",
                "**/*.astro/*.js"
            ],
            [
                "**/*.astro",
                "docs/**/*",
                "**/*.astro"
            ],
            [
                "**/*.astro",
                "docs/**/*",
                "**/*.astro/*.ts"
            ],
            [
                "**/*.astro",
                "docs/**/*",
                "**/*.astro/*.js"
            ]
        ]
    },
    // javascript
    {
        "ignores": [],
        rules: {
            "package-json/restrict-dependency-ranges": "off"
        },
        files: [
            [
                "**/package.json",
                "**/*",
                "packages/eslint-plugin/package.json"
            ],
            [
                "**/package.json",
                "**/*",
                "packages/eslint-plugin/package.json/**"
            ]
        ]
    },
    // javascript
    {
        rules: {
            "local/no-promise-matchers": [
                "error"
            ],
            "local/schema-location": [
                "error",
                {
                    "folders": [
                        "packages/cli/src/schemas",
                        "tests/schemas"
                    ]
                }
            ]
        },
        files: [
            "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
            "**/*.astro"
        ]
    },
];
