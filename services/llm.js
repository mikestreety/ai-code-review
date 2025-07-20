import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import config from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function escapeBackticks(text) {
  return text.replace(/`/g, '\\`');
}

function loadPromptTemplate() {
  const promptPath = join(__dirname, '..', 'prompts', 'code-review.txt');
  return readFileSync(promptPath, 'utf8');
}

export async function runCodeReview(llmName, codeDiff, fullFileContext) {
  const llmConfig = config.llms[llmName.toLowerCase()];
  if (!llmConfig) {
    throw new Error(`Unsupported LLM: ${llmName}. Supported LLMs: ${Object.keys(config.llms).join(', ')}`);
  }

  const promptTemplate = loadPromptTemplate();
  const prompt = promptTemplate
    .replace('{FULL_FILE_CONTEXT}', escapeBackticks(fullFileContext))
    .replace('{CODE_DIFF}', escapeBackticks(codeDiff));

  return new Promise((resolve, reject) => {
    console.log(`Starting ${llmName.toUpperCase()} CLI process...`);
    console.log('Prompt length:', prompt.length, 'characters');
    
    // Debug: show first 500 chars of prompt
    console.log('Prompt preview:', prompt.substring(0, 500) + '...');
    
    // Prepare arguments
    const args = [...llmConfig.args];
    if (!llmConfig.useStdin) {
      args.push(prompt);
    }

    const llmProcess = spawn(llmConfig.cliPath, args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    // Set a timeout to prevent hanging
    const timeout = setTimeout(() => {
      llmProcess.kill();
      reject(new Error(`${llmName.toUpperCase()} CLI timed out after ${llmConfig.timeout / 1000} seconds`));
    }, llmConfig.timeout);

    llmProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(`${llmName.toUpperCase()} output received:`, data.toString().length, 'characters');
    });

    llmProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log(`${llmName.toUpperCase()} stderr:`, data.toString());
    });

    llmProcess.on('close', (code) => {
      clearTimeout(timeout);
      console.log(`${llmName.toUpperCase()} CLI process closed with code ${code}`);
      if (code !== 0) {
        console.error(`Error running ${llmName.toUpperCase()} CLI:`, stderr);
        reject(new Error(`${llmName.toUpperCase()} CLI execution failed with code ${code}: ${stderr}`));
      } else {
        console.log(`${llmName.toUpperCase()} CLI completed successfully, output length:`, stdout.length);
        resolve(stdout);
      }
    });

    llmProcess.on('error', (err) => {
        clearTimeout(timeout);
        console.error(`Failed to start ${llmName.toUpperCase()} CLI:`, err);
        reject(new Error(`Failed to start ${llmName.toUpperCase()} CLI: ${err.message}`));
    });

    // Write the prompt to stdin if required
    if (llmConfig.useStdin) {
      console.log(`Writing prompt to ${llmName.toUpperCase()} CLI stdin...`);
      llmProcess.stdin.write(prompt);
      llmProcess.stdin.end();
      console.log(`Prompt written to ${llmName.toUpperCase()} CLI, waiting for response...`);
    }
  });
}

// Legacy function names for backward compatibility
export async function runClaudeCodeReview(codeDiff, fullFileContext) {
  return runCodeReview('claude', codeDiff, fullFileContext);
}

export async function runGeminiCodeReview(codeDiff, fullFileContext) {
  return runCodeReview('gemini', codeDiff, fullFileContext);
}