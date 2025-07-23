import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import config from '../config.js';

const __filename = fileURLToPath(import.meta.url),
	__dirname = path.dirname(__filename);

function escapeBackticks(text) {
	return text.replaceAll('`', '\\`');
}

function loadPromptTemplate() {
	// Try multiple path resolutions for better compatibility with npx
	const possiblePaths = [
		path.join(__dirname, '..', 'prompts', 'code-review.txt'),
		path.join(process.cwd(), 'prompts', 'code-review.txt'),
		path.join(path.dirname(__dirname), 'prompts', 'code-review.txt')
	];
	
	for (const promptPath of possiblePaths) {
		try {
			return readFileSync(promptPath, 'utf8');
		} catch (error) {
			// Continue to next path
			continue;
		}
	}
	
	throw new Error(`Could not find code-review.txt prompt file. Searched paths: ${possiblePaths.join(', ')}`);
}

export async function runCodeReview(llmName, codeDiff, fullFileContext) {
	const llmConfig = config.llms[llmName.toLowerCase()];
	if (!llmConfig) {
		throw new Error(`Unsupported LLM: ${llmName}. Supported LLMs: ${Object.keys(config.llms).join(', ')}`);
	}

	const promptTemplate = loadPromptTemplate(),
		prompt = promptTemplate
			.replace('{FULL_FILE_CONTEXT}', escapeBackticks(fullFileContext))
			.replace('{CODE_DIFF}', escapeBackticks(codeDiff));

	return new Promise((resolve, reject) => {
		// Debug info (less verbose to work better with spinners)
		process.stderr.write(`\n📤 Prompt: ${prompt.length} chars | Preview: ${prompt.slice(0, 100)}...\n`);

		const llmProcess = spawn(llmConfig.cliPath, llmConfig.args, {
			stdio: ['pipe', 'pipe', 'pipe'],
		});

		let stdout = '',
			stderr = '';

		// Set a timeout to prevent hanging
		const timeout = setTimeout(() => {
			llmProcess.kill();
			reject(new Error(`${llmName.toUpperCase()} CLI timed out after ${llmConfig.timeout / 1000} seconds`));
		}, llmConfig.timeout);

		llmProcess.stdout.on('data', (data) => {
			stdout += data.toString();
			// Less verbose output that doesn't interfere with spinners
			process.stderr.write('.');
		});

		llmProcess.stderr.on('data', (data) => {
			stderr += data.toString();
		});

		llmProcess.on('close', (code) => {
			clearTimeout(timeout);
			process.stderr.write('\n'); // End the dots line
			if (code === 0) {
				resolve(stdout);
			} else {
				reject(new Error(`${llmName.toUpperCase()} CLI execution failed with code ${code}: ${stderr}`));
			}
		});

		llmProcess.on('error', (error) => {
			clearTimeout(timeout);
			process.stderr.write('\n'); // End the dots line
			reject(new Error(`Failed to start ${llmName.toUpperCase()} CLI: ${error.message}`));
		});

		// Write the prompt to stdin
		llmProcess.stdin.write(prompt);
		llmProcess.stdin.end();
	});
}

// Legacy function names for backward compatibility
export async function runClaudeCodeReview(codeDiff, fullFileContext) {
	return runCodeReview('claude', codeDiff, fullFileContext);
}

export async function runGeminiCodeReview(codeDiff, fullFileContext) {
	return runCodeReview('gemini', codeDiff, fullFileContext);
}
