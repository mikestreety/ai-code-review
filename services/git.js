import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execPromise = promisify(exec);

export async function cloneRepository(cloneUrl, branchName, repositoryDirectory) {
	const command = `git clone --depth 1 --branch ${branchName} ${cloneUrl} ${repositoryDirectory}`;
	console.log(`Cloning repository into ${repositoryDirectory}...`);
	const { stdout, stderr } = await execPromise(command);
	console.log('Git clone stdout:', stdout);
	if (stderr) {
		console.error('Git clone stderr:', stderr);
	}
}
