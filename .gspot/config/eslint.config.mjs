import { join, relative, sep } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import eslint from "@eslint/js";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import packageJson from "eslint-plugin-package-json";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";
import picomatch from "picomatch";
import gspot from "@gspothq/eslint-plugin";
import importX from "eslint-plugin-import-x";
import jsdoc from "eslint-plugin-jsdoc";
import nodePlugin from "eslint-plugin-n";
import regexp from "eslint-plugin-regexp";
import security from "eslint-plugin-security";
import perfectionist from "eslint-plugin-perfectionist";
import boundaries from "eslint-plugin-boundaries";
import tseslint from 'typescript-eslint';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import astroPlugin from 'eslint-plugin-astro';
import zodPlugin from 'eslint-plugin-zod';

// The root has no closing separator because TypeScript's project service resolves from its containing folder.
const root = fileURLToPath(new URL('../..', import.meta.url)).replace(/[\\/]$/u, '');
const RUNTIME_GLOBAL_NAMES = new Set(Object.keys({ ...globals.node, ...globals.browser, ...globals.worker, ...globals.serviceworker, ...globals['react-native'] }));
// Keep compiler and test globals from framework presets; runtime APIs have their own file selectors.
function stripRuntimeGlobals(block) {
    const names = block.languageOptions?.globals;
    if (names === undefined) return block;
    return { ...block, languageOptions: { ...block.languageOptions, globals: Object.fromEntries(Object.entries(names).filter(([name]) => !RUNTIME_GLOBAL_NAMES.has(name))) } };
}
const runtimeDeclarations = [{"scope":"","runtime":"node","includes":["**/*"],"excludes":["docs/**","packages/cli/**","packages/eslint-plugin/**","tests/**"]},{"scope":"","runtime":"commonjs","includes":["**/*.{cjs,cts}"],"excludes":["docs/**","packages/cli/**","packages/eslint-plugin/**","tests/**"]},{"scope":"docs","runtime":"node","includes":["docs/**/*"],"excludes":[]},{"scope":"docs","runtime":"commonjs","includes":["docs/**/*.{cjs,cts}"],"excludes":[]},{"scope":"tests","runtime":"node","includes":["tests/**/*"],"excludes":[]},{"scope":"tests","runtime":"commonjs","includes":["tests/**/*.{cjs,cts}"],"excludes":[]},{"scope":"packages/cli","runtime":"node","includes":["packages/cli/**/*"],"excludes":[]},{"scope":"packages/cli","runtime":"commonjs","includes":["packages/cli/**/*.{cjs,cts}"],"excludes":[]},{"scope":"packages/eslint-plugin","runtime":"node","includes":["packages/eslint-plugin/**/*"],"excludes":[]},{"scope":"packages/eslint-plugin","runtime":"commonjs","includes":["packages/eslint-plugin/**/*.{cjs,cts}"],"excludes":[]}];
const runtimeMatchers = runtimeDeclarations.map(({ scope, includes, excludes }) => {
    const included = includes.map((glob) => picomatch(glob, { dot: true, flags: 's' }));
    const excluded = excludes.map((glob) => picomatch(glob, { dot: true, flags: 's' }));
    return (path) => {
        if (scope !== '' && !path.startsWith(`${scope}/`)) return false;
        return included.some((pattern) => pattern(path)) && !excluded.some((pattern) => pattern(path));
    };
});
function runtimeMatches(index) {
    const matches = (file) => runtimeMatchers.findLastIndex((matcher) => matcher(relative(root, file).split(sep).join('/'))) === index;
    return matches;
}
// Component parsers keep script language attributes. The last parser checks syntax errors.
function componentMatches(parser, framework, typescriptParser) {
    return (file) => {
        try {
            const parsed = parser.parseForESLint(readFileSync(file, 'utf8'), { filePath: file, tsconfigRootDir: root, ecmaVersion: 'latest', sourceType: 'module', parser: framework === 'vue' ? false : { ts: typescriptParser, typescript: typescriptParser } });
            const scripts = framework === 'vue' ? parsed.services.getDocumentFragment().children.filter((node) => node.type === 'VElement' && node.name === 'script') : parsed.ast.body.filter((node) => node.type === 'SvelteScriptElement');
            return scripts.some((script) => script.startTag.attributes.some((attribute) => attribute.key?.name === 'lang' && ['ts', 'typescript'].includes(framework === 'vue' ? attribute.value?.value : attribute.value[0]?.value)));
        } catch (error) {
            if (error instanceof SyntaxError || (error instanceof Error && error.name === 'TSError')) return false;
            throw error;
        }
    };
}
export default [
    { ignores: [
    ".gspot/**",
    "**/node_modules/**",
    "**/bower_components/**",
    "docs/worker-configuration.d.ts",
    "tests/worker-configuration.d.ts"
] },

    {...eslint["configs"]["recommended"], rules: { ...eslint["configs"]["recommended"].rules }, files: ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*.astro"]},

    {...sonarjs["configs"]["recommended"], rules: { ...sonarjs["configs"]["recommended"].rules }, files: ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*.astro"]},

    {...unicorn["configs"]["recommended"], rules: { ...unicorn["configs"]["recommended"].rules }, files: ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*.astro"]},

    {plugins: { "gspot": gspot, "import-x": importX, "jsdoc": jsdoc, "n": nodePlugin, "regexp": regexp, "security": security, "perfectionist": perfectionist, "boundaries": boundaries }, linterOptions: { reportUnusedDisableDirectives: 'error' }, languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.es2024 }, settings: { gspot: { root }, 'boundaries/root-path': root }, "rules": {"no-empty-character-class":"off","no-useless-constructor":"error","no-useless-return":"error","no-useless-call":"error","no-useless-rename":"error","no-duplicate-imports":"off","eqeqeq":["error","always"],"prefer-const":"error","no-empty":["error",{"allowEmptyCatch":false}],"perfectionist/sort-imports":["error",{"type":"line-length","order":"asc","ignoreCase":false,"groups":["singleline-import","multiline-import"],"fallbackSort":{"type":"alphabetical","order":"asc"},"newlinesBetween":1,"newlinesInside":0,"sortSideEffects":false,"useExperimentalDependencyDetection":false}],"perfectionist/sort-named-imports":["error",{"type":"line-length","ignoreCase":false}],"perfectionist/sort-exports":["error",{"type":"line-length","groups":["singleline-export","multiline-export"],"newlinesBetween":1,"ignoreCase":false}],"perfectionist/sort-named-exports":["error",{"type":"line-length","ignoreCase":false}],"sonarjs/assertions-in-tests":"off","sonarjs/async-test-assertions":"off","sonarjs/slow-regex":"off","sonarjs/no-unused-vars":"off","sonarjs/unused-import":"off","sonarjs/no-empty-character-class":"off","sonarjs/no-control-regex":"off","sonarjs/no-useless-catch":"off","sonarjs/no-parameter-reassignment":"off","sonarjs/for-loop-increment-sign":"off","sonarjs/no-hardcoded-passwords":"off","sonarjs/no-hardcoded-secrets":"off","sonarjs/no-empty-test-file":"off","sonarjs/no-collapsible-if":"error","unicorn/no-lonely-if":"off","unicorn/prevent-abbreviations":"off","unicorn/filename-case":"off","unicorn/no-null":"off","unicorn/no-useless-undefined":"off","unicorn/import-style":"off","unicorn/prefer-export-from":"off","security/detect-disable-mustache-escape":"error","security/detect-eval-with-expression":"off","security/detect-new-buffer":"off","security/detect-non-literal-regexp":"off","security/detect-non-literal-require":"error","security/detect-pseudoRandomBytes":"error","security/detect-unsafe-regex":"off","security/detect-object-injection":"off","security/detect-non-literal-fs-filename":"off","jsdoc/require-param-name":"error","jsdoc/check-param-names":"error","jsdoc/check-tag-names":"error","jsdoc/no-types":"off","regexp/no-super-linear-backtracking":"error","regexp/no-empty-alternative":"error","regexp/no-empty-capturing-group":"error","regexp/no-empty-character-class":"error","regexp/no-empty-group":"error","regexp/no-empty-lookarounds-assertion":"error","regexp/no-useless-assertions":"error","regexp/no-useless-backreference":"error","regexp/no-useless-character-class":"error","regexp/no-useless-dollar-replacements":"error","regexp/no-useless-lazy":"error","regexp/no-useless-quantifier":"error","regexp/no-useless-range":"error","regexp/no-lazy-ends":"error","regexp/no-optional-assertion":"error","regexp/no-invalid-regexp":"error","regexp/no-misleading-capturing-group":"error","regexp/no-contradiction-with-assertion":"error","regexp/strict":"error","import-x/export":"error","import-x/no-cycle":["error",{"ignoreExternal":false}],"import-x/no-self-import":"error","import-x/no-useless-path-segments":"error","import-x/no-empty-named-blocks":"error","import-x/no-duplicates":"error","no-param-reassign":"error","sonarjs/no-nested-switch":"error","sonarjs/prefer-object-literal":"error","sonarjs/no-commented-code":"error","sonarjs/prefer-immediate-return":"error","unicorn/prefer-ternary":["error","only-single-line"],"unicorn/expiring-todo-comments":["error",{"allowWarningComments":false}],"security/detect-child-process":"error","security/detect-possible-timing-attacks":"error","jsdoc/require-jsdoc":["error",{"publicOnly":true,"require":{"FunctionDeclaration":true,"ArrowFunctionExpression":true,"FunctionExpression":true,"MethodDefinition":true}}],"jsdoc/require-description":"error","jsdoc/require-param":"error","jsdoc/require-param-description":"error","jsdoc/require-returns":"error","jsdoc/require-returns-description":"error","no-restricted-syntax":["error",{"selector":"TSEnumDeclaration","message":"Use a literal union or an as-const object instead of an enum."},{"selector":"TSAsExpression[expression.type=\"TSAsExpression\"]","message":"Do not assert twice. Narrow the value, improve the type, or add a typed boundary."},{"selector":"TSTypeAssertion[expression.type=\"TSTypeAssertion\"]","message":"Do not assert twice. Narrow the value, improve the type, or add a typed boundary."},{"selector":"TSAsExpression > TSAnyKeyword","message":"Do not assert to any. Add a typed boundary or runtime narrowing instead."},{"selector":"TSTypeAssertion > TSAnyKeyword","message":"Do not assert to any. Add a typed boundary or runtime narrowing instead."},{"selector":"TSAsExpression > TSNeverKeyword","message":"Do not assert to never to silence the type system."},{"selector":"TSTypeAssertion > TSNeverKeyword","message":"Do not assert to never to silence the type system."},{"selector":"LogicalExpression[operator=\"||\"][right.type=\"ObjectExpression\"][right.properties.length=0]","message":"An empty-object fallback hides a missing value. Handle the missing case."},{"selector":"LogicalExpression[operator=\"??\"][right.type=\"ObjectExpression\"][right.properties.length=0]","message":"An empty-object fallback hides a missing value. Handle the missing case."},{"selector":"NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > Literal.arguments:first-child[value=/^[a-z]/]","message":"Start an error message with a capital letter."},{"selector":"NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > TemplateLiteral.arguments:first-child[quasis.0.value.raw=/^[a-z]/]","message":"Start an error message with a capital letter."},{"selector":"CallExpression[callee.property.name=/^(debug|info|warn|error|fatal|trace)$/] > TemplateLiteral.arguments:first-child[expressions.length>0]","message":"Log a stable message and pass the values as fields."}],"max-lines":["error",{"max":300,"skipBlankLines":true,"skipComments":true}],"max-lines-per-function":["error",{"max":60,"skipBlankLines":true,"skipComments":true,"IIFEs":true}],"max-params":["error",{"max":7,"countVoidThis":false}],"max-depth":["error",3],"max-statements":["error",30],"max-nested-callbacks":["error",3],"complexity":["error",8],"sonarjs/cognitive-complexity":["error",8],"sonarjs/no-identical-functions":["error",8],"gspot/header-first":"error","gspot/no-client-env":"error","gspot/import-boundaries":["error",{"folders":["*/*","docs","packages/cli","packages/eslint-plugin","tests"],"aliases":{"#cli/":"packages/cli/src/","#tests/":"tests/","#docs/":"docs/","#cli-package":"packages/cli/package.json","#eslint-plugin/":"packages/eslint-plugin/src/","#eslint-plugin-package":"packages/eslint-plugin/package.json","#root-package":"package.json"}}],"gspot/no-alias-exports":"error","gspot/no-index-imports":"error","gspot/no-trivial-files":"error","gspot/no-trivial-functions":"error","import-x/exports-last":"error","import-x/first":"error","import-x/newline-after-import":["error",{"count":1}]}, files: ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*.astro"]},

    {"rules": {"no-unused-vars":["error",{"args":"all","argsIgnorePattern":"^_","varsIgnorePattern":"^_","destructuredArrayIgnorePattern":"^_"}],"jsdoc/require-param-type":"error","jsdoc/require-returns-type":"error","jsdoc/check-types":"error","jsdoc/no-undefined-types":"error","jsdoc/valid-types":"error"}, files: ["**/*.{js,mjs,cjs,jsx}"]},

    {settings: {
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
}, "ignores": [], "rules": {"n/file-extension-in-import":["error","always"]}, files: [["**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"]]},

    {"rules": {"gspot/import-boundaries":["error",{"folders":["*/*","docs","packages/cli","packages/eslint-plugin","tests"],"aliases":{"#cli/":"packages/cli/src/","#tests/":"tests/","#docs/":"docs/","#cli-package":"packages/cli/package.json","#eslint-plugin/":"packages/eslint-plugin/src/","#eslint-plugin-package":"packages/eslint-plugin/package.json","#root-package":"package.json"}}]}, files: ["docs/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"]},

    {"rules": {"gspot/import-boundaries":["error",{"folders":["*/*","docs","packages/cli","packages/eslint-plugin","tests"],"aliases":{"#cli/":"packages/cli/src/","#tests/":"tests/","#docs/":"docs/","#cli-package":"packages/cli/package.json","#eslint-plugin/":"packages/eslint-plugin/src/","#eslint-plugin-package":"packages/eslint-plugin/package.json","#root-package":"package.json"}}]}, files: ["packages/cli/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"]},

    {"rules": {"gspot/import-boundaries":["error",{"folders":["*/*","docs","packages/cli","packages/eslint-plugin","tests"],"aliases":{}}]}, files: ["packages/eslint-plugin/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"]},

    {"rules": {"gspot/import-boundaries":["error",{"folders":["*/*","docs","packages/cli","packages/eslint-plugin","tests"],"aliases":{}}]}, files: ["tests/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"]},

    {settings: { ...{
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
            "category": "module:cli-config",
            "pattern": [
                "packages/cli/src/config/**"
            ]
        },
        {
            "category": "module:cli-types",
            "pattern": [
                "packages/cli/src/types/**"
            ]
        },
        {
            "category": "module:plugin-config",
            "pattern": [
                "packages/eslint-plugin/src/config/**"
            ]
        },
        {
            "category": "module:plugin-types",
            "pattern": [
                "packages/eslint-plugin/src/types/**"
            ]
        },
        {
            "category": "module:scripts-config",
            "pattern": [
                "scripts/config/**"
            ]
        },
        {
            "category": "module:scripts-types",
            "pattern": [
                "scripts/types/**"
            ]
        },
        {
            "category": "module:docs-config",
            "pattern": [
                "docs/src/config/**"
            ]
        },
        {
            "category": "module:docs-types",
            "pattern": [
                "docs/src/types/**"
            ]
        },
        {
            "category": "module:tests-config",
            "pattern": [
                "tests/config/**"
            ]
        },
        {
            "category": "module:tests-types",
            "pattern": [
                "tests/types/**"
            ]
        },
        {
            "category": "module:system",
            "pattern": [
                "packages/cli/src/system/**",
                "packages/cli/src/errors.ts",
                "packages/cli/src/objects.ts",
                "packages/cli/src/text.ts"
            ]
        },
        {
            "category": "module:parsers",
            "pattern": [
                "packages/cli/src/parsers/**"
            ]
        },
        {
            "category": "module:configurations",
            "pattern": [
                "packages/cli/src/configurations/**"
            ]
        },
        {
            "category": "module:repository",
            "pattern": [
                "packages/cli/src/repository/**"
            ]
        },
        {
            "category": "module:settings",
            "pattern": [
                "packages/cli/src/settings/**"
            ]
        },
        {
            "category": "module:rules",
            "pattern": [
                "packages/cli/src/rules.ts"
            ]
        },
        {
            "category": "module:planning",
            "pattern": [
                "packages/cli/src/planning/**"
            ]
        },
        {
            "category": "module:generation",
            "pattern": [
                "packages/cli/src/generation/**"
            ]
        },
        {
            "category": "module:tools",
            "pattern": [
                "packages/cli/src/tools/**"
            ]
        },
        {
            "category": "module:ownership",
            "pattern": [
                "packages/cli/src/ownership/**"
            ]
        },
        {
            "category": "module:install",
            "pattern": [
                "packages/cli/src/install/**"
            ]
        },
        {
            "category": "module:apply",
            "pattern": [
                "packages/cli/src/apply/**"
            ]
        },
        {
            "category": "module:execution",
            "pattern": [
                "packages/cli/src/execution/**"
            ]
        },
        {
            "category": "module:terminal",
            "pattern": [
                "packages/cli/src/terminal/**"
            ]
        },
        {
            "category": "module:checks",
            "pattern": [
                "packages/cli/src/checks/**"
            ]
        },
        {
            "category": "module:commands",
            "pattern": [
                "packages/cli/src/commands/**"
            ]
        },
        {
            "category": "module:main",
            "pattern": [
                "packages/cli/src/main.ts"
            ]
        },
        {
            "category": "module:plugin",
            "pattern": [
                "packages/eslint-plugin/src/*.ts",
                "packages/eslint-plugin/src/rules/**"
            ]
        },
        {
            "category": "module:scripts",
            "pattern": [
                "scripts/*.ts"
            ]
        },
        {
            "category": "module:docs",
            "pattern": [
                "docs/src/*.*",
                "docs/src/!(config|types)/**"
            ]
        },
        {
            "category": "module:tests",
            "pattern": [
                "tests/{unit,integration,e2e,setup}/**"
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
}, 'import/resolver': { typescript: { project: [
    "docs/tsconfig.json",
    "packages/cli/tsconfig.json",
    "packages/eslint-plugin/tsconfig.json",
    "tsconfig.json"
].map((project) => join(root, project)) } } }, "rules": {"boundaries/dependencies":["error",{"default":"disallow","policies":[{"from":{"file":{"categories":"module:cli-config"}},"allow":{"to":{"file":{"categories":{"anyOf":["module:cli-config"]}}}}},{"from":{"file":{"categories":"module:cli-types"}},"allow":{"to":{"file":{"categories":{"anyOf":["module:cli-types","module:cli-config"]}}}}},{"from":{"file":{"categories":"module:plugin-config"}},"allow":{"to":{"file":{"categories":{"anyOf":["module:plugin-config"]}}}}},{"from":{"file":{"categories":"module:plugin-types"}},"allow":{"to":{"file":{"categories":{"anyOf":["module:plugin-types","module:plugin-config"]}}}}},{"from":{"file":{"categories":"module:scripts-config"}},"allow":{"to":{"file":{"categories":{"anyOf":["module:scripts-config"]}}}}},{"from":{"file":{"categories":"module:scripts-types"}},"allow":{"to":{"file":{"categories":{"anyOf":["module:scripts-types","module:scripts-config","module:cli-types"]}}}}},{"from":{"file":{"categories":"module:docs-config"}},"allow":{"to":{"file":{"categories":{"anyOf":["module:docs-config"]}}}}},{"from":{"file":{"categories":"module:docs-types"}},"allow":{"to":{"file":{"categories":{"anyOf":["module:docs-types","module:docs-config","module:cli-types"]}}}}},{"from":{"file":{"categories":"module:tests-config"}},"allow":{"to":{"file":{"categories":{"anyOf":["module:tests-config"]}}}}},{"from":{"file":{"categories":"module:tests-types"}},"allow":{"to":{"file":{"categories":{"anyOf":["module:tests-types","module:tests-config","module:cli-types","module:cli-config","module:plugin-types"]}}}}},{"from":{"file":{"categories":"module:system"}},"allow":{"to":{"file":{"categories":{"anyOf":["module:system","module:cli-config","module:cli-types"]}}}}},{"from":{"file":{"categories":"module:parsers"}},"allow":{"to":{"file":{"categories":{"anyOf":["module:parsers","module:cli-config","module:cli-types","module:system"]}}}}},{"from":{"file":{"categories":"module:configurations"}},"allow":{"to":{"file":{"categories":{"anyOf":["module:configurations","module:cli-config","module:cli-types","module:system","module:parsers"]}}}}},{"from":{"file":{"categories":"module:repository"}},"allow":{"to":{"file":{"categories":{"anyOf":["module:repository","module:cli-config","module:cli-types","module:system","module:parsers","module:configurations"]}}}}},{"from":{"file":{"categories":"module:settings"}},"allow":{"to":{"file":{"categories":{"anyOf":["module:settings","module:cli-config","module:cli-types","module:system","module:parsers","module:configurations","module:repository","module:ownership","module:apply"]}}}}},{"from":{"file":{"categories":"module:rules"}},"allow":{"to":{"file":{"categories":{"anyOf":["module:rules","module:cli-config","module:cli-types","module:system","module:parsers","module:configurations","module:repository","module:settings"]}}}}},{"from":{"file":{"categories":"module:planning"}},"allow":{"to":{"file":{"categories":{"anyOf":["module:planning","module:cli-config","module:cli-types","module:system","module:parsers","module:configurations","module:repository","module:settings","module:rules"]}}}}},{"from":{"file":{"categories":"module:generation"}},"allow":{"to":{"file":{"categories":{"anyOf":["module:generation","module:cli-config","module:cli-types","module:system","module:parsers","module:configurations","module:repository","module:settings","module:rules","module:planning","module:tools","module:ownership"]}}}}},{"from":{"file":{"categories":"module:tools"}},"allow":{"to":{"file":{"categories":{"anyOf":["module:tools","module:cli-config","module:cli-types","module:system","module:parsers","module:configurations","module:repository","module:settings","module:rules","module:planning","module:generation"]}}}}},{"from":{"file":{"categories":"module:ownership"}},"allow":{"to":{"file":{"categories":{"anyOf":["module:ownership","module:cli-config","module:cli-types","module:system","module:parsers","module:configurations","module:repository","module:settings","module:rules","module:planning","module:generation","module:tools"]}}}}},{"from":{"file":{"categories":"module:install"}},"allow":{"to":{"file":{"categories":{"anyOf":["module:install","module:cli-config","module:cli-types","module:system","module:parsers","module:configurations","module:repository","module:settings","module:rules","module:planning","module:generation","module:tools","module:ownership","module:apply"]}}}}},{"from":{"file":{"categories":"module:apply"}},"allow":{"to":{"file":{"categories":{"anyOf":["module:apply","module:cli-config","module:cli-types","module:system","module:parsers","module:configurations","module:repository","module:settings","module:rules","module:planning","module:generation","module:tools","module:ownership","module:install"]}}}}},{"from":{"file":{"categories":"module:execution"}},"allow":{"to":{"file":{"categories":{"anyOf":["module:execution","module:cli-config","module:cli-types","module:system","module:parsers","module:configurations","module:repository","module:settings","module:rules","module:planning","module:generation","module:tools","module:ownership","module:install","module:apply"]}}}}},{"from":{"file":{"categories":"module:terminal"}},"allow":{"to":{"file":{"categories":{"anyOf":["module:terminal","module:cli-config","module:cli-types","module:system","module:parsers","module:configurations","module:repository","module:settings","module:rules","module:planning","module:generation","module:tools","module:ownership","module:install","module:apply","module:execution"]}}}}},{"from":{"file":{"categories":"module:checks"}},"allow":{"to":{"file":{"categories":{"anyOf":["module:checks","module:cli-config","module:cli-types","module:system","module:parsers","module:configurations","module:repository","module:settings","module:rules","module:planning","module:generation","module:tools","module:ownership","module:install","module:apply","module:execution","module:terminal"]}}}}},{"from":{"file":{"categories":"module:commands"}},"allow":{"to":{"file":{"categories":{"anyOf":["module:commands","module:cli-config","module:cli-types","module:system","module:parsers","module:configurations","module:repository","module:settings","module:rules","module:planning","module:generation","module:tools","module:ownership","module:install","module:apply","module:execution","module:terminal","module:checks"]}}}}},{"from":{"file":{"categories":"module:main"}},"allow":{"to":{"file":{"categories":{"anyOf":["module:main","module:cli-config","module:cli-types","module:system","module:parsers","module:configurations","module:repository","module:settings","module:rules","module:planning","module:generation","module:tools","module:ownership","module:install","module:apply","module:execution","module:terminal","module:checks","module:commands"]}}}}},{"from":{"file":{"categories":"module:plugin"}},"allow":{"to":{"file":{"categories":{"anyOf":["module:plugin","module:plugin-config","module:plugin-types"]}}}}},{"from":{"file":{"categories":"module:scripts"}},"allow":{"to":{"file":{"categories":{"anyOf":["module:scripts","module:scripts-config","module:scripts-types","module:cli-config","module:cli-types","module:system","module:parsers","module:configurations","module:repository","module:settings","module:rules","module:planning","module:generation","module:tools","module:ownership","module:install","module:apply","module:execution","module:terminal","module:checks","module:commands","module:plugin"]}}}}},{"from":{"file":{"categories":"module:docs"}},"allow":{"to":{"file":{"categories":{"anyOf":["module:docs","module:docs-config","module:docs-types","module:cli-config","module:cli-types","module:settings","module:configurations","module:scripts","module:plugin","module:commands","module:plugin-config","module:system"]}}}}},{"from":{"file":{"categories":"module:tests"}},"allow":{"to":{"file":{"categories":{"anyOf":["module:tests","module:tests-config","module:tests-types","module:cli-config","module:cli-types","module:plugin-config","module:plugin-types","module:scripts-config","module:scripts-types","module:docs-config","module:docs-types","module:system","module:parsers","module:configurations","module:repository","module:settings","module:rules","module:planning","module:generation","module:tools","module:ownership","module:install","module:apply","module:execution","module:terminal","module:checks","module:commands","module:main","module:plugin","module:scripts","module:docs"]}}}}},{"from":{"file":{"isUnknown":true}},"allow":{"to":{"file":{"path":"**/*"}}}},{"allow":{"to":{"file":{"isUnknown":true}}}},{"from":{"file":{"path":["**/test/**","**/tests/**","**/__tests__/**","**/*.test.*","**/*.spec.*","**/test_*.py","**/*_test.py","**/conftest.py","**/Tests/**","**/*Tests.swift","docs/**/test/**","docs/**/tests/**","docs/**/__tests__/**","docs/**/*.test.*","docs/**/*.spec.*","docs/**/test_*.py","docs/**/*_test.py","docs/**/conftest.py","docs/**/Tests/**","docs/**/*Tests.swift","packages/cli/**/test/**","packages/cli/**/tests/**","packages/cli/**/__tests__/**","packages/cli/**/*.test.*","packages/cli/**/*.spec.*","packages/cli/**/test_*.py","packages/cli/**/*_test.py","packages/cli/**/conftest.py","packages/cli/**/Tests/**","packages/cli/**/*Tests.swift","packages/eslint-plugin/**/test/**","packages/eslint-plugin/**/tests/**","packages/eslint-plugin/**/__tests__/**","packages/eslint-plugin/**/*.test.*","packages/eslint-plugin/**/*.spec.*","packages/eslint-plugin/**/test_*.py","packages/eslint-plugin/**/*_test.py","packages/eslint-plugin/**/conftest.py","packages/eslint-plugin/**/Tests/**","packages/eslint-plugin/**/*Tests.swift","tests/**/test/**","tests/**/tests/**","tests/**/__tests__/**","tests/**/*.test.*","tests/**/*.spec.*","tests/**/test_*.py","tests/**/*_test.py","tests/**/conftest.py","tests/**/Tests/**","tests/**/*Tests.swift"]}},"allow":{"to":{"file":{"path":"**/*"}}}},{"allow":{"to":{"file":{"path":["**/test/**","**/tests/**","**/__tests__/**","**/*.test.*","**/*.spec.*","**/test_*.py","**/*_test.py","**/conftest.py","**/Tests/**","**/*Tests.swift","docs/**/test/**","docs/**/tests/**","docs/**/__tests__/**","docs/**/*.test.*","docs/**/*.spec.*","docs/**/test_*.py","docs/**/*_test.py","docs/**/conftest.py","docs/**/Tests/**","docs/**/*Tests.swift","packages/cli/**/test/**","packages/cli/**/tests/**","packages/cli/**/__tests__/**","packages/cli/**/*.test.*","packages/cli/**/*.spec.*","packages/cli/**/test_*.py","packages/cli/**/*_test.py","packages/cli/**/conftest.py","packages/cli/**/Tests/**","packages/cli/**/*Tests.swift","packages/eslint-plugin/**/test/**","packages/eslint-plugin/**/tests/**","packages/eslint-plugin/**/__tests__/**","packages/eslint-plugin/**/*.test.*","packages/eslint-plugin/**/*.spec.*","packages/eslint-plugin/**/test_*.py","packages/eslint-plugin/**/*_test.py","packages/eslint-plugin/**/conftest.py","packages/eslint-plugin/**/Tests/**","packages/eslint-plugin/**/*Tests.swift","tests/**/test/**","tests/**/tests/**","tests/**/__tests__/**","tests/**/*.test.*","tests/**/*.spec.*","tests/**/test_*.py","tests/**/*_test.py","tests/**/conftest.py","tests/**/Tests/**","tests/**/*Tests.swift"]}}}},{"from":{"file":{"categories":{"noneOf":["module:cli-config","module:cli-types","module:plugin-config","module:plugin-types","module:scripts-config","module:scripts-types","module:docs-config","module:docs-types","module:tests-config","module:tests-types","module:system","module:parsers","module:configurations","module:repository","module:settings","module:rules","module:planning","module:generation","module:tools","module:ownership","module:install","module:apply","module:execution","module:terminal","module:checks","module:commands","module:main","module:plugin","module:scripts","module:docs","module:tests"]}}},"allow":{"to":{"file":{"path":"**/*"}}}},{"allow":{"to":{"file":{"categories":{"noneOf":["module:cli-config","module:cli-types","module:plugin-config","module:plugin-types","module:scripts-config","module:scripts-types","module:docs-config","module:docs-types","module:tests-config","module:tests-types","module:system","module:parsers","module:configurations","module:repository","module:settings","module:rules","module:planning","module:generation","module:tools","module:ownership","module:install","module:apply","module:execution","module:terminal","module:checks","module:commands","module:main","module:plugin","module:scripts","module:docs","module:tests"]}}}}},{"from":{"file":{"categories":{"noneOf":["tests"]}}},"disallow":{"to":{"file":{"categories":"tests"}}}}],"checkInternals":true}]}, files: ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"]},


stripRuntimeGlobals({...tseslint["configs"]["strictTypeChecked"][0], "ignores": ["docs/**","packages/cli/**","packages/eslint-plugin/**","tests/**"], files: [["**/*.{ts,mts,cts,tsx}", "**/*"]]}),

stripRuntimeGlobals({...tseslint["configs"]["strictTypeChecked"][1], "ignores": ["docs/**","packages/cli/**","packages/eslint-plugin/**","tests/**"], rules: { ...tseslint["configs"]["strictTypeChecked"][1].rules }, files: [["**/*.{ts,mts,cts,tsx}", "**/*"], ["**/*.astro", "**/*"]]}),

stripRuntimeGlobals({...tseslint["configs"]["strictTypeChecked"][2], "ignores": ["docs/**","packages/cli/**","packages/eslint-plugin/**","tests/**"], rules: { ...tseslint["configs"]["strictTypeChecked"][2].rules }, files: [["**/*.{ts,mts,cts,tsx}", "**/*"], ["**/*.astro", "**/*"]]}),

stripRuntimeGlobals({plugins: { '@typescript-eslint': tseslint.plugin }, languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: root } }, settings: { 'import-x/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx', '.mts', '.cts'] }, 'import-x/resolver-next': [createTypeScriptImportResolver({ project: [
    "docs/tsconfig.json",
    "packages/cli/tsconfig.json",
    "packages/eslint-plugin/tsconfig.json",
    "tsconfig.json"
].map((project) => join(root, project)) })] }, "ignores": ["docs/**","packages/cli/**","packages/eslint-plugin/**","tests/**"], "rules": {"@typescript-eslint/no-misused-spread":["error",{"allow":["string"]}],"sonarjs/deprecation":"off","jsdoc/require-param-type":"off","jsdoc/require-returns-type":"off","jsdoc/check-types":"off","jsdoc/no-undefined-types":"off","jsdoc/valid-types":"off","jsdoc/no-types":"error","@typescript-eslint/consistent-type-definitions":["error","type"],"@typescript-eslint/consistent-type-imports":["error",{"prefer":"type-imports","fixStyle":"separate-type-imports"}],"@typescript-eslint/consistent-type-exports":["error",{"fixMixedExportsWithInlineTypeSpecifier":false}],"@typescript-eslint/switch-exhaustiveness-check":["error",{"considerDefaultExhaustiveForUnions":true}],"@typescript-eslint/prefer-readonly":"error","@typescript-eslint/require-array-sort-compare":["error",{"ignoreStringArrays":true}],"@typescript-eslint/no-floating-promises":["error",{"ignoreVoid":false}],"@typescript-eslint/no-unused-vars":["error",{"args":"all","argsIgnorePattern":"^_","varsIgnorePattern":"^_","destructuredArrayIgnorePattern":"^_","ignoreUsingDeclarations":true}],"@typescript-eslint/no-require-imports":"off","@typescript-eslint/strict-boolean-expressions":"error","@typescript-eslint/explicit-module-boundary-types":"error","@typescript-eslint/prefer-optional-chain":"error","@typescript-eslint/no-magic-numbers":["error",{"ignoreEnums":true,"ignoreArrayIndexes":true,"ignoreReadonlyClassProperties":true,"ignoreTypeIndexes":true,"ignore":[-1,0,1]}],"@typescript-eslint/ban-ts-comment":["error",{"ts-expect-error":false,"ts-ignore":true,"ts-nocheck":true}],"sonarjs/no-duplicate-in-composite":"error","sonarjs/redundant-type-aliases":"error","no-unused-vars":"off"}, files: [["**/*.{ts,mts,cts,tsx}", "**/*"], ["**/*.astro", "**/*"]]}),
stripRuntimeGlobals({"ignores": ["docs/**","packages/cli/**","packages/eslint-plugin/**","tests/**"], "rules": {"@typescript-eslint/no-magic-numbers":"off","@typescript-eslint/no-non-null-assertion":"off"}, files: [["**/test/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*"], ["**/test/**", "**/*.astro", "**/*"], ["**/tests/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*"], ["**/tests/**", "**/*.astro", "**/*"], ["**/__tests__/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*"], ["**/__tests__/**", "**/*.astro", "**/*"], ["**/*.test.*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*"], ["**/*.test.*", "**/*.astro", "**/*"], ["**/*.spec.*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*"], ["**/*.spec.*", "**/*.astro", "**/*"], ["**/test_*.py", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*"], ["**/test_*.py", "**/*.astro", "**/*"], ["**/*_test.py", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*"], ["**/*_test.py", "**/*.astro", "**/*"], ["**/conftest.py", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*"], ["**/conftest.py", "**/*.astro", "**/*"], ["**/Tests/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*"], ["**/Tests/**", "**/*.astro", "**/*"], ["**/*Tests.swift", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*"], ["**/*Tests.swift", "**/*.astro", "**/*"]]}),


stripRuntimeGlobals({...tseslint["configs"]["strictTypeChecked"][0], "ignores": [], files: [["**/*.{ts,mts,cts,tsx}", "docs/**/*"]]}),

stripRuntimeGlobals({...tseslint["configs"]["strictTypeChecked"][1], "ignores": [], rules: { ...tseslint["configs"]["strictTypeChecked"][1].rules }, files: [["**/*.{ts,mts,cts,tsx}", "docs/**/*"], ["**/*.astro", "docs/**/*"]]}),

stripRuntimeGlobals({...tseslint["configs"]["strictTypeChecked"][2], "ignores": [], rules: { ...tseslint["configs"]["strictTypeChecked"][2].rules }, files: [["**/*.{ts,mts,cts,tsx}", "docs/**/*"], ["**/*.astro", "docs/**/*"]]}),

stripRuntimeGlobals({plugins: { '@typescript-eslint': tseslint.plugin }, languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: root } }, settings: { 'import-x/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx', '.mts', '.cts'] }, 'import-x/resolver-next': [createTypeScriptImportResolver({ project: [
    "docs/tsconfig.json",
    "packages/cli/tsconfig.json",
    "packages/eslint-plugin/tsconfig.json",
    "tsconfig.json"
].map((project) => join(root, project)) })] }, "ignores": [], "rules": {"@typescript-eslint/no-misused-spread":["error",{"allow":["string"]}],"sonarjs/deprecation":"off","jsdoc/require-param-type":"off","jsdoc/require-returns-type":"off","jsdoc/check-types":"off","jsdoc/no-undefined-types":"off","jsdoc/valid-types":"off","jsdoc/no-types":"error","@typescript-eslint/consistent-type-definitions":["error","type"],"@typescript-eslint/consistent-type-imports":["error",{"prefer":"type-imports","fixStyle":"separate-type-imports"}],"@typescript-eslint/consistent-type-exports":["error",{"fixMixedExportsWithInlineTypeSpecifier":false}],"@typescript-eslint/switch-exhaustiveness-check":["error",{"considerDefaultExhaustiveForUnions":true}],"@typescript-eslint/prefer-readonly":"error","@typescript-eslint/require-array-sort-compare":["error",{"ignoreStringArrays":true}],"@typescript-eslint/no-floating-promises":["error",{"ignoreVoid":false}],"@typescript-eslint/no-unused-vars":["error",{"args":"all","argsIgnorePattern":"^_","varsIgnorePattern":"^_","destructuredArrayIgnorePattern":"^_","ignoreUsingDeclarations":true}],"@typescript-eslint/no-require-imports":"off","@typescript-eslint/strict-boolean-expressions":"error","@typescript-eslint/explicit-module-boundary-types":"error","@typescript-eslint/prefer-optional-chain":"error","@typescript-eslint/no-magic-numbers":["error",{"ignoreEnums":true,"ignoreArrayIndexes":true,"ignoreReadonlyClassProperties":true,"ignoreTypeIndexes":true,"ignore":[-1,0,1]}],"@typescript-eslint/ban-ts-comment":["error",{"ts-expect-error":false,"ts-ignore":true,"ts-nocheck":true}],"sonarjs/no-duplicate-in-composite":"error","sonarjs/redundant-type-aliases":"error","no-unused-vars":"off"}, files: [["**/*.{ts,mts,cts,tsx}", "docs/**/*"], ["**/*.astro", "docs/**/*"]]}),
stripRuntimeGlobals({"ignores": [], "rules": {"@typescript-eslint/no-magic-numbers":"off","@typescript-eslint/no-non-null-assertion":"off"}, files: [["docs/**/test/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "docs/**/*"], ["docs/**/test/**", "**/*.astro", "docs/**/*"], ["docs/**/tests/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "docs/**/*"], ["docs/**/tests/**", "**/*.astro", "docs/**/*"], ["docs/**/__tests__/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "docs/**/*"], ["docs/**/__tests__/**", "**/*.astro", "docs/**/*"], ["docs/**/*.test.*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "docs/**/*"], ["docs/**/*.test.*", "**/*.astro", "docs/**/*"], ["docs/**/*.spec.*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "docs/**/*"], ["docs/**/*.spec.*", "**/*.astro", "docs/**/*"], ["docs/**/test_*.py", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "docs/**/*"], ["docs/**/test_*.py", "**/*.astro", "docs/**/*"], ["docs/**/*_test.py", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "docs/**/*"], ["docs/**/*_test.py", "**/*.astro", "docs/**/*"], ["docs/**/conftest.py", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "docs/**/*"], ["docs/**/conftest.py", "**/*.astro", "docs/**/*"], ["docs/**/Tests/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "docs/**/*"], ["docs/**/Tests/**", "**/*.astro", "docs/**/*"], ["docs/**/*Tests.swift", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "docs/**/*"], ["docs/**/*Tests.swift", "**/*.astro", "docs/**/*"]]}),


stripRuntimeGlobals({...tseslint["configs"]["strictTypeChecked"][0], "ignores": [], files: [["**/*.{ts,mts,cts,tsx}", "packages/cli/**/*"]]}),

stripRuntimeGlobals({...tseslint["configs"]["strictTypeChecked"][1], "ignores": [], rules: { ...tseslint["configs"]["strictTypeChecked"][1].rules }, files: [["**/*.{ts,mts,cts,tsx}", "packages/cli/**/*"], ["**/*.astro", "packages/cli/**/*"]]}),

stripRuntimeGlobals({...tseslint["configs"]["strictTypeChecked"][2], "ignores": [], rules: { ...tseslint["configs"]["strictTypeChecked"][2].rules }, files: [["**/*.{ts,mts,cts,tsx}", "packages/cli/**/*"], ["**/*.astro", "packages/cli/**/*"]]}),

stripRuntimeGlobals({plugins: { '@typescript-eslint': tseslint.plugin }, languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: root } }, settings: { 'import-x/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx', '.mts', '.cts'] }, 'import-x/resolver-next': [createTypeScriptImportResolver({ project: [
    "docs/tsconfig.json",
    "packages/cli/tsconfig.json",
    "packages/eslint-plugin/tsconfig.json",
    "tsconfig.json"
].map((project) => join(root, project)) })] }, "ignores": [], "rules": {"@typescript-eslint/no-misused-spread":["error",{"allow":["string"]}],"sonarjs/deprecation":"off","jsdoc/require-param-type":"off","jsdoc/require-returns-type":"off","jsdoc/check-types":"off","jsdoc/no-undefined-types":"off","jsdoc/valid-types":"off","jsdoc/no-types":"error","@typescript-eslint/consistent-type-definitions":["error","type"],"@typescript-eslint/consistent-type-imports":["error",{"prefer":"type-imports","fixStyle":"separate-type-imports"}],"@typescript-eslint/consistent-type-exports":["error",{"fixMixedExportsWithInlineTypeSpecifier":false}],"@typescript-eslint/switch-exhaustiveness-check":["error",{"considerDefaultExhaustiveForUnions":true}],"@typescript-eslint/prefer-readonly":"error","@typescript-eslint/require-array-sort-compare":["error",{"ignoreStringArrays":true}],"@typescript-eslint/no-floating-promises":["error",{"ignoreVoid":false}],"@typescript-eslint/no-unused-vars":["error",{"args":"all","argsIgnorePattern":"^_","varsIgnorePattern":"^_","destructuredArrayIgnorePattern":"^_","ignoreUsingDeclarations":true}],"@typescript-eslint/no-require-imports":"off","@typescript-eslint/strict-boolean-expressions":"error","@typescript-eslint/explicit-module-boundary-types":"error","@typescript-eslint/prefer-optional-chain":"error","@typescript-eslint/no-magic-numbers":["error",{"ignoreEnums":true,"ignoreArrayIndexes":true,"ignoreReadonlyClassProperties":true,"ignoreTypeIndexes":true,"ignore":[-1,0,1]}],"@typescript-eslint/ban-ts-comment":["error",{"ts-expect-error":false,"ts-ignore":true,"ts-nocheck":true}],"sonarjs/no-duplicate-in-composite":"error","sonarjs/redundant-type-aliases":"error","no-unused-vars":"off"}, files: [["**/*.{ts,mts,cts,tsx}", "packages/cli/**/*"], ["**/*.astro", "packages/cli/**/*"]]}),
stripRuntimeGlobals({"ignores": [], "rules": {"@typescript-eslint/no-magic-numbers":"off","@typescript-eslint/no-non-null-assertion":"off"}, files: [["packages/cli/**/test/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/cli/**/*"], ["packages/cli/**/test/**", "**/*.astro", "packages/cli/**/*"], ["packages/cli/**/tests/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/cli/**/*"], ["packages/cli/**/tests/**", "**/*.astro", "packages/cli/**/*"], ["packages/cli/**/__tests__/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/cli/**/*"], ["packages/cli/**/__tests__/**", "**/*.astro", "packages/cli/**/*"], ["packages/cli/**/*.test.*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/cli/**/*"], ["packages/cli/**/*.test.*", "**/*.astro", "packages/cli/**/*"], ["packages/cli/**/*.spec.*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/cli/**/*"], ["packages/cli/**/*.spec.*", "**/*.astro", "packages/cli/**/*"], ["packages/cli/**/test_*.py", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/cli/**/*"], ["packages/cli/**/test_*.py", "**/*.astro", "packages/cli/**/*"], ["packages/cli/**/*_test.py", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/cli/**/*"], ["packages/cli/**/*_test.py", "**/*.astro", "packages/cli/**/*"], ["packages/cli/**/conftest.py", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/cli/**/*"], ["packages/cli/**/conftest.py", "**/*.astro", "packages/cli/**/*"], ["packages/cli/**/Tests/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/cli/**/*"], ["packages/cli/**/Tests/**", "**/*.astro", "packages/cli/**/*"], ["packages/cli/**/*Tests.swift", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/cli/**/*"], ["packages/cli/**/*Tests.swift", "**/*.astro", "packages/cli/**/*"]]}),


