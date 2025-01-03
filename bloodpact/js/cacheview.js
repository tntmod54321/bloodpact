const manifest = chrome.runtime.getManifest();
const api_root = manifest.context === 'dev' ? 'http://localhost:11803' : 'https://sc-cache-api.strangled.net';

const params = new URLSearchParams(window.location.search);

// fetch and display metadata
(async () => {
  try {
    const access_token = await new Promise((resolve, reject) => {
      chrome.storage.sync.get(['access_token'], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result.access_token);
        }
      });
    });

	if (params.get('data')) {
		const cachets = params.get('data').split(',')[0];
		const url = atob(params.get('data').split(',')[1], 'base64');
		const response = await fetch(api_root + '/yandex_cachemeta', {
		  method: 'POST',
		  body: JSON.stringify({ url: url, cache_ts: cachets }),
		  headers: { 'x-bloodpact-token': access_token }
		});
		document.getElementById('content').innerText = await response.text();
	} else if (params.get('serp_id')) {
		const serp_id = params.get('serp_id');
		const response = await fetch(api_root + '/yandex_cachepage', {
		  method: 'POST',
		  body: JSON.stringify({ serp_id: serp_id }),
		  headers: { 'x-bloodpact-token': access_token }
		});
		document.querySelector('html').innerHTML = await response.text();
	}
  } catch (error) {
    console.error('meta fetch err:', error);
  }
})();
