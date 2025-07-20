import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import config from '../config.js';

export async function createTempDirectory() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), config.tempDirPrefix));
  console.log(`Created temporary directory: ${tempDir}`);
  return tempDir;
}

export async function cleanupDirectory(dirPath) {
  if (dirPath && dirPath.startsWith(path.join(os.tmpdir(), config.tempDirPrefix))) {
    console.log(`Cleaning up temporary directory: ${dirPath}`);
    await fs.rm(dirPath, { recursive: true, force: true });
  } else if (dirPath) {
    console.warn(`Skipping cleanup of non-temporary directory: ${dirPath}`);
  }
}

export async function readFilesForContext(filePaths, repoRoot) {
  let context = '';
  for (const filePath of filePaths) {
    try {
      const fullPath = path.join(repoRoot, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      context += `--- ${filePath} ---\n${content}\n\n`;
    } catch (error) {
      console.warn(`Warning: Could not read file ${filePath}: ${error.message}`);
    }
  }
  return context;
}
