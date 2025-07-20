
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
  },
  tempDirPrefix: 'gitlab-review-',
};

export default config;
