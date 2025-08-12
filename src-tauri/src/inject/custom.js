window.addEventListener('DOMContentLoaded', async _event => {
  const process = window.__TAURI__.process;
  const updater = window.__TAURI__.updater;

  const update = await updater.check();
  console.log(update)
  if (update) {
    console.log(
      `found update ${update.version} from ${update.date} with notes ${update.body}`
    );
    let downloaded = 0;
    let contentLength = 0;
    // alternatively we could also call update.download() and update.install() separately
    // await update.downloadAndInstall((event) => {
    //   console.log(event)
    //   switch (event.event) {
    //     case 'Started':
    //       contentLength = event.data.contentLength;
    //       console.log(`started downloading ${event.data.contentLength} bytes`);
    //       break;
    //     case 'Progress':
    //       downloaded += event.data.chunkLength;
    //       console.log(`downloaded ${downloaded} from ${contentLength}`);
    //       break;
    //     case 'Finished':
    //       console.log('download finished');
    //       break;
    //   }
    // });

    // console.log('update installed');
    // await process.relaunch();
  }
});
