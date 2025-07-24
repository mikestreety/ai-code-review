import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	getDefaultReviewMode,
	getForceReviewMode,
	getDefaultLlmProvider,
	getForceLlmProvider,
	getDefaultOutputFormat,
	getForceOutputFormat,
	getDefaultLocalOutputFormat,
	getForceLocalOutputFormat,
	shouldForceValue,
	getPromptDefault,
} from '../../services/environment-config.js';

// Mock the config-loader module
vi.mock('../../services/config-loader.js', () => ({
	getConfig: vi.fn(),
}));

describe('environment-config', () => {
	let mockGetConfig;

	beforeEach(async() => {
		vi.clearAllMocks();
		const configLoader = await import('../../services/config-loader.js');
		mockGetConfig = configLoader.getConfig;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('getDefaultReviewMode', () => {
		it('should return configured default review mode', () => {
			mockGetConfig.mockReturnValue('gitlab');

			const result = getDefaultReviewMode();

			expect(mockGetConfig).toHaveBeenCalledWith('DEFAULT_REVIEW_MODE', 'local');
			expect(result).toBe('gitlab');
		});

		it('should return default value when not configured', () => {
			mockGetConfig.mockReturnValue('local');

			const result = getDefaultReviewMode();

			expect(result).toBe('local');
		});
	});

	describe('getForceReviewMode', () => {
		it('should return forced review mode', () => {
			mockGetConfig.mockReturnValue('gitlab');

			const result = getForceReviewMode();

			expect(mockGetConfig).toHaveBeenCalledWith('FORCE_REVIEW_MODE');
			expect(result).toBe('gitlab');
		});

		it('should return undefined when not set', () => {
			mockGetConfig.mockReturnValue(null);

			const result = getForceReviewMode();

			expect(result).toBeNull();
		});
	});

	describe('getDefaultLlmProvider', () => {
		it('should return configured default LLM provider', () => {
			mockGetConfig.mockReturnValue('claude');

			const result = getDefaultLlmProvider();

			expect(mockGetConfig).toHaveBeenCalledWith('DEFAULT_LLM_PROVIDER');
			expect(result).toBe('claude');
		});
	});

	describe('getForceLlmProvider', () => {
		it('should return forced LLM provider', () => {
			mockGetConfig.mockReturnValue('gemini');

			const result = getForceLlmProvider();

			expect(mockGetConfig).toHaveBeenCalledWith('FORCE_LLM_PROVIDER');
			expect(result).toBe('gemini');
		});
	});

	describe('getDefaultOutputFormat', () => {
		it('should return configured default output format', () => {
			mockGetConfig.mockReturnValue('html');

			const result = getDefaultOutputFormat();

			expect(mockGetConfig).toHaveBeenCalledWith('DEFAULT_OUTPUT_FORMAT', 'gitlab');
			expect(result).toBe('html');
		});

		it('should return default value when not configured', () => {
			mockGetConfig.mockReturnValue('gitlab');

			const result = getDefaultOutputFormat();

			expect(result).toBe('gitlab');
		});
	});

	describe('getForceOutputFormat', () => {
		it('should return forced output format', () => {
			mockGetConfig.mockReturnValue('cli');

			const result = getForceOutputFormat();

			expect(mockGetConfig).toHaveBeenCalledWith('FORCE_OUTPUT_FORMAT');
			expect(result).toBe('cli');
		});
	});

	describe('getDefaultLocalOutputFormat', () => {
		it('should return configured default local output format', () => {
			mockGetConfig.mockReturnValue('cli');

			const result = getDefaultLocalOutputFormat();

			expect(mockGetConfig).toHaveBeenCalledWith('DEFAULT_LOCAL_OUTPUT_FORMAT', 'html');
			expect(result).toBe('cli');
		});

		it('should return default value when not configured', () => {
			mockGetConfig.mockReturnValue('html');

			const result = getDefaultLocalOutputFormat();

			expect(result).toBe('html');
		});
	});

	describe('getForceLocalOutputFormat', () => {
		it('should return forced local output format', () => {
			mockGetConfig.mockReturnValue('html');

			const result = getForceLocalOutputFormat();

			expect(mockGetConfig).toHaveBeenCalledWith('FORCE_LOCAL_OUTPUT_FORMAT');
			expect(result).toBe('html');
		});
	});

	describe('shouldForceValue', () => {
		it('should return true for non-empty string values', () => {
			expect(shouldForceValue('gitlab')).toBe(true);
			expect(shouldForceValue('claude')).toBe(true);
			expect(shouldForceValue('html')).toBe(true);
		});

		it('should return false for empty or whitespace-only strings', () => {
			expect(shouldForceValue('')).toBeFalsy(); // Empty string is falsy
			expect(shouldForceValue('   ')).toBe(false);
			expect(shouldForceValue('\t')).toBe(false);
			expect(shouldForceValue('\n')).toBe(false);
		});

		it('should return false for null or undefined values', () => {
			expect(shouldForceValue(null)).toBeFalsy(); // Null is falsy
			expect(shouldForceValue()).toBeFalsy(); // Undefined is falsy
		});

		it('should handle values that need trimming', () => {
			expect(shouldForceValue('  gitlab  ')).toBe(true);
			expect(shouldForceValue('\tvalue\n')).toBe(true);
		});
	});

	describe('getPromptDefault', () => {
		it('should return current value when provided', () => {
			const result = getPromptDefault('default', 'current');
			expect(result).toBe('current');
		});

		it('should return default value when current value is null', () => {
			const result = getPromptDefault('default', null);
			expect(result).toBe('default');
		});

		it('should return default value when current value is undefined', () => {
			const result = getPromptDefault('default');
			expect(result).toBe('default');
		});

		it('should return current value even if it is an empty string', () => {
			const result = getPromptDefault('default', '');
			expect(result).toBe('default'); // Empty string is falsy, so default is returned
		});

		it('should handle non-string values', () => {
			expect(getPromptDefault('default', 0)).toBe('default'); // 0 is falsy, so default is returned
			expect(getPromptDefault('default', false)).toBe('default'); // False is falsy, so default is returned
		});
	});
});
