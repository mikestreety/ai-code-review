import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execPromise = promisify(exec);

export async function cloneRepository(cloneUrl, branchName, repositoryDirectory) {
	if (!cloneUrl || !branchName || !repositoryDirectory) {
		throw new Error('Missing required parameters for git clone');
	}

	const command = 'git',
		arguments_ = ['clone', '--depth', '1', '--branch', branchName, cloneUrl, repositoryDirectory];

	console.log(`Cloning repository into ${repositoryDirectory}...`);

	try {
		const { stdout, stderr } = await execPromise(`${command} ${arguments_.map(argument => `"${argument}"`).join(' ')}`);
		console.log('Git clone stdout:', stdout);
		if (stderr) {
			console.error('Git clone stderr:', stderr);
		}
	} catch (error) {
		throw new Error(`Failed to clone repository: ${error.message}`);
	}
}