stripRuntimeGlobals({...tseslint["configs"]["strictTypeChecked"][0], "ignores": [], files: [["**/*.{ts,mts,cts,tsx}", "packages/eslint-plugin/**/*"]]}),

stripRuntimeGlobals({...tseslint["configs"]["strictTypeChecked"][1], "ignores": [], rules: { ...tseslint["configs"]["strictTypeChecked"][1].rules }, files: [["**/*.{ts,mts,cts,tsx}", "packages/eslint-plugin/**/*"], ["**/*.astro", "packages/eslint-plugin/**/*"]]}),

stripRuntimeGlobals({...tseslint["configs"]["strictTypeChecked"][2], "ignores": [], rules: { ...tseslint["configs"]["strictTypeChecked"][2].rules }, files: [["**/*.{ts,mts,cts,tsx}", "packages/eslint-plugin/**/*"], ["**/*.astro", "packages/eslint-plugin/**/*"]]}),

stripRuntimeGlobals({plugins: { '@typescript-eslint': tseslint.plugin }, languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: root } }, settings: { 'import-x/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx', '.mts', '.cts'] }, 'import-x/resolver-next': [createTypeScriptImportResolver({ project: [
    "docs/tsconfig.json",
    "packages/cli/tsconfig.json",
    "packages/eslint-plugin/tsconfig.json",
    "tsconfig.json"
].map((project) => join(root, project)) })] }, "ignores": [], "rules": {"@typescript-eslint/no-misused-spread":["error",{"allow":["string"]}],"sonarjs/deprecation":"off","jsdoc/require-param-type":"off","jsdoc/require-returns-type":"off","jsdoc/check-types":"off","jsdoc/no-undefined-types":"off","jsdoc/valid-types":"off","jsdoc/no-types":"error","@typescript-eslint/consistent-type-definitions":["error","type"],"@typescript-eslint/consistent-type-imports":["error",{"prefer":"type-imports","fixStyle":"separate-type-imports"}],"@typescript-eslint/consistent-type-exports":["error",{"fixMixedExportsWithInlineTypeSpecifier":false}],"@typescript-eslint/switch-exhaustiveness-check":["error",{"considerDefaultExhaustiveForUnions":true}],"@typescript-eslint/prefer-readonly":"error","@typescript-eslint/require-array-sort-compare":["error",{"ignoreStringArrays":true}],"@typescript-eslint/no-floating-promises":["error",{"ignoreVoid":false}],"@typescript-eslint/no-unused-vars":["error",{"args":"all","argsIgnorePattern":"^_","varsIgnorePattern":"^_","destructuredArrayIgnorePattern":"^_","ignoreUsingDeclarations":true}],"@typescript-eslint/no-require-imports":"off","@typescript-eslint/strict-boolean-expressions":"error","@typescript-eslint/explicit-module-boundary-types":"error","@typescript-eslint/prefer-optional-chain":"error","@typescript-eslint/no-magic-numbers":["error",{"ignoreEnums":true,"ignoreArrayIndexes":true,"ignoreReadonlyClassProperties":true,"ignoreTypeIndexes":true,"ignore":[-1,0,1]}],"@typescript-eslint/ban-ts-comment":["error",{"ts-expect-error":false,"ts-ignore":true,"ts-nocheck":true}],"sonarjs/no-duplicate-in-composite":"error","sonarjs/redundant-type-aliases":"error","no-unused-vars":"off"}, files: [["**/*.{ts,mts,cts,tsx}", "packages/eslint-plugin/**/*"], ["**/*.astro", "packages/eslint-plugin/**/*"]]}),
stripRuntimeGlobals({"ignores": [], "rules": {"@typescript-eslint/no-magic-numbers":"off","@typescript-eslint/no-non-null-assertion":"off"}, files: [["packages/eslint-plugin/**/test/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/eslint-plugin/**/*"], ["packages/eslint-plugin/**/test/**", "**/*.astro", "packages/eslint-plugin/**/*"], ["packages/eslint-plugin/**/tests/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/eslint-plugin/**/*"], ["packages/eslint-plugin/**/tests/**", "**/*.astro", "packages/eslint-plugin/**/*"], ["packages/eslint-plugin/**/__tests__/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/eslint-plugin/**/*"], ["packages/eslint-plugin/**/__tests__/**", "**/*.astro", "packages/eslint-plugin/**/*"], ["packages/eslint-plugin/**/*.test.*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/eslint-plugin/**/*"], ["packages/eslint-plugin/**/*.test.*", "**/*.astro", "packages/eslint-plugin/**/*"], ["packages/eslint-plugin/**/*.spec.*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/eslint-plugin/**/*"], ["packages/eslint-plugin/**/*.spec.*", "**/*.astro", "packages/eslint-plugin/**/*"], ["packages/eslint-plugin/**/test_*.py", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/eslint-plugin/**/*"], ["packages/eslint-plugin/**/test_*.py", "**/*.astro", "packages/eslint-plugin/**/*"], ["packages/eslint-plugin/**/*_test.py", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/eslint-plugin/**/*"], ["packages/eslint-plugin/**/*_test.py", "**/*.astro", "packages/eslint-plugin/**/*"], ["packages/eslint-plugin/**/conftest.py", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/eslint-plugin/**/*"], ["packages/eslint-plugin/**/conftest.py", "**/*.astro", "packages/eslint-plugin/**/*"], ["packages/eslint-plugin/**/Tests/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/eslint-plugin/**/*"], ["packages/eslint-plugin/**/Tests/**", "**/*.astro", "packages/eslint-plugin/**/*"], ["packages/eslint-plugin/**/*Tests.swift", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/eslint-plugin/**/*"], ["packages/eslint-plugin/**/*Tests.swift", "**/*.astro", "packages/eslint-plugin/**/*"]]}),


