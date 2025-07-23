/**
 * Configuration loader for Ruck
 * Supports .env files in project directory and .ruckconfig in user home directory
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import dotenv from 'dotenv';

/**
 * Load configuration from multiple sources in order of precedence:
 * 1. Environment variables (highest precedence)
 * 2. Project .env file
 * 3. User home .ruckconfig file (lowest precedence)
 */
export function loadConfig() {
	const config = {},

		// Load from user's home .ruckconfig file first (lowest precedence)
		ruckConfigPath = join(homedir(), '.ruckconfig');
	if (existsSync(ruckConfigPath)) {
		try {
			const ruckConfigContent = readFileSync(ruckConfigPath, 'utf8'),
				ruckConfig = dotenv.parse(ruckConfigContent);
			Object.assign(config, ruckConfig);
		} catch (error) {
			console.warn(`Warning: Could not read .ruckconfig file: ${error.message}`);
		}
	}

	// Load from project .env file (higher precedence)
	const projectEnvironmentPath = '.env';
	if (existsSync(projectEnvironmentPath)) {
		try {
			const projectEnvironmentContent = readFileSync(projectEnvironmentPath, 'utf8'),
				projectEnvironment = dotenv.parse(projectEnvironmentContent);
			Object.assign(config, projectEnvironment);
		} catch (error) {
			console.warn(`Warning: Could not read .env file: ${error.message}`);
		}
	}

	// Environment variables have highest precedence
	Object.assign(config, process.env);

	// Apply the loaded configuration to process.env for backward compatibility
	for (const key of Object.keys(config)) {
		if (!process.env[key]) {
			process.env[key] = config[key];
		}
	}

	return config;
}

/**
 * Get a configuration value with fallback
 */
export function getConfig(key, defaultValue = null) {
	return process.env[key] || defaultValue;
}

/**
 * Initialize configuration loading
 * Call this early in the application startup
 */
export function initConfig() {
	loadConfig();
}
