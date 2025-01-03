const manifest = chrome.runtime.getManifest();
const api_root = manifest.context === 'dev' ? 'http://localhost:11803' : 'https://sc-cache-api.strangled.net';

// send body, then close tab if successful

async function getAccessToken() {
	const { access_token } = await new Promise((resolve, reject) => {
      chrome.storage.sync.get(['access_token'], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });
    return access_token;
}

(async () => {
	access_token = await getAccessToken();
	
	fetch(api_root + '/yandex_cache', {
		method: 'POST',
		body: JSON.stringify({
			url: document.documentURI,
			html: document.documentElement.outerHTML,
		}),
		headers: {'x-bloodpact-token': access_token}
	})
	.then(response => {
		if (!response.ok) {
			const x = document.createElement('div');
			x.innerHTML = '<header style="color: #000000;top: 0;right: 0;left: 0;z-index: 1;position: fixed;font-size:30px;-webkit-text-stroke: 1px black;background: #FFFFFF;">Scarper: serverside metadata extraction failed. Refresh page. If error persists move on.</header>';
			document.querySelector('body').append(x);
			
			throw new Error('BAD YDX CACHE API RESPONSE!');
		}
		return null;
	})
	.then(() => {
		chrome.runtime.sendMessage({action: 'closeTab'});
	})
	.catch(error => {console.error(error)});
})();
