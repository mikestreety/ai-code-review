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
# Fully interactive mode (prompts for URL and output format)
npm start

# Interactive mode with command (prompts for URL and output format)
npm start review

# Direct URL (prompts for output format)
npm start review <merge-request-url>

# Specify all options
npm start review <merge-request-url> --llm claude --output html

# List available LLMs
npm start list-llms
```

### All Available Options

```bash
npm start review [url] [options]

Arguments:
  url                    GitLab Merge Request URL (optional, will prompt if missing)

Options:
  -l, --llm <provider>   LLM provider: claude, gemini, openai, ollama, chatgpt, llama, copilot
  -o, --output <format>  Output format: gitlab, html, cli (will prompt if not specified)
  --list-llms            List available LLM providers and exit
  -h, --help             Display help information
  -V, --version          Display version number
```

### Usage Examples

#### 1. Fully Interactive Mode
```bash
npm start
# Prompts for:
# - GitLab Merge Request URL
# - Output format (gitlab/html/cli)
# - Uses auto-detected LLM
```

#### 2. Interactive with Command
```bash
npm start review
# Prompts for:
# - GitLab Merge Request URL (if not provided)
# - Output format
```

#### 3. Specify URL, Auto-detect Everything Else
```bash
npm start review https://gitlab.example.com/project/repo/-/merge_requests/123
# Prompts for output format
# Auto-detects available LLM
```

#### 4. Complete Command with All Options
```bash
npm start review https://gitlab.example.com/project/repo/-/merge_requests/123 --llm claude --output html
# No prompts - runs directly with specified options
```

#### 5. Generate Different Output Formats
```bash
# Post comments to GitLab (default)
npm start review <url> --output gitlab

# Generate HTML report file
npm start review <url> --output html

# Show CLI linter-style output
npm start review <url> --output cli
```

#### 6. Specify LLM Provider
```bash
# Use Claude
npm start review <url> --llm claude

# Use Gemini
npm start review <url> --llm gemini

# Use OpenAI
npm start review <url> --llm openai

# Use local Ollama
npm start review <url> --llm ollama
```

#### 7. Check Available Providers
```bash
npm start list-llms
# Output:
# Available LLM providers:
#   - gemini
#   - claude
#   - openai (if installed)
```

### Command Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `[url]` | Argument | *prompted* | GitLab Merge Request URL |
| `-l, --llm <provider>` | Option | *auto-detected* | LLM provider: `claude`, `gemini`, `openai`, `ollama`, `chatgpt`, `llama`, `copilot` |
| `-o, --output <format>` | Option | *prompted* | Output format: `gitlab`, `html`, `cli` |
| `--list-llms` | Flag | - | List available LLM providers and exit |
| `-h, --help` | Flag | - | Display help information |
| `-V, --version` | Flag | - | Display version number |

### Interactive Prompts

The tool will interactively prompt for missing required information:

1. **URL Prompt**: If no URL provided as argument
2. **Output Format Prompt**: If no `--output` specified, shows options:
   - `gitlab` - Post comments directly to GitLab MR (requires GitLab token)
   - `html` - Generate beautiful HTML report file
   - `cli` - Show linter-style console output
3. **LLM Auto-detection**: Automatically detects and uses the first available LLM provider

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

## Complete Workflow

### 1. Input Collection
- **URL**: Provided as argument or prompted interactively
- **LLM Provider**: Auto-detected from available CLI tools, or specified with `--llm`
- **Output Format**: Prompted interactively or specified with `--output`

### 2. Validation & Setup
- Validates GitLab private token is set
- Checks for unresolved discussions on the MR
- Detects available LLM CLI tools on the system

### 3. Repository Analysis
- Clones the source branch to a temporary directory
- Retrieves the MR diff and changed files list
- Reads full file contents for better context

### 4. AI-Powered Review
- Sends code diff and context to selected LLM
- Uses Conventional Comments format for structured feedback
- Focuses on critical issues: bugs, security, performance

### 5. Output Generation
Based on selected format:

**GitLab Output:**
- Posts line-specific comments to MR
- Adds summary comment with overall assessment
- Shows real-time progress in console

**HTML Output:**
- Generates standalone HTML report file
- Professional Playwright-inspired styling
- Color-coded labels and summary statistics
- Self-contained file for sharing/archiving

**CLI Output:**
- Shows linter-style console output
- Format: `file:line label: message`
- Summary statistics at the end
- Perfect for CI/CD integration

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
