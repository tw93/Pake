import updateNotifier from 'update-notifier';
// @ts-expect-error
import packageJson from '../../package.json';

export async function checkUpdateTips() {
  updateNotifier({ pkg: packageJson }).notify();
}
