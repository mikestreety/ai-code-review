#!/usr/bin/env node

import 'dotenv/config';
import { execute } from '@oclif/core';

// Check if running in interactive mode (no command line arguments)
if (process.argv.length === 2) {
	// Force run the interactive command
	process.argv.push('interactive');
}

await execute({ development: false, dir: import.meta.url });
