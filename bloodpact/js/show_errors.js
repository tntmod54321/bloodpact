let error_offset = '';
let end_hit = false;
let isLoading = true;

async function fetch_errors(error_offset) {
	isLoading = true;
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
	
	const response = await fetch(api_root + '/errors?offset=' + error_offset, {
		method: 'GET',
		headers: { 'x-bloodpact-token': access_token }
	});
	data = await response.json();
	
	const tableBody = document.getElementById('errorsBody');
	for (let i = 0; i < data.length; i++) {
		const row = data[i]
		error_offset = Math.min('' || Infinity, row.id);
		const rowEl = document.createElement('tr');
		const ts = new Date(row.unixts * 1000);
		const date_str = `${ts.getFullYear()}/${ts.getMonth()+1}/${ts.getDate()} ${ts.getHours() % 12}:${ts.getMinutes()}`
		rowEl.innerHTML = `<td>${date_str}</td><td style="background-color:${row.has_metadata ? '#4dff29' : '#ff2929'};">${row.has_metadata ? 'T' : 'F'}</td><td style="background-color:${row.color};">${row.error}</td><td>${row.url}</td>`;
		tableBody.append(rowEl);
	}
	
	if (!(data.length)) {
		end_hit = true;
	}
  } catch (error) {
    console.error('stats fetch err:', error);
  }
  isLoading = false;
  return [end_hit, error_offset];
}

(async () => {
  [end_hit, error_offset] = await fetch_errors(error_offset);
})();

window.addEventListener("scroll", async () => {
	if (isLoading || end_hit) {return;}
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 10) {
        [end_hit, error_offset] = await fetch_errors(error_offset);
    }
});
