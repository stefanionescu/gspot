import { reviewBlockchainMnemonic } from '#eslint-plugin/rules/security/review-blockchain-mnemonic.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('review-blockchain-mnemonic', reviewBlockchainMnemonic, {
    valid: [
        "import { Wallet } from 'ethers';\nWallet.fromPhrase(process.env.WALLET_PHRASE);",
        "Wallet.fromPhrase('abandon abandon abandon');",
    ],
    invalid: [
        {
            code: "import { Wallet } from 'ethers';\nconst phrase = 'test test test test test test test test test test test junk';\nWallet.fromPhrase(phrase);\nWallet.fromPhrase('abandon abandon abandon');\nmnemonicToAccount(`legal winner thank year`);",
            errors: [
                { messageId: 'mnemonic', line: 2 },
                { messageId: 'mnemonic', line: 4 },
                { messageId: 'mnemonic', line: 5 },
            ],
        },
    ],
});
