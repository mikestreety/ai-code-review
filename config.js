import { getConfig } from './services/config-loader.js';

const TIMEOUT_5_MINUTES = 5 * 60 * 1000,
	TIMEOUT_10_MINUTES = 10 * 60 * 1000,
	MAX_BUFFER_10MB = 10 * 1024 * 1024,

	config = {
		gitlab: {
			privateToken: getConfig('GITLAB_PRIVATE_TOKEN'),
		},
		llms: {
			gemini: {
				cliPath: 'gemini',
				args: ['-p'],
				useStdin: false,
				timeout: TIMEOUT_5_MINUTES,
				maxBuffer: MAX_BUFFER_10MB,
			},
			claude: {
				cliPath: 'claude',
				args: ['--print', '--output-format', 'json', '--dangerously-skip-permissions'],
				useStdin: true,
				timeout: TIMEOUT_5_MINUTES,
				maxBuffer: MAX_BUFFER_10MB,
			},
			openai: {
				cliPath: 'openai',
				args: ['api', 'completions.create', '--model', 'gpt-4', '--max-tokens', '2000'],
				useStdin: true,
				timeout: TIMEOUT_5_MINUTES,
				maxBuffer: MAX_BUFFER_10MB,
			},
			ollama: {
				cliPath: 'ollama',
				args: ['run', 'llama3.2'],
				useStdin: true,
				timeout: TIMEOUT_10_MINUTES,
				maxBuffer: MAX_BUFFER_10MB,
			},
			chatgpt: {
				cliPath: 'chatgpt',
				args: ['--model', 'gpt-4'],
				useStdin: true,
				timeout: TIMEOUT_5_MINUTES,
				maxBuffer: MAX_BUFFER_10MB,
			},
			llama: {
				cliPath: 'llama',
				args: ['--model', 'llama3.2'],
				useStdin: true,
				timeout: TIMEOUT_10_MINUTES,
				maxBuffer: MAX_BUFFER_10MB,
			},
		},
		tempDirPrefix: 'gitlab-review-',
	};

export default config;
