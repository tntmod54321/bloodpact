// fetch and display metadata
(async () => {
  try {
	const response = await fetch(api_root + '/leaderboard', {method: 'GET'});
	data = await response.json();
	
	// update timestamp
	document.getElementById('leaderboardUpdatedTime').innerText = new Date(data.unixts * 1000).toString();
	
	// write total
	document.getElementById('total1').innerText = data.counts[0].split(',')[1];
	document.getElementById('total2').innerText = data.counts[0].split(',')[2];
	
	const tableBody = document.getElementById('leaderboardBody');
	for (let i = 1; i < data.counts.length; i++) {
		const [user, caches, metas] = data.counts[i].split(',');
		const row = document.createElement('tr');
		row.innerHTML = `<td>${i-1}</td><td>${user}</td><td>${caches}</td><td>${metas}</td>`;
		tableBody.append(row);
	}
  } catch (error) {
    console.error('stats fetch err:', error);
  }
})();