stripRuntimeGlobals({...tseslint["configs"]["strictTypeChecked"][0], "ignores": [], files: [["**/*.{ts,mts,cts,tsx}", "tests/**/*"]]}),

stripRuntimeGlobals({...tseslint["configs"]["strictTypeChecked"][1], "ignores": [], rules: { ...tseslint["configs"]["strictTypeChecked"][1].rules }, files: [["**/*.{ts,mts,cts,tsx}", "tests/**/*"], ["**/*.astro", "tests/**/*"]]}),

stripRuntimeGlobals({...tseslint["configs"]["strictTypeChecked"][2], "ignores": [], rules: { ...tseslint["configs"]["strictTypeChecked"][2].rules }, files: [["**/*.{ts,mts,cts,tsx}", "tests/**/*"], ["**/*.astro", "tests/**/*"]]}),

stripRuntimeGlobals({plugins: { '@typescript-eslint': tseslint.plugin }, languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: root } }, settings: { 'import-x/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx', '.mts', '.cts'] }, 'import-x/resolver-next': [createTypeScriptImportResolver({ project: [
    "docs/tsconfig.json",
    "packages/cli/tsconfig.json",
    "packages/eslint-plugin/tsconfig.json",
    "tsconfig.json"
].map((project) => join(root, project)) })] }, "ignores": [], "rules": {"@typescript-eslint/no-misused-spread":["error",{"allow":["string"]}],"sonarjs/deprecation":"off","jsdoc/require-param-type":"off","jsdoc/require-returns-type":"off","jsdoc/check-types":"off","jsdoc/no-undefined-types":"off","jsdoc/valid-types":"off","jsdoc/no-types":"error","@typescript-eslint/consistent-type-definitions":["error","type"],"@typescript-eslint/consistent-type-imports":["error",{"prefer":"type-imports","fixStyle":"separate-type-imports"}],"@typescript-eslint/consistent-type-exports":["error",{"fixMixedExportsWithInlineTypeSpecifier":false}],"@typescript-eslint/switch-exhaustiveness-check":["error",{"considerDefaultExhaustiveForUnions":true}],"@typescript-eslint/prefer-readonly":"error","@typescript-eslint/require-array-sort-compare":["error",{"ignoreStringArrays":true}],"@typescript-eslint/no-floating-promises":["error",{"ignoreVoid":false}],"@typescript-eslint/no-unused-vars":["error",{"args":"all","argsIgnorePattern":"^_","varsIgnorePattern":"^_","destructuredArrayIgnorePattern":"^_","ignoreUsingDeclarations":true}],"@typescript-eslint/no-require-imports":"off","@typescript-eslint/strict-boolean-expressions":"error","@typescript-eslint/explicit-module-boundary-types":"error","@typescript-eslint/prefer-optional-chain":"error","@typescript-eslint/no-magic-numbers":["error",{"ignoreEnums":true,"ignoreArrayIndexes":true,"ignoreReadonlyClassProperties":true,"ignoreTypeIndexes":true,"ignore":[-1,0,1]}],"@typescript-eslint/ban-ts-comment":["error",{"ts-expect-error":false,"ts-ignore":true,"ts-nocheck":true}],"sonarjs/no-duplicate-in-composite":"error","sonarjs/redundant-type-aliases":"error","no-unused-vars":"off"}, files: [["**/*.{ts,mts,cts,tsx}", "tests/**/*"], ["**/*.astro", "tests/**/*"]]}),
stripRuntimeGlobals({"ignores": [], "rules": {"@typescript-eslint/no-magic-numbers":"off","@typescript-eslint/no-non-null-assertion":"off"}, files: [["tests/**/test/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "tests/**/*"], ["tests/**/test/**", "**/*.astro", "tests/**/*"], ["tests/**/tests/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "tests/**/*"], ["tests/**/tests/**", "**/*.astro", "tests/**/*"], ["tests/**/__tests__/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "tests/**/*"], ["tests/**/__tests__/**", "**/*.astro", "tests/**/*"], ["tests/**/*.test.*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "tests/**/*"], ["tests/**/*.test.*", "**/*.astro", "tests/**/*"], ["tests/**/*.spec.*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "tests/**/*"], ["tests/**/*.spec.*", "**/*.astro", "tests/**/*"], ["tests/**/test_*.py", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "tests/**/*"], ["tests/**/test_*.py", "**/*.astro", "tests/**/*"], ["tests/**/*_test.py", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "tests/**/*"], ["tests/**/*_test.py", "**/*.astro", "tests/**/*"], ["tests/**/conftest.py", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "tests/**/*"], ["tests/**/conftest.py", "**/*.astro", "tests/**/*"], ["tests/**/Tests/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "tests/**/*"], ["tests/**/Tests/**", "**/*.astro", "tests/**/*"], ["tests/**/*Tests.swift", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "tests/**/*"], ["tests/**/*Tests.swift", "**/*.astro", "tests/**/*"]]}),


    stripRuntimeGlobals({...astroPlugin["configs"]["flat/recommended"][0], "ignores": [], files: [["**/*.astro", "docs/**/*"]]}),

    stripRuntimeGlobals({...astroPlugin["configs"]["flat/recommended"][1], "ignores": [], files: [["*.astro", "docs/**/*"], ["**/*.astro", "docs/**/*"]]}),

    stripRuntimeGlobals({...astroPlugin["configs"]["flat/recommended"][2], "ignores": [], rules: { ...astroPlugin["configs"]["flat/recommended"][2].rules }, files: [["**/*.astro/*.js", "docs/**/*"], ["*.astro/*.js", "docs/**/*"]]}),

    stripRuntimeGlobals({...astroPlugin["configs"]["flat/recommended"][3], "ignores": [], rules: { ...astroPlugin["configs"]["flat/recommended"][3].rules }, files: [["**/*.astro/*.ts", "docs/**/*"], ["*.astro/*.ts", "docs/**/*"]]}),

    stripRuntimeGlobals({...astroPlugin["configs"]["flat/recommended"][4], "ignores": [], rules: { ...astroPlugin["configs"]["flat/recommended"][4].rules, ...{"astro/missing-client-only-directive-value":["error"],"astro/no-conflict-set-directives":["error"],"astro/no-deprecated-astro-canonicalurl":["error"],"astro/no-deprecated-astro-fetchcontent":["error"],"astro/no-deprecated-astro-resolve":["error"],"astro/no-deprecated-getentrybyslug":["error"],"astro/no-unused-define-vars-in-style":["error"],"astro/valid-compile":["error"]} }, files: [["**/*.astro", "docs/**/*"]]}),

    stripRuntimeGlobals({...astroPlugin["configs"]["flat/jsx-a11y-recommended"][0], "ignores": [], files: [["**/*.astro", "docs/**/*"]]}),

    stripRuntimeGlobals({...astroPlugin["configs"]["flat/jsx-a11y-recommended"][1], "ignores": [], files: [["*.astro", "docs/**/*"], ["**/*.astro", "docs/**/*"]]}),

    stripRuntimeGlobals({...astroPlugin["configs"]["flat/jsx-a11y-recommended"][2], "ignores": [], rules: { ...astroPlugin["configs"]["flat/jsx-a11y-recommended"][2].rules }, files: [["**/*.astro/*.js", "docs/**/*"], ["*.astro/*.js", "docs/**/*"]]}),

    stripRuntimeGlobals({...astroPlugin["configs"]["flat/jsx-a11y-recommended"][3], "ignores": [], rules: { ...astroPlugin["configs"]["flat/jsx-a11y-recommended"][3].rules }, files: [["**/*.astro/*.ts", "docs/**/*"], ["*.astro/*.ts", "docs/**/*"]]}),

    stripRuntimeGlobals({...astroPlugin["configs"]["flat/jsx-a11y-recommended"][4], "ignores": [], rules: { ...astroPlugin["configs"]["flat/jsx-a11y-recommended"][4].rules, ...{"astro/jsx-a11y/alt-text":["error"],"astro/jsx-a11y/anchor-has-content":["error"],"astro/jsx-a11y/anchor-is-valid":["error"],"astro/jsx-a11y/aria-activedescendant-has-tabindex":["error"],"astro/jsx-a11y/aria-props":["error"],"astro/jsx-a11y/aria-proptypes":["error"],"astro/jsx-a11y/aria-role":["error"],"astro/jsx-a11y/aria-unsupported-elements":["error"],"astro/jsx-a11y/autocomplete-valid":["error"],"astro/jsx-a11y/click-events-have-key-events":["error"],"astro/jsx-a11y/control-has-associated-label":"off","astro/jsx-a11y/heading-has-content":["error"],"astro/jsx-a11y/html-has-lang":["error"],"astro/jsx-a11y/iframe-has-title":["error"],"astro/jsx-a11y/img-redundant-alt":["error"],"astro/jsx-a11y/label-has-associated-control":["error"],"astro/jsx-a11y/media-has-caption":["error"],"astro/jsx-a11y/mouse-events-have-key-events":["error"],"astro/jsx-a11y/no-access-key":["error"],"astro/jsx-a11y/no-autofocus":["error"],"astro/jsx-a11y/no-distracting-elements":["error"],"astro/jsx-a11y/no-redundant-roles":["error"],"astro/jsx-a11y/role-has-required-aria-props":["error"],"astro/jsx-a11y/role-supports-aria-props":["error"],"astro/jsx-a11y/scope":["error"],"astro/jsx-a11y/tabindex-no-positive":["error"]} }, files: [["**/*.astro", "docs/**/*"]]}),

    stripRuntimeGlobals({languageOptions: { parserOptions: { tsconfigRootDir: root } }, "ignores": [], "rules": {"astro/no-set-html-directive":"error","astro/no-exports-from-components":"error","astro/no-prerender-export-outside-pages":"error","astro/no-unused-css-selector":"error","astro/prefer-class-list-directive":"error","astro/prefer-object-class-list":"error","astro/prefer-split-class-list":"error"}, files: [["**/*.astro", "docs/**/*"]]}),

    stripRuntimeGlobals({processor: 'astro/client-side-ts', languageOptions: { parserOptions: { parser: tseslint.parser, projectService: false, project: true } }, "ignores": [], "rules": {"@typescript-eslint/no-unsafe-return":"off"}, files: [["**/*.astro", "docs/**/*"]]}),

    stripRuntimeGlobals({...tseslint["configs"]["disableTypeChecked"], "ignores": [], rules: { ...tseslint["configs"]["disableTypeChecked"].rules }, files: [["**/*.astro/*.ts", "docs/**/*"], ["**/*.astro/*.js", "docs/**/*"]]}),


