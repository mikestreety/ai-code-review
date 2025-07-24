import config from '@lintkit/eslint-config/config.js';

// Create a copy of the base config
const cliConfig = Object.values(config),

	// Override rules for CLI applications
	cliOverride = {
		files: ['**/*.js'],
		rules: {
			'no-console': 'off', // Allow console logging in CLI apps
			'unicorn/no-process-exit': 'off', // Allow process.exit in CLI apps
			'unicorn/prefer-top-level-await': 'off', // Allow main() function pattern
		},
	},

	// Override rules for test files
	testOverride = {
		files: ['test/**/*.js', '**/*.test.js'],
		rules: {
			'no-unused-vars': 'off', // Allow unused test imports like 'vi'
			'playwright/no-standalone-expect': 'off', // Allow expect outside test blocks for Vitest
			'unicorn/prevent-abbreviations': 'off', // Allow abbreviations in tests like tempDir
			'unicorn/prefer-event-target': 'off', // Allow EventEmitter mocks in tests
		},
	};

// Add CLI-specific and test overrides
cliConfig.push(cliOverride, testOverride);

export default cliConfig;
