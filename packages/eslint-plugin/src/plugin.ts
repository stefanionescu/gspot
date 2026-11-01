import type { RuleDocs } from './types/plugin.ts';
import { PLUGIN_PREFIX } from './config/plugin.ts';
import { noInMisuse } from './rules/no-in-misuse.ts';
import { tableHeader } from './rules/table-header.ts';
import { noClientEnv } from './rules/no-client-env.ts';
import { noVueMixins } from './rules/no-vue-mixins.ts';
import { awsRules, securityRules } from './security.ts';
import { noGlobalThis } from './rules/no-global-this.ts';
import { noTryPromise } from './rules/no-try-promise.ts';
import { useTypeAlias } from './rules/use-type-alias.ts';
import { preferLiteral } from './rules/prefer-literal.ts';
import { noPathCommand } from './rules/no-path-command.ts';
import { noSmallSwitch } from './rules/no-small-switch.ts';
import { noTestRetries } from './rules/no-test-retries.ts';
import { maxSwitchCases } from './rules/max-switch-cases.ts';
import { noCompoundCase } from './rules/no-compound-case.ts';
import { noDetachedCall } from './rules/no-detached-call.ts';
import { noIgnoredCatch } from './rules/no-ignored-catch.ts';
import { noIndexImports } from './rules/no-index-imports.ts';
import { noMagicNumbers } from './rules/no-magic-numbers.ts';
import { noNestedSwitch } from './rules/no-nested-switch.ts';
import { noTrivialFiles } from './rules/no-trivial-files.ts';
import { testHooksFirst } from './rules/test-hooks-first.ts';
import { noCommentedCode } from './rules/no-commented-code.ts';
import { noGeneratedKeys } from './rules/no-generated-keys.ts';
import { noIgnoredReturn } from './rules/no-ignored-return.ts';
import { noStatefulRegex } from './rules/no-stateful-regex.ts';
import { noUnthrownError } from './rules/no-unthrown-error.ts';
import { preferTestTable } from './rules/prefer-test-table.ts';
import { preferTypeGuard } from './rules/prefer-type-guard.ts';
import { importBoundaries } from './rules/import-boundaries.ts';
import { noCodeAfterDone } from './rules/no-code-after-done.ts';
import { noEmptyTestFile } from './rules/no-empty-test-file.ts';
import { noTableAsLayout } from './rules/no-table-as-layout.ts';
import { restrictedSyntax } from './rules/restricted-syntax.ts';
import { noExclusiveTests } from './rules/no-exclusive-tests.ts';
import { noInsecureRandom } from './rules/no-insecure-random.ts';
import { noRenamedExports } from './rules/no-renamed-exports.ts';
import pluginPackage from '../package.json' with { type: 'json' };
import { noEmptyTestTable } from './rules/no-empty-test-table.ts';
import { noFixedTestWaits } from './rules/no-fixed-test-waits.ts';
import { noEmptyCollection } from './rules/no-empty-collection.ts';
import { noEmptyRepetition } from './rules/no-empty-repetition.ts';
import { noInsecureCookies } from './rules/no-insecure-cookies.ts';
import { noNestedFunctions } from './rules/no-nested-functions.ts';
import { preferNativeAxios } from './rules/prefer-native-axios.ts';
import { requireMemoizeKey } from './rules/require-memoize-key.ts';
import { requireServerOnly } from './rules/require-server-only.ts';
import { noEarlyTestReturn } from './rules/no-early-test-return.ts';
import { noEmptyTestTitles } from './rules/no-empty-test-titles.ts';
import { noForcedUiActions } from './rules/no-forced-ui-actions.ts';
import { noLeakedJsxNumber } from './rules/no-leaked-jsx-number.ts';
import { noPoweredByHeader } from './rules/no-powered-by-header.ts';
import { noSelfStateUpdate } from './rules/no-self-state-update.ts';
import { noUiTestDebugging } from './rules/no-ui-test-debugging.ts';
import { maxRegexComplexity } from './rules/max-regex-complexity.ts';
import { noAmbiguousAnchors } from './rules/no-ambiguous-anchors.ts';
import { noAsyncConstructor } from './rules/no-async-constructor.ts';
import { noDiscardedPostfix } from './rules/no-discarded-postfix.ts';
import { noElementOverwrite } from './rules/no-element-overwrite.ts';
import { noGlobalsShadowing } from './rules/no-globals-shadowing.ts';
import { noInvariantReturns } from './rules/no-invariant-returns.ts';
import { noRedundantBoolean } from './rules/no-redundant-boolean.ts';
import { noSwappedArguments } from './rules/no-swapped-arguments.ts';
import { noTrivialFunctions } from './rules/no-trivial-functions.ts';
import { noUnusedCollection } from './rules/no-unused-collection.ts';
import { preferNativeJquery } from './rules/prefer-native-jquery.ts';
import { reduceInitialValue } from './rules/reduce-initial-value.ts';
import { requireErrorChecks } from './rules/require-error-checks.ts';
import { noEmptyReturnValue } from './rules/no-empty-return-value.ts';
import { noMixedReturnTypes } from './rules/no-mixed-return-types.ts';
import { noNestedVitestMock } from './rules/no-nested-vitest-mock.ts';
import { noSwitchCaseLabels } from './rules/no-switch-case-labels.ts';
import { noVueUpdatedWrites } from './rules/no-vue-updated-writes.ts';
import { noComponentDebounce } from './rules/no-component-debounce.ts';
import { noIdenticalOperands } from './rules/no-identical-operands.ts';
import { noNegatedComparison } from './rules/no-negated-comparison.ts';
import { noRedundantOptional } from './rules/no-redundant-optional.ts';
import { noSelectorParameter } from './rules/no-selector-parameter.ts';
import { noUndefinedArgument } from './rules/no-undefined-argument.ts';
import { preferBooleanReturn } from './rules/prefer-boolean-return.ts';
import { preferReadonlyProps } from './rules/prefer-readonly-props.ts';
import { noCommentsInImports } from './rules/no-comments-in-imports.ts';
import { noDuplicateTestRows } from './rules/no-duplicate-test-rows.ts';
import { noSetterInComponent } from './rules/no-setter-in-component.ts';
import { noUnknownRegexGroup } from './rules/no-unknown-regex-group.ts';
import { noVoidArrayCallback } from './rules/no-void-array-callback.ts';
import { embedAlternativeText } from './rules/embed-alternative-text.ts';
import { noConstantAssertions } from './rules/no-constant-assertions.ts';
import { noDuplicatedBranches } from './rules/no-duplicated-branches.ts';
import { noIdenticalFunctions } from './rules/no-identical-functions.ts';
import { noInvertedAssertions } from './rules/no-inverted-assertions.ts';
import { preferReadonlyStatic } from './rules/prefer-readonly-static.ts';
import { redundantTypeAliases } from './rules/redundant-type-aliases.ts';
import { tableHeaderReference } from './rules/table-header-reference.ts';
import { validThrowAssertions } from './rules/valid-throw-assertions.ts';
import { noBitwiseInCondition } from './rules/no-bitwise-in-condition.ts';
import { noEqualLoopCondition } from './rules/no-equal-loop-condition.ts';
import { noLazyBeforeOptional } from './rules/no-lazy-before-optional.ts';
import { noPositiveIndexCheck } from './rules/no-positive-index-check.ts';
import { noStringRegexPattern } from './rules/no-string-regex-pattern.ts';
import { noUpdatedLoopCounter } from './rules/no-updated-loop-counter.ts';
import { noVueClassComponents } from './rules/no-vue-class-components.ts';
import { noInlineInterpolation } from './rules/no-inline-interpolation.ts';
import { noKeywordDeclarations } from './rules/no-keyword-declarations.ts';
import { noMisplacedAssertions } from './rules/no-misplaced-assertions.ts';
import { noRedundantAssignment } from './rules/no-redundant-assignment.ts';
import { noUselessIntersection } from './rules/no-useless-intersection.ts';
import { preferImmediateReturn } from './rules/prefer-immediate-return.ts';
import { requireTestAssertions } from './rules/require-test-assertions.ts';
import { testingLibraryQueries } from './rules/testing-library-queries.ts';
import { noAdjacentMultilineIf } from './rules/no-adjacent-multiline-if.ts';
import { noAsyncSuiteCallbacks } from './rules/no-async-suite-callbacks.ts';
import { noDuplicateTestTitles } from './rules/no-duplicate-test-titles.ts';
import { noExcessCallArguments } from './rules/no-excess-call-arguments.ts';
import { noPublicTemporaryPath } from './rules/no-public-temporary-path.ts';
import { noUnvalidatedJsonBody } from './rules/no-unvalidated-json-body.ts';
import { noIncompleteAssertions } from './rules/no-incomplete-assertions.ts';
import { noTransposedAssignment } from './rules/no-transposed-assignment.ts';
import { preferPromiseShorthand } from './rules/prefer-promise-shorthand.ts';
import { noDuplicateInComposite } from './rules/no-duplicate-in-composite.ts';
import { noMisplacedLoopCounter } from './rules/no-misplaced-loop-counter.ts';
import { noShallowCloneMutation } from './rules/no-shallow-clone-mutation.ts';
import { noUnexplainedTestSkips } from './rules/no-unexplained-test-skips.ts';
import { noGratuitousExpressions } from './rules/no-gratuitous-expressions.ts';
import { preferMatcherAssertions } from './rules/prefer-matcher-assertions.ts';
import { noCypressThenAssertions } from './rules/no-cypress-then-assertions.ts';
import { noDefaultUtilityImports } from './rules/no-default-utility-imports.ts';
import { noFloatingPointEquality } from './rules/no-floating-point-equality.ts';
import { noUnsafeSanitizerBypass } from './rules/no-unsafe-sanitizer-bypass.ts';
import { noUnsafeSecurityHeaders } from './rules/no-unsafe-security-headers.ts';
import { noMisleadingArrayReverse } from './rules/no-misleading-array-reverse.ts';
import { noNestedTemplateLiterals } from './rules/no-nested-template-literals.ts';
import { noOverflowingTestTimeout } from './rules/no-overflowing-test-timeout.ts';
import { noSelfComparingAssertions } from './rules/no-self-comparing-assertions.ts';
import { noUncertainChaiAssertions } from './rules/no-uncertain-chai-assertions.ts';
import { noImpossibleCollectionSize } from './rules/no-impossible-collection-size.ts';
import { noInconsistentFunctionCall } from './rules/no-inconsistent-function-call.ts';
import { noMismatchedAssertionTypes } from './rules/no-mismatched-assertion-types.ts';
import { noUnenclosedMultilineBlock } from './rules/no-unenclosed-multiline-block.ts';

