// backend/.eslintrc.js
module.exports = {
    env: {
        node: true,
        es2022: true,
        commonjs: true
    },
    extends: ['eslint:recommended'],
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'commonjs'
    },
    rules: {
        // Code quality
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        'no-undef': 'error',
        'no-var': 'error',
        'prefer-const': 'warn',
        'eqeqeq': ['error', 'always'],

        // Security: console.log should not appear in production code
        // Use the logger utility instead
        'no-console': ['warn', { allow: ['warn', 'error'] }],

        // Async/await
        'no-async-promise-executor': 'error',
        'require-await': 'warn',

        // Best practices
        'no-duplicate-imports': 'error',
        'no-unused-expressions': 'warn',
        'no-eval': 'error',
        'no-implied-eval': 'error',

        // Style (non-blocking, just warnings)
        'semi': ['warn', 'always'],
        'quotes': ['warn', 'single', { avoidEscape: true }]
    },
    ignorePatterns: [
        'node_modules/',
        'build/',
        'dist/',
        'coverage/',
        '*.min.js',
        'prisma/migrations/'
    ]
};
