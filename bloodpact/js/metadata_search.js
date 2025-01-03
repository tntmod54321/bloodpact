const manifest = chrome.runtime.getManifest();
const api_root = manifest.context === 'dev' ? 'http://localhost:11803' : 'https://sc-cache-api.strangled.net';

function fetchMetadata(el) {
	const box = el.parentElement.querySelector('.queryBox');
	
	const queryType = box.getAttribute('querytype');
	const query = box.value;
	
	document.body.innerText = 'Loading...';
	
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
		
		const rawQuery = `${queryType}:${query}`;
		
		const response = await fetch(api_root + '/metadata_search', {
		  method: 'POST',
		  body: JSON.stringify({ "query": rawQuery}),
		  headers: { 'x-bloodpact-token': access_token }
		});
		
		const j = await response.json();
		document.querySelector('body').innerText = `QUERY=${rawQuery}\n${j.results_cnt} results\n\n` + j.results.map(sc => sc.pretty).join('');
	  } catch (error) {
		console.error('meta fetch err:', error);
		document.querySelector('body').innerText = `meta fetch err: ${error}`;
	  }
	})();
}

document.addEventListener('DOMContentLoaded', () => {
	document.querySelectorAll('.queryBox').forEach((box) => {
		box.addEventListener('keypress', function(event) {if (event.key === 'Enter') {fetchMetadata(box)}});
	})
	document.querySelectorAll('.queryButton').forEach((box) => {
		box.addEventListener('click', function(event) {fetchMetadata(box)});
	})
})