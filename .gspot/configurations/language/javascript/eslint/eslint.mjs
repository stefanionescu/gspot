import { setLevelRules, mergePresetRules, addPlugins, setRuntime, setRootFolder, setBoundaryLookup, buildRuntimeMatcher, setRuleOptions } from "./functions.mjs";
import eslintJs from "@eslint/js";
import gspothqEslintPlugin from "@gspothq/eslint-plugin";
import eslintPluginUnicorn from "eslint-plugin-unicorn";
import eslintPluginImportX from "eslint-plugin-import-x";
import eslintPluginJsdoc from "eslint-plugin-jsdoc";
import eslintPluginN from "eslint-plugin-n";
import eslintPluginRegexp from "eslint-plugin-regexp";
import eslintPluginSecurity from "eslint-plugin-security";
import eslintPluginPerfectionist from "eslint-plugin-perfectionist";
import eslintPluginBoundaries from "eslint-plugin-boundaries";
import globals from "globals";
import eslintPluginPackageJson from "eslint-plugin-package-json";
import eslintConfigPrettier from "eslint-config-prettier";
import { defineConfig } from "eslint/config";
import typescriptBlocks from "../../typescript/eslint.mjs";
import astroBlocks from "../../../framework/astro/eslint.mjs";
import zodBlocks from "../../../library/zod/eslint.mjs";
const maxLinesList = [
    "error",
    {
        "max": 300,
        "skipBlankLines": true,
        "skipComments": true
    }
];
const maxLinesPerFunctionList = [
    "error",
    {
        "max": 60,
        "skipBlankLines": true,
        "skipComments": true,
        "IIFEs": true
    }
];
const maxParamsList = [
    "error",
    7
];
const maxDepthList = [
    "error",
    3
];
const maxStatementsList = [
    "error",
    30
];
const complexityList = [
    "error",
    {
        "max": 8,
        "variant": "modified"
    }
];
const importBoundaryFolders = [
    "*/*",
    "docs",
    "packages/cli",
    "packages/eslint-plugin",
    "tests"
];
const gspotImportBoundariesList = [
    "error",
    {
        "folders": importBoundaryFolders,
        "aliases": {
            "#cli/*": "packages/cli/src/*",
            "#tests/*": "tests/*",
            "#cli-package": "packages/cli/package.json",
            "#eslint-plugin/*": "packages/eslint-plugin/src/*",
            "#eslint-plugin-package": "packages/eslint-plugin/package.json",
            "#root-package": "package.json",
            "#docs/*": "docs/src/*",
            "ajv/*": "node_modules/.test-tools/node_modules/ajv/*",
            "eslint": "node_modules/.test-tools/node_modules/eslint",
            "html-validate": "node_modules/.test-tools/node_modules/html-validate",
            "prettier": "node_modules/.test-tools/node_modules/prettier/index.d.ts",
            "prettier/*": "node_modules/.test-tools/node_modules/prettier/*",
            "stylelint": "node_modules/.test-tools/node_modules/stylelint/types/stylelint/index.d.ts",
            "typescript": "node_modules/.test-tools/node_modules/typescript"
        }
    }
];
const tryExtensionsList = [
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
];
const nFileExtensionInImportList = [
    "error",
    "always"
];
const gspotImportBoundariesList2 = [
    "error",
    {
        "folders": importBoundaryFolders,
        "aliases": {}
    }
];
const ignoresList = [
    "docs/**",
    "packages/cli/**",
    "packages/eslint-plugin/**",
    "tests/**"
];
const patternList = [
    "**/test/**",
    "**/tests/**",
    "**/__tests__/**",
    "**/*.test.*",
    "**/*.spec.*",
    "**/Tests/**",
    "docs/**/test/**",
    "docs/**/tests/**",
    "docs/**/__tests__/**",
    "docs/**/*.test.*",
    "docs/**/*.spec.*",
    "docs/**/Tests/**",
    "packages/cli/**/test/**",
    "packages/cli/**/tests/**",
    "packages/cli/**/__tests__/**",
    "packages/cli/**/*.test.*",
    "packages/cli/**/*.spec.*",
    "packages/cli/**/Tests/**",
    "packages/eslint-plugin/**/test/**",
    "packages/eslint-plugin/**/tests/**",
    "packages/eslint-plugin/**/__tests__/**",
    "packages/eslint-plugin/**/*.test.*",
    "packages/eslint-plugin/**/*.spec.*",
    "packages/eslint-plugin/**/Tests/**",
    "tests/**/test/**",
    "tests/**/tests/**",
    "tests/**/__tests__/**",
    "tests/**/*.test.*",
    "tests/**/*.spec.*",
    "tests/**/Tests/**"
];
const noneOfList = [
    "import-rule:cli-types",
    "import-rule:system",
    "import-rule:parsers",
    "import-rule:manifests",
    "import-rule:repository",
    "import-rule:settings",
    "import-rule:tools",
    "import-rule:engine",
    "import-rule:shipped-config",
    "import-rule:configurations",
    "import-rule:generation",
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
    "import-rule:release"
];
const runtimeDeclarations = [
    {
        "scopePath": "",
        "runtime": "node",
        "includes": [
            "^(?:(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$))(?:(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$)).)*?)\\/)?(?!\\.{1,2}(?:\\/|$))(?=.)[^/]*?\\/?)$"
        ],
        "excludes": []
    },
    {
        "scopePath": "",
        "runtime": "commonjs",
        "includes": [
            "^(?:(?:^|\\/|(?:(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$)).)*?)\\/)(?!\\.{1,2}(?:\\/|$))(?=.)[^/]*?\\.(cjs|cts))$"
        ],
        "excludes": []
    },
    {
        "scopePath": "docs",
        "runtime": "node",
        "includes": [
            "^(?:docs(?:\\/(?!\\.{1,2}(?:\\/|$))(?:(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$)).)*?)\\/|\\/|$)(?!\\.{1,2}(?:\\/|$))(?=.)[^/]*?\\.(js|jsx))$"
        ],
        "excludes": []
    },
    {
        "scopePath": "tests",
        "runtime": "node",
        "includes": [
            "^(?:tests(?:\\/(?!\\.{1,2}(?:\\/|$))(?:(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$)).)*?)\\/|\\/|$)(?!\\.{1,2}(?:\\/|$))(?=.)[^/]*?\\.(js|jsx))$"
        ],
        "excludes": []
    },
    {
        "scopePath": "packages/cli",
        "runtime": "node",
        "includes": [
            "^(?:packages\\/cli(?:\\/(?!\\.{1,2}(?:\\/|$))(?:(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$)).)*?)\\/|\\/|$)(?!\\.{1,2}(?:\\/|$))(?=.)[^/]*?\\.(js|jsx))$"
        ],
        "excludes": []
    },
    {
        "scopePath": "packages/eslint-plugin",
        "runtime": "node",
        "includes": [
            "^(?:packages\\/eslint-plugin(?:\\/(?!\\.{1,2}(?:\\/|$))(?:(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$)).)*?)\\/|\\/|$)(?!\\.{1,2}(?:\\/|$))(?=.)[^/]*?\\.(js|jsx))$"
        ],
        "excludes": []
    }
];
const ignoresList2 = [
    "**/*.config.*"
];
const ignoresList3 = [
    "packages/cli/src/system/environment.ts",
    "tests/setup/system/environment.ts"
];
const gspotRestrictedSyntaxList = [
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
        "selector": ":matches(TSAsExpression[expression.type=\"TSAsExpression\"], TSTypeAssertion[expression.type=\"TSTypeAssertion\"])",
        "message": "Do not assert twice. Narrow the value, fix its type, or check it at run time."
    },
    {
        "selector": ":matches(TSAsExpression, TSTypeAssertion) > TSNeverKeyword",
        "message": "Do not assert to never to silence the type system."
    },
    {
        "selector": "Program:has(> :matches(ExportNamedDeclaration:not([exportKind=\"type\"]), ExportDefaultDeclaration, ExportAllDeclaration:not([exportKind=\"type\"]))) > :matches(ForStatement, ForOfStatement, ForInStatement, WhileStatement, DoWhileStatement, IfStatement, TryStatement)",
        "message": "A module that exports values runs no statements when it loads. Move this statement into a function that the entry point calls.",
        "ignores": ignoresList2
    },
    {
        "selector": "NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > :matches(Literal.arguments:first-child[value=/^[a-z]/], TemplateLiteral.arguments:first-child[quasis.0.value.raw=/^[a-z]/])",
        "message": "Start an error message with a capital letter."
    },
    {
        "selector": "LabeledStatement:not([body.type=/^(?:WhileStatement|DoWhileStatement|ForStatement|ForInStatement|ForOfStatement|SwitchStatement)$/])",
        "message": "Use a label only on a loop or switch statement. Remove this label."
    },
    {
        "selector": "ForStatement[init=null][update=null][test!=null]",
        "message": "This loop has no initializer or update. Use a while loop for its condition."
    },
    {
        "selector": "UnaryExpression[operator='delete']:not([argument.type='MemberExpression']):not([argument.type='ChainExpression']):not([argument.type='Identifier'])",
        "message": "The delete operator removes properties. Pass a property access instead of this expression."
    },
    {
        "selector": "AssignmentExpression:not(ExpressionStatement > AssignmentExpression):not(AssignmentExpression > AssignmentExpression):not(BinaryExpression[operator=/^(?:==|!=|===|!==|<|<=|>|>=)$/] > AssignmentExpression):not(SequenceExpression > AssignmentExpression):not(VariableDeclarator > AssignmentExpression):not(ArrowFunctionExpression > AssignmentExpression.body):not(LogicalExpression > AssignmentExpression.right):not(WhileStatement > AssignmentExpression.test):not(DoWhileStatement > AssignmentExpression.test):not(ForStatement > AssignmentExpression.init):not(ForStatement > AssignmentExpression.update)",
        "message": "Move this assignment into a separate statement before using its value."
    },
    {
        "selector": "CallExpression[callee.type=/^(?:ArrayExpression|ClassExpression|ObjectExpression|Literal|TemplateLiteral)$/]",
        "message": "Call a function or method instead of a literal value."
    },
    {
        "selector": "TaggedTemplateExpression[tag.type=/^(?:ArrayExpression|ClassExpression|ObjectExpression|Literal|TemplateLiteral)$/]",
        "message": "Use a function as the template tag instead of a literal value."
    },
    {
        "selector": "ImportDeclaration[source.value=/node_modules/]",
        "message": "Use the package's public name instead of a node_modules path."
    },
    {
        "selector": "CallExpression[callee.type='Identifier'][callee.name='require'][arguments.length=1][arguments.0.type='Literal'][arguments.0.value=type(string)][arguments.0.value=/node_modules/]",
        "message": "Use the package's public name instead of a node_modules path."
    },
    {
        "selector": ":matches(WhileStatement, DoWhileStatement, ForStatement, ForInStatement, ForOfStatement) > BlockStatement[body.length>1] > ContinueStatement[label=null]:last-child",
        "message": "This continue ends the loop body, so it does nothing. Remove it."
    },
    {
        "selector": ":matches(WhileStatement, DoWhileStatement, ForStatement, ForInStatement, ForOfStatement) > BlockStatement > IfStatement:last-child > BlockStatement[body.length>1] > ContinueStatement[label=null]:last-child",
        "message": "This continue ends the loop body, so it does nothing. Remove it."
    },
    {
        "selector": "Literal[regex.flags=/s/][regex.pattern=/\\[(?:\\\\s\\\\S|\\\\S\\\\s)\\]/]",
        "message": "The s flag makes . match every character. Write . instead of this character class."
    },
    {
        "selector": "LogicalExpression[operator=/^(\\|\\||\\?\\?)$/][right.type=\"ObjectExpression\"][right.properties.length=0]",
        "message": "An empty-object fallback hides a missing value. Handle the missing case."
    },
    {
        "selector": "CallExpression:matches([callee.property.name=/^(debug|info|warn|error|fatal|trace)$/], [callee.property.name=\"log\"][callee.object.name!=\"console\"]) > TemplateLiteral.arguments:first-child[expressions.length>0]",
        "message": "Log a stable message and pass the values as fields."
    },
    {
        "selector": "CallExpression[callee.property.name='waitForLoadState'] > Literal:first-child[value='networkidle']",
        "message": "Network inactivity does not prove that the page is ready. Wait for the visible state, response, or URL."
    },
    {
        "selector": "Program:has(ImportDeclaration[source.value='@playwright/test']) CallExpression[callee.name='expect'] > AwaitExpression:first-child",
        "message": "Pass the locator to expect, so that the assertion retries, such as await expect(locator).toHaveText(text)."
    },
    {
        "selector": "AssignmentExpression[left.property.name=/^(?:innerHTML|outerHTML)$/]:not([right.type=\"Literal\"])",
        "message": "Writing HTML into the page allows XSS. Set textContent, create the nodes, or write fixed markup."
    },
    {
        "selector": "CallExpression:matches([callee.property.name=\"insertAdjacentHTML\"][arguments.1.type!=\"Literal\"], [callee.object.name=\"document\"][callee.property.name=\"write\"][arguments.0.type!=\"Literal\"])",
        "message": "Writing HTML into the page allows XSS. Set textContent, create the nodes, or write fixed markup."
    },
    {
        "selector": "CallExpression[callee.name=\"fetch\"]:matches([arguments.0.object.object.name=\"req\"], [arguments.0.callee.object.property.name=\"searchParams\"][arguments.0.callee.property.name=\"get\"])",
        "message": "fetch() takes its URL from the request, which allows server-side request forgery. Allow only known hosts."
    },
    {
        "selector": "CallExpression[callee.property.name=/^(?:log|trace|debug|info|warn|error|fatal)$/][arguments.length=1]:matches([arguments.0.object.object.name=\"process\"][arguments.0.object.property.name=\"env\"][arguments.0.property.name=/KEY|SECRET|PASSWORD|TOKEN|CREDENTIAL/], [arguments.0.callee.object.object.name=\"Deno\"][arguments.0.callee.object.property.name=\"env\"][arguments.0.callee.property.name=\"get\"][arguments.0.arguments.0.value=/KEY|SECRET|PASSWORD|TOKEN|CREDENTIAL/])",
        "message": "The log writes a secret from the environment. Remove the value, or mask it."
    },
    {
        "selector": "CallExpression[callee.name=/^(?:execSync|exec)$/] > TemplateLiteral.arguments:first-child[expressions.length>0]",
        "message": "Interpolation in execSync() or exec() allows command injection. Use execFileSync() or execFile() with an argument array."
    },
    {
        "selector": "MemberExpression[object.type=\"MetaProperty\"][object.meta.name=\"import\"][object.property.name=\"meta\"][property.name=\"env\"]",
        "message": "Read environment variables only in the files that structure.environment_readers lists, and pass the value in.",
        "ignores": ignoresList3
    },
    {
        "selector": ":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#[^/]+\\/|@\\/)/][source.value!=/\\.[^/?.]+$/]:not([source.value=/\\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))",
        "message": "Give an alias import its file extension."
    }
];
const gspotNoTrivialFunctionsList = [
    "error",
    {
        "trivialFunctionStatements": 2
    }
];
export default setRuleOptions(defineConfig([
    {
    "ignores": [
        "**/build/**",
        ".gspot/**",
        ".gspot-copies/**",
        "**/gspot.baseline.json",
        ".editorconfig",
        ".github/workflows/gspot.yml",
        ".markdownlint.jsonc",
        ".prettierignore",
        ".stylelintrc.yml",
        "eslint.config.mjs",
        "prettier.config.mjs",
        "packages/cli/README.md",
        "**/CHANGELOG.md",
        "tests/setup/sandboxes/test-tools.lock",
        "docs/worker-configuration.d.ts",
        "docs/cloudflare-env.d.ts",
        "**/node_modules/**",
        "**/bower_components/**",
        "**/coverage/**",
        "**/.env",
        "**/.env.*",
        "**/.dev.vars",
        "**/.dev.vars.*",
        "**/.wrangler/**",
        "**/bun.lock",
        "**/*.log",
        "packages/*/dist/**",
        "docs/dist/**",
        "docs/.astro/**",
        "docs/.wrangler/**"
    ]
},
    setLevelRules({"extends": [eslintJs["configs"]["recommended"]],
    "files": ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*.astro"]}, gspothqEslintPlugin, "all"),
    setLevelRules({"extends": [eslintPluginUnicorn["configs"]["recommended"]],
    "files": ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*.astro"]}, gspothqEslintPlugin, "all"),
    setRootFolder(setRuntime(addPlugins(setLevelRules(mergePresetRules({"linterOptions": {
        "reportUnusedDisableDirectives": "error"
    },
    "languageOptions": {
        "ecmaVersion": "latest"
    },
    "settings": {
        "import-x/ignore": [
            "[/\\\\]build[/\\\\]",
            "[/\\\\]\\.gspot[/\\\\]",
            "[/\\\\]\\.gspot-copies[/\\\\]",
            "[/\\\\]node_modules[/\\\\]",
            "[/\\\\]bower_components[/\\\\]",
            "[/\\\\]coverage[/\\\\]",
            "[/\\\\]\\.wrangler[/\\\\]",
            "[/\\\\]docs[/\\\\]dist[/\\\\]",
            "[/\\\\]docs[/\\\\]\\.astro[/\\\\]",
            "[/\\\\]docs[/\\\\]\\.wrangler[/\\\\]"
        ]
    },
    "rules": {
        "array-callback-return": "error",
        "block-scoped-var": "error",
        "no-const-assign": "error",
        "no-loop-func": "error",
        "no-labels": "error",
        "no-new": "error",
        "no-nested-ternary": "error",
        "default-case-last": "error",
        "no-void": "error",
        "no-constructor-return": "error",
        "no-new-func": "error",
        "no-promise-executor-return": "error",
        "no-return-assign": "error",
        "no-self-compare": "error",
        "no-template-curly-in-string": "error",
        "no-unmodified-loop-condition": "error",
        "no-unreachable-loop": "error",
        "no-var": "error",
        "no-empty-character-class": "off",
        "no-useless-constructor": "error",
        "no-useless-return": "error",
        "no-useless-call": "error",
        "no-useless-rename": "error",
        "no-duplicate-imports": "off",
        "eqeqeq": "error",
        "prefer-const": "error",
        "no-param-reassign": "error",
        "no-warning-comments": [
            "error",
            {
                "terms": [
                    "todo",
                    "fixme",
                    "xxx",
                    "hack"
                ],
                "location": "anywhere"
            }
        ],
        "perfectionist/sort-imports": [
            "error",
            {
                "type": "alphabetical",
                "ignoreCase": false,
                "groups": [
                    "builtin",
                    "external",
                    "internal",
                    [
                        "parent",
                        "sibling",
                        "index"
                    ],
                    "unknown"
                ],
                "newlinesBetween": 1,
                "useExperimentalDependencyDetection": false
            }
        ],
        "perfectionist/sort-named-imports": [
            "error",
            {
                "type": "alphabetical",
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
        "unicorn/name-replacements": "off",
        "unicorn/filename-case": "off",
        "unicorn/no-null": "off",
        "unicorn/no-useless-undefined": "off",
        "unicorn/import-style": "off",
        "unicorn/prefer-export-from": "off",
        "unicorn/no-unnecessary-array-flat-map": "off",
        "unicorn/no-abusive-eslint-disable": "off",
        "unicorn/prefer-ternary": "off",
        "unicorn/prefer-await": "off",
        "unicorn/no-negated-array-predicate": "off",
        "unicorn/prefer-simple-condition-first": "off",
        "unicorn/prefer-combined-guards": "off",
        "unicorn/expiring-todo-comments": "off",
        "unicorn/consistent-boolean-name": [
            "error",
            {
                "checkFunctions": "never",
                "ignore": [
                    "^_",
                    "^(?:enabled|active|retryable)$"
                ],
                "prefixes": {
                    "are": false,
                    "have": false,
                    "should": false,
                    "was": false,
                    "were": false,
                    "does": false,
                    "did": false,
                    "will": false,
                    "requires": false
                }
            }
        ],
        "security/detect-disable-mustache-escape": "error",
        "security/detect-eval-with-expression": "off",
        "security/detect-new-buffer": "off",
        "security/detect-non-literal-regexp": "off",
        "security/detect-non-literal-require": "off",
        "security/detect-pseudoRandomBytes": "off",
        "import-x/no-dynamic-require": "error",
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
                    "MethodDefinition": true
                },
                "contexts": [
                    ":matches(VariableDeclarator, AssignmentExpression, ExportDefaultDeclaration, PropertyDefinition) > :matches(ArrowFunctionExpression, FunctionExpression)"
                ]
            }
        ],
        "jsdoc/require-description": "error",
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
        "regexp/no-lazy-ends": [
            "error",
            {
                "ignorePartial": false
            }
        ],
        "regexp/no-optional-assertion": "error",
        "regexp/no-invalid-regexp": "error",
        "regexp/no-misleading-capturing-group": "error",
        "regexp/no-contradiction-with-assertion": "error",
        "regexp/strict": "error",
        "regexp/no-super-linear-move": "error",
        "regexp/no-dupe-characters-character-class": "error",
        "regexp/prefer-character-class": [
            "error",
            {
                "minAlternatives": 2
            }
        ],
        "regexp/prefer-d": "error",
        "regexp/prefer-w": "error",
        "regexp/prefer-question-quantifier": "error",
        "regexp/prefer-star-quantifier": "error",
        "regexp/prefer-plus-quantifier": "error",
        "regexp/no-useless-two-nums-quantifier": "error",
        "regexp/no-zero-quantifier": "error",
        "regexp/match-any": "error",
        "regexp/prefer-result-array-groups": "error",
        "regexp/prefer-named-replacement": "error",
        "regexp/prefer-named-backreference": "error",
        "regexp/no-unused-capturing-group": "error",
        "import-x/export": "error",
        "import-x/no-self-import": "error",
        "import-x/no-useless-path-segments": "error",
        "import-x/no-empty-named-blocks": "error",
        "import-x/no-duplicates": "error",
        "import-x/no-mutable-exports": "error",
        "import-x/no-relative-packages": "error",
        "import-x/no-default-export": "error",
        "max-lines": maxLinesList,
        "max-lines-per-function": maxLinesPerFunctionList,
        "max-params": maxParamsList,
        "max-depth": maxDepthList,
        "max-statements": maxStatementsList,
        "max-nested-callbacks": maxDepthList,
        "complexity": complexityList,
        "gspot/no-identical-functions": [
            "error",
            {
                "minLines": 8
            }
        ],
        "gspot/import-boundaries": gspotImportBoundariesList,
        "import-x/first": "error",
        "import-x/newline-after-import": [
            "error",
            {
                "count": 1,
                "considerComments": true
            }
        ]
    },
    "files": ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*.astro"]}, gspothqEslintPlugin["configs"]["all"]), gspothqEslintPlugin, "all"), { "gspot": gspothqEslintPlugin, "import-x": eslintPluginImportX, "jsdoc": eslintPluginJsdoc, "n": eslintPluginN, "regexp": eslintPluginRegexp, "security": eslintPluginSecurity, "perfectionist": eslintPluginPerfectionist, "boundaries": eslintPluginBoundaries }), globals, "es2024", "module"), [
        [
            "settings",
            "gspot",
            "root"
        ],
        [
            "settings",
            "boundaries/root-path"
        ]
    ]),
    setLevelRules({"rules": {
        "no-implied-eval": "error",
        "no-throw-literal": "error",
        "no-unused-expressions": "error",
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
    "files": ["**/*.{js,mjs,cjs,jsx}"]}, gspothqEslintPlugin, "all"),
    setLevelRules({"settings": {
        "n": {
            "tryExtensions": tryExtensionsList,
            "typescriptExtensionMap": []
        }
    },
    "rules": {
        "n/file-extension-in-import": nFileExtensionInImportList
    },
    "files": [["**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "gspot/import-boundaries": gspotImportBoundariesList
    },
    "files": ["docs/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/cli/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "gspot/import-boundaries": gspotImportBoundariesList2
    },
    "files": ["packages/eslint-plugin/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "tests/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"]}, gspothqEslintPlugin, "all"),
    setLevelRules({"settings": {
        "n": {
            "tryExtensions": tryExtensionsList,
            "typescriptExtensionMap": []
        }
    },
    "rules": {
        "n/file-extension-in-import": nFileExtensionInImportList,
        "gspot/import-boundaries": gspotImportBoundariesList2
    },
    "ignores": ignoresList,
    "files": ["**/*.mjs", "**/*.cjs"]}, gspothqEslintPlugin, "all"),
    setLevelRules({"settings": {
        "n": {
            "tryExtensions": tryExtensionsList,
            "typescriptExtensionMap": []
        }
    },
    "rules": {
        "n/file-extension-in-import": nFileExtensionInImportList,
        "gspot/import-boundaries": gspotImportBoundariesList2
    },
    "files": ["docs/**/*.mjs", "docs/**/*.cjs", "packages/cli/**/*.mjs", "packages/cli/**/*.cjs", "packages/eslint-plugin/**/*.mjs", "packages/eslint-plugin/**/*.cjs", "tests/**/*.mjs", "tests/**/*.cjs"]}, gspothqEslintPlugin, "all"),
    setBoundaryLookup(setLevelRules({"settings": {
        "boundaries/files": [
            {
                "category": "tests",
                "pattern": patternList,
                "stopMatching": true
            },
            {
                "category": "import-rule:cli-types",
                "pattern": [
                    "packages/cli/src/types/*.d.ts"
                ],
                "stopMatching": true
            },
            {
                "category": "import-rule:system",
                "pattern": [
                    "packages/cli/src/system/**",
                    "packages/cli/src/config/system.ts",
                    "packages/cli/src/types/system.ts"
                ],
                "stopMatching": true
            },
            {
                "category": "import-rule:parsers",
                "pattern": [
                    "packages/cli/src/parsers/**",
                    "packages/cli/src/config/parsers.ts",
                    "packages/cli/src/types/parsers.ts",
                    "packages/cli/src/schemas/parsers.ts"
                ],
                "stopMatching": true
            },
            {
                "category": "import-rule:manifests",
                "pattern": [
                    "packages/cli/src/manifests/**",
                    "packages/cli/src/config/manifests.ts",
                    "packages/cli/src/types/manifests.ts",
                    "packages/cli/src/schemas/manifests/**"
                ],
                "stopMatching": true
            },
            {
                "category": "import-rule:repository",
                "pattern": [
                    "packages/cli/src/repository/**",
                    "packages/cli/src/config/repository/**",
                    "packages/cli/src/types/repository.ts",
                    "packages/cli/src/schemas/repository.ts"
                ],
                "stopMatching": true
            },
            {
                "category": "import-rule:settings",
                "pattern": [
                    "packages/cli/src/settings/**",
                    "packages/cli/src/config/settings/**",
                    "packages/cli/src/types/settings.ts",
                    "packages/cli/src/schemas/settings/**"
                ],
                "stopMatching": true
            },
            {
                "category": "import-rule:tools",
                "pattern": [
                    "packages/cli/src/tools/**",
                    "packages/cli/src/config/tools/**",
                    "packages/cli/src/types/tools.ts",
                    "packages/cli/src/schemas/tools.ts"
                ],
                "stopMatching": true
            },
            {
                "category": "import-rule:engine",
                "pattern": [
                    "packages/cli/src/engine/**",
                    "packages/cli/src/config/engine.ts",
                    "packages/cli/src/types/engine/**",
                    "packages/cli/src/schemas/engine.ts"
                ],
                "stopMatching": true
            },
            {
                "category": "import-rule:shipped-config",
                "pattern": [
                    "packages/cli/src/configurations/*/*/files/**"
                ],
                "stopMatching": true
            },
            {
                "category": "import-rule:configurations",
                "pattern": [
                    "packages/cli/src/configurations/**",
                    "packages/cli/src/config/configurations/**",
                    "packages/cli/src/types/configurations/**",
                    "packages/cli/src/schemas/configurations.ts"
                ],
                "stopMatching": true
            },
            {
                "category": "import-rule:generation",
                "pattern": [
                    "packages/cli/src/generation/**",
                    "packages/cli/src/config/generation.ts",
                    "packages/cli/src/types/generation.ts",
                    "packages/cli/src/schemas/generation.ts"
                ],
                "stopMatching": true
            },
            {
                "category": "import-rule:commands",
                "pattern": [
                    "packages/cli/src/commands/**",
                    "packages/cli/src/config/commands/**",
                    "packages/cli/src/types/commands/**",
                    "packages/cli/src/schemas/commands.ts"
                ],
                "stopMatching": true
            },
            {
                "category": "import-rule:main",
                "pattern": [
                    "packages/cli/src/main.ts",
                    "packages/cli/src/bin.ts",
                    "packages/cli/src/reference.ts",
                    "packages/cli/src/config/main.ts",
                    "packages/cli/src/types/main.ts"
                ],
                "stopMatching": true
            },
            {
                "category": "import-rule:plugin-config",
                "pattern": [
                    "packages/eslint-plugin/src/config/**"
                ],
                "stopMatching": true
            },
            {
                "category": "import-rule:plugin-types",
                "pattern": [
                    "packages/eslint-plugin/src/types/**"
                ],
                "stopMatching": true
            },
            {
                "category": "import-rule:plugin",
                "pattern": [
                    "packages/eslint-plugin/src/*.ts",
                    "packages/eslint-plugin/src/language/**",
                    "packages/eslint-plugin/src/libraries/**",
                    "packages/eslint-plugin/src/rules/**",
                    "packages/eslint-plugin/plugin.d.ts"
                ],
                "stopMatching": true
            },
            {
                "category": "import-rule:docs-config",
                "pattern": [
                    "docs/src/config/**"
                ],
                "stopMatching": true
            },
            {
                "category": "import-rule:docs-types",
                "pattern": [
                    "docs/src/types/**"
                ],
                "stopMatching": true
            },
            {
                "category": "import-rule:docs",
                "pattern": [
                    "docs/src/*.*",
                    "docs/src/!(config|types)/**"
                ],
                "stopMatching": true
            },
            {
                "category": "import-rule:tests-data",
                "pattern": [
                    "tests/config/**"
                ],
                "stopMatching": true
            },
            {
                "category": "import-rule:tests-types",
                "pattern": [
                    "tests/types/**"
                ],
                "stopMatching": true
            },
            {
                "category": "import-rule:tests-setup",
                "pattern": [
                    "tests/setup/**",
                    "tests/schemas/**"
                ],
                "stopMatching": true
            },
            {
                "category": "import-rule:tests",
                "pattern": [
                    "tests/suites/**"
                ],
                "stopMatching": true
            },
            {
                "category": "import-rule:release",
                "pattern": [
                    ".mise/release/**"
                ],
                "stopMatching": true
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
    "rules": {
        "boundaries/dependencies": [
            "error",
            {
                "default": "disallow",
                "policies": [
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
                        "message": "Import rule \"cli-types\" may import its own files and \"system\", \"parsers\", \"manifests\", \"repository\", \"settings\", \"tools\", \"engine\", \"configurations\", \"generation\", \"commands\", \"main\", not {{dependency.source}} from {{#each to.file.categories}}{{#if @last}}{{this}}{{/if}}{{/each}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
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
                                            "import-rule:system",
                                            "import-rule:parsers",
                                            "import-rule:manifests",
                                            "import-rule:repository",
                                            "import-rule:settings",
                                            "import-rule:tools",
                                            "import-rule:engine",
                                            "import-rule:configurations",
                                            "import-rule:generation",
                                            "import-rule:commands",
                                            "import-rule:main"
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
                        "message": "Import rule \"system\" may import its own files and \"cli-types\", not {{dependency.source}} from {{#each to.file.categories}}{{#if @last}}{{this}}{{/if}}{{/each}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
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
                        "message": "Import rule \"parsers\" may import its own files and \"cli-types\", \"system\", not {{dependency.source}} from {{#each to.file.categories}}{{#if @last}}{{this}}{{/if}}{{/each}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
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
                                "categories": "import-rule:manifests"
                            }
                        },
                        "disallow": {
                            "to": {
                                "file": {
                                    "path": "**/*"
                                }
                            }
                        },
                        "message": "Import rule \"manifests\" may import its own files and \"cli-types\", \"system\", \"parsers\", not {{dependency.source}} from {{#each to.file.categories}}{{#if @last}}{{this}}{{/if}}{{/each}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
                    },
                    {
                        "from": {
                            "file": {
                                "categories": "import-rule:manifests"
                            }
                        },
                        "allow": {
                            "to": {
                                "file": {
                                    "categories": {
                                        "anyOf": [
                                            "import-rule:manifests",
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
                        "message": "Import rule \"repository\" may import its own files and \"cli-types\", \"system\", \"parsers\", \"manifests\", not {{dependency.source}} from {{#each to.file.categories}}{{#if @last}}{{this}}{{/if}}{{/each}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
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
                                            "import-rule:cli-types",
                                            "import-rule:system",
                                            "import-rule:parsers",
                                            "import-rule:manifests"
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
                        "message": "Import rule \"settings\" may import its own files and \"cli-types\", \"system\", \"parsers\", \"manifests\", \"repository\", not {{dependency.source}} from {{#each to.file.categories}}{{#if @last}}{{this}}{{/if}}{{/each}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
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
                                            "import-rule:cli-types",
                                            "import-rule:system",
                                            "import-rule:parsers",
                                            "import-rule:manifests",
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
                        "message": "Import rule \"tools\" may import its own files and \"cli-types\", \"system\", \"parsers\", \"manifests\", \"repository\", \"settings\", not {{dependency.source}} from {{#each to.file.categories}}{{#if @last}}{{this}}{{/if}}{{/each}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
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
                                            "import-rule:cli-types",
                                            "import-rule:system",
                                            "import-rule:parsers",
                                            "import-rule:manifests",
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
                                "categories": "import-rule:engine"
                            }
                        },
                        "disallow": {
                            "to": {
                                "file": {
                                    "path": "**/*"
                                }
                            }
                        },
                        "message": "Import rule \"engine\" may import its own files and \"cli-types\", \"system\", \"parsers\", \"manifests\", \"repository\", \"settings\", \"tools\", not {{dependency.source}} from {{#each to.file.categories}}{{#if @last}}{{this}}{{/if}}{{/each}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
                    },
                    {
                        "from": {
                            "file": {
                                "categories": "import-rule:engine"
                            }
                        },
                        "allow": {
                            "to": {
                                "file": {
                                    "categories": {
                                        "anyOf": [
                                            "import-rule:engine",
                                            "import-rule:cli-types",
                                            "import-rule:system",
                                            "import-rule:parsers",
                                            "import-rule:manifests",
                                            "import-rule:repository",
                                            "import-rule:settings",
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
                                "categories": "import-rule:shipped-config"
                            }
                        },
                        "disallow": {
                            "to": {
                                "file": {
                                    "path": "**/*"
                                }
                            }
                        },
                        "message": "Import rule \"shipped-config\" may import its own files and \"configurations\", not {{dependency.source}} from {{#each to.file.categories}}{{#if @last}}{{this}}{{/if}}{{/each}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
                    },
                    {
                        "from": {
                            "file": {
                                "categories": "import-rule:shipped-config"
                            }
                        },
                        "allow": {
                            "to": {
                                "file": {
                                    "categories": {
                                        "anyOf": [
                                            "import-rule:shipped-config",
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
                        "message": "Import rule \"configurations\" may import its own files and \"cli-types\", \"system\", \"parsers\", \"manifests\", \"repository\", \"settings\", \"tools\", \"engine\", \"shipped-config\", not {{dependency.source}} from {{#each to.file.categories}}{{#if @last}}{{this}}{{/if}}{{/each}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
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
                                            "import-rule:cli-types",
                                            "import-rule:system",
                                            "import-rule:parsers",
                                            "import-rule:manifests",
                                            "import-rule:repository",
                                            "import-rule:settings",
                                            "import-rule:tools",
                                            "import-rule:engine",
                                            "import-rule:shipped-config"
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
                        "message": "Import rule \"generation\" may import its own files and \"cli-types\", \"system\", \"parsers\", \"manifests\", \"repository\", \"settings\", \"tools\", \"engine\", \"shipped-config\", \"configurations\", not {{dependency.source}} from {{#each to.file.categories}}{{#if @last}}{{this}}{{/if}}{{/each}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
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
                                            "import-rule:cli-types",
                                            "import-rule:system",
                                            "import-rule:parsers",
                                            "import-rule:manifests",
                                            "import-rule:repository",
                                            "import-rule:settings",
                                            "import-rule:tools",
                                            "import-rule:engine",
                                            "import-rule:shipped-config",
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
                        "message": "Import rule \"commands\" may import its own files and \"cli-types\", \"system\", \"parsers\", \"manifests\", \"repository\", \"settings\", \"tools\", \"engine\", \"shipped-config\", \"configurations\", \"generation\", not {{dependency.source}} from {{#each to.file.categories}}{{#if @last}}{{this}}{{/if}}{{/each}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
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
                                            "import-rule:cli-types",
                                            "import-rule:system",
                                            "import-rule:parsers",
                                            "import-rule:manifests",
                                            "import-rule:repository",
                                            "import-rule:settings",
                                            "import-rule:tools",
                                            "import-rule:engine",
                                            "import-rule:shipped-config",
                                            "import-rule:configurations",
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
                        "message": "Import rule \"main\" may import its own files and \"cli-types\", \"system\", \"parsers\", \"manifests\", \"repository\", \"settings\", \"tools\", \"engine\", \"shipped-config\", \"configurations\", \"generation\", \"commands\", not {{dependency.source}} from {{#each to.file.categories}}{{#if @last}}{{this}}{{/if}}{{/each}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
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
                                            "import-rule:cli-types",
                                            "import-rule:system",
                                            "import-rule:parsers",
                                            "import-rule:manifests",
                                            "import-rule:repository",
                                            "import-rule:settings",
                                            "import-rule:tools",
                                            "import-rule:engine",
                                            "import-rule:shipped-config",
                                            "import-rule:configurations",
                                            "import-rule:generation",
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
                        "message": "Import rule \"plugin-config\" may import only its own files, not {{dependency.source}} from {{#each to.file.categories}}{{#if @last}}{{this}}{{/if}}{{/each}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
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
                        "message": "Import rule \"plugin-types\" may import only its own files, not {{dependency.source}} from {{#each to.file.categories}}{{#if @last}}{{this}}{{/if}}{{/each}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
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
                        "message": "Import rule \"plugin\" may import its own files and \"plugin-config\", \"plugin-types\", not {{dependency.source}} from {{#each to.file.categories}}{{#if @last}}{{this}}{{/if}}{{/each}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
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
                        "message": "Import rule \"docs-config\" may import its own files and \"system\", \"parsers\", \"manifests\", \"repository\", \"settings\", \"tools\", \"engine\", \"configurations\", \"generation\", \"commands\", \"main\", \"cli-types\", \"docs-types\", not {{dependency.source}} from {{#each to.file.categories}}{{#if @last}}{{this}}{{/if}}{{/each}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
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
                                            "import-rule:system",
                                            "import-rule:parsers",
                                            "import-rule:manifests",
                                            "import-rule:repository",
                                            "import-rule:settings",
                                            "import-rule:tools",
                                            "import-rule:engine",
                                            "import-rule:configurations",
                                            "import-rule:generation",
                                            "import-rule:commands",
                                            "import-rule:main",
                                            "import-rule:cli-types",
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
                        "message": "Import rule \"docs-types\" may import its own files and \"system\", \"parsers\", \"manifests\", \"repository\", \"settings\", \"tools\", \"engine\", \"configurations\", \"generation\", \"commands\", \"main\", \"cli-types\", \"docs-config\", not {{dependency.source}} from {{#each to.file.categories}}{{#if @last}}{{this}}{{/if}}{{/each}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
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
                                            "import-rule:system",
                                            "import-rule:parsers",
                                            "import-rule:manifests",
                                            "import-rule:repository",
                                            "import-rule:settings",
                                            "import-rule:tools",
                                            "import-rule:engine",
                                            "import-rule:configurations",
                                            "import-rule:generation",
                                            "import-rule:commands",
                                            "import-rule:main",
                                            "import-rule:cli-types",
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
                        "message": "Import rule \"docs\" may import its own files and \"cli-types\", \"system\", \"parsers\", \"manifests\", \"repository\", \"settings\", \"tools\", \"engine\", \"shipped-config\", \"configurations\", \"generation\", \"commands\", \"main\", \"plugin-config\", \"plugin-types\", \"plugin\", \"docs-config\", \"docs-types\", not {{dependency.source}} from {{#each to.file.categories}}{{#if @last}}{{this}}{{/if}}{{/each}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
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
                                            "import-rule:cli-types",
                                            "import-rule:system",
                                            "import-rule:parsers",
                                            "import-rule:manifests",
                                            "import-rule:repository",
                                            "import-rule:settings",
                                            "import-rule:tools",
                                            "import-rule:engine",
                                            "import-rule:shipped-config",
                                            "import-rule:configurations",
                                            "import-rule:generation",
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
                        "message": "Import rule \"tests-data\" may import its own files and \"system\", \"parsers\", \"manifests\", \"repository\", \"settings\", \"tools\", \"engine\", \"configurations\", \"generation\", \"commands\", \"main\", \"cli-types\", \"tests-setup\", not {{dependency.source}} from {{#each to.file.categories}}{{#if @last}}{{this}}{{/if}}{{/each}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
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
                                            "import-rule:system",
                                            "import-rule:parsers",
                                            "import-rule:manifests",
                                            "import-rule:repository",
                                            "import-rule:settings",
                                            "import-rule:tools",
                                            "import-rule:engine",
                                            "import-rule:configurations",
                                            "import-rule:generation",
                                            "import-rule:commands",
                                            "import-rule:main",
                                            "import-rule:cli-types",
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
                        "message": "Import rule \"tests-types\" may import its own files and \"system\", \"parsers\", \"manifests\", \"repository\", \"settings\", \"tools\", \"engine\", \"configurations\", \"generation\", \"commands\", \"main\", \"cli-types\", \"plugin-types\", \"tests-data\", not {{dependency.source}} from {{#each to.file.categories}}{{#if @last}}{{this}}{{/if}}{{/each}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
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
                                            "import-rule:system",
                                            "import-rule:parsers",
                                            "import-rule:manifests",
                                            "import-rule:repository",
                                            "import-rule:settings",
                                            "import-rule:tools",
                                            "import-rule:engine",
                                            "import-rule:configurations",
                                            "import-rule:generation",
                                            "import-rule:commands",
                                            "import-rule:main",
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
                        "message": "Import rule \"tests-setup\" may import its own files and \"cli-types\", \"system\", \"parsers\", \"manifests\", \"repository\", \"settings\", \"tools\", \"engine\", \"shipped-config\", \"configurations\", \"generation\", \"commands\", \"main\", \"plugin-config\", \"plugin-types\", \"plugin\", \"docs-config\", \"docs-types\", \"docs\", \"tests-data\", \"tests-types\", not {{dependency.source}} from {{#each to.file.categories}}{{#if @last}}{{this}}{{/if}}{{/each}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
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
                                            "import-rule:cli-types",
                                            "import-rule:system",
                                            "import-rule:parsers",
                                            "import-rule:manifests",
                                            "import-rule:repository",
                                            "import-rule:settings",
                                            "import-rule:tools",
                                            "import-rule:engine",
                                            "import-rule:shipped-config",
                                            "import-rule:configurations",
                                            "import-rule:generation",
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
                        "message": "Import rule \"tests\" may import its own files and \"cli-types\", \"system\", \"parsers\", \"manifests\", \"repository\", \"settings\", \"tools\", \"engine\", \"shipped-config\", \"configurations\", \"generation\", \"commands\", \"main\", \"plugin-config\", \"plugin-types\", \"plugin\", \"docs-config\", \"docs-types\", \"docs\", \"tests-data\", \"tests-types\", \"tests-setup\", not {{dependency.source}} from {{#each to.file.categories}}{{#if @last}}{{this}}{{/if}}{{/each}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
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
                                            "import-rule:cli-types",
                                            "import-rule:system",
                                            "import-rule:parsers",
                                            "import-rule:manifests",
                                            "import-rule:repository",
                                            "import-rule:settings",
                                            "import-rule:tools",
                                            "import-rule:engine",
                                            "import-rule:shipped-config",
                                            "import-rule:configurations",
                                            "import-rule:generation",
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
                                "categories": "import-rule:release"
                            }
                        },
                        "disallow": {
                            "to": {
                                "file": {
                                    "path": "**/*"
                                }
                            }
                        },
                        "message": "Import rule \"release\" may import its own files and \"system\", \"parsers\", \"manifests\", \"repository\", \"settings\", \"tools\", \"engine\", \"configurations\", \"generation\", \"commands\", \"main\", \"cli-types\", not {{dependency.source}} from {{#each to.file.categories}}{{#if @last}}{{this}}{{/if}}{{/each}}. Move the code, move that rule above this one, or list the rules it may import in can_import."
                    },
                    {
                        "from": {
                            "file": {
                                "categories": "import-rule:release"
                            }
                        },
                        "allow": {
                            "to": {
                                "file": {
                                    "categories": {
                                        "anyOf": [
                                            "import-rule:release",
                                            "import-rule:system",
                                            "import-rule:parsers",
                                            "import-rule:manifests",
                                            "import-rule:repository",
                                            "import-rule:settings",
                                            "import-rule:tools",
                                            "import-rule:engine",
                                            "import-rule:configurations",
                                            "import-rule:generation",
                                            "import-rule:commands",
                                            "import-rule:main",
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
                                "path": patternList
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
                                    "path": patternList
                                }
                            }
                        }
                    },
                    {
                        "from": {
                            "file": {
                                "categories": {
                                    "noneOf": noneOfList
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
                                        "noneOf": noneOfList
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
    "files": ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*.astro"]}, gspothqEslintPlugin, "all"), [
        "docs/tsconfig.json",
        "packages/cli/tsconfig.json",
        "packages/eslint-plugin/tsconfig.json",
        "tsconfig.json"
    ]),
    ...typescriptBlocks,
    ...astroBlocks,
    ...zodBlocks,
    setRuntime(setLevelRules({"rules": {},
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", buildRuntimeMatcher(0, runtimeDeclarations)], ["**/*.astro", buildRuntimeMatcher(0, runtimeDeclarations)]]}, gspothqEslintPlugin, "all"), globals, "nodeBuiltin", "module"),
    setRuntime(setLevelRules({"rules": {
        "unicorn/prefer-module": "off"
    },
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", buildRuntimeMatcher(1, runtimeDeclarations)], ["**/*.astro", buildRuntimeMatcher(1, runtimeDeclarations)]]}, gspothqEslintPlugin, "all"), globals, "node", "commonjs"),
    setRuntime(setLevelRules({"rules": {},
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", buildRuntimeMatcher(2, runtimeDeclarations)], ["**/*.astro", buildRuntimeMatcher(2, runtimeDeclarations)], ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", buildRuntimeMatcher(3, runtimeDeclarations)], ["**/*.astro", buildRuntimeMatcher(3, runtimeDeclarations)], ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", buildRuntimeMatcher(4, runtimeDeclarations)], ["**/*.astro", buildRuntimeMatcher(4, runtimeDeclarations)], ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", buildRuntimeMatcher(5, runtimeDeclarations)], ["**/*.astro", buildRuntimeMatcher(5, runtimeDeclarations)]]}, gspothqEslintPlugin, "all"), globals, "nodeBuiltin", "module"),
    setLevelRules({"rules": {
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
        "n/hashbang": "error",
        "n/no-extraneous-import": "error",
        "n/no-extraneous-require": "error",
        "n/prefer-global/url-search-params": "error",
        "n/prefer-global/url": "error",
        "n/prefer-global/process": "error",
        "n/prefer-global/console": "error",
        "n/prefer-global/buffer": "error",
        "n/no-process-exit": "error",
        "n/prefer-promises/dns": "error",
        "n/prefer-promises/fs": "error"
    },
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", buildRuntimeMatcher(0, runtimeDeclarations)], ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", buildRuntimeMatcher(1, runtimeDeclarations)], ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", buildRuntimeMatcher(2, runtimeDeclarations)], ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", buildRuntimeMatcher(3, runtimeDeclarations)], ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", buildRuntimeMatcher(4, runtimeDeclarations)], ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", buildRuntimeMatcher(5, runtimeDeclarations)], ["**/*.astro", buildRuntimeMatcher(0, runtimeDeclarations)], ["**/*.astro", buildRuntimeMatcher(1, runtimeDeclarations)], ["**/*.astro", buildRuntimeMatcher(2, runtimeDeclarations)], ["**/*.astro", buildRuntimeMatcher(3, runtimeDeclarations)], ["**/*.astro", buildRuntimeMatcher(4, runtimeDeclarations)], ["**/*.astro", buildRuntimeMatcher(5, runtimeDeclarations)]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "gspot/restricted-syntax": gspotRestrictedSyntaxList
    },
    "ignores": ignoresList,
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*", "**/*"], ["**/*.astro", "**/*", "**/*"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "gspot/restricted-syntax": [
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
                "selector": ":matches(TSAsExpression[expression.type=\"TSAsExpression\"], TSTypeAssertion[expression.type=\"TSTypeAssertion\"])",
                "message": "Do not assert twice. Narrow the value, fix its type, or check it at run time."
            },
            {
                "selector": ":matches(TSAsExpression, TSTypeAssertion) > TSNeverKeyword",
                "message": "Do not assert to never to silence the type system."
            },
            {
                "selector": "Program:has(> :matches(ExportNamedDeclaration:not([exportKind=\"type\"]), ExportDefaultDeclaration, ExportAllDeclaration:not([exportKind=\"type\"]))) > :matches(ForStatement, ForOfStatement, ForInStatement, WhileStatement, DoWhileStatement, IfStatement, TryStatement)",
                "message": "A module that exports values runs no statements when it loads. Move this statement into a function that the entry point calls.",
                "ignores": ignoresList2
            },
            {
                "selector": "NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > :matches(Literal.arguments:first-child[value=/^[a-z]/], TemplateLiteral.arguments:first-child[quasis.0.value.raw=/^[a-z]/])",
                "message": "Start an error message with a capital letter."
            },
            {
                "selector": "LabeledStatement:not([body.type=/^(?:WhileStatement|DoWhileStatement|ForStatement|ForInStatement|ForOfStatement|SwitchStatement)$/])",
                "message": "Use a label only on a loop or switch statement. Remove this label."
            },
            {
                "selector": "ForStatement[init=null][update=null][test!=null]",
                "message": "This loop has no initializer or update. Use a while loop for its condition."
            },
            {
                "selector": "UnaryExpression[operator='delete']:not([argument.type='MemberExpression']):not([argument.type='ChainExpression']):not([argument.type='Identifier'])",
                "message": "The delete operator removes properties. Pass a property access instead of this expression."
            },
            {
                "selector": "AssignmentExpression:not(ExpressionStatement > AssignmentExpression):not(AssignmentExpression > AssignmentExpression):not(BinaryExpression[operator=/^(?:==|!=|===|!==|<|<=|>|>=)$/] > AssignmentExpression):not(SequenceExpression > AssignmentExpression):not(VariableDeclarator > AssignmentExpression):not(ArrowFunctionExpression > AssignmentExpression.body):not(LogicalExpression > AssignmentExpression.right):not(WhileStatement > AssignmentExpression.test):not(DoWhileStatement > AssignmentExpression.test):not(ForStatement > AssignmentExpression.init):not(ForStatement > AssignmentExpression.update)",
                "message": "Move this assignment into a separate statement before using its value."
            },
            {
                "selector": "CallExpression[callee.type=/^(?:ArrayExpression|ClassExpression|ObjectExpression|Literal|TemplateLiteral)$/]",
                "message": "Call a function or method instead of a literal value."
            },
            {
                "selector": "TaggedTemplateExpression[tag.type=/^(?:ArrayExpression|ClassExpression|ObjectExpression|Literal|TemplateLiteral)$/]",
                "message": "Use a function as the template tag instead of a literal value."
            },
            {
                "selector": "ImportDeclaration[source.value=/node_modules/]",
                "message": "Use the package's public name instead of a node_modules path."
            },
            {
                "selector": "CallExpression[callee.type='Identifier'][callee.name='require'][arguments.length=1][arguments.0.type='Literal'][arguments.0.value=type(string)][arguments.0.value=/node_modules/]",
                "message": "Use the package's public name instead of a node_modules path."
            },
            {
                "selector": ":matches(WhileStatement, DoWhileStatement, ForStatement, ForInStatement, ForOfStatement) > BlockStatement[body.length>1] > ContinueStatement[label=null]:last-child",
                "message": "This continue ends the loop body, so it does nothing. Remove it."
            },
            {
                "selector": ":matches(WhileStatement, DoWhileStatement, ForStatement, ForInStatement, ForOfStatement) > BlockStatement > IfStatement:last-child > BlockStatement[body.length>1] > ContinueStatement[label=null]:last-child",
                "message": "This continue ends the loop body, so it does nothing. Remove it."
            },
            {
                "selector": "Literal[regex.flags=/s/][regex.pattern=/\\[(?:\\\\s\\\\S|\\\\S\\\\s)\\]/]",
                "message": "The s flag makes . match every character. Write . instead of this character class."
            },
            {
                "selector": "LogicalExpression[operator=/^(\\|\\||\\?\\?)$/][right.type=\"ObjectExpression\"][right.properties.length=0]",
                "message": "An empty-object fallback hides a missing value. Handle the missing case."
            },
            {
                "selector": "CallExpression:matches([callee.property.name=/^(debug|info|warn|error|fatal|trace)$/], [callee.property.name=\"log\"][callee.object.name!=\"console\"]) > TemplateLiteral.arguments:first-child[expressions.length>0]",
                "message": "Log a stable message and pass the values as fields."
            },
            {
                "selector": "CallExpression[callee.property.name='waitForLoadState'] > Literal:first-child[value='networkidle']",
                "message": "Network inactivity does not prove that the page is ready. Wait for the visible state, response, or URL."
            },
            {
                "selector": "Program:has(ImportDeclaration[source.value='@playwright/test']) CallExpression[callee.name='expect'] > AwaitExpression:first-child",
                "message": "Pass the locator to expect, so that the assertion retries, such as await expect(locator).toHaveText(text)."
            },
            {
                "selector": "AssignmentExpression[left.property.name=/^(?:innerHTML|outerHTML)$/]:not([right.type=\"Literal\"])",
                "message": "Writing HTML into the page allows XSS. Set textContent, create the nodes, or write fixed markup."
            },
            {
                "selector": "CallExpression:matches([callee.property.name=\"insertAdjacentHTML\"][arguments.1.type!=\"Literal\"], [callee.object.name=\"document\"][callee.property.name=\"write\"][arguments.0.type!=\"Literal\"])",
                "message": "Writing HTML into the page allows XSS. Set textContent, create the nodes, or write fixed markup."
            },
            {
                "selector": "CallExpression[callee.name=\"fetch\"]:matches([arguments.0.object.object.name=\"req\"], [arguments.0.callee.object.property.name=\"searchParams\"][arguments.0.callee.property.name=\"get\"])",
                "message": "fetch() takes its URL from the request, which allows server-side request forgery. Allow only known hosts."
            },
            {
                "selector": "CallExpression[callee.property.name=/^(?:log|trace|debug|info|warn|error|fatal)$/][arguments.length=1]:matches([arguments.0.object.object.name=\"process\"][arguments.0.object.property.name=\"env\"][arguments.0.property.name=/KEY|SECRET|PASSWORD|TOKEN|CREDENTIAL/], [arguments.0.callee.object.object.name=\"Deno\"][arguments.0.callee.object.property.name=\"env\"][arguments.0.callee.property.name=\"get\"][arguments.0.arguments.0.value=/KEY|SECRET|PASSWORD|TOKEN|CREDENTIAL/])",
                "message": "The log writes a secret from the environment. Remove the value, or mask it."
            },
            {
                "selector": "CallExpression[callee.name=/^(?:execSync|exec)$/] > TemplateLiteral.arguments:first-child[expressions.length>0]",
                "message": "Interpolation in execSync() or exec() allows command injection. Use execFileSync() or execFile() with an argument array."
            },
            {
                "selector": ":matches(Property[key.value=\"Access-Control-Allow-Origin\"][value.value=\"*\"], CallExpression[callee.property.name=/^(?:set|append)$/][arguments.0.value=\"Access-Control-Allow-Origin\"][arguments.1.value=\"*\"])",
                "message": "A wildcard CORS origin lets every site read the response. List the allowed origins."
            },
            {
                "selector": "MemberExpression[object.type=\"MetaProperty\"][object.meta.name=\"import\"][object.property.name=\"meta\"][property.name=\"env\"]",
                "message": "Read environment variables only in the files that structure.environment_readers lists, and pass the value in.",
                "ignores": ignoresList3
            },
            {
                "selector": ":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#[^/]+\\/|@\\/)/][source.value!=/\\.[^/?.]+$/]:not([source.value=/\\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))",
                "message": "Give an alias import its file extension."
            }
        ]
    },
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "docs/**/*", "**/*"], ["**/*.astro", "docs/**/*", "**/*"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "gspot/restricted-syntax": gspotRestrictedSyntaxList
    },
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/cli/**/*", "**/*"], ["**/*.astro", "packages/cli/**/*", "**/*"], ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/eslint-plugin/**/*", "**/*"], ["**/*.astro", "packages/eslint-plugin/**/*", "**/*"], ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "tests/**/*", "**/*"], ["**/*.astro", "tests/**/*", "**/*"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "no-console": "error"
    },
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
        "**/Tests/**",
        "scripts/**",
        "**/*.config.{js,mjs,cjs,ts}",
        "{mise-tasks,.mise-tasks,mise/tasks,.mise/tasks,.config/mise/tasks}/**"
    ],
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*", "**/*"], ["**/*.astro", "**/*", "**/*"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "no-console": "error"
    },
    "ignores": [
        "docs/**/test/**",
        "docs/**/tests/**",
        "docs/**/__tests__/**",
        "docs/**/*.test.*",
        "docs/**/*.spec.*",
        "docs/**/Tests/**",
        "docs/scripts/**",
        "docs/**/*.config.{js,mjs,cjs,ts}",
        "docs/{mise-tasks,.mise-tasks,mise/tasks,.mise/tasks,.config/mise/tasks}/**"
    ],
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "docs/**/*", "**/*"], ["**/*.astro", "docs/**/*", "**/*"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "no-console": "error"
    },
    "ignores": [
        "packages/cli/**/test/**",
        "packages/cli/**/tests/**",
        "packages/cli/**/__tests__/**",
        "packages/cli/**/*.test.*",
        "packages/cli/**/*.spec.*",
        "packages/cli/**/Tests/**",
        "packages/cli/scripts/**",
        "packages/cli/**/*.config.{js,mjs,cjs,ts}",
        "packages/cli/{mise-tasks,.mise-tasks,mise/tasks,.mise/tasks,.config/mise/tasks}/**"
    ],
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/cli/**/*", "**/*"], ["**/*.astro", "packages/cli/**/*", "**/*"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "no-console": "error"
    },
    "ignores": [
        "packages/eslint-plugin/**/test/**",
        "packages/eslint-plugin/**/tests/**",
        "packages/eslint-plugin/**/__tests__/**",
        "packages/eslint-plugin/**/*.test.*",
        "packages/eslint-plugin/**/*.spec.*",
        "packages/eslint-plugin/**/Tests/**",
        "packages/eslint-plugin/scripts/**",
        "packages/eslint-plugin/**/*.config.{js,mjs,cjs,ts}",
        "packages/eslint-plugin/{mise-tasks,.mise-tasks,mise/tasks,.mise/tasks,.config/mise/tasks}/**"
    ],
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/eslint-plugin/**/*", "**/*"], ["**/*.astro", "packages/eslint-plugin/**/*", "**/*"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "no-console": "error"
    },
    "ignores": [
        "tests/**/test/**",
        "tests/**/tests/**",
        "tests/**/__tests__/**",
        "tests/**/*.test.*",
        "tests/**/*.spec.*",
        "tests/**/Tests/**",
        "tests/scripts/**",
        "tests/**/*.config.{js,mjs,cjs,ts}",
        "tests/{mise-tasks,.mise-tasks,mise/tasks,.mise/tasks,.config/mise/tasks}/**"
    ],
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "tests/**/*", "**/*"], ["**/*.astro", "tests/**/*", "**/*"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "n/no-process-exit": "off",
        "unicorn/no-process-exit": "off"
    },
    "files": [["scripts/**", "**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["scripts/**", "**/*", "**/*.astro"], ["**/*.config.{js,mjs,cjs,ts}", "**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["**/*.config.{js,mjs,cjs,ts}", "**/*", "**/*.astro"], ["{mise-tasks,.mise-tasks,mise/tasks,.mise/tasks,.config/mise/tasks}/**", "**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["{mise-tasks,.mise-tasks,mise/tasks,.mise/tasks,.config/mise/tasks}/**", "**/*", "**/*.astro"], ["docs/scripts/**", "docs/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["docs/scripts/**", "docs/**/*", "**/*.astro"], ["docs/**/*.config.{js,mjs,cjs,ts}", "docs/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["docs/**/*.config.{js,mjs,cjs,ts}", "docs/**/*", "**/*.astro"], ["docs/{mise-tasks,.mise-tasks,mise/tasks,.mise/tasks,.config/mise/tasks}/**", "docs/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["docs/{mise-tasks,.mise-tasks,mise/tasks,.mise/tasks,.config/mise/tasks}/**", "docs/**/*", "**/*.astro"], ["packages/cli/scripts/**", "packages/cli/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["packages/cli/scripts/**", "packages/cli/**/*", "**/*.astro"], ["packages/cli/**/*.config.{js,mjs,cjs,ts}", "packages/cli/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["packages/cli/**/*.config.{js,mjs,cjs,ts}", "packages/cli/**/*", "**/*.astro"], ["packages/cli/{mise-tasks,.mise-tasks,mise/tasks,.mise/tasks,.config/mise/tasks}/**", "packages/cli/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["packages/cli/{mise-tasks,.mise-tasks,mise/tasks,.mise/tasks,.config/mise/tasks}/**", "packages/cli/**/*", "**/*.astro"], ["packages/eslint-plugin/scripts/**", "packages/eslint-plugin/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["packages/eslint-plugin/scripts/**", "packages/eslint-plugin/**/*", "**/*.astro"], ["packages/eslint-plugin/**/*.config.{js,mjs,cjs,ts}", "packages/eslint-plugin/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["packages/eslint-plugin/**/*.config.{js,mjs,cjs,ts}", "packages/eslint-plugin/**/*", "**/*.astro"], ["packages/eslint-plugin/{mise-tasks,.mise-tasks,mise/tasks,.mise/tasks,.config/mise/tasks}/**", "packages/eslint-plugin/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["packages/eslint-plugin/{mise-tasks,.mise-tasks,mise/tasks,.mise/tasks,.config/mise/tasks}/**", "packages/eslint-plugin/**/*", "**/*.astro"], ["tests/scripts/**", "tests/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["tests/scripts/**", "tests/**/*", "**/*.astro"], ["tests/**/*.config.{js,mjs,cjs,ts}", "tests/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["tests/**/*.config.{js,mjs,cjs,ts}", "tests/**/*", "**/*.astro"], ["tests/{mise-tasks,.mise-tasks,mise/tasks,.mise/tasks,.config/mise/tasks}/**", "tests/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["tests/{mise-tasks,.mise-tasks,mise/tasks,.mise/tasks,.config/mise/tasks}/**", "tests/**/*", "**/*.astro"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "jsdoc/require-jsdoc": "off",
        "jsdoc/require-description": "off",
        "n/no-unpublished-import": "off",
        "n/no-unpublished-require": "off",
        "no-template-curly-in-string": "off",
        "unicorn/no-incorrect-template-string-interpolation": "off"
    },
    "files": [["**/test/**", "**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["**/test/**", "**/*", "**/*.astro"], ["**/tests/**", "**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["**/tests/**", "**/*", "**/*.astro"], ["**/__tests__/**", "**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["**/__tests__/**", "**/*", "**/*.astro"], ["**/*.test.*", "**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["**/*.test.*", "**/*", "**/*.astro"], ["**/*.spec.*", "**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["**/*.spec.*", "**/*", "**/*.astro"], ["**/Tests/**", "**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["**/Tests/**", "**/*", "**/*.astro"], ["docs/**/test/**", "docs/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["docs/**/test/**", "docs/**/*", "**/*.astro"], ["docs/**/tests/**", "docs/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["docs/**/tests/**", "docs/**/*", "**/*.astro"], ["docs/**/__tests__/**", "docs/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["docs/**/__tests__/**", "docs/**/*", "**/*.astro"], ["docs/**/*.test.*", "docs/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["docs/**/*.test.*", "docs/**/*", "**/*.astro"], ["docs/**/*.spec.*", "docs/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["docs/**/*.spec.*", "docs/**/*", "**/*.astro"], ["docs/**/Tests/**", "docs/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["docs/**/Tests/**", "docs/**/*", "**/*.astro"], ["packages/cli/**/test/**", "packages/cli/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["packages/cli/**/test/**", "packages/cli/**/*", "**/*.astro"], ["packages/cli/**/tests/**", "packages/cli/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["packages/cli/**/tests/**", "packages/cli/**/*", "**/*.astro"], ["packages/cli/**/__tests__/**", "packages/cli/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["packages/cli/**/__tests__/**", "packages/cli/**/*", "**/*.astro"], ["packages/cli/**/*.test.*", "packages/cli/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["packages/cli/**/*.test.*", "packages/cli/**/*", "**/*.astro"], ["packages/cli/**/*.spec.*", "packages/cli/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["packages/cli/**/*.spec.*", "packages/cli/**/*", "**/*.astro"], ["packages/cli/**/Tests/**", "packages/cli/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["packages/cli/**/Tests/**", "packages/cli/**/*", "**/*.astro"], ["packages/eslint-plugin/**/test/**", "packages/eslint-plugin/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["packages/eslint-plugin/**/test/**", "packages/eslint-plugin/**/*", "**/*.astro"], ["packages/eslint-plugin/**/tests/**", "packages/eslint-plugin/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["packages/eslint-plugin/**/tests/**", "packages/eslint-plugin/**/*", "**/*.astro"], ["packages/eslint-plugin/**/__tests__/**", "packages/eslint-plugin/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["packages/eslint-plugin/**/__tests__/**", "packages/eslint-plugin/**/*", "**/*.astro"], ["packages/eslint-plugin/**/*.test.*", "packages/eslint-plugin/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["packages/eslint-plugin/**/*.test.*", "packages/eslint-plugin/**/*", "**/*.astro"], ["packages/eslint-plugin/**/*.spec.*", "packages/eslint-plugin/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["packages/eslint-plugin/**/*.spec.*", "packages/eslint-plugin/**/*", "**/*.astro"], ["packages/eslint-plugin/**/Tests/**", "packages/eslint-plugin/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["packages/eslint-plugin/**/Tests/**", "packages/eslint-plugin/**/*", "**/*.astro"], ["tests/**/test/**", "tests/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["tests/**/test/**", "tests/**/*", "**/*.astro"], ["tests/**/tests/**", "tests/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["tests/**/tests/**", "tests/**/*", "**/*.astro"], ["tests/**/__tests__/**", "tests/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["tests/**/__tests__/**", "tests/**/*", "**/*.astro"], ["tests/**/*.test.*", "tests/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["tests/**/*.test.*", "tests/**/*", "**/*.astro"], ["tests/**/*.spec.*", "tests/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["tests/**/*.spec.*", "tests/**/*", "**/*.astro"], ["tests/**/Tests/**", "tests/**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["tests/**/Tests/**", "tests/**/*", "**/*.astro"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"extends": [eslintPluginPackageJson["configs"]["recommended"]],
    "files": ["**/package.json"]}, gspothqEslintPlugin, "all"),
    setLevelRules({"extends": [eslintConfigPrettier],
    "files": ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*.astro"]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "package-json/restrict-dependency-ranges": [
            "error",
            {
                "forDependencyTypes": [
                    "devDependencies"
                ],
                "rangeType": "pin"
            }
        ],
        "package-json/scripts-name-casing": "error"
    },
    "files": ["**/package.json"]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "package-json/restrict-dependency-ranges": [
            "error",
            {
                "rangeType": "pin"
            }
        ]
    },
    "files": ["docs/package.json", "package.json", "tests/package.json"]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "package-json/require-packageManager": "error"
    },
    "files": ["package.json"]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "max-lines": maxLinesList,
        "max-lines-per-function": maxLinesPerFunctionList,
        "max-params": maxParamsList,
        "max-depth": maxDepthList,
        "max-statements": maxStatementsList,
        "max-nested-callbacks": maxDepthList,
        "complexity": complexityList
    },
    "files": ["**/*.{js,mjs,cjs,jsx}"]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
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
    "ignores": [
        "packages/cli/src/system/environment.ts",
        "packages/cli/src/system/environment.ts/**",
        "tests/setup/system/environment.ts",
        "tests/setup/system/environment.ts/**"
    ],
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,vue,svelte,astro}"], ["**/*.astro", "**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,vue,svelte,astro}"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "gspot/no-trivial-files": [
            "error",
            {
                "reexports": "none",
                "indexExports": 20
            }
        ],
        "gspot/no-trivial-functions": gspotNoTrivialFunctionsList
    },
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*", "**/*.{js,mjs,cjs,jsx}"], ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*", "**/*.{ts,mts,cts,tsx,vue,svelte,astro}"], ["**/*.astro", "**/*", "**/*.{js,mjs,cjs,jsx}"], ["**/*.astro", "**/*", "**/*.{ts,mts,cts,tsx,vue,svelte,astro}"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "gspot/no-trivial-files": [
            "error",
            {
                "reexports": "none",
                "indexExports": 20,
                "forwardingFiles": [
                    "**/*.astro",
                    "**/*.astro/*.ts",
                    "**/*.astro/*.js"
                ]
            }
        ],
        "gspot/no-trivial-functions": gspotNoTrivialFunctionsList
    },
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "docs/**/*", "**/*.{js,mjs,cjs,jsx}"], ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "docs/**/*", "**/*.{ts,mts,cts,tsx,vue,svelte,astro}"], ["**/*.astro", "docs/**/*", "**/*.{js,mjs,cjs,jsx}"], ["**/*.astro", "docs/**/*", "**/*.{ts,mts,cts,tsx,vue,svelte,astro}"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "import-x/no-default-export": "off",
        "unicorn/no-top-level-side-effects": "off"
    },
    "ignores": ignoresList,
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*", "**/*.config.*"], ["**/*.astro", "**/*", "**/*.config.*"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "@typescript-eslint/consistent-type-definitions": "off"
    },
    "ignores": ignoresList,
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*", "**/*.d.ts"], ["**/*.astro", "**/*", "**/*.d.ts"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "import-x/no-default-export": "off"
    },
    "ignores": ignoresList,
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*", "**/*.d.ts"], ["**/*.astro", "**/*", "**/*.d.ts"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "gspot/no-client-environment": [
            "error",
            {
                "client": true,
                "publicPrefixes": [
                    "PUBLIC_"
                ],
                "allowedNames": [
                    "NODE_ENV",
                    "SITE",
                    "ASSETS_PREFIX"
                ]
            }
        ]
    },
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "docs/**/*", "docs/**/*.astro/*.{js,ts}"], ["**/*.astro", "docs/**/*", "docs/**/*.astro/*.{js,ts}"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "import-x/no-default-export": "off",
        "unicorn/no-top-level-side-effects": "off"
    },
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "docs/**/*", "**/*.config.*"], ["**/*.astro", "docs/**/*", "**/*.config.*"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "@typescript-eslint/consistent-type-definitions": "off"
    },
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "docs/**/*", "**/*.d.ts"], ["**/*.astro", "docs/**/*", "**/*.d.ts"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "import-x/no-default-export": "off"
    },
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "docs/**/*", "**/*.d.ts"], ["**/*.astro", "docs/**/*", "**/*.d.ts"], ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "docs/**/*", "**/*.astro"], ["**/*.astro", "docs/**/*", "**/*.astro"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "import-x/no-default-export": "off",
        "unicorn/no-top-level-side-effects": "off"
    },
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/cli/**/*", "**/*.config.*"], ["**/*.astro", "packages/cli/**/*", "**/*.config.*"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "@typescript-eslint/consistent-type-definitions": "off"
    },
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/cli/**/*", "**/*.d.ts"], ["**/*.astro", "packages/cli/**/*", "**/*.d.ts"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "import-x/no-default-export": "off"
    },
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/cli/**/*", "**/*.d.ts"], ["**/*.astro", "packages/cli/**/*", "**/*.d.ts"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "import-x/no-default-export": "off",
        "unicorn/no-top-level-side-effects": "off"
    },
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/eslint-plugin/**/*", "**/*.config.*"], ["**/*.astro", "packages/eslint-plugin/**/*", "**/*.config.*"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "@typescript-eslint/consistent-type-definitions": "off"
    },
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/eslint-plugin/**/*", "**/*.d.ts"], ["**/*.astro", "packages/eslint-plugin/**/*", "**/*.d.ts"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "import-x/no-default-export": "off"
    },
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/eslint-plugin/**/*", "**/*.d.ts"], ["**/*.astro", "packages/eslint-plugin/**/*", "**/*.d.ts"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "import-x/no-default-export": "off",
        "unicorn/no-top-level-side-effects": "off"
    },
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "tests/**/*", "**/*.config.*"], ["**/*.astro", "tests/**/*", "**/*.config.*"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "@typescript-eslint/consistent-type-definitions": "off"
    },
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "tests/**/*", "**/*.d.ts"], ["**/*.astro", "tests/**/*", "**/*.d.ts"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "import-x/no-default-export": "off"
    },
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "tests/**/*", "**/*.d.ts"], ["**/*.astro", "tests/**/*", "**/*.d.ts"], ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*", "packages/eslint-plugin/src/plugin.ts"], ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*", "packages/eslint-plugin/src/plugin.ts/**"], ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*", "packages/cli/src/configurations/language/markdown/files/markdownlint-cli2.ts"], ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*", "packages/cli/src/configurations/language/markdown/files/markdownlint-cli2.ts/**"], ["**/*.astro", "**/*", "packages/eslint-plugin/src/plugin.ts"], ["**/*.astro", "**/*", "packages/eslint-plugin/src/plugin.ts/**"], ["**/*.astro", "**/*", "packages/cli/src/configurations/language/markdown/files/markdownlint-cli2.ts"], ["**/*.astro", "**/*", "packages/cli/src/configurations/language/markdown/files/markdownlint-cli2.ts/**"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "unicorn/prefer-ternary": "off"
    },
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*", "**/*"], ["**/*.astro", "**/*", "**/*"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "unicorn/prefer-await": "off"
    },
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*", "**/*"], ["**/*.astro", "**/*", "**/*"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "no-template-curly-in-string": "off"
    },
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*", "tests/**"], ["**/*.astro", "**/*", "tests/**"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "unicorn/no-incorrect-template-string-interpolation": "off"
    },
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*", "tests/**"], ["**/*.astro", "**/*", "tests/**"]]}, gspothqEslintPlugin, "all"),
    setLevelRules({"rules": {
        "unicorn/no-top-level-side-effects": "off"
    },
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*", "**/*.config.*"], ["**/*.astro", "**/*", "**/*.config.*"]]}, gspothqEslintPlugin, "all"),
]), [
    {
        "paths": [
            [
                "**/*",
                "**/*"
            ]
        ],
        "ignores": [],
        "rules": {
            "no-restricted-properties": [
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
            ],
            "unicorn/consistent-boolean-name": [
                {
                    "checkFunctions": "never",
                    "ignore": [
                        "^_",
                        "^(?:enabled|active|retryable)$"
                    ]
                }
            ],
            "jsdoc/require-jsdoc": [
                {
                    "enableFixer": false,
                    "publicOnly": true,
                    "require": {
                        "FunctionDeclaration": true,
                        "MethodDefinition": true
                    },
                    "contexts": [
                        ":matches(VariableDeclarator, AssignmentExpression, ExportDefaultDeclaration, PropertyDefinition) > :matches(ArrowFunctionExpression, FunctionExpression)"
                    ]
                }
            ]
        }
    }
]);
