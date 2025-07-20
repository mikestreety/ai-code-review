
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export async function cloneRepository(cloneUrl, branchName, repoDir) {
  const command = `git clone --depth 1 --branch ${branchName} ${cloneUrl} ${repoDir}`;
  console.log(`Cloning repository into ${repoDir}...`);
  const { stdout, stderr } = await execPromise(command);
  console.log('Git clone stdout:', stdout);
  if (stderr) {
    console.error('Git clone stderr:', stderr);
  }
}
