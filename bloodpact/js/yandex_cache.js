const manifest = chrome.runtime.getManifest();
const api_root = manifest.context === 'dev' ? 'http://localhost:11803' : 'https://sc-cache-api.strangled.net';

// send body, then close tab if successful

async function storageGet(key, defaultValue) {
    return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
            resolve(result[key] !== undefined ? result[key] : defaultValue);
        });
    });
}

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
	.then(async response => {
		if (!response.ok) {
			const msgBanner = document.createElement('div');
			
			msgBanner.innerHTML = `<header style="color: #000000;top: 0;right: 0;left: 0;z-index: 1;position: fixed;font-size:30px;-webkit-text-stroke: 1px black;background: #FFFFFF;">Scraper: serverside metadata extraction failed. Refresh page. If error persists move on.<br>Performed <span id="attempt_cnt">UNSET</span>/<span id="retries_cnt">UNSET</span> retries</header>`;
			document.querySelector('body').append(msgBanner);
			
			await new Promise((resolve) => setTimeout(resolve, 0)); // Let DOM update // ig?
			
			const retries = await storageGet('retries', 0);
            document.getElementById('retries_cnt').innerText = retries;
			
			chrome.runtime.sendMessage({ action: 'checkTabRetries' }, (response) => {
				console.log(response);
                if (response && response.retries !== undefined) {
                    document.getElementById('attempt_cnt').innerText = response.retries;
                }
            });
			
			throw new Error('BAD YDX CACHE API RESPONSE!');
		}
		return null;
	})
	.then(() => {
		chrome.runtime.sendMessage({action: 'closeTab'});
	})
	.catch(error => {console.error(error)});
})();
