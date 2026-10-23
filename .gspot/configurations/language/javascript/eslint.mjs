import { root, runtimeMatches, stripRuntimeGlobals, componentMatches } from "./eslint-runtime.mjs";
import { join } from "node:path";
import eslint from "@eslint/js";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import packageJson from "eslint-plugin-package-json";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";
import gspot from "@gspothq/eslint-plugin";
import importX from "eslint-plugin-import-x";
import jsdoc from "eslint-plugin-jsdoc";
import nodePlugin from "eslint-plugin-n";
import regexp from "eslint-plugin-regexp";
import security from "eslint-plugin-security";
import perfectionist from "eslint-plugin-perfectionist";
import boundaries from "eslint-plugin-boundaries";
import localPlugin0 from "../../../../packages/eslint-plugin/repository.mjs";
import tseslint from 'typescript-eslint';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import astroPlugin from 'eslint-plugin-astro';
import zodPlugin from 'eslint-plugin-zod';
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
    // Shared ignore sections.
    {
        "ignores": [
            "**/build/**",
            "**/.DS_Store",
            "**/Thumbs.db",
            "**/*.swp",
            "**/*~",
            "**/.idea/**",
            "**/.vscode/**",
            "**/node_modules/**",
            "**/.env",
            "**/.env.*",
            "**/*.log",
            ".wrangler/**",
            "packages/*/dist/**",
            "packages/cli/grammars/**",
            "docs/dist/**",
            "docs/.astro/**",
            "docs/.wrangler/**",
            "findings/**",
            ".gspot/**",
            "**/eslint.config.mjs",
            "**/.markdownlint.jsonc",
            "**/.editorconfig",
            "**/prettier.config.mjs",
            "**/.prettierignore",
            "docs/.markdownlint.jsonc",
            "docs/.stylelintrc.json",
            "packages/cli/.markdownlint.jsonc",
            "packages/eslint-plugin/.markdownlint.jsonc",
            "packages/cli/configurations/**/eslint-presets.json",
            "packages/cli/configurations/**/*-names.json",
            "docs/worker-configuration.d.ts",
            "docs/cloudflare-env.d.ts",
            "**/bower_components/**",
            "**/bun.lock",
            "**/.env*"
        ]
    },

    // JavaScript and repository settings: eslint["configs"]["recommended"].rules
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

    // JavaScript and repository settings: sonarjs["configs"]["recommended"].rules
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

    // JavaScript and repository settings: unicorn["configs"]["recommended"].rules
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

    // JavaScript and repository settings: gspot.configs.all.rules
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
            "repository": localPlugin0
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
                "[\\\\/]\\.idea[\\\\/]",
                "[\\\\/]\\.vscode[\\\\/]",
                "[\\\\/]node_modules[\\\\/]",
                "[\\\\/]\\.wrangler[\\\\/]",
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
            "unicorn/no-lonely-if": "off",
            "unicorn/prevent-abbreviations": "off",
            "unicorn/filename-case": "off",
            "unicorn/no-null": "off",
            "unicorn/no-useless-undefined": "off",
            "unicorn/import-style": "off",
            "unicorn/prefer-export-from": "off",
            "security/detect-disable-mustache-escape": "error",
            "security/detect-eval-with-expression": "off",
            "security/detect-new-buffer": "off",
            "security/detect-non-literal-regexp": "off",
            "security/detect-non-literal-require": "error",
            "security/detect-pseudoRandomBytes": "error",
            "security/detect-unsafe-regex": "off",
            "security/detect-object-injection": "off",
            "security/detect-non-literal-fs-filename": "off",
            "jsdoc/require-param-name": "error",
            "jsdoc/check-param-names": "error",
            "jsdoc/check-tag-names": "error",
            "jsdoc/no-types": "off",
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
            "no-param-reassign": "error",
            "sonarjs/no-nested-switch": "error",
            "sonarjs/prefer-object-literal": "error",
            "sonarjs/no-commented-code": "error",
            "sonarjs/prefer-immediate-return": "error",
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
            "security/detect-child-process": "error",
            "security/detect-possible-timing-attacks": "error",
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
            "jsdoc/require-returns": "error",
            "jsdoc/require-returns-description": "error",
            "jsdoc/tag-lines": [
                "error",
                "any",
                {
                    "startLines": 1
                }
            ],
            "no-restricted-syntax": [
                "error",
                {
                    "selector": "TSEnumDeclaration",
                    "message": "Use a literal union or an as-const object instead of an enum."
                },
                {
                    "selector": "TSAsExpression[expression.type=\"TSAsExpression\"]",
                    "message": "Do not assert twice. Narrow the value, improve the type, or add a typed boundary."
                },
                {
                    "selector": "TSTypeAssertion[expression.type=\"TSTypeAssertion\"]",
                    "message": "Do not assert twice. Narrow the value, improve the type, or add a typed boundary."
                },
                {
                    "selector": "TSAsExpression > TSAnyKeyword",
                    "message": "Do not assert to any. Add a typed boundary or runtime narrowing instead."
                },
                {
                    "selector": "TSTypeAssertion > TSAnyKeyword",
                    "message": "Do not assert to any. Add a typed boundary or runtime narrowing instead."
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
                        "#cli/": "packages/cli/src/",
                        "#tests/": "tests/",
                        "#cli-package": "packages/cli/package.json",
                        "#eslint-plugin/": "packages/eslint-plugin/src/",
                        "#eslint-plugin-package": "packages/eslint-plugin/package.json",
                        "#root-package": "package.json"
                    }
                }
            ],
            "import-x/exports-last": "error",
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

    // JavaScript and repository settings
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

    // JavaScript and repository settings
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

    // JavaScript and repository settings
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
                        "#cli/": "packages/cli/src/",
                        "#tests/": "tests/",
                        "#cli-package": "packages/cli/package.json",
                        "#eslint-plugin/": "packages/eslint-plugin/src/",
                        "#eslint-plugin-package": "packages/eslint-plugin/package.json",
                        "#root-package": "package.json"
                    }
                }
            ]
        },
        files: [
            "docs/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
        ]
    },

    // JavaScript and repository settings
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
                        "#cli/": "packages/cli/src/",
                        "#tests/": "tests/",
                        "#cli-package": "packages/cli/package.json",
                        "#eslint-plugin/": "packages/eslint-plugin/src/",
                        "#eslint-plugin-package": "packages/eslint-plugin/package.json",
                        "#root-package": "package.json"
                    }
                }
            ]
        },
        files: [
            "packages/cli/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
        ]
    },

    // JavaScript and repository settings
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

    // JavaScript and repository settings
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

    // JavaScript and repository settings
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

    // JavaScript and repository settings
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

    // JavaScript and repository settings
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

    // JavaScript and repository settings
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

    // JavaScript and repository settings
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

    // JavaScript and repository settings
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
                        "category": "import-rule:ownership",
                        "pattern": [
                            "packages/cli/src/ownership/**"
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
                        "category": "import-rule:generation",
                        "pattern": [
                            "packages/cli/src/generation/**",
                            "packages/cli/src/schemas/generation.ts"
                        ]
                    },
                    {
                        "category": "import-rule:tools",
                        "pattern": [
                            "packages/cli/src/tools/**"
                        ]
                    },
                    {
                        "category": "import-rule:session",
                        "pattern": [
                            "packages/cli/src/session.ts"
                        ]
                    },
                    {
                        "category": "import-rule:install",
                        "pattern": [
                            "packages/cli/src/install/**",
                            "packages/cli/src/schemas/install/**"
                        ]
                    },
                    {
                        "category": "import-rule:apply",
                        "pattern": [
                            "packages/cli/src/apply/**"
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
                            "packages/cli/src/bin.ts"
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
                            "packages/eslint-plugin/src/schemas/**",
                            "packages/eslint-plugin/plugin.d.ts",
                            "packages/eslint-plugin/repository.mjs"
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
                        "docs/tsconfig.json",
                        "packages/cli/tsconfig.json",
                        "packages/eslint-plugin/tsconfig.json",
                        "tsconfig.json"
                    ].map((project) => join(root, project))
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
                            "message": "Import rule \"cli-config\" may import its own files and \"cli-types\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, or add that rule to can_also_import or can_import."
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
                            "message": "Import rule \"cli-types\" may import its own files and \"cli-config\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, or add that rule to can_also_import or can_import."
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
                            "message": "Import rule \"system\" may import its own files and \"cli-config\", \"cli-types\", \"repository\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, or add that rule to can_also_import or can_import."
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
                                                "import-rule:cli-types",
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
                            "message": "Import rule \"parsers\" may import its own files and \"cli-config\", \"cli-types\", \"system\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, or add that rule to can_also_import or can_import."
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
                            "message": "Import rule \"configurations\" may import its own files and \"cli-config\", \"cli-types\", \"system\", \"parsers\", \"repository\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, or add that rule to can_also_import or can_import."
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
                                                "import-rule:parsers",
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
                            "message": "Import rule \"repository\" may import its own files and \"cli-config\", \"cli-types\", \"system\", \"parsers\", \"configurations\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, or add that rule to can_also_import or can_import."
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
                                    "categories": "import-rule:ownership"
                                }
                            },
                            "disallow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            },
                            "message": "Import rule \"ownership\" may import its own files and \"cli-config\", \"cli-types\", \"system\", \"parsers\", \"configurations\", \"repository\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, or add that rule to can_also_import or can_import."
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:ownership"
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "categories": {
                                            "anyOf": [
                                                "import-rule:ownership",
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
                            "message": "Import rule \"settings\" may import its own files and \"cli-config\", \"cli-types\", \"system\", \"parsers\", \"configurations\", \"repository\", \"ownership\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, or add that rule to can_also_import or can_import."
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
                                                "import-rule:repository",
                                                "import-rule:ownership"
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
                            "message": "Import rule \"planning\" may import its own files and \"cli-config\", \"cli-types\", \"system\", \"parsers\", \"configurations\", \"repository\", \"ownership\", \"settings\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, or add that rule to can_also_import or can_import."
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
                                                "import-rule:ownership",
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
                            "message": "Import rule \"generation\" may import its own files and \"cli-config\", \"cli-types\", \"system\", \"parsers\", \"configurations\", \"repository\", \"ownership\", \"settings\", \"planning\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, or add that rule to can_also_import or can_import."
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
                                                "import-rule:ownership",
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
                            "message": "Import rule \"tools\" may import its own files and \"cli-config\", \"cli-types\", \"system\", \"parsers\", \"configurations\", \"repository\", \"ownership\", \"settings\", \"planning\", \"generation\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, or add that rule to can_also_import or can_import."
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
                                                "import-rule:ownership",
                                                "import-rule:settings",
                                                "import-rule:planning",
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
                                    "categories": "import-rule:session"
                                }
                            },
                            "disallow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            },
                            "message": "Import rule \"session\" may import its own files and \"cli-config\", \"cli-types\", \"system\", \"parsers\", \"configurations\", \"repository\", \"ownership\", \"settings\", \"planning\", \"generation\", \"tools\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, or add that rule to can_also_import or can_import."
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:session"
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "categories": {
                                            "anyOf": [
                                                "import-rule:session",
                                                "import-rule:cli-config",
                                                "import-rule:cli-types",
                                                "import-rule:system",
                                                "import-rule:parsers",
                                                "import-rule:configurations",
                                                "import-rule:repository",
                                                "import-rule:ownership",
                                                "import-rule:settings",
                                                "import-rule:planning",
                                                "import-rule:generation",
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
                                    "categories": "import-rule:install"
                                }
                            },
                            "disallow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            },
                            "message": "Import rule \"install\" may import its own files and \"cli-config\", \"cli-types\", \"system\", \"parsers\", \"configurations\", \"repository\", \"ownership\", \"settings\", \"planning\", \"generation\", \"tools\", \"session\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, or add that rule to can_also_import or can_import."
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:install"
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "categories": {
                                            "anyOf": [
                                                "import-rule:install",
                                                "import-rule:cli-config",
                                                "import-rule:cli-types",
                                                "import-rule:system",
                                                "import-rule:parsers",
                                                "import-rule:configurations",
                                                "import-rule:repository",
                                                "import-rule:ownership",
                                                "import-rule:settings",
                                                "import-rule:planning",
                                                "import-rule:generation",
                                                "import-rule:tools",
                                                "import-rule:session"
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:apply"
                                }
                            },
                            "disallow": {
                                "to": {
                                    "file": {
                                        "path": "**/*"
                                    }
                                }
                            },
                            "message": "Import rule \"apply\" may import its own files and \"cli-config\", \"cli-types\", \"system\", \"parsers\", \"configurations\", \"repository\", \"ownership\", \"settings\", \"planning\", \"generation\", \"tools\", \"session\", \"install\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, or add that rule to can_also_import or can_import."
                        },
                        {
                            "from": {
                                "file": {
                                    "categories": "import-rule:apply"
                                }
                            },
                            "allow": {
                                "to": {
                                    "file": {
                                        "categories": {
                                            "anyOf": [
                                                "import-rule:apply",
                                                "import-rule:cli-config",
                                                "import-rule:cli-types",
                                                "import-rule:system",
                                                "import-rule:parsers",
                                                "import-rule:configurations",
                                                "import-rule:repository",
                                                "import-rule:ownership",
                                                "import-rule:settings",
                                                "import-rule:planning",
                                                "import-rule:generation",
                                                "import-rule:tools",
                                                "import-rule:session",
                                                "import-rule:install"
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
                            "message": "Import rule \"runs\" may import its own files and \"cli-config\", \"cli-types\", \"system\", \"parsers\", \"configurations\", \"repository\", \"ownership\", \"settings\", \"planning\", \"generation\", \"tools\", \"session\", \"install\", \"apply\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, or add that rule to can_also_import or can_import."
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
                                                "import-rule:ownership",
                                                "import-rule:settings",
                                                "import-rule:planning",
                                                "import-rule:generation",
                                                "import-rule:tools",
                                                "import-rule:session",
                                                "import-rule:install",
                                                "import-rule:apply"
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
                            "message": "Import rule \"checks\" may import its own files and \"cli-config\", \"cli-types\", \"system\", \"parsers\", \"configurations\", \"repository\", \"ownership\", \"settings\", \"planning\", \"generation\", \"tools\", \"session\", \"install\", \"apply\", \"runs\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, or add that rule to can_also_import or can_import."
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
                                                "import-rule:ownership",
                                                "import-rule:settings",
                                                "import-rule:planning",
                                                "import-rule:generation",
                                                "import-rule:tools",
                                                "import-rule:session",
                                                "import-rule:install",
                                                "import-rule:apply",
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
                            "message": "Import rule \"commands\" may import its own files and \"cli-config\", \"cli-types\", \"system\", \"parsers\", \"configurations\", \"repository\", \"ownership\", \"settings\", \"planning\", \"generation\", \"tools\", \"session\", \"install\", \"apply\", \"runs\", \"checks\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, or add that rule to can_also_import or can_import."
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
                                                "import-rule:ownership",
                                                "import-rule:settings",
                                                "import-rule:planning",
                                                "import-rule:generation",
                                                "import-rule:tools",
                                                "import-rule:session",
                                                "import-rule:install",
                                                "import-rule:apply",
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
                            "message": "Import rule \"main\" may import its own files and \"cli-config\", \"cli-types\", \"system\", \"parsers\", \"configurations\", \"repository\", \"ownership\", \"settings\", \"planning\", \"generation\", \"tools\", \"session\", \"install\", \"apply\", \"runs\", \"checks\", \"commands\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, or add that rule to can_also_import or can_import."
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
                                                "import-rule:ownership",
                                                "import-rule:settings",
                                                "import-rule:planning",
                                                "import-rule:generation",
                                                "import-rule:tools",
                                                "import-rule:session",
                                                "import-rule:install",
                                                "import-rule:apply",
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
                            "message": "Import rule \"plugin-config\" may import only its own files, not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, or add that rule to can_also_import or can_import."
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
                            "message": "Import rule \"plugin-types\" may import only its own files, not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, or add that rule to can_also_import or can_import."
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
                            "message": "Import rule \"plugin\" may import its own files and \"plugin-config\", \"plugin-types\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, or add that rule to can_also_import or can_import."
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
                            "message": "Import rule \"docs-config\" may import its own files and \"cli-config\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, or add that rule to can_also_import or can_import."
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
                            "message": "Import rule \"docs-types\" may import its own files and \"cli-types\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, or add that rule to can_also_import or can_import."
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
                            "message": "Import rule \"docs\" may import its own files and \"cli-config\", \"cli-types\", \"system\", \"parsers\", \"configurations\", \"repository\", \"ownership\", \"settings\", \"planning\", \"generation\", \"tools\", \"session\", \"install\", \"apply\", \"runs\", \"checks\", \"commands\", \"main\", \"plugin-config\", \"plugin-types\", \"plugin\", \"docs-config\", \"docs-types\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, or add that rule to can_also_import or can_import."
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
                                                "import-rule:ownership",
                                                "import-rule:settings",
                                                "import-rule:planning",
                                                "import-rule:generation",
                                                "import-rule:tools",
                                                "import-rule:session",
                                                "import-rule:install",
                                                "import-rule:apply",
                                                "import-rule:runs",
                                                "import-rule:checks",
                                                "import-rule:commands",
                                                "import-rule:main",
                                                "import-rule:plugin-config",
                                                "import-rule:plugin-types",
                                                "import-rule:plugin",
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
                            "message": "Import rule \"tests-data\" may import its own files and \"cli-config\", \"tests-setup\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, or add that rule to can_also_import or can_import."
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
                            "message": "Import rule \"tests-types\" may import its own files and \"cli-types\", \"plugin-types\", \"tests-data\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, or add that rule to can_also_import or can_import."
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
                            "message": "Import rule \"tests-setup\" may import its own files and \"cli-config\", \"cli-types\", \"system\", \"parsers\", \"configurations\", \"repository\", \"ownership\", \"settings\", \"planning\", \"generation\", \"tools\", \"session\", \"install\", \"apply\", \"runs\", \"checks\", \"commands\", \"main\", \"plugin-config\", \"plugin-types\", \"plugin\", \"docs-config\", \"docs-types\", \"docs\", \"tests-data\", \"tests-types\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, or add that rule to can_also_import or can_import."
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
                                                "import-rule:ownership",
                                                "import-rule:settings",
                                                "import-rule:planning",
                                                "import-rule:generation",
                                                "import-rule:tools",
                                                "import-rule:session",
                                                "import-rule:install",
                                                "import-rule:apply",
                                                "import-rule:runs",
                                                "import-rule:checks",
                                                "import-rule:commands",
                                                "import-rule:main",
                                                "import-rule:plugin-config",
                                                "import-rule:plugin-types",
                                                "import-rule:plugin",
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
                            "message": "Import rule \"tests\" may import its own files and \"cli-config\", \"cli-types\", \"system\", \"parsers\", \"configurations\", \"repository\", \"ownership\", \"settings\", \"planning\", \"generation\", \"tools\", \"session\", \"install\", \"apply\", \"runs\", \"checks\", \"commands\", \"main\", \"plugin-config\", \"plugin-types\", \"plugin\", \"docs-config\", \"docs-types\", \"docs\", \"tests-data\", \"tests-types\", \"tests-setup\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, or add that rule to can_also_import or can_import."
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
                                                "import-rule:ownership",
                                                "import-rule:settings",
                                                "import-rule:planning",
                                                "import-rule:generation",
                                                "import-rule:tools",
                                                "import-rule:session",
                                                "import-rule:install",
                                                "import-rule:apply",
                                                "import-rule:runs",
                                                "import-rule:checks",
                                                "import-rule:commands",
                                                "import-rule:main",
                                                "import-rule:plugin-config",
                                                "import-rule:plugin-types",
                                                "import-rule:plugin",
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
                            "message": "Import rule \"config-files\" may import its own files and \"cli-types\", not {{dependency.source}} from {{to.file.categories.[0]}}. Move the code, or add that rule to can_also_import or can_import."
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
                                            "import-rule:ownership",
                                            "import-rule:settings",
                                            "import-rule:planning",
                                            "import-rule:generation",
                                            "import-rule:tools",
                                            "import-rule:session",
                                            "import-rule:install",
                                            "import-rule:apply",
                                            "import-rule:runs",
                                            "import-rule:checks",
                                            "import-rule:commands",
                                            "import-rule:main",
                                            "import-rule:plugin-config",
                                            "import-rule:plugin-types",
                                            "import-rule:plugin",
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
                                                "import-rule:ownership",
                                                "import-rule:settings",
                                                "import-rule:planning",
                                                "import-rule:generation",
                                                "import-rule:tools",
                                                "import-rule:session",
                                                "import-rule:install",
                                                "import-rule:apply",
                                                "import-rule:runs",
                                                "import-rule:checks",
                                                "import-rule:commands",
                                                "import-rule:main",
                                                "import-rule:plugin-config",
                                                "import-rule:plugin-types",
                                                "import-rule:plugin",
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




    // typescript: tseslint["configs"]["strictTypeChecked"][0].rules
    stripRuntimeGlobals({
        ...tseslint["configs"]["strictTypeChecked"][0],
        "ignores": [
            "docs/**",
            "packages/cli/**",
            "packages/eslint-plugin/**",
            "tests/**"
        ],
        rules: {
            ...tseslint["configs"]["strictTypeChecked"][0].rules
        },
        files: [
            [
                "**/*.{ts,mts,cts,tsx}",
                "**/*"
            ]
        ]
    }, globals),

    // typescript: tseslint["configs"]["strictTypeChecked"][1].rules
    stripRuntimeGlobals({
        ...tseslint["configs"]["strictTypeChecked"][1],
        "ignores": [
            "docs/**",
            "packages/cli/**",
            "packages/eslint-plugin/**",
            "tests/**"
        ],
        rules: {
            ...tseslint["configs"]["strictTypeChecked"][1].rules
        },
        files: [
            [
                "**/*.{ts,mts,cts,tsx}",
                "**/*"
            ],
            [
                "**/*.astro",
                "**/*"
            ]
        ]
    }, globals),

    // typescript: tseslint["configs"]["strictTypeChecked"][2].rules
    stripRuntimeGlobals({
        ...tseslint["configs"]["strictTypeChecked"][2],
        "ignores": [
            "docs/**",
            "packages/cli/**",
            "packages/eslint-plugin/**",
            "tests/**"
        ],
        rules: {
            ...tseslint["configs"]["strictTypeChecked"][2].rules
        },
        files: [
            [
                "**/*.{ts,mts,cts,tsx}",
                "**/*"
            ],
            [
                "**/*.astro",
                "**/*"
            ]
        ]
    }, globals),

    // typescript
    stripRuntimeGlobals({
        plugins: {
            '@typescript-eslint': tseslint.plugin
        },
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: root
            }
        },
        settings: {
            'import-x/parsers': {
                '@typescript-eslint/parser': [
                    ".ts",
                    ".tsx",
                    ".mts",
                    ".cts"
                ]
            },
            'import-x/resolver-next': [
                createTypeScriptImportResolver({
                    project: [
                        "docs/tsconfig.json",
                        "packages/cli/tsconfig.json",
                        "packages/eslint-plugin/tsconfig.json",
                        "tsconfig.json"
                    ].map((project) => join(root, project))
                })
            ]
        },
        "ignores": [
            "docs/**",
            "packages/cli/**",
            "packages/eslint-plugin/**",
            "tests/**"
        ],
        rules: {
            "@typescript-eslint/no-misused-spread": [
                "error",
                {
                    "allow": [
                        "string"
                    ]
                }
            ],
            "sonarjs/deprecation": "off",
            "jsdoc/require-param-type": "off",
            "jsdoc/require-returns-type": "off",
            "jsdoc/check-types": "off",
            "jsdoc/no-undefined-types": "off",
            "jsdoc/valid-types": "off",
            "jsdoc/no-types": "error",
            "@typescript-eslint/consistent-type-definitions": [
                "error",
                "type"
            ],
            "@typescript-eslint/consistent-type-imports": [
                "error",
                {
                    "prefer": "type-imports",
                    "fixStyle": "separate-type-imports"
                }
            ],
            "import-x/no-duplicates": [
                "error",
                {
                    "prefer-inline": true
                }
            ],
            "@typescript-eslint/consistent-type-exports": [
                "error",
                {
                    "fixMixedExportsWithInlineTypeSpecifier": false
                }
            ],
            "@typescript-eslint/switch-exhaustiveness-check": [
                "error",
                {
                    "considerDefaultExhaustiveForUnions": true
                }
            ],
            "@typescript-eslint/prefer-readonly": "error",
            "@typescript-eslint/require-array-sort-compare": [
                "error",
                {
                    "ignoreStringArrays": true
                }
            ],
            "@typescript-eslint/no-floating-promises": [
                "error",
                {
                    "ignoreVoid": false
                }
            ],
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    "args": "all",
                    "argsIgnorePattern": "^_",
                    "varsIgnorePattern": "^_",
                    "destructuredArrayIgnorePattern": "^_",
                    "ignoreUsingDeclarations": true
                }
            ],
            "@typescript-eslint/no-require-imports": "off",
            "@typescript-eslint/strict-boolean-expressions": "error",
            "@typescript-eslint/explicit-module-boundary-types": "error",
            "@typescript-eslint/prefer-optional-chain": "error",
            "gspot/no-magic-numbers": [
                "error",
                {
                    "ignoreEnums": true,
                    "ignoreArrayIndexes": true,
                    "ignoreReadonlyClassProperties": true,
                    "ignoreTypeIndexes": true,
                    "ignore": [
                        -1, 0, 1
                    ]
                }
            ],
            "@typescript-eslint/ban-ts-comment": [
                "error",
                {
                    "ts-expect-error": false,
                    "ts-ignore": true,
                    "ts-nocheck": true
                }
            ],
            "sonarjs/no-duplicate-in-composite": "error",
            "sonarjs/redundant-type-aliases": "error",
            "no-unused-vars": "off"
        },
        files: [
            [
                "**/*.{ts,mts,cts,tsx}",
                "**/*"
            ],
            [
                "**/*.astro",
                "**/*"
            ]
        ]
    }, globals),
    // typescript
    stripRuntimeGlobals({
        "ignores": [
            "docs/**",
            "packages/cli/**",
            "packages/eslint-plugin/**",
            "tests/**"
        ],
        rules: {
            "gspot/no-magic-numbers": "off",
            "@typescript-eslint/no-non-null-assertion": "off"
        },
        files: [
            [
                "**/test/**",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "**/*"
            ],
            [
                "**/test/**",
                "**/*.astro",
                "**/*"
            ],
            [
                "**/tests/**",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "**/*"
            ],
            [
                "**/tests/**",
                "**/*.astro",
                "**/*"
            ],
            [
                "**/__tests__/**",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "**/*"
            ],
            [
                "**/__tests__/**",
                "**/*.astro",
                "**/*"
            ],
            [
                "**/*.test.*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "**/*"
            ],
            [
                "**/*.test.*",
                "**/*.astro",
                "**/*"
            ],
            [
                "**/*.spec.*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "**/*"
            ],
            [
                "**/*.spec.*",
                "**/*.astro",
                "**/*"
            ],
            [
                "**/test_*.py",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "**/*"
            ],
            [
                "**/test_*.py",
                "**/*.astro",
                "**/*"
            ],
            [
                "**/*_test.py",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "**/*"
            ],
            [
                "**/*_test.py",
                "**/*.astro",
                "**/*"
            ],
            [
                "**/conftest.py",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "**/*"
            ],
            [
                "**/conftest.py",
                "**/*.astro",
                "**/*"
            ],
            [
                "**/Tests/**",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "**/*"
            ],
            [
                "**/Tests/**",
                "**/*.astro",
                "**/*"
            ],
            [
                "**/*Tests.swift",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "**/*"
            ],
            [
                "**/*Tests.swift",
                "**/*.astro",
                "**/*"
            ]
        ]
    }, globals),




    // typescript: tseslint["configs"]["strictTypeChecked"][0].rules
    stripRuntimeGlobals({
        ...tseslint["configs"]["strictTypeChecked"][0],
        "ignores": [],
        rules: {
            ...tseslint["configs"]["strictTypeChecked"][0].rules
        },
        files: [
            [
                "**/*.{ts,mts,cts,tsx}",
                "docs/**/*"
            ]
        ]
    }, globals),

    // typescript: tseslint["configs"]["strictTypeChecked"][1].rules
    stripRuntimeGlobals({
        ...tseslint["configs"]["strictTypeChecked"][1],
        "ignores": [],
        rules: {
            ...tseslint["configs"]["strictTypeChecked"][1].rules
        },
        files: [
            [
                "**/*.{ts,mts,cts,tsx}",
                "docs/**/*"
            ],
            [
                "**/*.astro",
                "docs/**/*"
            ]
        ]
    }, globals),

    // typescript: tseslint["configs"]["strictTypeChecked"][2].rules
    stripRuntimeGlobals({
        ...tseslint["configs"]["strictTypeChecked"][2],
        "ignores": [],
        rules: {
            ...tseslint["configs"]["strictTypeChecked"][2].rules
        },
        files: [
            [
                "**/*.{ts,mts,cts,tsx}",
                "docs/**/*"
            ],
            [
                "**/*.astro",
                "docs/**/*"
            ]
        ]
    }, globals),

    // typescript
    stripRuntimeGlobals({
        plugins: {
            '@typescript-eslint': tseslint.plugin
        },
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: root
            }
        },
        settings: {
            'import-x/parsers': {
                '@typescript-eslint/parser': [
                    ".ts",
                    ".tsx",
                    ".mts",
                    ".cts"
                ]
            },
            'import-x/resolver-next': [
                createTypeScriptImportResolver({
                    project: [
                        "docs/tsconfig.json",
                        "packages/cli/tsconfig.json",
                        "packages/eslint-plugin/tsconfig.json",
                        "tsconfig.json"
                    ].map((project) => join(root, project))
                })
            ]
        },
        "ignores": [],
        rules: {
            "@typescript-eslint/no-misused-spread": [
                "error",
                {
                    "allow": [
                        "string"
                    ]
                }
            ],
            "sonarjs/deprecation": "off",
            "jsdoc/require-param-type": "off",
            "jsdoc/require-returns-type": "off",
            "jsdoc/check-types": "off",
            "jsdoc/no-undefined-types": "off",
            "jsdoc/valid-types": "off",
            "jsdoc/no-types": "error",
            "@typescript-eslint/consistent-type-definitions": [
                "error",
                "type"
            ],
            "@typescript-eslint/consistent-type-imports": [
                "error",
                {
                    "prefer": "type-imports",
                    "fixStyle": "separate-type-imports"
                }
            ],
            "import-x/no-duplicates": [
                "error",
                {
                    "prefer-inline": true
                }
            ],
            "@typescript-eslint/consistent-type-exports": [
                "error",
                {
                    "fixMixedExportsWithInlineTypeSpecifier": false
                }
            ],
            "@typescript-eslint/switch-exhaustiveness-check": [
                "error",
                {
                    "considerDefaultExhaustiveForUnions": true
                }
            ],
            "@typescript-eslint/prefer-readonly": "error",
            "@typescript-eslint/require-array-sort-compare": [
                "error",
                {
                    "ignoreStringArrays": true
                }
            ],
            "@typescript-eslint/no-floating-promises": [
                "error",
                {
                    "ignoreVoid": false
                }
            ],
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    "args": "all",
                    "argsIgnorePattern": "^_",
                    "varsIgnorePattern": "^_",
                    "destructuredArrayIgnorePattern": "^_",
                    "ignoreUsingDeclarations": true
                }
            ],
            "@typescript-eslint/no-require-imports": "off",
            "@typescript-eslint/strict-boolean-expressions": "error",
            "@typescript-eslint/explicit-module-boundary-types": "error",
            "@typescript-eslint/prefer-optional-chain": "error",
            "gspot/no-magic-numbers": [
                "error",
                {
                    "ignoreEnums": true,
                    "ignoreArrayIndexes": true,
                    "ignoreReadonlyClassProperties": true,
                    "ignoreTypeIndexes": true,
                    "ignore": [
                        -1, 0, 1
                    ]
                }
            ],
            "@typescript-eslint/ban-ts-comment": [
                "error",
                {
                    "ts-expect-error": false,
                    "ts-ignore": true,
                    "ts-nocheck": true
                }
            ],
            "sonarjs/no-duplicate-in-composite": "error",
            "sonarjs/redundant-type-aliases": "error",
            "no-unused-vars": "off"
        },
        files: [
            [
                "**/*.{ts,mts,cts,tsx}",
                "docs/**/*"
            ],
            [
                "**/*.astro",
                "docs/**/*"
            ]
        ]
    }, globals),
    // typescript
    stripRuntimeGlobals({
        "ignores": [],
        rules: {
            "gspot/no-magic-numbers": "off",
            "@typescript-eslint/no-non-null-assertion": "off"
        },
        files: [
            [
                "docs/**/test/**",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "docs/**/*"
            ],
            [
                "docs/**/test/**",
                "**/*.astro",
                "docs/**/*"
            ],
            [
                "docs/**/tests/**",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "docs/**/*"
            ],
            [
                "docs/**/tests/**",
                "**/*.astro",
                "docs/**/*"
            ],
            [
                "docs/**/__tests__/**",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "docs/**/*"
            ],
            [
                "docs/**/__tests__/**",
                "**/*.astro",
                "docs/**/*"
            ],
            [
                "docs/**/*.test.*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "docs/**/*"
            ],
            [
                "docs/**/*.test.*",
                "**/*.astro",
                "docs/**/*"
            ],
            [
                "docs/**/*.spec.*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "docs/**/*"
            ],
            [
                "docs/**/*.spec.*",
                "**/*.astro",
                "docs/**/*"
            ],
            [
                "docs/**/test_*.py",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "docs/**/*"
            ],
            [
                "docs/**/test_*.py",
                "**/*.astro",
                "docs/**/*"
            ],
            [
                "docs/**/*_test.py",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "docs/**/*"
            ],
            [
                "docs/**/*_test.py",
                "**/*.astro",
                "docs/**/*"
            ],
            [
                "docs/**/conftest.py",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "docs/**/*"
            ],
            [
                "docs/**/conftest.py",
                "**/*.astro",
                "docs/**/*"
            ],
            [
                "docs/**/Tests/**",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "docs/**/*"
            ],
            [
                "docs/**/Tests/**",
                "**/*.astro",
                "docs/**/*"
            ],
            [
                "docs/**/*Tests.swift",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "docs/**/*"
            ],
            [
                "docs/**/*Tests.swift",
                "**/*.astro",
                "docs/**/*"
            ]
        ]
    }, globals),




    // typescript: tseslint["configs"]["strictTypeChecked"][0].rules
    stripRuntimeGlobals({
        ...tseslint["configs"]["strictTypeChecked"][0],
        "ignores": [],
        rules: {
            ...tseslint["configs"]["strictTypeChecked"][0].rules
        },
        files: [
            [
                "**/*.{ts,mts,cts,tsx}",
                "packages/cli/**/*"
            ]
        ]
    }, globals),

    // typescript: tseslint["configs"]["strictTypeChecked"][1].rules
    stripRuntimeGlobals({
        ...tseslint["configs"]["strictTypeChecked"][1],
        "ignores": [],
        rules: {
            ...tseslint["configs"]["strictTypeChecked"][1].rules
        },
        files: [
            [
                "**/*.{ts,mts,cts,tsx}",
                "packages/cli/**/*"
            ],
            [
                "**/*.astro",
                "packages/cli/**/*"
            ]
        ]
    }, globals),

    // typescript: tseslint["configs"]["strictTypeChecked"][2].rules
    stripRuntimeGlobals({
        ...tseslint["configs"]["strictTypeChecked"][2],
        "ignores": [],
        rules: {
            ...tseslint["configs"]["strictTypeChecked"][2].rules
        },
        files: [
            [
                "**/*.{ts,mts,cts,tsx}",
                "packages/cli/**/*"
            ],
            [
                "**/*.astro",
                "packages/cli/**/*"
            ]
        ]
    }, globals),

    // typescript
    stripRuntimeGlobals({
        plugins: {
            '@typescript-eslint': tseslint.plugin
        },
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: root
            }
        },
        settings: {
            'import-x/parsers': {
                '@typescript-eslint/parser': [
                    ".ts",
                    ".tsx",
                    ".mts",
                    ".cts"
                ]
            },
            'import-x/resolver-next': [
                createTypeScriptImportResolver({
                    project: [
                        "docs/tsconfig.json",
                        "packages/cli/tsconfig.json",
                        "packages/eslint-plugin/tsconfig.json",
                        "tsconfig.json"
                    ].map((project) => join(root, project))
                })
            ]
        },
        "ignores": [],
        rules: {
            "@typescript-eslint/no-misused-spread": [
                "error",
                {
                    "allow": [
                        "string"
                    ]
                }
            ],
            "sonarjs/deprecation": "off",
            "jsdoc/require-param-type": "off",
            "jsdoc/require-returns-type": "off",
            "jsdoc/check-types": "off",
            "jsdoc/no-undefined-types": "off",
            "jsdoc/valid-types": "off",
            "jsdoc/no-types": "error",
            "@typescript-eslint/consistent-type-definitions": [
                "error",
                "type"
            ],
            "@typescript-eslint/consistent-type-imports": [
                "error",
                {
                    "prefer": "type-imports",
                    "fixStyle": "separate-type-imports"
                }
            ],
            "import-x/no-duplicates": [
                "error",
                {
                    "prefer-inline": true
                }
            ],
            "@typescript-eslint/consistent-type-exports": [
                "error",
                {
                    "fixMixedExportsWithInlineTypeSpecifier": false
                }
            ],
            "@typescript-eslint/switch-exhaustiveness-check": [
                "error",
                {
                    "considerDefaultExhaustiveForUnions": true
                }
            ],
            "@typescript-eslint/prefer-readonly": "error",
            "@typescript-eslint/require-array-sort-compare": [
                "error",
                {
                    "ignoreStringArrays": true
                }
            ],
            "@typescript-eslint/no-floating-promises": [
                "error",
                {
                    "ignoreVoid": false
                }
            ],
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    "args": "all",
                    "argsIgnorePattern": "^_",
                    "varsIgnorePattern": "^_",
                    "destructuredArrayIgnorePattern": "^_",
                    "ignoreUsingDeclarations": true
                }
            ],
            "@typescript-eslint/no-require-imports": "off",
            "@typescript-eslint/strict-boolean-expressions": "error",
            "@typescript-eslint/explicit-module-boundary-types": "error",
            "@typescript-eslint/prefer-optional-chain": "error",
            "gspot/no-magic-numbers": [
                "error",
                {
                    "ignoreEnums": true,
                    "ignoreArrayIndexes": true,
                    "ignoreReadonlyClassProperties": true,
                    "ignoreTypeIndexes": true,
                    "ignore": [
                        -1, 0, 1
                    ]
                }
            ],
            "@typescript-eslint/ban-ts-comment": [
                "error",
                {
                    "ts-expect-error": false,
                    "ts-ignore": true,
                    "ts-nocheck": true
                }
            ],
            "sonarjs/no-duplicate-in-composite": "error",
            "sonarjs/redundant-type-aliases": "error",
            "no-unused-vars": "off"
        },
        files: [
            [
                "**/*.{ts,mts,cts,tsx}",
                "packages/cli/**/*"
            ],
            [
                "**/*.astro",
                "packages/cli/**/*"
            ]
        ]
    }, globals),
    // typescript
    stripRuntimeGlobals({
        "ignores": [],
        rules: {
            "gspot/no-magic-numbers": "off",
            "@typescript-eslint/no-non-null-assertion": "off"
        },
        files: [
            [
                "packages/cli/**/test/**",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/cli/**/*"
            ],
            [
                "packages/cli/**/test/**",
                "**/*.astro",
                "packages/cli/**/*"
            ],
            [
                "packages/cli/**/tests/**",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/cli/**/*"
            ],
            [
                "packages/cli/**/tests/**",
                "**/*.astro",
                "packages/cli/**/*"
            ],
            [
                "packages/cli/**/__tests__/**",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/cli/**/*"
            ],
            [
                "packages/cli/**/__tests__/**",
                "**/*.astro",
                "packages/cli/**/*"
            ],
            [
                "packages/cli/**/*.test.*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/cli/**/*"
            ],
            [
                "packages/cli/**/*.test.*",
                "**/*.astro",
                "packages/cli/**/*"
            ],
            [
                "packages/cli/**/*.spec.*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/cli/**/*"
            ],
            [
                "packages/cli/**/*.spec.*",
                "**/*.astro",
                "packages/cli/**/*"
            ],
            [
                "packages/cli/**/test_*.py",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/cli/**/*"
            ],
            [
                "packages/cli/**/test_*.py",
                "**/*.astro",
                "packages/cli/**/*"
            ],
            [
                "packages/cli/**/*_test.py",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/cli/**/*"
            ],
            [
                "packages/cli/**/*_test.py",
                "**/*.astro",
                "packages/cli/**/*"
            ],
            [
                "packages/cli/**/conftest.py",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/cli/**/*"
            ],
            [
                "packages/cli/**/conftest.py",
                "**/*.astro",
                "packages/cli/**/*"
            ],
            [
                "packages/cli/**/Tests/**",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/cli/**/*"
            ],
            [
                "packages/cli/**/Tests/**",
                "**/*.astro",
                "packages/cli/**/*"
            ],
            [
                "packages/cli/**/*Tests.swift",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/cli/**/*"
            ],
            [
                "packages/cli/**/*Tests.swift",
                "**/*.astro",
                "packages/cli/**/*"
            ]
        ]
    }, globals),




    // typescript: tseslint["configs"]["strictTypeChecked"][0].rules
    stripRuntimeGlobals({
        ...tseslint["configs"]["strictTypeChecked"][0],
        "ignores": [],
        rules: {
            ...tseslint["configs"]["strictTypeChecked"][0].rules
        },
        files: [
            [
                "**/*.{ts,mts,cts,tsx}",
                "packages/eslint-plugin/**/*"
            ]
        ]
    }, globals),

    // typescript: tseslint["configs"]["strictTypeChecked"][1].rules
    stripRuntimeGlobals({
        ...tseslint["configs"]["strictTypeChecked"][1],
        "ignores": [],
        rules: {
            ...tseslint["configs"]["strictTypeChecked"][1].rules
        },
        files: [
            [
                "**/*.{ts,mts,cts,tsx}",
                "packages/eslint-plugin/**/*"
            ],
            [
                "**/*.astro",
                "packages/eslint-plugin/**/*"
            ]
        ]
    }, globals),

    // typescript: tseslint["configs"]["strictTypeChecked"][2].rules
    stripRuntimeGlobals({
        ...tseslint["configs"]["strictTypeChecked"][2],
        "ignores": [],
        rules: {
            ...tseslint["configs"]["strictTypeChecked"][2].rules
        },
        files: [
            [
                "**/*.{ts,mts,cts,tsx}",
                "packages/eslint-plugin/**/*"
            ],
            [
                "**/*.astro",
                "packages/eslint-plugin/**/*"
            ]
        ]
    }, globals),

    // typescript
    stripRuntimeGlobals({
        plugins: {
            '@typescript-eslint': tseslint.plugin
        },
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: root
            }
        },
        settings: {
            'import-x/parsers': {
                '@typescript-eslint/parser': [
                    ".ts",
                    ".tsx",
                    ".mts",
                    ".cts"
                ]
            },
            'import-x/resolver-next': [
                createTypeScriptImportResolver({
                    project: [
                        "docs/tsconfig.json",
                        "packages/cli/tsconfig.json",
                        "packages/eslint-plugin/tsconfig.json",
                        "tsconfig.json"
                    ].map((project) => join(root, project))
                })
            ]
        },
        "ignores": [],
        rules: {
            "@typescript-eslint/no-misused-spread": [
                "error",
                {
                    "allow": [
                        "string"
                    ]
                }
            ],
            "sonarjs/deprecation": "off",
            "jsdoc/require-param-type": "off",
            "jsdoc/require-returns-type": "off",
            "jsdoc/check-types": "off",
            "jsdoc/no-undefined-types": "off",
            "jsdoc/valid-types": "off",
            "jsdoc/no-types": "error",
            "@typescript-eslint/consistent-type-definitions": [
                "error",
                "type"
            ],
            "@typescript-eslint/consistent-type-imports": [
                "error",
                {
                    "prefer": "type-imports",
                    "fixStyle": "separate-type-imports"
                }
            ],
            "import-x/no-duplicates": [
                "error",
                {
                    "prefer-inline": true
                }
            ],
            "@typescript-eslint/consistent-type-exports": [
                "error",
                {
                    "fixMixedExportsWithInlineTypeSpecifier": false
                }
            ],
            "@typescript-eslint/switch-exhaustiveness-check": [
                "error",
                {
                    "considerDefaultExhaustiveForUnions": true
                }
            ],
            "@typescript-eslint/prefer-readonly": "error",
            "@typescript-eslint/require-array-sort-compare": [
                "error",
                {
                    "ignoreStringArrays": true
                }
            ],
            "@typescript-eslint/no-floating-promises": [
                "error",
                {
                    "ignoreVoid": false
                }
            ],
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    "args": "all",
                    "argsIgnorePattern": "^_",
                    "varsIgnorePattern": "^_",
                    "destructuredArrayIgnorePattern": "^_",
                    "ignoreUsingDeclarations": true
                }
            ],
            "@typescript-eslint/no-require-imports": "off",
            "@typescript-eslint/strict-boolean-expressions": "error",
            "@typescript-eslint/explicit-module-boundary-types": "error",
            "@typescript-eslint/prefer-optional-chain": "error",
            "gspot/no-magic-numbers": [
                "error",
                {
                    "ignoreEnums": true,
                    "ignoreArrayIndexes": true,
                    "ignoreReadonlyClassProperties": true,
                    "ignoreTypeIndexes": true,
                    "ignore": [
                        -1, 0, 1
                    ]
                }
            ],
            "@typescript-eslint/ban-ts-comment": [
                "error",
                {
                    "ts-expect-error": false,
                    "ts-ignore": true,
                    "ts-nocheck": true
                }
            ],
            "sonarjs/no-duplicate-in-composite": "error",
            "sonarjs/redundant-type-aliases": "error",
            "no-unused-vars": "off"
        },
        files: [
            [
                "**/*.{ts,mts,cts,tsx}",
                "packages/eslint-plugin/**/*"
            ],
            [
                "**/*.astro",
                "packages/eslint-plugin/**/*"
            ]
        ]
    }, globals),
    // typescript
    stripRuntimeGlobals({
        "ignores": [],
        rules: {
            "gspot/no-magic-numbers": "off",
            "@typescript-eslint/no-non-null-assertion": "off"
        },
        files: [
            [
                "packages/eslint-plugin/**/test/**",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/eslint-plugin/**/*"
            ],
            [
                "packages/eslint-plugin/**/test/**",
                "**/*.astro",
                "packages/eslint-plugin/**/*"
            ],
            [
                "packages/eslint-plugin/**/tests/**",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/eslint-plugin/**/*"
            ],
            [
                "packages/eslint-plugin/**/tests/**",
                "**/*.astro",
                "packages/eslint-plugin/**/*"
            ],
            [
                "packages/eslint-plugin/**/__tests__/**",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/eslint-plugin/**/*"
            ],
            [
                "packages/eslint-plugin/**/__tests__/**",
                "**/*.astro",
                "packages/eslint-plugin/**/*"
            ],
            [
                "packages/eslint-plugin/**/*.test.*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/eslint-plugin/**/*"
            ],
            [
                "packages/eslint-plugin/**/*.test.*",
                "**/*.astro",
                "packages/eslint-plugin/**/*"
            ],
            [
                "packages/eslint-plugin/**/*.spec.*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/eslint-plugin/**/*"
            ],
            [
                "packages/eslint-plugin/**/*.spec.*",
                "**/*.astro",
                "packages/eslint-plugin/**/*"
            ],
            [
                "packages/eslint-plugin/**/test_*.py",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/eslint-plugin/**/*"
            ],
            [
                "packages/eslint-plugin/**/test_*.py",
                "**/*.astro",
                "packages/eslint-plugin/**/*"
            ],
            [
                "packages/eslint-plugin/**/*_test.py",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/eslint-plugin/**/*"
            ],
            [
                "packages/eslint-plugin/**/*_test.py",
                "**/*.astro",
                "packages/eslint-plugin/**/*"
            ],
            [
                "packages/eslint-plugin/**/conftest.py",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/eslint-plugin/**/*"
            ],
            [
                "packages/eslint-plugin/**/conftest.py",
                "**/*.astro",
                "packages/eslint-plugin/**/*"
            ],
            [
                "packages/eslint-plugin/**/Tests/**",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/eslint-plugin/**/*"
            ],
            [
                "packages/eslint-plugin/**/Tests/**",
                "**/*.astro",
                "packages/eslint-plugin/**/*"
            ],
            [
                "packages/eslint-plugin/**/*Tests.swift",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/eslint-plugin/**/*"
            ],
            [
                "packages/eslint-plugin/**/*Tests.swift",
                "**/*.astro",
                "packages/eslint-plugin/**/*"
            ]
        ]
    }, globals),




    // typescript: tseslint["configs"]["strictTypeChecked"][0].rules
    stripRuntimeGlobals({
        ...tseslint["configs"]["strictTypeChecked"][0],
        "ignores": [],
        rules: {
            ...tseslint["configs"]["strictTypeChecked"][0].rules
        },
        files: [
            [
                "**/*.{ts,mts,cts,tsx}",
                "tests/**/*"
            ]
        ]
    }, globals),

    // typescript: tseslint["configs"]["strictTypeChecked"][1].rules
    stripRuntimeGlobals({
        ...tseslint["configs"]["strictTypeChecked"][1],
        "ignores": [],
        rules: {
            ...tseslint["configs"]["strictTypeChecked"][1].rules
        },
        files: [
            [
                "**/*.{ts,mts,cts,tsx}",
                "tests/**/*"
            ],
            [
                "**/*.astro",
                "tests/**/*"
            ]
        ]
    }, globals),

    // typescript: tseslint["configs"]["strictTypeChecked"][2].rules
    stripRuntimeGlobals({
        ...tseslint["configs"]["strictTypeChecked"][2],
        "ignores": [],
        rules: {
            ...tseslint["configs"]["strictTypeChecked"][2].rules
        },
        files: [
            [
                "**/*.{ts,mts,cts,tsx}",
                "tests/**/*"
            ],
            [
                "**/*.astro",
                "tests/**/*"
            ]
        ]
    }, globals),

    // typescript
    stripRuntimeGlobals({
        plugins: {
            '@typescript-eslint': tseslint.plugin
        },
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: root
            }
        },
        settings: {
            'import-x/parsers': {
                '@typescript-eslint/parser': [
                    ".ts",
                    ".tsx",
                    ".mts",
                    ".cts"
                ]
            },
            'import-x/resolver-next': [
                createTypeScriptImportResolver({
                    project: [
                        "docs/tsconfig.json",
                        "packages/cli/tsconfig.json",
                        "packages/eslint-plugin/tsconfig.json",
                        "tsconfig.json"
                    ].map((project) => join(root, project))
                })
            ]
        },
        "ignores": [],
        rules: {
            "@typescript-eslint/no-misused-spread": [
                "error",
                {
                    "allow": [
                        "string"
                    ]
                }
            ],
            "sonarjs/deprecation": "off",
            "jsdoc/require-param-type": "off",
            "jsdoc/require-returns-type": "off",
            "jsdoc/check-types": "off",
            "jsdoc/no-undefined-types": "off",
            "jsdoc/valid-types": "off",
            "jsdoc/no-types": "error",
            "@typescript-eslint/consistent-type-definitions": [
                "error",
                "type"
            ],
            "@typescript-eslint/consistent-type-imports": [
                "error",
                {
                    "prefer": "type-imports",
                    "fixStyle": "separate-type-imports"
                }
            ],
            "import-x/no-duplicates": [
                "error",
                {
                    "prefer-inline": true
                }
            ],
            "@typescript-eslint/consistent-type-exports": [
                "error",
                {
                    "fixMixedExportsWithInlineTypeSpecifier": false
                }
            ],
            "@typescript-eslint/switch-exhaustiveness-check": [
                "error",
                {
                    "considerDefaultExhaustiveForUnions": true
                }
            ],
            "@typescript-eslint/prefer-readonly": "error",
            "@typescript-eslint/require-array-sort-compare": [
                "error",
                {
                    "ignoreStringArrays": true
                }
            ],
            "@typescript-eslint/no-floating-promises": [
                "error",
                {
                    "ignoreVoid": false
                }
            ],
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    "args": "all",
                    "argsIgnorePattern": "^_",
                    "varsIgnorePattern": "^_",
                    "destructuredArrayIgnorePattern": "^_",
                    "ignoreUsingDeclarations": true
                }
            ],
            "@typescript-eslint/no-require-imports": "off",
            "@typescript-eslint/strict-boolean-expressions": "error",
            "@typescript-eslint/explicit-module-boundary-types": "error",
            "@typescript-eslint/prefer-optional-chain": "error",
            "gspot/no-magic-numbers": [
                "error",
                {
                    "ignoreEnums": true,
                    "ignoreArrayIndexes": true,
                    "ignoreReadonlyClassProperties": true,
                    "ignoreTypeIndexes": true,
                    "ignore": [
                        -1, 0, 1
                    ]
                }
            ],
            "@typescript-eslint/ban-ts-comment": [
                "error",
                {
                    "ts-expect-error": false,
                    "ts-ignore": true,
                    "ts-nocheck": true
                }
            ],
            "sonarjs/no-duplicate-in-composite": "error",
            "sonarjs/redundant-type-aliases": "error",
            "no-unused-vars": "off"
        },
        files: [
            [
                "**/*.{ts,mts,cts,tsx}",
                "tests/**/*"
            ],
            [
                "**/*.astro",
                "tests/**/*"
            ]
        ]
    }, globals),
    // typescript
    stripRuntimeGlobals({
        "ignores": [],
        rules: {
            "gspot/no-magic-numbers": "off",
            "@typescript-eslint/no-non-null-assertion": "off"
        },
        files: [
            [
                "tests/**/test/**",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "tests/**/*"
            ],
            [
                "tests/**/test/**",
                "**/*.astro",
                "tests/**/*"
            ],
            [
                "tests/**/tests/**",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "tests/**/*"
            ],
            [
                "tests/**/tests/**",
                "**/*.astro",
                "tests/**/*"
            ],
            [
                "tests/**/__tests__/**",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "tests/**/*"
            ],
            [
                "tests/**/__tests__/**",
                "**/*.astro",
                "tests/**/*"
            ],
            [
                "tests/**/*.test.*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "tests/**/*"
            ],
            [
                "tests/**/*.test.*",
                "**/*.astro",
                "tests/**/*"
            ],
            [
                "tests/**/*.spec.*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "tests/**/*"
            ],
            [
                "tests/**/*.spec.*",
                "**/*.astro",
                "tests/**/*"
            ],
            [
                "tests/**/test_*.py",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "tests/**/*"
            ],
            [
                "tests/**/test_*.py",
                "**/*.astro",
                "tests/**/*"
            ],
            [
                "tests/**/*_test.py",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "tests/**/*"
            ],
            [
                "tests/**/*_test.py",
                "**/*.astro",
                "tests/**/*"
            ],
            [
                "tests/**/conftest.py",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "tests/**/*"
            ],
            [
                "tests/**/conftest.py",
                "**/*.astro",
                "tests/**/*"
            ],
            [
                "tests/**/Tests/**",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "tests/**/*"
            ],
            [
                "tests/**/Tests/**",
                "**/*.astro",
                "tests/**/*"
            ],
            [
                "tests/**/*Tests.swift",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "tests/**/*"
            ],
            [
                "tests/**/*Tests.swift",
                "**/*.astro",
                "tests/**/*"
            ]
        ]
    }, globals),


    // astro: astroPlugin["configs"]["flat/recommended"][0].rules
    stripRuntimeGlobals({
        ...astroPlugin["configs"]["flat/recommended"][0],
        "ignores": [],
        rules: {
            ...astroPlugin["configs"]["flat/recommended"][0].rules
        },
        files: [
            [
                "**/*.astro",
                "docs/**/*"
            ]
        ]
    }, globals),

    // astro: astroPlugin["configs"]["flat/recommended"][1].rules
    stripRuntimeGlobals({
        ...astroPlugin["configs"]["flat/recommended"][1],
        "ignores": [],
        rules: {
            ...astroPlugin["configs"]["flat/recommended"][1].rules
        },
        files: [
            [
                "*.astro",
                "docs/**/*"
            ],
            [
                "**/*.astro",
                "docs/**/*"
            ]
        ]
    }, globals),

    // astro: astroPlugin["configs"]["flat/recommended"][2].rules
    stripRuntimeGlobals({
        ...astroPlugin["configs"]["flat/recommended"][2],
        "ignores": [],
        rules: {
            ...astroPlugin["configs"]["flat/recommended"][2].rules
        },
        files: [
            [
                "**/*.astro/*.js",
                "docs/**/*"
            ],
            [
                "*.astro/*.js",
                "docs/**/*"
            ]
        ]
    }, globals),

    // astro: astroPlugin["configs"]["flat/recommended"][3].rules
    stripRuntimeGlobals({
        ...astroPlugin["configs"]["flat/recommended"][3],
        "ignores": [],
        rules: {
            ...astroPlugin["configs"]["flat/recommended"][3].rules
        },
        files: [
            [
                "**/*.astro/*.ts",
                "docs/**/*"
            ],
            [
                "*.astro/*.ts",
                "docs/**/*"
            ]
        ]
    }, globals),

    // astro: astroPlugin["configs"]["flat/recommended"][4].rules
    stripRuntimeGlobals({
        ...astroPlugin["configs"]["flat/recommended"][4],
        "ignores": [],
        rules: {
            ...astroPlugin["configs"]["flat/recommended"][4].rules,
            "astro/missing-client-only-directive-value": [
                "error"
            ],
            "astro/no-conflict-set-directives": [
                "error"
            ],
            "astro/no-deprecated-astro-canonicalurl": [
                "error"
            ],
            "astro/no-deprecated-astro-fetchcontent": [
                "error"
            ],
            "astro/no-deprecated-astro-resolve": [
                "error"
            ],
            "astro/no-deprecated-getentrybyslug": [
                "error"
            ],
            "astro/no-unused-define-vars-in-style": [
                "error"
            ],
            "astro/valid-compile": [
                "error"
            ]
        },
        files: [
            [
                "**/*.astro",
                "docs/**/*"
            ]
        ]
    }, globals),

    // astro: astroPlugin["configs"]["flat/jsx-a11y-recommended"][0].rules
    stripRuntimeGlobals({
        ...astroPlugin["configs"]["flat/jsx-a11y-recommended"][0],
        "ignores": [],
        rules: {
            ...astroPlugin["configs"]["flat/jsx-a11y-recommended"][0].rules
        },
        files: [
            [
                "**/*.astro",
                "docs/**/*"
            ]
        ]
    }, globals),

    // astro: astroPlugin["configs"]["flat/jsx-a11y-recommended"][1].rules
    stripRuntimeGlobals({
        ...astroPlugin["configs"]["flat/jsx-a11y-recommended"][1],
        "ignores": [],
        rules: {
            ...astroPlugin["configs"]["flat/jsx-a11y-recommended"][1].rules
        },
        files: [
            [
                "*.astro",
                "docs/**/*"
            ],
            [
                "**/*.astro",
                "docs/**/*"
            ]
        ]
    }, globals),

    // astro: astroPlugin["configs"]["flat/jsx-a11y-recommended"][2].rules
    stripRuntimeGlobals({
        ...astroPlugin["configs"]["flat/jsx-a11y-recommended"][2],
        "ignores": [],
        rules: {
            ...astroPlugin["configs"]["flat/jsx-a11y-recommended"][2].rules
        },
        files: [
            [
                "**/*.astro/*.js",
                "docs/**/*"
            ],
            [
                "*.astro/*.js",
                "docs/**/*"
            ]
        ]
    }, globals),

    // astro: astroPlugin["configs"]["flat/jsx-a11y-recommended"][3].rules
    stripRuntimeGlobals({
        ...astroPlugin["configs"]["flat/jsx-a11y-recommended"][3],
        "ignores": [],
        rules: {
            ...astroPlugin["configs"]["flat/jsx-a11y-recommended"][3].rules
        },
        files: [
            [
                "**/*.astro/*.ts",
                "docs/**/*"
            ],
            [
                "*.astro/*.ts",
                "docs/**/*"
            ]
        ]
    }, globals),

    // astro: astroPlugin["configs"]["flat/jsx-a11y-recommended"][4].rules
    stripRuntimeGlobals({
        ...astroPlugin["configs"]["flat/jsx-a11y-recommended"][4],
        "ignores": [],
        rules: {
            ...astroPlugin["configs"]["flat/jsx-a11y-recommended"][4].rules,
            "astro/jsx-a11y/alt-text": [
                "error"
            ],
            "astro/jsx-a11y/anchor-has-content": [
                "error"
            ],
            "astro/jsx-a11y/anchor-is-valid": [
                "error"
            ],
            "astro/jsx-a11y/aria-activedescendant-has-tabindex": [
                "error"
            ],
            "astro/jsx-a11y/aria-props": [
                "error"
            ],
            "astro/jsx-a11y/aria-proptypes": [
                "error"
            ],
            "astro/jsx-a11y/aria-role": [
                "error"
            ],
            "astro/jsx-a11y/aria-unsupported-elements": [
                "error"
            ],
            "astro/jsx-a11y/autocomplete-valid": [
                "error"
            ],
            "astro/jsx-a11y/click-events-have-key-events": [
                "error"
            ],
            "astro/jsx-a11y/control-has-associated-label": "off",
            "astro/jsx-a11y/heading-has-content": [
                "error"
            ],
            "astro/jsx-a11y/html-has-lang": [
                "error"
            ],
            "astro/jsx-a11y/iframe-has-title": [
                "error"
            ],
            "astro/jsx-a11y/img-redundant-alt": [
                "error"
            ],
            "astro/jsx-a11y/label-has-associated-control": [
                "error"
            ],
            "astro/jsx-a11y/media-has-caption": [
                "error"
            ],
            "astro/jsx-a11y/mouse-events-have-key-events": [
                "error"
            ],
            "astro/jsx-a11y/no-access-key": [
                "error"
            ],
            "astro/jsx-a11y/no-autofocus": [
                "error"
            ],
            "astro/jsx-a11y/no-distracting-elements": [
                "error"
            ],
            "astro/jsx-a11y/no-noninteractive-tabindex": [
                "error",
                {
                    "tags": [],
                    "roles": [
                        "tabpanel",
                        "region"
                    ],
                    "allowExpressionValues": true
                }
            ],
            "astro/jsx-a11y/no-redundant-roles": [
                "error"
            ],
            "astro/jsx-a11y/role-has-required-aria-props": [
                "error"
            ],
            "astro/jsx-a11y/role-supports-aria-props": [
                "error"
            ],
            "astro/jsx-a11y/scope": [
                "error"
            ],
            "astro/jsx-a11y/tabindex-no-positive": [
                "error"
            ]
        },
        files: [
            [
                "**/*.astro",
                "docs/**/*"
            ]
        ]
    }, globals),

    // astro
    stripRuntimeGlobals({
        languageOptions: {
            parserOptions: {
                tsconfigRootDir: root
            }
        },
        "ignores": [],
        rules: {
            "astro/no-set-html-directive": "error",
            "astro/no-exports-from-components": "error",
            "astro/no-prerender-export-outside-pages": "error",
            "astro/no-unused-css-selector": "error",
            "astro/prefer-class-list-directive": "error",
            "astro/prefer-object-class-list": "error",
            "astro/prefer-split-class-list": "error"
        },
        files: [
            [
                "**/*.astro",
                "docs/**/*"
            ]
        ]
    }, globals),

    // astro
    stripRuntimeGlobals({
        processor: 'astro/client-side-ts',
        languageOptions: {
            parserOptions: {
                parser: tseslint.parser,
                projectService: false,
                project: true
            }
        },
        "ignores": [],
        rules: {
            "@typescript-eslint/no-unsafe-return": "off"
        },
        files: [
            [
                "**/*.astro",
                "docs/**/*"
            ]
        ]
    }, globals),

    // astro: tseslint["configs"]["disableTypeChecked"].rules
    stripRuntimeGlobals({
        ...tseslint["configs"]["disableTypeChecked"],
        "ignores": [],
        rules: {
            ...tseslint["configs"]["disableTypeChecked"].rules
        },
        files: [
            [
                "**/*.astro/*.ts",
                "docs/**/*"
            ],
            [
                "**/*.astro/*.js",
                "docs/**/*"
            ]
        ]
    }, globals),


    // zod
    stripRuntimeGlobals({
        plugins: {
            zod: zodPlugin
        },
        "ignores": [],
        rules: {
            "zod/no-any-schema": "error",
            "zod/no-coerce-boolean": "error",
            "zod/no-empty-custom-schema": "error",
            "zod/no-native-enum": "error",
            "zod/no-promise-schema": "error",
            "zod/no-throw-in-refine": "error",
            "zod/prefer-strict-object": "error",
            "zod/prefer-meta-last": "error",
            "zod/require-brand-type-parameter": "error"
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "docs/**/*"
            ],
            [
                "**/*.astro",
                "docs/**/*"
            ]
        ]
    }, globals),

    // zod
    stripRuntimeGlobals({
        plugins: {
            zod: zodPlugin
        },
        "ignores": [],
        rules: {
            "zod/no-any-schema": "error",
            "zod/no-coerce-boolean": "error",
            "zod/no-empty-custom-schema": "error",
            "zod/no-native-enum": "error",
            "zod/no-promise-schema": "error",
            "zod/no-throw-in-refine": "error",
            "zod/prefer-strict-object": "error",
            "zod/prefer-meta-last": "error",
            "zod/require-brand-type-parameter": "error"
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/cli/**/*"
            ],
            [
                "**/*.astro",
                "packages/cli/**/*"
            ]
        ]
    }, globals),

    // zod
    stripRuntimeGlobals({
        plugins: {
            zod: zodPlugin
        },
        "ignores": [],
        rules: {
            "zod/no-any-schema": "error",
            "zod/no-coerce-boolean": "error",
            "zod/no-empty-custom-schema": "error",
            "zod/no-native-enum": "error",
            "zod/no-promise-schema": "error",
            "zod/no-throw-in-refine": "error",
            "zod/prefer-strict-object": "error",
            "zod/prefer-meta-last": "error",
            "zod/require-brand-type-parameter": "error"
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "tests/**/*"
            ],
            [
                "**/*.astro",
                "tests/**/*"
            ]
        ]
    }, globals),


    // JavaScript and repository settings
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
            "n/no-unpublished-import": "error",
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

    // JavaScript and repository settings
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
            "n/no-unpublished-import": "error",
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

    // JavaScript and repository settings
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
            "n/no-unpublished-import": "error",
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

    // JavaScript and repository settings
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
            "n/no-unpublished-import": "error",
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

    // JavaScript and repository settings
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
            "n/no-unpublished-import": "error",
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

    // JavaScript and repository settings
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
            "n/no-unpublished-import": "error",
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

    // JavaScript and repository settings
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
            "n/no-unpublished-import": "error",
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

    // JavaScript and repository settings
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
            "n/no-unpublished-import": "error",
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

    // JavaScript and repository settings
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
            "n/no-unpublished-import": "error",
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

    // JavaScript and repository settings
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
            "n/no-unpublished-import": "error",
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

    // JavaScript and repository settings
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
                    "selector": "TSEnumDeclaration",
                    "message": "Use a literal union or an as-const object instead of an enum."
                },
                {
                    "selector": "TSAsExpression[expression.type=\"TSAsExpression\"]",
                    "message": "Do not assert twice. Narrow the value, improve the type, or add a typed boundary."
                },
                {
                    "selector": "TSTypeAssertion[expression.type=\"TSTypeAssertion\"]",
                    "message": "Do not assert twice. Narrow the value, improve the type, or add a typed boundary."
                },
                {
                    "selector": "TSAsExpression > TSAnyKeyword",
                    "message": "Do not assert to any. Add a typed boundary or runtime narrowing instead."
                },
                {
                    "selector": "TSTypeAssertion > TSAnyKeyword",
                    "message": "Do not assert to any. Add a typed boundary or runtime narrowing instead."
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
                    "selector": ":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#|@\\/)/][source.value!=/\\.[^/?.]+$/]:not([source.value=/\\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))",
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
                "tests/setup/runner/offline.ts"
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
                "tests/setup/runner/offline.ts"
            ]
        ]
    },

    // JavaScript and repository settings
    {
        "ignores": [
            "docs/**",
            "packages/cli/**",
            "packages/eslint-plugin/**",
            "tests/**",
            "packages/cli/src/system/environment.ts",
            "tests/setup/system/environment.ts",
            "tests/setup/runner/offline.ts"
        ],
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    "selector": "TSEnumDeclaration",
                    "message": "Use a literal union or an as-const object instead of an enum."
                },
                {
                    "selector": "TSAsExpression[expression.type=\"TSAsExpression\"]",
                    "message": "Do not assert twice. Narrow the value, improve the type, or add a typed boundary."
                },
                {
                    "selector": "TSTypeAssertion[expression.type=\"TSTypeAssertion\"]",
                    "message": "Do not assert twice. Narrow the value, improve the type, or add a typed boundary."
                },
                {
                    "selector": "TSAsExpression > TSAnyKeyword",
                    "message": "Do not assert to any. Add a typed boundary or runtime narrowing instead."
                },
                {
                    "selector": "TSTypeAssertion > TSAnyKeyword",
                    "message": "Do not assert to any. Add a typed boundary or runtime narrowing instead."
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
                    "selector": ":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#|@\\/)/][source.value!=/\\.[^/?.]+$/]:not([source.value=/\\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))",
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

    // JavaScript and repository settings
    {
        "ignores": [],
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    "selector": "TSEnumDeclaration",
                    "message": "Use a literal union or an as-const object instead of an enum."
                },
                {
                    "selector": "TSAsExpression[expression.type=\"TSAsExpression\"]",
                    "message": "Do not assert twice. Narrow the value, improve the type, or add a typed boundary."
                },
                {
                    "selector": "TSTypeAssertion[expression.type=\"TSTypeAssertion\"]",
                    "message": "Do not assert twice. Narrow the value, improve the type, or add a typed boundary."
                },
                {
                    "selector": "TSAsExpression > TSAnyKeyword",
                    "message": "Do not assert to any. Add a typed boundary or runtime narrowing instead."
                },
                {
                    "selector": "TSTypeAssertion > TSAnyKeyword",
                    "message": "Do not assert to any. Add a typed boundary or runtime narrowing instead."
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
                    "selector": ":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#|@\\/)/][source.value!=/\\.[^/?.]+$/]:not([source.value=/\\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))",
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
                "tests/setup/runner/offline.ts"
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
                "tests/setup/runner/offline.ts"
            ]
        ]
    },

    // JavaScript and repository settings
    {
        "ignores": [
            "packages/cli/src/system/environment.ts",
            "tests/setup/system/environment.ts",
            "tests/setup/runner/offline.ts"
        ],
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    "selector": "TSEnumDeclaration",
                    "message": "Use a literal union or an as-const object instead of an enum."
                },
                {
                    "selector": "TSAsExpression[expression.type=\"TSAsExpression\"]",
                    "message": "Do not assert twice. Narrow the value, improve the type, or add a typed boundary."
                },
                {
                    "selector": "TSTypeAssertion[expression.type=\"TSTypeAssertion\"]",
                    "message": "Do not assert twice. Narrow the value, improve the type, or add a typed boundary."
                },
                {
                    "selector": "TSAsExpression > TSAnyKeyword",
                    "message": "Do not assert to any. Add a typed boundary or runtime narrowing instead."
                },
                {
                    "selector": "TSTypeAssertion > TSAnyKeyword",
                    "message": "Do not assert to any. Add a typed boundary or runtime narrowing instead."
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
                    "selector": ":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#|@\\/)/][source.value!=/\\.[^/?.]+$/]:not([source.value=/\\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))",
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

    // JavaScript and repository settings
    {
        "ignores": [],
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    "selector": "TSEnumDeclaration",
                    "message": "Use a literal union or an as-const object instead of an enum."
                },
                {
                    "selector": "TSAsExpression[expression.type=\"TSAsExpression\"]",
                    "message": "Do not assert twice. Narrow the value, improve the type, or add a typed boundary."
                },
                {
                    "selector": "TSTypeAssertion[expression.type=\"TSTypeAssertion\"]",
                    "message": "Do not assert twice. Narrow the value, improve the type, or add a typed boundary."
                },
                {
                    "selector": "TSAsExpression > TSAnyKeyword",
                    "message": "Do not assert to any. Add a typed boundary or runtime narrowing instead."
                },
                {
                    "selector": "TSTypeAssertion > TSAnyKeyword",
                    "message": "Do not assert to any. Add a typed boundary or runtime narrowing instead."
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
                    "selector": ":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#|@\\/)/][source.value!=/\\.[^/?.]+$/]:not([source.value=/\\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))",
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
                "tests/setup/runner/offline.ts"
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
                "tests/setup/runner/offline.ts"
            ]
        ]
    },

    // JavaScript and repository settings
    {
        "ignores": [
            "packages/cli/src/system/environment.ts",
            "tests/setup/system/environment.ts",
            "tests/setup/runner/offline.ts"
        ],
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    "selector": "TSEnumDeclaration",
                    "message": "Use a literal union or an as-const object instead of an enum."
                },
                {
                    "selector": "TSAsExpression[expression.type=\"TSAsExpression\"]",
                    "message": "Do not assert twice. Narrow the value, improve the type, or add a typed boundary."
                },
                {
                    "selector": "TSTypeAssertion[expression.type=\"TSTypeAssertion\"]",
                    "message": "Do not assert twice. Narrow the value, improve the type, or add a typed boundary."
                },
                {
                    "selector": "TSAsExpression > TSAnyKeyword",
                    "message": "Do not assert to any. Add a typed boundary or runtime narrowing instead."
                },
                {
                    "selector": "TSTypeAssertion > TSAnyKeyword",
                    "message": "Do not assert to any. Add a typed boundary or runtime narrowing instead."
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
                    "selector": ":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#|@\\/)/][source.value!=/\\.[^/?.]+$/]:not([source.value=/\\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))",
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

    // JavaScript and repository settings
    {
        "ignores": [],
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    "selector": "TSEnumDeclaration",
                    "message": "Use a literal union or an as-const object instead of an enum."
                },
                {
                    "selector": "TSAsExpression[expression.type=\"TSAsExpression\"]",
                    "message": "Do not assert twice. Narrow the value, improve the type, or add a typed boundary."
                },
                {
                    "selector": "TSTypeAssertion[expression.type=\"TSTypeAssertion\"]",
                    "message": "Do not assert twice. Narrow the value, improve the type, or add a typed boundary."
                },
                {
                    "selector": "TSAsExpression > TSAnyKeyword",
                    "message": "Do not assert to any. Add a typed boundary or runtime narrowing instead."
                },
                {
                    "selector": "TSTypeAssertion > TSAnyKeyword",
                    "message": "Do not assert to any. Add a typed boundary or runtime narrowing instead."
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
                    "selector": ":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#|@\\/)/][source.value!=/\\.[^/?.]+$/]:not([source.value=/\\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))",
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
                "tests/setup/runner/offline.ts"
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
                "tests/setup/runner/offline.ts"
            ]
        ]
    },

    // JavaScript and repository settings
    {
        "ignores": [
            "packages/cli/src/system/environment.ts",
            "tests/setup/system/environment.ts",
            "tests/setup/runner/offline.ts"
        ],
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    "selector": "TSEnumDeclaration",
                    "message": "Use a literal union or an as-const object instead of an enum."
                },
                {
                    "selector": "TSAsExpression[expression.type=\"TSAsExpression\"]",
                    "message": "Do not assert twice. Narrow the value, improve the type, or add a typed boundary."
                },
                {
                    "selector": "TSTypeAssertion[expression.type=\"TSTypeAssertion\"]",
                    "message": "Do not assert twice. Narrow the value, improve the type, or add a typed boundary."
                },
                {
                    "selector": "TSAsExpression > TSAnyKeyword",
                    "message": "Do not assert to any. Add a typed boundary or runtime narrowing instead."
                },
                {
                    "selector": "TSTypeAssertion > TSAnyKeyword",
                    "message": "Do not assert to any. Add a typed boundary or runtime narrowing instead."
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
                    "selector": ":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#|@\\/)/][source.value!=/\\.[^/?.]+$/]:not([source.value=/\\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))",
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

    // JavaScript and repository settings
    {
        "ignores": [],
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    "selector": "TSEnumDeclaration",
                    "message": "Use a literal union or an as-const object instead of an enum."
                },
                {
                    "selector": "TSAsExpression[expression.type=\"TSAsExpression\"]",
                    "message": "Do not assert twice. Narrow the value, improve the type, or add a typed boundary."
                },
                {
                    "selector": "TSTypeAssertion[expression.type=\"TSTypeAssertion\"]",
                    "message": "Do not assert twice. Narrow the value, improve the type, or add a typed boundary."
                },
                {
                    "selector": "TSAsExpression > TSAnyKeyword",
                    "message": "Do not assert to any. Add a typed boundary or runtime narrowing instead."
                },
                {
                    "selector": "TSTypeAssertion > TSAnyKeyword",
                    "message": "Do not assert to any. Add a typed boundary or runtime narrowing instead."
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
                    "selector": ":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#|@\\/)/][source.value!=/\\.[^/?.]+$/]:not([source.value=/\\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))",
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
                "tests/setup/runner/offline.ts"
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
                "tests/setup/runner/offline.ts"
            ]
        ]
    },

    // JavaScript and repository settings
    {
        "ignores": [
            "packages/cli/src/system/environment.ts",
            "tests/setup/system/environment.ts",
            "tests/setup/runner/offline.ts"
        ],
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    "selector": "TSEnumDeclaration",
                    "message": "Use a literal union or an as-const object instead of an enum."
                },
                {
                    "selector": "TSAsExpression[expression.type=\"TSAsExpression\"]",
                    "message": "Do not assert twice. Narrow the value, improve the type, or add a typed boundary."
                },
                {
                    "selector": "TSTypeAssertion[expression.type=\"TSTypeAssertion\"]",
                    "message": "Do not assert twice. Narrow the value, improve the type, or add a typed boundary."
                },
                {
                    "selector": "TSAsExpression > TSAnyKeyword",
                    "message": "Do not assert to any. Add a typed boundary or runtime narrowing instead."
                },
                {
                    "selector": "TSTypeAssertion > TSAnyKeyword",
                    "message": "Do not assert to any. Add a typed boundary or runtime narrowing instead."
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
                    "selector": ":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#|@\\/)/][source.value!=/\\.[^/?.]+$/]:not([source.value=/\\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))",
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

    // JavaScript and repository settings
    {
        "ignores": [
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
            "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
            "**/*.astro"
        ]
    },

    // JavaScript and repository settings
    {
        rules: {
            "n/no-process-exit": "off",
            "unicorn/no-process-exit": "off"
        },
        files: [
            [
                "scripts/**",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "scripts/**",
                "**/*.astro"
            ],
            [
                "**/*.config.{js,mjs,cjs,ts}",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "**/*.config.{js,mjs,cjs,ts}",
                "**/*.astro"
            ],
            [
                ".mise/tasks/**",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                ".mise/tasks/**",
                "**/*.astro"
            ]
        ]
    },

    // JavaScript and repository settings
    {
        rules: {
            "jsdoc/require-jsdoc": "off",
            "jsdoc/require-param": "off",
            "jsdoc/require-returns": "off",
            "jsdoc/require-description": "off",
            "jsdoc/require-param-description": "off",
            "jsdoc/require-returns-description": "off",
            "n/no-unpublished-import": "off",
            "n/no-unpublished-require": "off"
        },
        files: [
            [
                "**/test/**",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "**/test/**",
                "**/*.astro"
            ],
            [
                "**/tests/**",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "**/tests/**",
                "**/*.astro"
            ],
            [
                "**/__tests__/**",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "**/__tests__/**",
                "**/*.astro"
            ],
            [
                "**/*.test.*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "**/*.test.*",
                "**/*.astro"
            ],
            [
                "**/*.spec.*",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "**/*.spec.*",
                "**/*.astro"
            ],
            [
                "**/test_*.py",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "**/test_*.py",
                "**/*.astro"
            ],
            [
                "**/*_test.py",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "**/*_test.py",
                "**/*.astro"
            ],
            [
                "**/conftest.py",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "**/conftest.py",
                "**/*.astro"
            ],
            [
                "**/Tests/**",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "**/Tests/**",
                "**/*.astro"
            ],
            [
                "**/*Tests.swift",
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"
            ],
            [
                "**/*Tests.swift",
                "**/*.astro"
            ]
        ]
    },

    // JavaScript and repository settings: packageJson["configs"]["recommended"].rules
    {
        ...packageJson["configs"]["recommended"],
        rules: {
            ...packageJson["configs"]["recommended"].rules
        },
        files: [
            "**/package.json"
        ]
    },

    // JavaScript and repository settings: prettierConfig.rules
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

    // JavaScript and repository settings
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

    // JavaScript and repository settings
    {
        rules: {
            "package-json/require-packageManager": "error"
        },
        files: [
            "package.json"
        ]
    },

    // JavaScript and repository settings
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

    // JavaScript and repository settings
    {
        "ignores": [
            "packages/cli/src/system/environment.ts",
            "packages/cli/src/system/environment.ts/**",
            "tests/setup/system/environment.ts",
            "tests/setup/system/environment.ts/**",
            "tests/setup/runner/offline.ts",
            "tests/setup/runner/offline.ts/**"
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

    // JavaScript and repository settings
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

    // JavaScript and repository settings
    {
        "ignores": [],
        rules: {
            "import-x/exports-last": "off"
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

    // JavaScript and repository settings
    {
        "ignores": [],
        rules: {
            "n/no-unpublished-import": "off"
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "**/*",
                "packages/cli/configurations/language/javascript/config-files/eslint-functions.ts"
            ],
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "**/*",
                "packages/cli/configurations/language/javascript/config-files/eslint-functions.ts/**"
            ],
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "**/*",
                "packages/cli/configurations/language/markdown/config-files/markdownlint-cli2.ts"
            ],
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "**/*",
                "packages/cli/configurations/language/markdown/config-files/markdownlint-cli2.ts/**"
            ],
            [
                "**/*.astro",
                "**/*",
                "packages/cli/configurations/language/javascript/config-files/eslint-functions.ts"
            ],
            [
                "**/*.astro",
                "**/*",
                "packages/cli/configurations/language/javascript/config-files/eslint-functions.ts/**"
            ],
            [
                "**/*.astro",
                "**/*",
                "packages/cli/configurations/language/markdown/config-files/markdownlint-cli2.ts"
            ],
            [
                "**/*.astro",
                "**/*",
                "packages/cli/configurations/language/markdown/config-files/markdownlint-cli2.ts/**"
            ]
        ]
    },

    // JavaScript and repository settings
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

    // JavaScript and repository settings
    {
        "ignores": [],
        rules: {
            "package-json/specify-peers-locally": "off"
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

    // JavaScript and repository settings
    {
        rules: {
            "repository/schema-location": [
                "error",
                {
                    "folders": [
                        "packages/cli/src/schemas",
                        "packages/eslint-plugin/src/schemas",
                        "tests/schemas"
                    ]
                }
            ],
            "repository/no-promise-matchers": [
                "error"
            ]
        },
        files: [
            "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
            "**/*.astro"
        ]
    },

    // JavaScript and repository settings
    {
        rules: {
            "repository/schema-location": [
                "error",
                {
                    "folders": [
                        "packages/cli/src/schemas",
                        "packages/eslint-plugin/src/schemas",
                        "tests/schemas"
                    ]
                }
            ],
            "repository/no-promise-matchers": [
                "error"
            ]
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "docs/**/*"
            ],
            [
                "**/*.astro",
                "docs/**/*"
            ]
        ]
    },

    // JavaScript and repository settings
    {
        rules: {
            "repository/schema-location": [
                "error",
                {
                    "folders": [
                        "packages/cli/src/schemas",
                        "packages/eslint-plugin/src/schemas",
                        "tests/schemas"
                    ]
                }
            ],
            "repository/no-promise-matchers": [
                "error"
            ]
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/cli/**/*"
            ],
            [
                "**/*.astro",
                "packages/cli/**/*"
            ]
        ]
    },

    // JavaScript and repository settings
    {
        rules: {
            "repository/schema-location": [
                "error",
                {
                    "folders": [
                        "packages/cli/src/schemas",
                        "packages/eslint-plugin/src/schemas",
                        "tests/schemas"
                    ]
                }
            ],
            "repository/no-promise-matchers": [
                "error"
            ]
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/eslint-plugin/**/*"
            ],
            [
                "**/*.astro",
                "packages/eslint-plugin/**/*"
            ]
        ]
    },

    // JavaScript and repository settings
    {
        rules: {
            "repository/schema-location": [
                "error",
                {
                    "folders": [
                        "packages/cli/src/schemas",
                        "packages/eslint-plugin/src/schemas",
                        "tests/schemas"
                    ]
                }
            ],
            "repository/no-promise-matchers": [
                "error"
            ]
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "tests/**/*"
            ],
            [
                "**/*.astro",
                "tests/**/*"
            ]
        ]
    },

];