const rules = {
    ...securityRules,
    ...awsRules,
    'no-void-array-callback': noVoidArrayCallback,
    'no-redundant-assignment': noRedundantAssignment,
    'no-shallow-clone-mutation': noShallowCloneMutation,
    'no-mixed-return-types': noMixedReturnTypes,
    'no-selector-parameter': noSelectorParameter,
    'no-swapped-arguments': noSwappedArguments,
    'no-gratuitous-expressions': noGratuitousExpressions,
    'no-unused-collection': noUnusedCollection,
    'no-empty-collection': noEmptyCollection,
    'no-identical-functions': noIdenticalFunctions,
    'no-unknown-regex-group': noUnknownRegexGroup,
    'no-stateful-regex': noStatefulRegex,
    'no-lazy-before-optional': noLazyBeforeOptional,
    'max-regex-complexity': maxRegexComplexity,
    'no-ambiguous-anchors': noAmbiguousAnchors,
    'no-empty-repetition': noEmptyRepetition,
    'no-string-regex-pattern': noStringRegexPattern,
    'no-useless-intersection': noUselessIntersection,
    'no-redundant-optional': noRedundantOptional,
    'prefer-promise-shorthand': preferPromiseShorthand,
    'prefer-type-guard': preferTypeGuard,
    'use-type-alias': useTypeAlias,
    'no-duplicate-in-composite': noDuplicateInComposite,
    'no-ignored-return': noIgnoredReturn,
    'no-misleading-array-reverse': noMisleadingArrayReverse,
    'no-positive-index-check': noPositiveIndexCheck,
    'no-async-constructor': noAsyncConstructor,
    'no-try-promise': noTryPromise,
    'reduce-initial-value': reduceInitialValue,
    'no-undefined-argument': noUndefinedArgument,
    'no-in-misuse': noInMisuse,
    'no-globals-shadowing': noGlobalsShadowing,
    'no-nested-functions': noNestedFunctions,
    'no-inconsistent-function-call': noInconsistentFunctionCall,
    'no-invariant-returns': noInvariantReturns,
    'no-element-overwrite': noElementOverwrite,
    'no-unenclosed-multiline-block': noUnenclosedMultilineBlock,
    'no-updated-loop-counter': noUpdatedLoopCounter,
    'no-misplaced-loop-counter': noMisplacedLoopCounter,
    'no-duplicated-branches': noDuplicatedBranches,
    'no-bitwise-in-condition': noBitwiseInCondition,
    'no-floating-point-equality': noFloatingPointEquality,
    'no-equal-loop-condition': noEqualLoopCondition,
    'no-small-switch': noSmallSwitch,
    'require-memoize-key': requireMemoizeKey,
    'prefer-native-jquery': preferNativeJquery,
    'prefer-native-axios': preferNativeAxios,
    'no-constant-assertions': noConstantAssertions,
    'prefer-matcher-assertions': preferMatcherAssertions,
    'no-mismatched-assertion-types': noMismatchedAssertionTypes,
    'valid-throw-assertions': validThrowAssertions,
    'require-test-assertions': requireTestAssertions,
    'no-misplaced-assertions': noMisplacedAssertions,
    'no-cypress-then-assertions': noCypressThenAssertions,
    'no-component-debounce': noComponentDebounce,
    'prefer-readonly-props': preferReadonlyProps,
    'no-vue-updated-writes': noVueUpdatedWrites,
    'no-setter-in-component': noSetterInComponent,
    'no-self-state-update': noSelfStateUpdate,
    'no-generated-keys': noGeneratedKeys,
    'no-leaked-jsx-number': noLeakedJsxNumber,
    'no-vue-class-components': noVueClassComponents,
    'no-vue-mixins': noVueMixins,
    'no-default-utility-imports': noDefaultUtilityImports,
    'no-unvalidated-json-body': noUnvalidatedJsonBody,
    'no-incomplete-assertions': noIncompleteAssertions,
    'no-inverted-assertions': noInvertedAssertions,
    'no-self-comparing-assertions': noSelfComparingAssertions,
    'require-error-checks': requireErrorChecks,
    'no-uncertain-chai-assertions': noUncertainChaiAssertions,
    'no-ui-test-debugging': noUiTestDebugging,
    'no-forced-ui-actions': noForcedUiActions,
    'testing-library-queries': testingLibraryQueries,
    'no-async-suite-callbacks': noAsyncSuiteCallbacks,
    'no-code-after-done': noCodeAfterDone,
    'no-overflowing-test-timeout': noOverflowingTestTimeout,
    'no-test-retries': noTestRetries,
    'no-inline-interpolation': noInlineInterpolation,
    'no-nested-vitest-mock': noNestedVitestMock,
    'no-empty-test-table': noEmptyTestTable,
    'no-duplicate-test-rows': noDuplicateTestRows,
    'prefer-test-table': preferTestTable,
    'no-empty-test-file': noEmptyTestFile,
    'no-exclusive-tests': noExclusiveTests,
    'no-unexplained-test-skips': noUnexplainedTestSkips,
    'no-early-test-return': noEarlyTestReturn,
    'no-empty-test-titles': noEmptyTestTitles,
    'no-duplicate-test-titles': noDuplicateTestTitles,
    'test-hooks-first': testHooksFirst,
    'no-discarded-postfix': noDiscardedPostfix,
    'no-ignored-catch': noIgnoredCatch,
    'no-keyword-declarations': noKeywordDeclarations,
    'no-adjacent-multiline-if': noAdjacentMultilineIf,
    'no-detached-call': noDetachedCall,
    'no-redundant-boolean': noRedundantBoolean,
    'no-compound-case': noCompoundCase,
    'no-unsafe-sanitizer-bypass': noUnsafeSanitizerBypass,
    'no-path-command': noPathCommand,
    'no-public-temporary-path': noPublicTemporaryPath,
    'no-identical-operands': noIdenticalOperands,
    'no-global-this': noGlobalThis,
    'no-negated-comparison': noNegatedComparison,
    'prefer-boolean-return': preferBooleanReturn,
    'no-fixed-test-waits': noFixedTestWaits,
    'no-impossible-collection-size': noImpossibleCollectionSize,
    'no-excess-call-arguments': noExcessCallArguments,
    'no-empty-return-value': noEmptyReturnValue,
    'max-switch-cases': maxSwitchCases,
    'no-unthrown-error': noUnthrownError,
    'no-transposed-assignment': noTransposedAssignment,
    'no-nested-template-literals': noNestedTemplateLiterals,
    'no-switch-case-labels': noSwitchCaseLabels,
    'prefer-readonly-static': preferReadonlyStatic,
    'no-comments-in-imports': noCommentsInImports,
    'no-client-env': noClientEnv,
    'no-powered-by-header': noPoweredByHeader,
    'no-insecure-random': noInsecureRandom,
    'no-unsafe-security-headers': noUnsafeSecurityHeaders,
    'no-insecure-cookies': noInsecureCookies,
    'import-boundaries': importBoundaries,
    'no-renamed-exports': noRenamedExports,
    'no-index-imports': noIndexImports,
    'no-magic-numbers': noMagicNumbers,
    'no-trivial-files': noTrivialFiles,
    'no-nested-switch': noNestedSwitch,
    'prefer-object-literal': preferLiteral,
    'prefer-immediate-return': preferImmediateReturn,
    'redundant-type-aliases': redundantTypeAliases,
    'no-commented-code': noCommentedCode,
    'no-trivial-functions': noTrivialFunctions,
    'restricted-syntax': restrictedSyntax,
    'require-server-only': requireServerOnly,
    'table-header': tableHeader,
    'table-header-reference': tableHeaderReference,
    'no-table-as-layout': noTableAsLayout,
    'embed-alternative-text': embedAlternativeText,
};

const selectLevelRules = (levels: readonly RuleDocs['level'][]) =>
    Object.fromEntries(
        Object.entries(rules)
            .filter(([, rule]) => rule.meta.docs !== undefined && levels.includes(rule.meta.docs.level))
            .map(([name]) => [`${PLUGIN_PREFIX}/${name}`, 'error' as const]),
    );

const plugin = {
    meta: { name: pluginPackage.name, version: pluginPackage.version },
    rules,
};

export default Object.assign(plugin, {
    configs: {
        recommended: {
            name: `${PLUGIN_PREFIX}/recommended`,
            plugins: { [PLUGIN_PREFIX]: plugin },
            rules: selectLevelRules(['recommended']),
        },
        all: {
            name: `${PLUGIN_PREFIX}/all`,
            plugins: { [PLUGIN_PREFIX]: plugin },
            rules: selectLevelRules(['recommended', 'all']),
        },
    },
});
