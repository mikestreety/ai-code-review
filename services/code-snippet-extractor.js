/**
 * Extracts code snippets from file content for HTML reports
 */

export function extractCodeSnippet(fileContent, lineNumber, contextLines = 3) {
	if (!fileContent || !lineNumber || lineNumber < 1 || !Number.isInteger(lineNumber) || contextLines < 0) {
		return null;
	}

	const lines = fileContent.split('\n'),
		targetLineIndex = lineNumber - 1; // Convert to 0-based index

	if (targetLineIndex >= lines.length) {
		return null;
	}

	// Calculate snippet bounds
	const startLine = Math.max(0, targetLineIndex - contextLines),
		endLine = Math.min(lines.length - 1, targetLineIndex + contextLines),

		// Extract the snippet
		snippetLines = [];
	for (let index = startLine; index <= endLine; index++) {
		snippetLines.push({
			lineNumber: index + 1,
			content: lines[index] || '',
			isTarget: index === targetLineIndex,
		});
	}

	return {
		startLine: startLine + 1,
		endLine: endLine + 1,
		targetLine: lineNumber,
		lines: snippetLines,
	};
}

export function parseFileContents(fileContext) {
	const fileContents = new Map();

	if (!fileContext) {
		return fileContents;
	}

	// Split by file headers and process each file
	const sections = fileContext.split(/^--- (.+?) ---$/gm);

	// Process in pairs: [content, filename, content, filename, ...]
	// Skip first empty section
	for (let index = 1; index < sections.length; index += 2) {
		const fileName = sections[index],
			fileContent = sections[index + 1];

		if (fileName && fileContent) {
			// Clean up the content (remove leading/trailing whitespace and empty lines)
			const cleanContent = fileContent.trim();
			if (cleanContent) {
				fileContents.set(fileName, cleanContent);
			}
		}
	}

	return fileContents;
}

export function getFileExtension(filePath) {
	const lastDotIndex = filePath.lastIndexOf('.');
	if (lastDotIndex === -1 || lastDotIndex === filePath.length - 1) {
		return '';
	}
	return filePath.slice(Math.max(0, lastDotIndex + 1)).toLowerCase();
}

export function getLanguageFromExtension(extension) {
	const languageMap = {
		js: 'javascript',
		jsx: 'javascript',
		ts: 'typescript',
		tsx: 'typescript',
		py: 'python',
		rb: 'ruby',
		php: 'php',
		java: 'java',
		c: 'c',
		cpp: 'cpp',
		cc: 'cpp',
		cxx: 'cpp',
		h: 'c',
		hpp: 'cpp',
		cs: 'csharp',
		go: 'go',
		rs: 'rust',
		swift: 'swift',
		kt: 'kotlin',
		scala: 'scala',
		sh: 'bash',
		bash: 'bash',
		zsh: 'bash',
		fish: 'bash',
		ps1: 'powershell',
		sql: 'sql',
		html: 'html',
		htm: 'html',
		xml: 'xml',
		css: 'css',
		scss: 'scss',
		sass: 'sass',
		less: 'less',
		json: 'json',
		yaml: 'yaml',
		yml: 'yaml',
		toml: 'toml',
		ini: 'ini',
		conf: 'ini',
		config: 'ini',
		md: 'markdown',
		markdown: 'markdown',
		txt: 'text',
	};

	return languageMap[extension] || 'text';
}
