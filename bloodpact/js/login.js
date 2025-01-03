const manifest = chrome.runtime.getManifest();
const api_root = manifest.context === 'dev' ? 'http://localhost:11803' : 'https://sc-cache-api.strangled.net';

async function fetchToken() {
	const username = document.getElementById('userBox').value;
	const password = document.getElementById('passBox').value;
    try {
        fetch(api_root + '/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username, password: password })
        }).then(async response => {
			let msg;
			if (response.ok) {
				const data = await response.json();
				const access_token = data.access_token;
				await chrome.storage.sync.set({ access_token });
				msg = 'signed in!';
			} else {
				msg = await response.text();
			}
			msg = msg || 'err undefined msg';
			const box = document.getElementById('msgBox');
			box.textContent = msg;
		});
    } catch (error) {
        console.error('failed to login:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
	document.querySelectorAll('.loginButton').forEach((box) => {
		box.addEventListener('click', function(event) {
			(async () => fetchToken())();
		});
	})
})