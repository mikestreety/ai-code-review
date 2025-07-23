#!/usr/bin/env node

import { initConfig } from '../services/config-loader.js';
import { execute } from '@oclif/core';

// Initialize configuration from .env and .ruckconfig
initConfig();

// Check if running in interactive mode (no command line arguments)
if (process.argv.length === 2) {
	// Force run the interactive command
	process.argv.push('interactive');
}

await execute({ development: false, dir: import.meta.url });
