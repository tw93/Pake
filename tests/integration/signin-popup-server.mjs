// A site and an identity provider that sign in through a popup, for checking
// a real bundle by hand or with a click driver:
//
//   node tests/integration/signin-popup-server.mjs [delay-ms]
//
// Package http://localhost:8731/ and click each button, on macOS or Windows
// (Linux keeps its previous routes). The app's page must stay where it is and
// its title must end as shown:
//
//   G  the page opens the provider sized (TikTok's Google button)
//      "H G open=proxy | MSG http://localhost:8731 {"code":"ok","via":"g"} | G closed"
//   N  the page opens a sized page of its own that redirects to the provider
//      and back (Notion's)
//      "... N open=proxy | MSG http://localhost:8731 {"code":"ok","via":"n"} | N closed"
//   F  a frame of the provider opens the provider's popup, which answers the
//      frame (X's Google button)
//      "... {"frameOpen":"proxy"} ... {"frame":{"code":"frame-ok"},...} ... {"frameClosed":true}"
//
// Before the popups were real windows, G and N left the app on a blank
// callback page and F did nothing. A popup that stays on screen after
// "closed", or an app that quits, is the other half of the regression.
//
// Package http://localhost:8731/selfclose as well: its page calls
// window.close() in its first script, as a callback page does. The window
// must stay open with the title "S still here" and the app must keep running.
import http from "node:http";

const APP = 8731;
const PROVIDER = 8732;
const delay = Number(process.argv[2] || 3000);

const appPage = `<!doctype html><meta charset=utf-8><title>H start</title>
<style>button{display:block;width:300px;height:60px;margin:20px;font-size:18px}
iframe{border:1px solid #999;width:340px;height:110px;margin:0 20px}</style>
<button id=g>G provider popup</button>
<button id=n>N own-site popup</button>
<iframe src="http://127.0.0.1:${PROVIDER}/button"></iframe>
<pre id=log></pre>
<script>
const log=[];function show(){document.title='H '+log.join(' | ');document.getElementById('log').textContent=log.join('\\n')}
addEventListener('message',e=>{log.push('MSG '+e.origin+' '+JSON.stringify(e.data));show()});
function watch(p,tag){log.push(tag+' open='+(p?(p===window?'self':'proxy'):'null'));show();
 if(!p||p===window)return;const t=setInterval(()=>{if(p.closed){log.push(tag+' closed');show();clearInterval(t)}},300)}
g.onclick=()=>watch(window.open('http://127.0.0.1:${PROVIDER}/o/oauth2/v2/auth?redirect_uri='+encodeURIComponent('http://localhost:${APP}/callback?via=g'),'g_auth_token_window','toolbar=no,width=590,height=630,top=143,left=569'),'G');
n.onclick=()=>watch(window.open('/popup-start?via=n',' Login','toolbar=0,menubar=0,location=0,width=610,height=600,scrollbars=1'),'N');
show();
</script>`;

const callbackPage = `<!doctype html><meta charset=utf-8><title>callback</title><script>
const q=new URLSearchParams(location.search);
if(window.opener){window.opener.postMessage({code:q.get('code'),via:q.get('via')},'*');window.close()}
</script>`;

const providerPage = `<!doctype html><meta charset=utf-8><title>Provider sign-in</title>
<h1>Provider sign-in</h1><p id=s></p><script>
const q=new URLSearchParams(location.search);
document.getElementById('s').textContent='opener='+(window.opener?'yes':'no');
setTimeout(()=>{if(q.get('mode')==='frame'){if(window.opener){window.opener.postMessage({code:'frame-ok'},'*')}window.close()}
else{const u=new URL(q.get('redirect_uri'));u.searchParams.set('code','ok');location.href=u.href}},${delay});
</script>`;

const buttonPage = `<!doctype html><meta charset=utf-8><button id=f style="width:300px;height:60px;margin:20px;font-size:18px">F frame popup</button><script>
addEventListener('message',e=>{parent.postMessage({frame:e.data,from:e.origin},'*')});
f.onclick=()=>{const p=window.open('/o/oauth2/v2/auth?mode=frame','g_frame_window','width=500,height=600,top=100,left=100');
 parent.postMessage({frameOpen:p?'proxy':'null'},'*');
 if(p){const t=setInterval(()=>{if(p.closed){parent.postMessage({frameClosed:true},'*');clearInterval(t)}},300)}};
</script>`;

function send(response, body, status = 200, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  response.end(body);
}

const selfClosePage = `<!doctype html><meta charset=utf-8><title>S closing</title><script>
window.close();
setTimeout(()=>{document.title='S still here'},1500);
</script><h1>This window closes itself while loading</h1>`;

const routes = {
  [APP]: {
    "/": (response) => send(response, appPage),
    "/popup-start": (response) =>
      send(response, "", 302, {
        Location: `http://127.0.0.1:${PROVIDER}/o/oauth2/v2/auth?redirect_uri=${encodeURIComponent(`http://localhost:${APP}/callback?via=n`)}`,
      }),
    "/callback": (response) => send(response, callbackPage),
    "/selfclose": (response) => send(response, selfClosePage),
  },
  [PROVIDER]: {
    "/o/oauth2/v2/auth": (response) => send(response, providerPage),
    "/button": (response) => send(response, buttonPage),
  },
};

for (const port of [APP, PROVIDER]) {
  http
    .createServer((request, response) => {
      const route =
        routes[port][new URL(request.url, "http://localhost").pathname];
      if (route) route(response);
      else send(response, "not found", 404);
    })
    .listen(port, "127.0.0.1");
}
console.log(`ready: package http://localhost:${APP}/`);
