const config = {
	gitlab: {
		privateToken: process.env.GITLAB_PRIVATE_TOKEN,
	},
	llms: {
		gemini: {
			cliPath: 'gemini',
			args: ['-p'],
			useStdin: false,
			timeout: 5 * 60 * 1000, // 5 minutes
			maxBuffer: 10 * 1024 * 1024, // 10MB
		},
		claude: {
			cliPath: 'claude',
			args: ['--print', '--output-format', 'json', '--dangerously-skip-permissions'],
			useStdin: true,
			timeout: 5 * 60 * 1000, // 5 minutes
			maxBuffer: 10 * 1024 * 1024, // 10MB
		},
		openai: {
			cliPath: 'openai',
			args: ['api', 'completions.create', '--model', 'gpt-4', '--max-tokens', '2000'],
			useStdin: true,
			timeout: 5 * 60 * 1000, // 5 minutes
			maxBuffer: 10 * 1024 * 1024, // 10MB
		},
		ollama: {
			cliPath: 'ollama',
			args: ['run', 'llama3.2'],
			useStdin: true,
			timeout: 10 * 60 * 1000, // 10 minutes for local processing
			maxBuffer: 10 * 1024 * 1024, // 10MB
		},
		copilot: {
			cliPath: 'gh',
			args: ['copilot', 'suggest', '--type', 'shell'],
			useStdin: true,
			timeout: 5 * 60 * 1000, // 5 minutes
			maxBuffer: 10 * 1024 * 1024, // 10MB
		},
		chatgpt: {
			cliPath: 'chatgpt',
			args: ['--model', 'gpt-4'],
			useStdin: true,
			timeout: 5 * 60 * 1000, // 5 minutes
			maxBuffer: 10 * 1024 * 1024, // 10MB
		},
		llama: {
			cliPath: 'llama',
			args: ['--model', 'llama3.2'],
			useStdin: true,
			timeout: 10 * 60 * 1000, // 10 minutes for local processing
			maxBuffer: 10 * 1024 * 1024, // 10MB
		},
	},
	tempDirPrefix: 'gitlab-review-',
};

export default config;
