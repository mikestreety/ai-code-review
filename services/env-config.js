/**
 * Environment configuration utilities for reading default and force settings
 */

export function getDefaultReviewMode() {
	return process.env.DEFAULT_REVIEW_MODE || 'local';
}

export function getForceReviewMode() {
	return process.env.FORCE_REVIEW_MODE || null;
}

export function getDefaultLlmProvider() {
	return process.env.DEFAULT_LLM_PROVIDER || null;
}

export function getForceLlmProvider() {
	return process.env.FORCE_LLM_PROVIDER || null;
}

export function getDefaultOutputFormat() {
	return process.env.DEFAULT_OUTPUT_FORMAT || 'gitlab';
}

export function getForceOutputFormat() {
	return process.env.FORCE_OUTPUT_FORMAT || null;
}

export function getDefaultLocalOutputFormat() {
	return process.env.DEFAULT_LOCAL_OUTPUT_FORMAT || 'html';
}

export function getForceLocalOutputFormat() {
	return process.env.FORCE_LOCAL_OUTPUT_FORMAT || null;
}

/**
 * Check if a value should be forced (skipping prompts)
 */
export function shouldForceValue(forceValue) {
	return forceValue && forceValue.trim() !== '';
}

/**
 * Get the appropriate default value for prompts
 */
export function getPromptDefault(defaultValue, currentValue = null) {
	return currentValue || defaultValue;
}