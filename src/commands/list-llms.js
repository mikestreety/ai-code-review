import { Command } from '@oclif/core';
import { getAvailableLlms } from '../../services/llm-discovery.js';

export default class ListLlms extends Command {
	static description = 'List available LLM providers';

	async run() {
		const availableLlms = await getAvailableLlms();
		if (availableLlms.length === 0) {
			this.log('No LLM binaries found. Please install one of: claude, gemini, openai, ollama, chatgpt, llama, or gh (for copilot)');
		} else {
			this.log('Available LLM providers:');
			for (const llm of availableLlms) {
				this.log(`  - ${llm}`);
			}
		}
	}
}