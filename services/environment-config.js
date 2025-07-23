/**
 * Environment configuration utilities for reading default and force settings
 */

import { getConfig } from './config-loader.js';

export function getDefaultReviewMode() {
	return getConfig('DEFAULT_REVIEW_MODE', 'local');
}

export function getForceReviewMode() {
	return getConfig('FORCE_REVIEW_MODE');
}

export function getDefaultLlmProvider() {
	return getConfig('DEFAULT_LLM_PROVIDER');
}

export function getForceLlmProvider() {
	return getConfig('FORCE_LLM_PROVIDER');
}

export function getDefaultOutputFormat() {
	return getConfig('DEFAULT_OUTPUT_FORMAT', 'gitlab');
}

export function getForceOutputFormat() {
	return getConfig('FORCE_OUTPUT_FORMAT');
}

export function getDefaultLocalOutputFormat() {
	return getConfig('DEFAULT_LOCAL_OUTPUT_FORMAT', 'html');
}

export function getForceLocalOutputFormat() {
	return getConfig('FORCE_LOCAL_OUTPUT_FORMAT');
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