stripRuntimeGlobals({plugins: { zod: zodPlugin }, "ignores": [], "rules": {"zod/no-any-schema":"error","zod/no-coerce-boolean":"error","zod/no-empty-custom-schema":"error","zod/no-native-enum":"error","zod/no-promise-schema":"error","zod/no-throw-in-refine":"error","zod/prefer-strict-object":"error","zod/prefer-meta-last":"error","zod/require-brand-type-parameter":"error"}, files: [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "docs/**/*"], ["**/*.astro", "docs/**/*"]]}),

stripRuntimeGlobals({plugins: { zod: zodPlugin }, "ignores": [], "rules": {"zod/no-any-schema":"error","zod/no-coerce-boolean":"error","zod/no-empty-custom-schema":"error","zod/no-native-enum":"error","zod/no-promise-schema":"error","zod/no-throw-in-refine":"error","zod/prefer-strict-object":"error","zod/prefer-meta-last":"error","zod/require-brand-type-parameter":"error"}, files: [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/cli/**/*"], ["**/*.astro", "packages/cli/**/*"]]}),


    {languageOptions: { sourceType: "module", globals: globals["nodeBuiltin"] }, "rules": {"n/no-unsupported-features/node-builtins":["error",{"allowExperimental":true}],"n/no-unsupported-features/es-builtins":"error","n/no-deprecated-api":"error","unicorn/no-process-exit":"off","n/no-unsupported-features/es-syntax":"off","n/no-sync":"off","n/no-callback-literal":"error","n/no-new-require":"error","n/no-path-concat":"error","n/no-missing-import":"off","n/no-missing-require":"off","n/no-unpublished-import":"error","n/no-unpublished-require":"error","n/no-extraneous-import":"error","n/no-extraneous-require":"error","n/prefer-global/url-search-params":["error","always"],"n/prefer-global/url":["error","always"],"n/prefer-global/process":["error","always"],"n/prefer-global/console":["error","always"],"n/prefer-global/buffer":["error","always"],"n/no-process-exit":"error","n/prefer-promises/dns":"error","n/prefer-promises/fs":"error"}, files: [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", runtimeMatches(0)], ["**/*.astro", runtimeMatches(0)]]},

    {languageOptions: { sourceType: "commonjs", globals: globals["node"] }, "rules": {"n/no-unsupported-features/node-builtins":["error",{"allowExperimental":true}],"n/no-unsupported-features/es-builtins":"error","n/no-deprecated-api":"error","unicorn/no-process-exit":"off","n/no-unsupported-features/es-syntax":"off","n/no-sync":"off","n/no-callback-literal":"error","n/no-new-require":"error","n/no-path-concat":"error","n/no-missing-import":"off","n/no-missing-require":"off","n/no-unpublished-import":"error","n/no-unpublished-require":"error","n/no-extraneous-import":"error","n/no-extraneous-require":"error","n/prefer-global/url-search-params":["error","always"],"n/prefer-global/url":["error","always"],"n/prefer-global/process":["error","always"],"n/prefer-global/console":["error","always"],"n/prefer-global/buffer":["error","always"],"n/no-process-exit":"error","n/prefer-promises/dns":"error","n/prefer-promises/fs":"error","unicorn/prefer-module":"off"}, files: [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", runtimeMatches(1)], ["**/*.astro", runtimeMatches(1)]]},

    {languageOptions: { sourceType: "module", globals: globals["nodeBuiltin"] }, "rules": {"n/no-unsupported-features/node-builtins":["error",{"allowExperimental":true}],"n/no-unsupported-features/es-builtins":"error","n/no-deprecated-api":"error","unicorn/no-process-exit":"off","n/no-unsupported-features/es-syntax":"off","n/no-sync":"off","n/no-callback-literal":"error","n/no-new-require":"error","n/no-path-concat":"error","n/no-missing-import":"off","n/no-missing-require":"off","n/no-unpublished-import":"error","n/no-unpublished-require":"error","n/no-extraneous-import":"error","n/no-extraneous-require":"error","n/prefer-global/url-search-params":["error","always"],"n/prefer-global/url":["error","always"],"n/prefer-global/process":["error","always"],"n/prefer-global/console":["error","always"],"n/prefer-global/buffer":["error","always"],"n/no-process-exit":"error","n/prefer-promises/dns":"error","n/prefer-promises/fs":"error"}, files: [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", runtimeMatches(2)], ["**/*.astro", runtimeMatches(2)]]},

    {languageOptions: { sourceType: "commonjs", globals: globals["node"] }, "rules": {"n/no-unsupported-features/node-builtins":["error",{"allowExperimental":true}],"n/no-unsupported-features/es-builtins":"error","n/no-deprecated-api":"error","unicorn/no-process-exit":"off","n/no-unsupported-features/es-syntax":"off","n/no-sync":"off","n/no-callback-literal":"error","n/no-new-require":"error","n/no-path-concat":"error","n/no-missing-import":"off","n/no-missing-require":"off","n/no-unpublished-import":"error","n/no-unpublished-require":"error","n/no-extraneous-import":"error","n/no-extraneous-require":"error","n/prefer-global/url-search-params":["error","always"],"n/prefer-global/url":["error","always"],"n/prefer-global/process":["error","always"],"n/prefer-global/console":["error","always"],"n/prefer-global/buffer":["error","always"],"n/no-process-exit":"error","n/prefer-promises/dns":"error","n/prefer-promises/fs":"error","unicorn/prefer-module":"off"}, files: [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", runtimeMatches(3)], ["**/*.astro", runtimeMatches(3)]]},

    {languageOptions: { sourceType: "module", globals: globals["nodeBuiltin"] }, "rules": {"n/no-unsupported-features/node-builtins":["error",{"allowExperimental":true}],"n/no-unsupported-features/es-builtins":"error","n/no-deprecated-api":"error","unicorn/no-process-exit":"off","n/no-unsupported-features/es-syntax":"off","n/no-sync":"off","n/no-callback-literal":"error","n/no-new-require":"error","n/no-path-concat":"error","n/no-missing-import":"off","n/no-missing-require":"off","n/no-unpublished-import":"error","n/no-unpublished-require":"error","n/no-extraneous-import":"error","n/no-extraneous-require":"error","n/prefer-global/url-search-params":["error","always"],"n/prefer-global/url":["error","always"],"n/prefer-global/process":["error","always"],"n/prefer-global/console":["error","always"],"n/prefer-global/buffer":["error","always"],"n/no-process-exit":"error","n/prefer-promises/dns":"error","n/prefer-promises/fs":"error"}, files: [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", runtimeMatches(4)], ["**/*.astro", runtimeMatches(4)]]},

    {languageOptions: { sourceType: "commonjs", globals: globals["node"] }, "rules": {"n/no-unsupported-features/node-builtins":["error",{"allowExperimental":true}],"n/no-unsupported-features/es-builtins":"error","n/no-deprecated-api":"error","unicorn/no-process-exit":"off","n/no-unsupported-features/es-syntax":"off","n/no-sync":"off","n/no-callback-literal":"error","n/no-new-require":"error","n/no-path-concat":"error","n/no-missing-import":"off","n/no-missing-require":"off","n/no-unpublished-import":"error","n/no-unpublished-require":"error","n/no-extraneous-import":"error","n/no-extraneous-require":"error","n/prefer-global/url-search-params":["error","always"],"n/prefer-global/url":["error","always"],"n/prefer-global/process":["error","always"],"n/prefer-global/console":["error","always"],"n/prefer-global/buffer":["error","always"],"n/no-process-exit":"error","n/prefer-promises/dns":"error","n/prefer-promises/fs":"error","unicorn/prefer-module":"off"}, files: [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", runtimeMatches(5)], ["**/*.astro", runtimeMatches(5)]]},

    {languageOptions: { sourceType: "module", globals: globals["nodeBuiltin"] }, "rules": {"n/no-unsupported-features/node-builtins":["error",{"allowExperimental":true}],"n/no-unsupported-features/es-builtins":"error","n/no-deprecated-api":"error","unicorn/no-process-exit":"off","n/no-unsupported-features/es-syntax":"off","n/no-sync":"off","n/no-callback-literal":"error","n/no-new-require":"error","n/no-path-concat":"error","n/no-missing-import":"off","n/no-missing-require":"off","n/no-unpublished-import":"error","n/no-unpublished-require":"error","n/no-extraneous-import":"error","n/no-extraneous-require":"error","n/prefer-global/url-search-params":["error","always"],"n/prefer-global/url":["error","always"],"n/prefer-global/process":["error","always"],"n/prefer-global/console":["error","always"],"n/prefer-global/buffer":["error","always"],"n/no-process-exit":"error","n/prefer-promises/dns":"error","n/prefer-promises/fs":"error"}, files: [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", runtimeMatches(6)], ["**/*.astro", runtimeMatches(6)]]},

    {languageOptions: { sourceType: "commonjs", globals: globals["node"] }, "rules": {"n/no-unsupported-features/node-builtins":["error",{"allowExperimental":true}],"n/no-unsupported-features/es-builtins":"error","n/no-deprecated-api":"error","unicorn/no-process-exit":"off","n/no-unsupported-features/es-syntax":"off","n/no-sync":"off","n/no-callback-literal":"error","n/no-new-require":"error","n/no-path-concat":"error","n/no-missing-import":"off","n/no-missing-require":"off","n/no-unpublished-import":"error","n/no-unpublished-require":"error","n/no-extraneous-import":"error","n/no-extraneous-require":"error","n/prefer-global/url-search-params":["error","always"],"n/prefer-global/url":["error","always"],"n/prefer-global/process":["error","always"],"n/prefer-global/console":["error","always"],"n/prefer-global/buffer":["error","always"],"n/no-process-exit":"error","n/prefer-promises/dns":"error","n/prefer-promises/fs":"error","unicorn/prefer-module":"off"}, files: [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", runtimeMatches(7)], ["**/*.astro", runtimeMatches(7)]]},

    {languageOptions: { sourceType: "module", globals: globals["nodeBuiltin"] }, "rules": {"n/no-unsupported-features/node-builtins":["error",{"allowExperimental":true}],"n/no-unsupported-features/es-builtins":"error","n/no-deprecated-api":"error","unicorn/no-process-exit":"off","n/no-unsupported-features/es-syntax":"off","n/no-sync":"off","n/no-callback-literal":"error","n/no-new-require":"error","n/no-path-concat":"error","n/no-missing-import":"off","n/no-missing-require":"off","n/no-unpublished-import":"error","n/no-unpublished-require":"error","n/no-extraneous-import":"error","n/no-extraneous-require":"error","n/prefer-global/url-search-params":["error","always"],"n/prefer-global/url":["error","always"],"n/prefer-global/process":["error","always"],"n/prefer-global/console":["error","always"],"n/prefer-global/buffer":["error","always"],"n/no-process-exit":"error","n/prefer-promises/dns":"error","n/prefer-promises/fs":"error"}, files: [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", runtimeMatches(8)], ["**/*.astro", runtimeMatches(8)]]},

    {languageOptions: { sourceType: "commonjs", globals: globals["node"] }, "rules": {"n/no-unsupported-features/node-builtins":["error",{"allowExperimental":true}],"n/no-unsupported-features/es-builtins":"error","n/no-deprecated-api":"error","unicorn/no-process-exit":"off","n/no-unsupported-features/es-syntax":"off","n/no-sync":"off","n/no-callback-literal":"error","n/no-new-require":"error","n/no-path-concat":"error","n/no-missing-import":"off","n/no-missing-require":"off","n/no-unpublished-import":"error","n/no-unpublished-require":"error","n/no-extraneous-import":"error","n/no-extraneous-require":"error","n/prefer-global/url-search-params":["error","always"],"n/prefer-global/url":["error","always"],"n/prefer-global/process":["error","always"],"n/prefer-global/console":["error","always"],"n/prefer-global/buffer":["error","always"],"n/no-process-exit":"error","n/prefer-promises/dns":"error","n/prefer-promises/fs":"error","unicorn/prefer-module":"off"}, files: [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", runtimeMatches(9)], ["**/*.astro", runtimeMatches(9)]]},

    {"ignores": ["docs/**","packages/cli/**","packages/eslint-plugin/**","tests/**"], "rules": {"no-restricted-syntax":["error",{"selector":"TSEnumDeclaration","message":"Use a literal union or an as-const object instead of an enum."},{"selector":"TSAsExpression[expression.type=\"TSAsExpression\"]","message":"Do not assert twice. Narrow the value, improve the type, or add a typed boundary."},{"selector":"TSTypeAssertion[expression.type=\"TSTypeAssertion\"]","message":"Do not assert twice. Narrow the value, improve the type, or add a typed boundary."},{"selector":"TSAsExpression > TSAnyKeyword","message":"Do not assert to any. Add a typed boundary or runtime narrowing instead."},{"selector":"TSTypeAssertion > TSAnyKeyword","message":"Do not assert to any. Add a typed boundary or runtime narrowing instead."},{"selector":"TSAsExpression > TSNeverKeyword","message":"Do not assert to never to silence the type system."},{"selector":"TSTypeAssertion > TSNeverKeyword","message":"Do not assert to never to silence the type system."},{"selector":"LogicalExpression[operator=\"||\"][right.type=\"ObjectExpression\"][right.properties.length=0]","message":"An empty-object fallback hides a missing value. Handle the missing case."},{"selector":"LogicalExpression[operator=\"??\"][right.type=\"ObjectExpression\"][right.properties.length=0]","message":"An empty-object fallback hides a missing value. Handle the missing case."},{"selector":"NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > Literal.arguments:first-child[value=/^[a-z]/]","message":"Start an error message with a capital letter."},{"selector":"NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > TemplateLiteral.arguments:first-child[quasis.0.value.raw=/^[a-z]/]","message":"Start an error message with a capital letter."},{"selector":"CallExpression[callee.property.name=/^(debug|info|warn|error|fatal|trace)$/] > TemplateLiteral.arguments:first-child[expressions.length>0]","message":"Log a stable message and pass the values as fields."},{"selector":"ExportAllDeclaration","message":"Export values at their declaration instead of re-exporting them."},{"selector":"ExportNamedDeclaration[source!=null]","message":"Export values at their declaration instead of re-exporting them."},{"selector":":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#|@\\/)/][source.value!=/\\.[^/?.]+$/]:not([source.value=/\\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))","message":"Give an alias import its file extension."}]}, files: [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*", "packages/cli/src/system/environment.ts"], ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*", "tests/setup/environment.ts"], ["**/*.astro", "**/*", "packages/cli/src/system/environment.ts"], ["**/*.astro", "**/*", "tests/setup/environment.ts"]]},

    {"ignores": ["docs/**","packages/cli/**","packages/eslint-plugin/**","tests/**","packages/cli/src/system/environment.ts","tests/setup/environment.ts"], "rules": {"no-restricted-syntax":["error",{"selector":"TSEnumDeclaration","message":"Use a literal union or an as-const object instead of an enum."},{"selector":"TSAsExpression[expression.type=\"TSAsExpression\"]","message":"Do not assert twice. Narrow the value, improve the type, or add a typed boundary."},{"selector":"TSTypeAssertion[expression.type=\"TSTypeAssertion\"]","message":"Do not assert twice. Narrow the value, improve the type, or add a typed boundary."},{"selector":"TSAsExpression > TSAnyKeyword","message":"Do not assert to any. Add a typed boundary or runtime narrowing instead."},{"selector":"TSTypeAssertion > TSAnyKeyword","message":"Do not assert to any. Add a typed boundary or runtime narrowing instead."},{"selector":"TSAsExpression > TSNeverKeyword","message":"Do not assert to never to silence the type system."},{"selector":"TSTypeAssertion > TSNeverKeyword","message":"Do not assert to never to silence the type system."},{"selector":"LogicalExpression[operator=\"||\"][right.type=\"ObjectExpression\"][right.properties.length=0]","message":"An empty-object fallback hides a missing value. Handle the missing case."},{"selector":"LogicalExpression[operator=\"??\"][right.type=\"ObjectExpression\"][right.properties.length=0]","message":"An empty-object fallback hides a missing value. Handle the missing case."},{"selector":"NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > Literal.arguments:first-child[value=/^[a-z]/]","message":"Start an error message with a capital letter."},{"selector":"NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > TemplateLiteral.arguments:first-child[quasis.0.value.raw=/^[a-z]/]","message":"Start an error message with a capital letter."},{"selector":"CallExpression[callee.property.name=/^(debug|info|warn|error|fatal|trace)$/] > TemplateLiteral.arguments:first-child[expressions.length>0]","message":"Log a stable message and pass the values as fields."},{"selector":"ExportAllDeclaration","message":"Export values at their declaration instead of re-exporting them."},{"selector":"ExportNamedDeclaration[source!=null]","message":"Export values at their declaration instead of re-exporting them."},{"selector":"MemberExpression[object.type=\"MetaProperty\"][object.meta.name=\"import\"][object.property.name=\"meta\"][property.name=\"env\"]","message":"Read the environment in its architecture owner and pass the value to other modules."},{"selector":":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#|@\\/)/][source.value!=/\\.[^/?.]+$/]:not([source.value=/\\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))","message":"Give an alias import its file extension."}]}, files: [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*", "**/*"], ["**/*.astro", "**/*", "**/*"]]},

    {"ignores": [], "rules": {"no-restricted-syntax":["error",{"selector":"TSEnumDeclaration","message":"Use a literal union or an as-const object instead of an enum."},{"selector":"TSAsExpression[expression.type=\"TSAsExpression\"]","message":"Do not assert twice. Narrow the value, improve the type, or add a typed boundary."},{"selector":"TSTypeAssertion[expression.type=\"TSTypeAssertion\"]","message":"Do not assert twice. Narrow the value, improve the type, or add a typed boundary."},{"selector":"TSAsExpression > TSAnyKeyword","message":"Do not assert to any. Add a typed boundary or runtime narrowing instead."},{"selector":"TSTypeAssertion > TSAnyKeyword","message":"Do not assert to any. Add a typed boundary or runtime narrowing instead."},{"selector":"TSAsExpression > TSNeverKeyword","message":"Do not assert to never to silence the type system."},{"selector":"TSTypeAssertion > TSNeverKeyword","message":"Do not assert to never to silence the type system."},{"selector":"LogicalExpression[operator=\"||\"][right.type=\"ObjectExpression\"][right.properties.length=0]","message":"An empty-object fallback hides a missing value. Handle the missing case."},{"selector":"LogicalExpression[operator=\"??\"][right.type=\"ObjectExpression\"][right.properties.length=0]","message":"An empty-object fallback hides a missing value. Handle the missing case."},{"selector":"NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > Literal.arguments:first-child[value=/^[a-z]/]","message":"Start an error message with a capital letter."},{"selector":"NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > TemplateLiteral.arguments:first-child[quasis.0.value.raw=/^[a-z]/]","message":"Start an error message with a capital letter."},{"selector":"CallExpression[callee.property.name=/^(debug|info|warn|error|fatal|trace)$/] > TemplateLiteral.arguments:first-child[expressions.length>0]","message":"Log a stable message and pass the values as fields."},{"selector":"ExportAllDeclaration","message":"Export values at their declaration instead of re-exporting them."},{"selector":"ExportNamedDeclaration[source!=null]","message":"Export values at their declaration instead of re-exporting them."},{"selector":":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#|@\\/)/][source.value!=/\\.[^/?.]+$/]:not([source.value=/\\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))","message":"Give an alias import its file extension."}]}, files: [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "docs/**/*", "packages/cli/src/system/environment.ts"], ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "docs/**/*", "tests/setup/environment.ts"], ["**/*.astro", "docs/**/*", "packages/cli/src/system/environment.ts"], ["**/*.astro", "docs/**/*", "tests/setup/environment.ts"]]},

    {"ignores": ["packages/cli/src/system/environment.ts","tests/setup/environment.ts"], "rules": {"no-restricted-syntax":["error",{"selector":"TSEnumDeclaration","message":"Use a literal union or an as-const object instead of an enum."},{"selector":"TSAsExpression[expression.type=\"TSAsExpression\"]","message":"Do not assert twice. Narrow the value, improve the type, or add a typed boundary."},{"selector":"TSTypeAssertion[expression.type=\"TSTypeAssertion\"]","message":"Do not assert twice. Narrow the value, improve the type, or add a typed boundary."},{"selector":"TSAsExpression > TSAnyKeyword","message":"Do not assert to any. Add a typed boundary or runtime narrowing instead."},{"selector":"TSTypeAssertion > TSAnyKeyword","message":"Do not assert to any. Add a typed boundary or runtime narrowing instead."},{"selector":"TSAsExpression > TSNeverKeyword","message":"Do not assert to never to silence the type system."},{"selector":"TSTypeAssertion > TSNeverKeyword","message":"Do not assert to never to silence the type system."},{"selector":"LogicalExpression[operator=\"||\"][right.type=\"ObjectExpression\"][right.properties.length=0]","message":"An empty-object fallback hides a missing value. Handle the missing case."},{"selector":"LogicalExpression[operator=\"??\"][right.type=\"ObjectExpression\"][right.properties.length=0]","message":"An empty-object fallback hides a missing value. Handle the missing case."},{"selector":"NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > Literal.arguments:first-child[value=/^[a-z]/]","message":"Start an error message with a capital letter."},{"selector":"NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > TemplateLiteral.arguments:first-child[quasis.0.value.raw=/^[a-z]/]","message":"Start an error message with a capital letter."},{"selector":"CallExpression[callee.property.name=/^(debug|info|warn|error|fatal|trace)$/] > TemplateLiteral.arguments:first-child[expressions.length>0]","message":"Log a stable message and pass the values as fields."},{"selector":"ExportAllDeclaration","message":"Export values at their declaration instead of re-exporting them."},{"selector":"ExportNamedDeclaration[source!=null]","message":"Export values at their declaration instead of re-exporting them."},{"selector":"MemberExpression[object.type=\"MetaProperty\"][object.meta.name=\"import\"][object.property.name=\"meta\"][property.name=\"env\"]","message":"Read the environment in its architecture owner and pass the value to other modules."},{"selector":":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#|@\\/)/][source.value!=/\\.[^/?.]+$/]:not([source.value=/\\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))","message":"Give an alias import its file extension."}]}, files: [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "docs/**/*", "**/*"], ["**/*.astro", "docs/**/*", "**/*"]]},

    {"ignores": [], "rules": {"no-restricted-syntax":["error",{"selector":"TSEnumDeclaration","message":"Use a literal union or an as-const object instead of an enum."},{"selector":"TSAsExpression[expression.type=\"TSAsExpression\"]","message":"Do not assert twice. Narrow the value, improve the type, or add a typed boundary."},{"selector":"TSTypeAssertion[expression.type=\"TSTypeAssertion\"]","message":"Do not assert twice. Narrow the value, improve the type, or add a typed boundary."},{"selector":"TSAsExpression > TSAnyKeyword","message":"Do not assert to any. Add a typed boundary or runtime narrowing instead."},{"selector":"TSTypeAssertion > TSAnyKeyword","message":"Do not assert to any. Add a typed boundary or runtime narrowing instead."},{"selector":"TSAsExpression > TSNeverKeyword","message":"Do not assert to never to silence the type system."},{"selector":"TSTypeAssertion > TSNeverKeyword","message":"Do not assert to never to silence the type system."},{"selector":"LogicalExpression[operator=\"||\"][right.type=\"ObjectExpression\"][right.properties.length=0]","message":"An empty-object fallback hides a missing value. Handle the missing case."},{"selector":"LogicalExpression[operator=\"??\"][right.type=\"ObjectExpression\"][right.properties.length=0]","message":"An empty-object fallback hides a missing value. Handle the missing case."},{"selector":"NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > Literal.arguments:first-child[value=/^[a-z]/]","message":"Start an error message with a capital letter."},{"selector":"NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > TemplateLiteral.arguments:first-child[quasis.0.value.raw=/^[a-z]/]","message":"Start an error message with a capital letter."},{"selector":"CallExpression[callee.property.name=/^(debug|info|warn|error|fatal|trace)$/] > TemplateLiteral.arguments:first-child[expressions.length>0]","message":"Log a stable message and pass the values as fields."},{"selector":"ExportAllDeclaration","message":"Export values at their declaration instead of re-exporting them."},{"selector":"ExportNamedDeclaration[source!=null]","message":"Export values at their declaration instead of re-exporting them."},{"selector":":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#|@\\/)/][source.value!=/\\.[^/?.]+$/]:not([source.value=/\\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))","message":"Give an alias import its file extension."}]}, files: [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/cli/**/*", "packages/cli/src/system/environment.ts"], ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/cli/**/*", "tests/setup/environment.ts"], ["**/*.astro", "packages/cli/**/*", "packages/cli/src/system/environment.ts"], ["**/*.astro", "packages/cli/**/*", "tests/setup/environment.ts"]]},

    {"ignores": ["packages/cli/src/system/environment.ts","tests/setup/environment.ts"], "rules": {"no-restricted-syntax":["error",{"selector":"TSEnumDeclaration","message":"Use a literal union or an as-const object instead of an enum."},{"selector":"TSAsExpression[expression.type=\"TSAsExpression\"]","message":"Do not assert twice. Narrow the value, improve the type, or add a typed boundary."},{"selector":"TSTypeAssertion[expression.type=\"TSTypeAssertion\"]","message":"Do not assert twice. Narrow the value, improve the type, or add a typed boundary."},{"selector":"TSAsExpression > TSAnyKeyword","message":"Do not assert to any. Add a typed boundary or runtime narrowing instead."},{"selector":"TSTypeAssertion > TSAnyKeyword","message":"Do not assert to any. Add a typed boundary or runtime narrowing instead."},{"selector":"TSAsExpression > TSNeverKeyword","message":"Do not assert to never to silence the type system."},{"selector":"TSTypeAssertion > TSNeverKeyword","message":"Do not assert to never to silence the type system."},{"selector":"LogicalExpression[operator=\"||\"][right.type=\"ObjectExpression\"][right.properties.length=0]","message":"An empty-object fallback hides a missing value. Handle the missing case."},{"selector":"LogicalExpression[operator=\"??\"][right.type=\"ObjectExpression\"][right.properties.length=0]","message":"An empty-object fallback hides a missing value. Handle the missing case."},{"selector":"NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > Literal.arguments:first-child[value=/^[a-z]/]","message":"Start an error message with a capital letter."},{"selector":"NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > TemplateLiteral.arguments:first-child[quasis.0.value.raw=/^[a-z]/]","message":"Start an error message with a capital letter."},{"selector":"CallExpression[callee.property.name=/^(debug|info|warn|error|fatal|trace)$/] > TemplateLiteral.arguments:first-child[expressions.length>0]","message":"Log a stable message and pass the values as fields."},{"selector":"ExportAllDeclaration","message":"Export values at their declaration instead of re-exporting them."},{"selector":"ExportNamedDeclaration[source!=null]","message":"Export values at their declaration instead of re-exporting them."},{"selector":"MemberExpression[object.type=\"MetaProperty\"][object.meta.name=\"import\"][object.property.name=\"meta\"][property.name=\"env\"]","message":"Read the environment in its architecture owner and pass the value to other modules."},{"selector":":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#|@\\/)/][source.value!=/\\.[^/?.]+$/]:not([source.value=/\\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))","message":"Give an alias import its file extension."}]}, files: [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/cli/**/*", "**/*"], ["**/*.astro", "packages/cli/**/*", "**/*"]]},

    {"ignores": [], "rules": {"no-restricted-syntax":["error",{"selector":"TSEnumDeclaration","message":"Use a literal union or an as-const object instead of an enum."},{"selector":"TSAsExpression[expression.type=\"TSAsExpression\"]","message":"Do not assert twice. Narrow the value, improve the type, or add a typed boundary."},{"selector":"TSTypeAssertion[expression.type=\"TSTypeAssertion\"]","message":"Do not assert twice. Narrow the value, improve the type, or add a typed boundary."},{"selector":"TSAsExpression > TSAnyKeyword","message":"Do not assert to any. Add a typed boundary or runtime narrowing instead."},{"selector":"TSTypeAssertion > TSAnyKeyword","message":"Do not assert to any. Add a typed boundary or runtime narrowing instead."},{"selector":"TSAsExpression > TSNeverKeyword","message":"Do not assert to never to silence the type system."},{"selector":"TSTypeAssertion > TSNeverKeyword","message":"Do not assert to never to silence the type system."},{"selector":"LogicalExpression[operator=\"||\"][right.type=\"ObjectExpression\"][right.properties.length=0]","message":"An empty-object fallback hides a missing value. Handle the missing case."},{"selector":"LogicalExpression[operator=\"??\"][right.type=\"ObjectExpression\"][right.properties.length=0]","message":"An empty-object fallback hides a missing value. Handle the missing case."},{"selector":"NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > Literal.arguments:first-child[value=/^[a-z]/]","message":"Start an error message with a capital letter."},{"selector":"NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > TemplateLiteral.arguments:first-child[quasis.0.value.raw=/^[a-z]/]","message":"Start an error message with a capital letter."},{"selector":"CallExpression[callee.property.name=/^(debug|info|warn|error|fatal|trace)$/] > TemplateLiteral.arguments:first-child[expressions.length>0]","message":"Log a stable message and pass the values as fields."},{"selector":"ExportAllDeclaration","message":"Export values at their declaration instead of re-exporting them."},{"selector":"ExportNamedDeclaration[source!=null]","message":"Export values at their declaration instead of re-exporting them."},{"selector":":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#|@\\/)/][source.value!=/\\.[^/?.]+$/]:not([source.value=/\\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))","message":"Give an alias import its file extension."}]}, files: [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/eslint-plugin/**/*", "packages/cli/src/system/environment.ts"], ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/eslint-plugin/**/*", "tests/setup/environment.ts"], ["**/*.astro", "packages/eslint-plugin/**/*", "packages/cli/src/system/environment.ts"], ["**/*.astro", "packages/eslint-plugin/**/*", "tests/setup/environment.ts"]]},

    {"ignores": ["packages/cli/src/system/environment.ts","tests/setup/environment.ts"], "rules": {"no-restricted-syntax":["error",{"selector":"TSEnumDeclaration","message":"Use a literal union or an as-const object instead of an enum."},{"selector":"TSAsExpression[expression.type=\"TSAsExpression\"]","message":"Do not assert twice. Narrow the value, improve the type, or add a typed boundary."},{"selector":"TSTypeAssertion[expression.type=\"TSTypeAssertion\"]","message":"Do not assert twice. Narrow the value, improve the type, or add a typed boundary."},{"selector":"TSAsExpression > TSAnyKeyword","message":"Do not assert to any. Add a typed boundary or runtime narrowing instead."},{"selector":"TSTypeAssertion > TSAnyKeyword","message":"Do not assert to any. Add a typed boundary or runtime narrowing instead."},{"selector":"TSAsExpression > TSNeverKeyword","message":"Do not assert to never to silence the type system."},{"selector":"TSTypeAssertion > TSNeverKeyword","message":"Do not assert to never to silence the type system."},{"selector":"LogicalExpression[operator=\"||\"][right.type=\"ObjectExpression\"][right.properties.length=0]","message":"An empty-object fallback hides a missing value. Handle the missing case."},{"selector":"LogicalExpression[operator=\"??\"][right.type=\"ObjectExpression\"][right.properties.length=0]","message":"An empty-object fallback hides a missing value. Handle the missing case."},{"selector":"NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > Literal.arguments:first-child[value=/^[a-z]/]","message":"Start an error message with a capital letter."},{"selector":"NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > TemplateLiteral.arguments:first-child[quasis.0.value.raw=/^[a-z]/]","message":"Start an error message with a capital letter."},{"selector":"CallExpression[callee.property.name=/^(debug|info|warn|error|fatal|trace)$/] > TemplateLiteral.arguments:first-child[expressions.length>0]","message":"Log a stable message and pass the values as fields."},{"selector":"ExportAllDeclaration","message":"Export values at their declaration instead of re-exporting them."},{"selector":"ExportNamedDeclaration[source!=null]","message":"Export values at their declaration instead of re-exporting them."},{"selector":"MemberExpression[object.type=\"MetaProperty\"][object.meta.name=\"import\"][object.property.name=\"meta\"][property.name=\"env\"]","message":"Read the environment in its architecture owner and pass the value to other modules."},{"selector":":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#|@\\/)/][source.value!=/\\.[^/?.]+$/]:not([source.value=/\\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))","message":"Give an alias import its file extension."}]}, files: [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/eslint-plugin/**/*", "**/*"], ["**/*.astro", "packages/eslint-plugin/**/*", "**/*"]]},

    {"ignores": [], "rules": {"no-restricted-syntax":["error",{"selector":"TSEnumDeclaration","message":"Use a literal union or an as-const object instead of an enum."},{"selector":"TSAsExpression[expression.type=\"TSAsExpression\"]","message":"Do not assert twice. Narrow the value, improve the type, or add a typed boundary."},{"selector":"TSTypeAssertion[expression.type=\"TSTypeAssertion\"]","message":"Do not assert twice. Narrow the value, improve the type, or add a typed boundary."},{"selector":"TSAsExpression > TSAnyKeyword","message":"Do not assert to any. Add a typed boundary or runtime narrowing instead."},{"selector":"TSTypeAssertion > TSAnyKeyword","message":"Do not assert to any. Add a typed boundary or runtime narrowing instead."},{"selector":"TSAsExpression > TSNeverKeyword","message":"Do not assert to never to silence the type system."},{"selector":"TSTypeAssertion > TSNeverKeyword","message":"Do not assert to never to silence the type system."},{"selector":"LogicalExpression[operator=\"||\"][right.type=\"ObjectExpression\"][right.properties.length=0]","message":"An empty-object fallback hides a missing value. Handle the missing case."},{"selector":"LogicalExpression[operator=\"??\"][right.type=\"ObjectExpression\"][right.properties.length=0]","message":"An empty-object fallback hides a missing value. Handle the missing case."},{"selector":"NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > Literal.arguments:first-child[value=/^[a-z]/]","message":"Start an error message with a capital letter."},{"selector":"NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > TemplateLiteral.arguments:first-child[quasis.0.value.raw=/^[a-z]/]","message":"Start an error message with a capital letter."},{"selector":"CallExpression[callee.property.name=/^(debug|info|warn|error|fatal|trace)$/] > TemplateLiteral.arguments:first-child[expressions.length>0]","message":"Log a stable message and pass the values as fields."},{"selector":"ExportAllDeclaration","message":"Export values at their declaration instead of re-exporting them."},{"selector":"ExportNamedDeclaration[source!=null]","message":"Export values at their declaration instead of re-exporting them."},{"selector":":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#|@\\/)/][source.value!=/\\.[^/?.]+$/]:not([source.value=/\\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))","message":"Give an alias import its file extension."}]}, files: [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "tests/**/*", "packages/cli/src/system/environment.ts"], ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "tests/**/*", "tests/setup/environment.ts"], ["**/*.astro", "tests/**/*", "packages/cli/src/system/environment.ts"], ["**/*.astro", "tests/**/*", "tests/setup/environment.ts"]]},

    {"ignores": ["packages/cli/src/system/environment.ts","tests/setup/environment.ts"], "rules": {"no-restricted-syntax":["error",{"selector":"TSEnumDeclaration","message":"Use a literal union or an as-const object instead of an enum."},{"selector":"TSAsExpression[expression.type=\"TSAsExpression\"]","message":"Do not assert twice. Narrow the value, improve the type, or add a typed boundary."},{"selector":"TSTypeAssertion[expression.type=\"TSTypeAssertion\"]","message":"Do not assert twice. Narrow the value, improve the type, or add a typed boundary."},{"selector":"TSAsExpression > TSAnyKeyword","message":"Do not assert to any. Add a typed boundary or runtime narrowing instead."},{"selector":"TSTypeAssertion > TSAnyKeyword","message":"Do not assert to any. Add a typed boundary or runtime narrowing instead."},{"selector":"TSAsExpression > TSNeverKeyword","message":"Do not assert to never to silence the type system."},{"selector":"TSTypeAssertion > TSNeverKeyword","message":"Do not assert to never to silence the type system."},{"selector":"LogicalExpression[operator=\"||\"][right.type=\"ObjectExpression\"][right.properties.length=0]","message":"An empty-object fallback hides a missing value. Handle the missing case."},{"selector":"LogicalExpression[operator=\"??\"][right.type=\"ObjectExpression\"][right.properties.length=0]","message":"An empty-object fallback hides a missing value. Handle the missing case."},{"selector":"NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > Literal.arguments:first-child[value=/^[a-z]/]","message":"Start an error message with a capital letter."},{"selector":"NewExpression[callee.name=/Error$/]:matches([arguments.length=1], [arguments.1.type=\"ObjectExpression\"]) > TemplateLiteral.arguments:first-child[quasis.0.value.raw=/^[a-z]/]","message":"Start an error message with a capital letter."},{"selector":"CallExpression[callee.property.name=/^(debug|info|warn|error|fatal|trace)$/] > TemplateLiteral.arguments:first-child[expressions.length>0]","message":"Log a stable message and pass the values as fields."},{"selector":"ExportAllDeclaration","message":"Export values at their declaration instead of re-exporting them."},{"selector":"ExportNamedDeclaration[source!=null]","message":"Export values at their declaration instead of re-exporting them."},{"selector":"MemberExpression[object.type=\"MetaProperty\"][object.meta.name=\"import\"][object.property.name=\"meta\"][property.name=\"env\"]","message":"Read the environment in its architecture owner and pass the value to other modules."},{"selector":":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=/^(#|@\\/)/][source.value!=/\\.[^/?.]+$/]:not([source.value=/\\?/]):not(:has(ImportAttribute:matches([key.name='type'],[key.value='type'])[value.value='json']))","message":"Give an alias import its file extension."}]}, files: [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "tests/**/*", "**/*"], ["**/*.astro", "tests/**/*", "**/*"]]},

    {"ignores": ["**/test/**","**/tests/**","**/__tests__/**","**/*.test.*","**/*.spec.*","**/test_*.py","**/*_test.py","**/conftest.py","**/Tests/**","**/*Tests.swift","scripts/**","**/*.config.{js,mjs,cjs,ts}",".mise/tasks/**"], "rules": {"no-console":"error"}, files: ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*.astro"]},

    {"rules": {"n/no-process-exit":"off","unicorn/no-process-exit":"off"}, files: [["scripts/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["scripts/**", "**/*.astro"], ["**/*.config.{js,mjs,cjs,ts}", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["**/*.config.{js,mjs,cjs,ts}", "**/*.astro"], [".mise/tasks/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], [".mise/tasks/**", "**/*.astro"]]},

    {"rules": {"jsdoc/require-jsdoc":"off","jsdoc/require-param":"off","jsdoc/require-returns":"off","jsdoc/require-description":"off","jsdoc/require-param-description":"off","jsdoc/require-returns-description":"off","n/no-unpublished-import":"off","n/no-unpublished-require":"off"}, files: [["**/test/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["**/test/**", "**/*.astro"], ["**/tests/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["**/tests/**", "**/*.astro"], ["**/__tests__/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["**/__tests__/**", "**/*.astro"], ["**/*.test.*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["**/*.test.*", "**/*.astro"], ["**/*.spec.*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["**/*.spec.*", "**/*.astro"], ["**/test_*.py", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["**/test_*.py", "**/*.astro"], ["**/*_test.py", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["**/*_test.py", "**/*.astro"], ["**/conftest.py", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["**/conftest.py", "**/*.astro"], ["**/Tests/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["**/Tests/**", "**/*.astro"], ["**/*Tests.swift", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"], ["**/*Tests.swift", "**/*.astro"]]},

    {...packageJson["configs"]["recommended"], rules: { ...packageJson["configs"]["recommended"].rules }, files: ["**/package.json"]},

    {...prettierConfig, rules: { ...prettierConfig.rules }, files: ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*.astro"]},

    {"rules": {"package-json/restrict-dependency-ranges":["error",{"rangeType":"pin"}]}, files: ["**/package.json"]},

    {"rules": {"max-params":["error",7]}, files: ["**/*.{js,mjs,cjs,jsx}"]},

    {"ignores": ["packages/cli/src/system/environment.ts","packages/cli/src/system/environment.ts/**","tests/setup/environment.ts","tests/setup/environment.ts/**"], "rules": {"n/no-process-env":["error",{"allowedVariables":["NODE_ENV"]}],"no-restricted-properties":["error",{"object":"Bun","property":"env"},{"object":"Deno","property":"env"}]}, files: [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,vue,svelte,astro}"], ["**/*.astro", "**/*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,vue,svelte,astro}"]]},

    {"ignores": [], "rules": {"gspot/no-trivial-files":"off"}, files: [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "docs/**/*", "**/*.astro"], ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "docs/**/*", "**/*.astro/*.ts"], ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "docs/**/*", "**/*.astro/*.js"], ["**/*.astro", "docs/**/*", "**/*.astro"], ["**/*.astro", "docs/**/*", "**/*.astro/*.ts"], ["**/*.astro", "docs/**/*", "**/*.astro/*.js"]]},

    {"ignores": [], "rules": {"@typescript-eslint/no-magic-numbers":"off"}, files: [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*", "tests/config/**"], ["**/*.astro", "**/*", "tests/config/**"]]},

    {"ignores": [], "rules": {"package-json/restrict-dependency-ranges":"off"}, files: [["**/package.json", "**/*", "packages/eslint-plugin/package.json"], ["**/package.json", "**/*", "packages/eslint-plugin/package.json/**"]]},

    {"ignores": [], "rules": {"package-json/specify-peers-locally":"off"}, files: [["**/package.json", "**/*", "packages/eslint-plugin/package.json"], ["**/package.json", "**/*", "packages/eslint-plugin/package.json/**"]]},

];
