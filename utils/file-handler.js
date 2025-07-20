import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import config from '../config.js';

export async function createTemporaryDirectory() {
	const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), config.tempDirPrefix));
	console.log(`Created temporary directory: ${temporaryDirectory}`);
	return temporaryDirectory;
}

export async function cleanupDirectory(directoryPath) {
	if (directoryPath && directoryPath.startsWith(path.join(os.tmpdir(), config.tempDirPrefix))) {
		console.log(`Cleaning up temporary directory: ${directoryPath}`);
		await fs.rm(directoryPath, { recursive: true, force: true });
	} else if (directoryPath) {
		console.warn(`Skipping cleanup of non-temporary directory: ${directoryPath}`);
	}
}

export async function readFilesForContext(filePaths, repoRoot) {
	let context = '';
	for (const filePath of filePaths) {
		try {
			const fullPath = path.join(repoRoot, filePath),
				content = await fs.readFile(fullPath, 'utf8');
			context += `--- ${filePath} ---\n${content}\n\n`;
		} catch (error) {
			console.warn(`Warning: Could not read file ${filePath}: ${error.message}`);
		}
	}
	return context;
}
