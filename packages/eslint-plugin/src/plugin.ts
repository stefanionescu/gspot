import type { RuleDocs } from './types/plugin.ts';
import { PLUGIN_PREFIX } from './config/plugin.ts';
import { noInMisuse } from './rules/no-in-misuse.ts';
import { noClientEnv } from './rules/no-client-env.ts';
import { noGlobalThis } from './rules/no-global-this.ts';
import { noTryPromise } from './rules/no-try-promise.ts';
import { preferLiteral } from './rules/prefer-literal.ts';
import { noPathCommand } from './rules/no-path-command.ts';
import { noSmallSwitch } from './rules/no-small-switch.ts';
import { maxSwitchCases } from './rules/max-switch-cases.ts';
import { noCompoundCase } from './rules/no-compound-case.ts';
import { noDetachedCall } from './rules/no-detached-call.ts';
import { noIgnoredCatch } from './rules/no-ignored-catch.ts';
import { noIndexImports } from './rules/no-index-imports.ts';
import { noMagicNumbers } from './rules/no-magic-numbers.ts';
import { noNestedSwitch } from './rules/no-nested-switch.ts';
import { noTrivialFiles } from './rules/no-trivial-files.ts';
import { noCommentedCode } from './rules/no-commented-code.ts';
import { noIgnoredReturn } from './rules/no-ignored-return.ts';
import { noUnthrownError } from './rules/no-unthrown-error.ts';
import { importBoundaries } from './rules/import-boundaries.ts';
import { noInsecureRandom } from './rules/no-insecure-random.ts';
import { noRenamedExports } from './rules/no-renamed-exports.ts';
import pluginPackage from '../package.json' with { type: 'json' };
import { noFixedTestWaits } from './rules/no-fixed-test-waits.ts';
import { noInsecureCookies } from './rules/no-insecure-cookies.ts';
import { noNestedFunctions } from './rules/no-nested-functions.ts';
import { requireServerOnly } from './rules/require-server-only.ts';
import { noPoweredByHeader } from './rules/no-powered-by-header.ts';
import { noAsyncConstructor } from './rules/no-async-constructor.ts';
import { noDiscardedPostfix } from './rules/no-discarded-postfix.ts';
import { noElementOverwrite } from './rules/no-element-overwrite.ts';
import { noGlobalsShadowing } from './rules/no-globals-shadowing.ts';
import { noInvariantReturns } from './rules/no-invariant-returns.ts';
import { noRedundantBoolean } from './rules/no-redundant-boolean.ts';
import { noTrivialFunctions } from './rules/no-trivial-functions.ts';
import { reduceInitialValue } from './rules/reduce-initial-value.ts';
import { noEmptyReturnValue } from './rules/no-empty-return-value.ts';
import { noSwitchCaseLabels } from './rules/no-switch-case-labels.ts';
import { noIdenticalOperands } from './rules/no-identical-operands.ts';
import { noNegatedComparison } from './rules/no-negated-comparison.ts';
import { noUndefinedArgument } from './rules/no-undefined-argument.ts';
import { preferBooleanReturn } from './rules/prefer-boolean-return.ts';
import { noCommentsInImports } from './rules/no-comments-in-imports.ts';
import { noDuplicatedBranches } from './rules/no-duplicated-branches.ts';
import { preferReadonlyStatic } from './rules/prefer-readonly-static.ts';
import { redundantTypeAliases } from './rules/redundant-type-aliases.ts';
import { noBitwiseInCondition } from './rules/no-bitwise-in-condition.ts';
import { noEqualLoopCondition } from './rules/no-equal-loop-condition.ts';
import { noPositiveIndexCheck } from './rules/no-positive-index-check.ts';
import { noUpdatedLoopCounter } from './rules/no-updated-loop-counter.ts';
import { noKeywordDeclarations } from './rules/no-keyword-declarations.ts';
import { preferImmediateReturn } from './rules/prefer-immediate-return.ts';
import { noAdjacentMultilineIf } from './rules/no-adjacent-multiline-if.ts';
import { noExcessCallArguments } from './rules/no-excess-call-arguments.ts';
import { noPublicTemporaryPath } from './rules/no-public-temporary-path.ts';
import { noTransposedAssignment } from './rules/no-transposed-assignment.ts';
import { noMisplacedLoopCounter } from './rules/no-misplaced-loop-counter.ts';
import { noFloatingPointEquality } from './rules/no-floating-point-equality.ts';
import { noUnsafeSanitizerBypass } from './rules/no-unsafe-sanitizer-bypass.ts';
import { noUnsafeSecurityHeaders } from './rules/no-unsafe-security-headers.ts';
import { noMisleadingArrayReverse } from './rules/no-misleading-array-reverse.ts';
import { noNestedTemplateLiterals } from './rules/no-nested-template-literals.ts';
import { noImpossibleCollectionSize } from './rules/no-impossible-collection-size.ts';
import { noInconsistentFunctionCall } from './rules/no-inconsistent-function-call.ts';
import { noUnenclosedMultilineBlock } from './rules/no-unenclosed-multiline-block.ts';

const rules = {
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
    'require-server-only': requireServerOnly,
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
