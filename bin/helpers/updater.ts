import updateNotifier from 'update-notifier';
import packageJson from '../../package.json';

export async function checkUpdateTips() {
  updateNotifier({ pkg: packageJson, updateCheckInterval: 1000 * 60 }).notify();
}
