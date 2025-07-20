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
	};

// Add CLI-specific overrides
cliConfig.push(cliOverride);

export default cliConfig;
