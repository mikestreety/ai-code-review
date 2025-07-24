import { describe, it, expect, vi } from 'vitest';

describe('config-loader (simplified)', () => {
	it('should have basic functionality', async() => {
		// Test that the module can be imported
		const { getConfig } = await import('../../services/config-loader.js');

		// Test basic getConfig functionality without complex mocking
		expect(typeof getConfig).toBe('function');

		// Test default value return
		const result = getConfig('NONEXISTENT_VAR', 'default');
		expect(result).toBe('default');
	});

	it('should return environment variable values', async() => {
		const { getConfig } = await import('../../services/config-loader.js');

		// Set a test env var
		process.env.TEST_CONFIG_VAR = 'test_value';

		const result = getConfig('TEST_CONFIG_VAR');
		expect(result).toBe('test_value');

		// Cleanup
		delete process.env.TEST_CONFIG_VAR;
	});
});
