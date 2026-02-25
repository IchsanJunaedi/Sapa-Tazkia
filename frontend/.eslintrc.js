// frontend/.eslintrc.js
module.exports = {
    env: {
        browser: true,
        es2022: true,
        node: true
    },
    extends: [
        'react-app',
        'react-app/jest'
    ],
    rules: {
        // No console in production frontend
        'no-console': ['warn', { allow: ['warn', 'error'] }],

        // React specific
        'react/prop-types': 'warn',
        'react/no-unused-prop-types': 'warn',
        'react-hooks/exhaustive-deps': 'warn',

        // Code quality
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        'prefer-const': 'warn',
        'eqeqeq': ['warn', 'always']
    },
    ignorePatterns: [
        'node_modules/',
        'build/',
        'public/'
    ]
};
