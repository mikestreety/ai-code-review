# GitLab MR Reviewer

---

**Note:** This code was 100% generated with AI (mainly Claude Code) as an experiment.

---

Automated GitLab Merge Request code reviews using various AI/LLM providers.

## Features

- 🤖 **Multi-LLM Support**: Works with Claude, Gemini, OpenAI, Ollama, ChatGPT, Llama, and GitHub Copilot
- 🔍 **Smart Detection**: Automatically detects available LLM binaries on your system
- 📝 **Comprehensive Reviews**: Provides detailed code analysis with line-specific comments
- 🛡️ **Conflict Prevention**: Checks for unresolved discussions before proceeding
- 🎯 **Interactive CLI**: Professional command-line interface with helpful prompts
- ⚡ **Fast Setup**: Simple installation and configuration

## Installation

### Prerequisites

1. **Node.js**: Version 16 or higher
2. **GitLab Access Token**: Personal access token with appropriate permissions
3. **LLM CLI Tool**: At least one of the following:
   - [Claude CLI](https://claude.ai/code)
   - [Gemini CLI](https://ai.google.dev/)
   - [OpenAI CLI](https://platform.openai.com/docs/guides/cli)
   - [Ollama](https://ollama.ai/) (for local models)
   - [ChatGPT CLI](https://www.npmjs.com/package/chatgpt-cli)
   - [GitHub CLI](https://cli.github.com/) (for Copilot)

### Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd gitlab-mr-reviewer
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   Create a `.env` file in the project root:
   ```bash
   GITLAB_PRIVATE_TOKEN=your_gitlab_token_here
   ```

4. **Verify LLM availability**:
   ```bash
   npm start list-llms
   ```

## Usage

### Command Structure

```bash
# Interactive mode (prompts for URL)
npm start review

# Direct URL
npm start review <merge-request-url>

# Specify LLM provider
npm start review <merge-request-url> --llm claude

# Choose output format
npm start review <merge-request-url> --output html

# List available LLMs
npm start list-llms
```

### Examples

1. **Basic review with auto-detected LLM**:
   ```bash
   npm start review https://gitlab.example.com/project/repo/-/merge_requests/123
   ```

2. **Interactive mode**:
   ```bash
   npm start review
   # Prompts: Please enter the GitLab Merge Request URL:
   ```

3. **Specify LLM provider**:
   ```bash
   npm start review https://gitlab.example.com/project/repo/-/merge_requests/123 --llm claude
   ```

4. **Generate HTML report**:
   ```bash
   npm start review https://gitlab.example.com/project/repo/-/merge_requests/123 --output html
   ```

5. **CLI linter-style output**:
   ```bash
   npm start review https://gitlab.example.com/project/repo/-/merge_requests/123 --output cli
   ```

6. **Check available LLMs**:
   ```bash
   npm start list-llms
   # Output:
   # Available LLM providers:
   #   - gemini
   #   - claude
   ```

### Command Options

| Option | Description |
|--------|-------------|
| `<url>` | GitLab Merge Request URL (optional, will prompt if missing) |
| `-l, --llm <provider>` | Specify LLM provider (auto-detected if not specified) |
| `-o, --output <format>` | Output format: gitlab, html, cli (default: gitlab) |
| `--list-llms` | List available LLM providers and exit |
| `-h, --help` | Display help information |
| `-V, --version` | Display version number |

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GITLAB_PRIVATE_TOKEN` | GitLab personal access token | Yes |

### Supported LLM Providers

The tool automatically detects which LLM CLI tools are installed:

| Provider | CLI Command | Installation |
|----------|-------------|--------------|
| Claude | `claude` | [Claude CLI Setup](https://claude.ai/code) |
| Gemini | `gemini` | [Gemini CLI Setup](https://ai.google.dev/) |
| OpenAI | `openai` | [OpenAI CLI Setup](https://platform.openai.com/docs/guides/cli) |
| Ollama | `ollama` | [Ollama Setup](https://ollama.ai/) |
| ChatGPT | `chatgpt` | `npm install -g chatgpt-cli` |
| Llama | `llama` | Various implementations available |
| Copilot | `gh` | [GitHub CLI Setup](https://cli.github.com/) |

## How It Works

1. **Validation**: Checks for unresolved discussions on the MR
2. **Repository Setup**: Clones the source branch to a temporary directory
3. **Diff Analysis**: Retrieves the MR diff and changed files
4. **Context Building**: Reads full file contents for better analysis
5. **AI Review**: Sends code and context to the selected LLM for analysis
6. **Output Generation**: Delivers results based on selected format:
   - **GitLab**: Posts line-specific comments and summary to GitLab
   - **HTML**: Generates beautiful standalone report file
   - **CLI**: Shows linter-style console output

## Output Formats

The tool supports three output formats:

### GitLab (Default)
- **Line-specific comments**: Posted directly on the relevant lines
- **Summary comment**: Overall review summary posted to the MR
- **Console output**: Real-time progress and results

### HTML Report
- **Professional styling**: Playwright-inspired design with modern UI
- **Color-coded labels**: Visual distinction for different comment types
- **Summary statistics**: Overview of comments, blocking issues, and praise
- **Standalone file**: Self-contained report that can be shared or archived

### CLI Output
- **Linter-style format**: Similar to ESLint output with `file:line label: message`
- **Summary statistics**: Quick overview of issues found
- **Console-friendly**: Perfect for CI/CD pipelines and terminal workflows

## Troubleshooting

### Common Issues

1. **"No LLM binaries found"**:
   - Install at least one LLM CLI tool
   - Ensure the CLI is in your system PATH
   - Run `npm start list-llms` to verify detection

2. **"GITLAB_PRIVATE_TOKEN not set"**:
   - Create a `.env` file with your GitLab token
   - Ensure the token has appropriate API permissions

3. **"Failed to parse GitLab URL"**:
   - Verify the MR URL format: `https://gitlab.example.com/group/project/-/merge_requests/123`
   - Ensure the MR exists and is accessible

4. **"Unresolved discussions found"**:
   - Resolve all discussion threads in the MR before running the review
   - This prevents duplicate or conflicting feedback

### Debug Mode

For troubleshooting, check the console output which includes:
- LLM detection results
- Git operations status
- API call responses
- File processing progress

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run the linter: `npm run lint`
5. Commit your changes
6. Push to your fork
7. Create a Pull Request

## License

[MIT License](LICENSE)

## Security

- The tool only reads repository data and posts comments
- No sensitive data is stored or transmitted beyond GitLab APIs
- LLM providers may have their own data handling policies
- Review your organization's policies before use

---

**Note**: This tool is designed for code review assistance. Always review AI-generated feedback before taking action, as AI suggestions may not always be appropriate for your specific context or requirements.
