import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createCliProgram, handleInteractiveMode } from './services/cli-handler.js';

// Application metadata
const __filename = fileURLToPath(import.meta.url),
	__dirname = path.dirname(__filename),
	packageJson = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

// Main application flow
async function main() {
	// Check if running in interactive mode (no command line arguments)
	if (process.argv.length === 2) {
		await handleInteractiveMode();
	} else {
		// Parse and execute CLI commands
		const program = createCliProgram(packageJson);
		program.parse();
	}
}

// Entry point
main().catch((error) => {
	console.error('Fatal error:', error.message);
	process.exit(1);
});
