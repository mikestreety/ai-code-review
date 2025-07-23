import { Command } from '@oclif/core';
import { runSetup } from '../../services/setup.js';

export default class Setup extends Command {
	static description = 'Configure default preferences and force options';

	async run() {
		await runSetup();
	}
}
