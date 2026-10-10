// Native import-linter output keeps two broken contracts and their distinct dependency chains.
export const IMPORT_CONTRACT_REPORT =
    'Contracts\n---------\n\nFirst boundary BROKEN (1 ignored import)\nSecond boundary BROKEN [0.1s]\n\n\u001B[1mBroken contracts\u001B[0m\n----------------\n\u001B[1mFirst boundary\u001B[0m\n--------------\nexample.low -> example.high (l. 1)\n\nSecond boundary\n---------------\nexample.other -> example.high (l. 3)\n';
