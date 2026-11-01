import { createRule } from '../rule.ts';
import { listImportedModules } from '../packages.ts';
import { readExpressionValue } from '../expressions.ts';
import { WALLET_MODULES, MNEMONIC_FUNCTIONS } from '../config/security.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function findHardcodedPhrase(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.CallExpression,
): TSESTree.Node | undefined {
    const callee = node.callee.type === AST_NODE_TYPES.MemberExpression ? node.callee.property : node.callee;
    if (!ASTUtils.isIdentifier(callee) || !MNEMONIC_FUNCTIONS.has(callee.name)) return undefined;
    const phrase = readExpressionValue(node.arguments[0], source);
    return phrase && ASTUtils.getStringIfConstant(phrase) !== null ? phrase : undefined;
}

export const reviewBlockchainMnemonic = createRule<[], 'mnemonic'>({
    name: 'review-blockchain-mnemonic',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'In a file that imports `ethers`, `viem/accounts`, or `tronweb`, finds `fromPhrase`, `mnemonicToAccount`, and `fromMnemonic` calls whose seed phrase is a string written in the code.',
            why: 'A seed phrase gives full control of a wallet, so everyone who reads the code can take its funds.',
            fix: 'Move the funds to a new wallet, and read the new seed phrase from a secret store at run time.',
            example:
                'The call `Wallet.fromPhrase("test test test ...")` reports `mnemonic`. Use `Wallet.fromPhrase(process.env.WALLET_PHRASE)`.',
        },
        schema: [],
        messages: { mnemonic: 'Revoke and replace this seed phrase. The code shows it to everyone who reads it.' },
    },
    create(context) {
        const source = context.sourceCode;
        if (
            !listImportedModules(source)
                .values()
                .some((module) => WALLET_MODULES.has(module))
        )
            return {};
        return {
            CallExpression(node) {
                const phrase = findHardcodedPhrase(source, node);
                if (phrase) context.report({ node: phrase, messageId: 'mnemonic' });
            },
        };
    },
});
