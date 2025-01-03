const pageLoad = new Date().getTime();

const manifest = chrome.runtime.getManifest();
const api_root = manifest.context === 'dev' ? 'http://localhost:11803' : 'https://sc-cache-api.strangled.net';

let apiResp = {data: null};
let uniqCacheStatus = {};
let cacheStatus = {};
let openCacheTabs = 0;
let access_token;

// import icons
const svgUrls = {
  fdVec: 'img/floppy_disk.svg',
  userVec: 'img/user.svg',
  trackVec: 'img/track.svg',
  setVec: 'img/set.svg',
  publicVec: 'img/public.svg',
  dbVec: 'img/database.svg',
  dbVec2: 'img/database2.svg',
  mobileVec: 'img/mobile.svg',
  desktopVec: 'img/desktop.svg',
  loaderVec: 'img/loader.svg',
  homeVec: 'img/home.svg',
  pageVec: 'img/page.svg',
};
const svgs = {};

function loadSvgs() {
  const fetchPromises = Object.entries(svgUrls).map(([key, path]) =>
    fetch(chrome.runtime.getURL(path))
      .then(response => response.text())
      .then(svg => {
        svgs[key] = svg;
      })
  );
  return Promise.all(fetchPromises);
}

const GREEN = '#00FF00';
const CYAN3 = '#56ffc1';
const GRAY = '#858585';
const HIGHLIGHTED = '#F3FF4F';
const CYAN = '#176978';
const CYAN2 = '#41ffed';
const ORANGE = '#ff8000';

function setAttributes(element, attributes) {
  if (element){
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value);
  }
  } else {
	  console.error('passed null element');
  }
}

function setCacheIcon(serp_id, status, metacnt = 0) {
	const cachelink = document.querySelector(`#ydxcachelink-${serp_id}`);
	
	cachelink.setAttribute('cachestatus', status);
	cachevec = cachelink.querySelector('.cachevec')
	cachevec.innerHTML = `<div class="cachevecico">${svgs.fdVec}</div><div class="loadervecico" style="display: none">${svgs.loaderVec}</div>`;
	loadervec = cachevec.querySelector('.loadervecico svg');
	cachevec = cachevec.querySelector('.cachevecico svg');
	
	setAttributes(cachevec, {
		'height': '20px',
		'width': '20px'
	});
	
	const highlighted_yr = cachelink.querySelector('.scraper_highlight');
	const metavec = cachelink.parentElement.querySelector('.metavec');
	const pagevec = cachelink.parentElement.querySelector('.pagevec');
	switch (status) {
		case 'unscraped':
			cachevec.setAttribute('fill', GRAY);
			cachelink.setAttribute('title', 'cache is not scraped');
			cachelink.style.color = 'none';
			break;
		case 'scraped':
			cachevec.setAttribute('fill', ORANGE);
			cachelink.setAttribute('title', 'cache page was scraped but metadata extraction failed');
			cachelink.style.color = ORANGE;
			if (highlighted_yr) {highlighted_yr.classList.remove('scraper_highlight')}
			metavec.querySelector('.metavectext').innerText = metacnt;
			metavec.querySelector('.metavectext').style.setProperty('color', GRAY, '');
			break;
		case 'metadata':
			cachevec.setAttribute('fill', GREEN);
			cachelink.setAttribute('title', 'cache page was successfully scraped');
			cachelink.style.color = GREEN;
			if (highlighted_yr) {highlighted_yr.classList.remove('scraper_highlight')}
			metavec.setAttribute('href', metavec.getAttribute('href_inactive'));
			metavec.querySelector('svg').setAttribute('fill', HIGHLIGHTED);
			metavec.querySelector('.metavectext').innerText = metacnt;
			
			pagevec.querySelector('svg').setAttribute('fill', HIGHLIGHTED);
			pagevec.setAttribute('href', pagevec.getAttribute('href_inactive'));
			
			break;
	}
	
	setAttributes(loadervec, {
		'height': '20px',
		'width': '20px',
		'fill': CYAN2,
		'loadervec': 'true'
	});
}

function updateResultsCnt() {
	const totalCnt = document.getElementById('scraperUnscrapedCount');
	const uniqCnt = document.getElementById('scraperUniqUnscrapedCount');
	if (uniqCnt) {
		uniqCnt.textContent = Object.values(uniqCacheStatus).filter(v => v === "unscraped").length;}
	if (totalCnt) {totalCnt.textContent = Object.values(cacheStatus).filter(v => v === "unscraped").length;}
	
	if (totalCnt && totalCnt.textContent === '0') {
		totalCnt.parentElement.style.color = GREEN;
	} else if (totalCnt && totalCnt.textContent > 0) {
		totalCnt.parentElement.style.color = 'white';
	}
}

function addNavbar() {
	// get prev/next links
	var prevLink;
	var nextLink;
	
	const url = new URL(window.location.href);
	const currentPage = url.searchParams.get('p');
	
	if (document.querySelector('.Pager-Item_type_begin')) {
		prevLink = document.querySelector('.Pager-Item_type_begin').href
	} else {prevLink = null}
	if (document.querySelector('.Pager-ListItem_type_next a')) {
		nextLink = document.querySelector('.Pager-ListItem_type_next a').href
	} else {nextLink = null}
	
	// update navbar
	const pageHeader = document.querySelector('.HeaderDesktop');
	const newNavbar = document.createElement('nav');
	newNavbar.innerHTML = `
	<div id="scraperNavbar" class="HeaderDesktop-Navigation" style="margin-top: 10px; display: flex; align-items: center; font-size: 16px;">
		<div id="scraperHomeVec" style="margin-right:10px; padding:3px; border-radius: 2rem; outline: solid white; display: flex; align-items: center; color: white;"><a href="${chrome.runtime.getURL('/html/search_metadata.html')}">${svgs.homeVec}</a></div>
		<div id="scraperPagenav" style="border-radius: 2rem; outline: solid white; display: flex; align-items: center; color: white;">
			<a id="scraperPrevlink" style="margin: 3px;text-decoration: none;color: white;">🢀</a>
			<div>${Number(currentPage)+1}</div>
			<a id="scraperNextlink" style="margin: 3px;text-decoration: none;color: white;">🢂</a>
		</div>
		<div style="margin-left:10px; overflow: hidden;border-radius: 2rem; outline: solid white; display: flex; align-items: center;">
			<button id="scrapeAllButton" style="display: flex; align-items: center;" disabled>
				<span style="margin:3px">save all</span>
				<div id="scrapeallicon">${svgs.fdVec}</div>
			</button>
			<span style="margin:3px">concurrency:</span>
			<input style="width: 2em" id="scraperConcurrencyInput" type="number" min="1" max="5" value="${localStorage.getItem('concurrency') || 2}">
		</div>
		<div style="margin-left:10px; overflow: hidden;border-radius: 2rem; outline: solid white; display: flex; align-items: center;">
			<span style="margin:3px">auto-paginate:</span>
			<input id="scraperPaginateInput" type="checkbox">
			<span style="margin:3px">delay:</span>
			<input style="width: 3em" id="scraperPaginateDelayInput" type="number" min="1" value="${localStorage.getItem('paginate_delay') || 15}">
		</div>
		<div id="scrapedCount" style="padding-left: 5px; margin: 5px;"><span id="scraperUnscrapedCount"></span>/<span id="scraperUniqUnscrapedCount"></span> total/unique unscraped</div>
	</div>`;
	pageHeader.append(newNavbar);
	updateResultsCnt();
	
	if (localStorage.getItem('paginate') === 'true') {
		document.getElementById('scraperPaginateInput').setAttribute('checked', '');
	}
	
	// fix home icon
	setAttributes(newNavbar.querySelector('#scraperHomeVec svg'), {
		'fill': 'white',
		'height': '20px',
		'width': '20px',
	});
	
	// fix icon
	setAttributes(newNavbar.querySelector('#scrapeallicon svg'), {
		'fill': 'white',
		'height': '20px',
		'width': '20px',
	});
	
	document.getElementById('scrapeAllButton').addEventListener('click', function() {
        scrapeAll();
    });
	
	// add concurrency input listener
	const concurrencyinput = document.getElementById('scraperConcurrencyInput');
	concurrencyinput.addEventListener('input', () => {
	  localStorage.setItem('concurrency', concurrencyinput.value);
	});
	
	// add paginate input listener
	const paginateinput = document.getElementById('scraperPaginateInput');
	paginateinput.addEventListener('input', () => {
	  localStorage.setItem('paginate', paginateinput.checked);
	  if (paginateinput.checked) {
		  scrapeAll();
	  }
	});
	
	// add paginate input listener
	const paginatedelayinput = document.getElementById('scraperPaginateDelayInput');
	paginatedelayinput.addEventListener('input', () => {
	  localStorage.setItem('paginate_delay', paginatedelayinput.value);
	});
	
	// add page links
	if (currentPage > 0) {
		url.searchParams.set('p', Number(currentPage) - 1);
		document.getElementById('scraperPrevlink').href = url.toString();
	} else {document.getElementById('scraperPrevlink').setAttribute('style', `color:${GRAY}`);}
	if (document.querySelectorAll('.Pager-Item_type_next').length) {
		url.searchParams.set('p', Number(currentPage) + 1);
		document.getElementById('scraperNextlink').href = url.toString();
	} else {document.getElementById('scraperNextlink').setAttribute('style', `color:${GRAY}`);}
	
	// update results padding to accomodate navbar
	document.querySelector('.HeaderDesktopPlaceholder').style = `padding-top: ${document.querySelector('.HeaderDesktop').offsetHeight}px`;
}

function startCachePolling(serp_id) {
	// switch icons
	document.querySelector(`#ydxcachelink-${serp_id} .cachevecico`).setAttribute('style', 'display:none');
	document.querySelector(`#ydxcachelink-${serp_id} .loadervecico`).setAttribute('style', '');
	chrome.runtime.sendMessage({action: "ydxAddToQueue", serp_id: serp_id, access_token: access_token});
}

// shit chatgpt func
async function waitForFreeTabSlot(interval = 200) {
  return new Promise((resolve, reject) => {
    // const maxWaitTime = 100000; // Set a timeout to avoid infinite wait (100 seconds here)
    // const startTime = Date.now();

    const checkValue = () => {
      const concurrency = parseInt(localStorage.getItem('concurrency'));
      if (openCacheTabs < concurrency) {
        resolve(); // Resolve when the condition is met
      }
	  // else if (Date.now() - startTime > maxWaitTime) {
        // reject(new Error("Timeout: No free tab slot available within the allowed time."));
      // }
	  else {
        setTimeout(checkValue, interval); // Check again after the specified interval
      }
    };

    checkValue();
  });
}

async function scrapeAll() {
	// disable button
	document.getElementById('scrapeAllButton').setAttribute('disabled', '');
	
	// set loading icon
	icon = document.querySelector('#scrapeallicon svg');
	if (icon) {
		icon.outerHTML = svgs.loaderVec;
		setAttributes(document.querySelector('#scrapeallicon svg'), {
			'fill': 'white',
			'height': '20px',
			'width': '20px',
			'loadervec': 'true',
		});
	}
	
	try {
    // Loop through all "unscraped" serp_ids
    for (const serp_id of Object.keys(cacheStatus).filter(k => cacheStatus[k] === "unscraped")) {
      const cachelink = document.getElementById(`ydxcachelink-${serp_id}`);
      const serpItem = apiResp.data.results[String(serp_id)];
      
      if (cachelink && serpItem?.ident) {
		// wait for open cache tabs count to decrease
		await waitForFreeTabSlot();
        console.log('opened', serpItem.serp_id, serpItem.ident);
		chrome.runtime.sendMessage({action: 'openTabInBg', url: cachelink.href});
		openCacheTabs += 1; // increase before poll returns
        await startCachePolling(serp_id);
      }
    }

    // Disable loader (once all processing is done)
    document.getElementById('scrapeallicon')?.remove();
	
	// autopaginate if wanted
	const nextPageEl = document.getElementById('scraperNextlink');
	if (((!(localStorage.getItem('paginate') === 'false')) || false) && nextPageEl.href) {
		const now = new Date().getTime();
		const elapsed = now - pageLoad;
		const delay = localStorage.getItem('paginate_delay') * 1000;
		
		if (elapsed < delay) {
			console.log('waiting', delay - (now - pageLoad));
			document.getElementById('scrapedCount').innerText = `waiting ${Math.round((Math.round((delay - elapsed) * 10) / 1000) * 10) / 100}s`;
			setTimeout(() => {nextPageEl.click()}, delay - elapsed);
		} else{
			nextPageEl.click();
		}
	}
  } catch (error) {
    console.error("Error processing cache status:", error);
  }
}

function updatePage(data) {
	apiResp.data = data;
	const textHighlight = document.createElement('style');
	textHighlight.innerHTML = '.scraper_highlight {color: #000000; background-color: #FFFF00}';
	document.querySelector('head').prepend(textHighlight);
	
	// remove ANNOYING css that makes the link box bigger
	document.querySelectorAll(`.OrganicTitle-Link`).forEach(element => {element.classList.remove('OrganicTitle-Link')});
	
	// set cache status
	for (const serpItem of Object.values(data.results)) {uniqCacheStatus[serpItem.ident] = serpItem.cache_status;}
	for (const serpItem of Object.values(data.results)) {cacheStatus[serpItem.serp_id] = serpItem.cache_status;}
	
	// enable save all button
	document.getElementById('scrapeAllButton').removeAttribute('disabled')
	
	// add cache widgets to results
	for (const serpItem of Object.values(data.results)) {
		const serpElement = document.querySelector(`.${data.card_key}[data-cid="${serpItem.i}"]`)
		if (!serpItem) {
			console.error('unable to find serp card', data.card_key, serpItem.i);
		}
		else if (!serpItem.cu) {}
		else {
			// write cache info
			const cacheInfo = document.createElement('div')
			cacheInfo.innerHTML = `
				<div style="display: flex; align-items: center; font-size: 16px; height: 30px">
				<div style="margin-right: 5px" class="platvec"></div>
				<a class="serpydxcachelink" id="ydxcachelink-${serpItem.serp_id}" target="_blank" href="${serpItem.cu}" style="display: flex; align-items: center; background-color: transparent;border:10">
				<div class="cachevec">
				</div>
				<div style="margin: 4px">${serpItem.ct}</div>
				</a>
				<a style="display: flex; align-items: center; text-decoration: none; margin-right:4px;" class="pagevec" target="_blank" href_inactive="${chrome.runtime.getURL('/html/view_cache.html')}?serp_id=${serpItem.serp_id}" title="view scraped page">
				<div class="pagevecreal"></div>
				</a>
				<a style="display: flex; align-items: center; text-decoration: none;" class="metavec" target="_blank" href_inactive="${chrome.runtime.getURL('/html/view_cache.html')}?data=${serpItem.metadata_slug}" title="view scraped metadata">
				<div class="metavecreal"></div>
				<div class="metavectext" style="margin-left: 5px; color: ${HIGHLIGHTED};"></div>
				</a>
				</div>`
			serpElement.prepend(cacheInfo)
			
			// start polling cache when cache is opened
			document.getElementById(`ydxcachelink-${serpItem.serp_id}`).addEventListener('mousedown', (event) => {
				if ([0, 1].includes(event.button)) {startCachePolling(serpItem.serp_id);}});
			
			// format plat vec
			const platvec = cacheInfo.querySelector('.platvec');
			var platColor = GRAY;
			if (serpItem.platform == 'mobile'){platvec.innerHTML = svgs.mobileVec; platColor = CYAN3; platvec.setAttribute('title', 'mobile site');}
			else {platvec.innerHTML = svgs.desktopVec;platvec.setAttribute('title', 'desktop site');}
			setAttributes(platvec.querySelector('svg'), {
				'height': '20px',
				'width': '20px',
				'fill': platColor});
			
			// set page icon
			const pagevec = cacheInfo.querySelector('.pagevecreal')
			pagevec.innerHTML = svgs.pageVec;
			setAttributes(pagevec.querySelector('svg'), {
				'height': '20px',
				'width': '20px',
				'fill': GRAY,
			});
			
			// set meta icon
			const metavec = cacheInfo.querySelector('.metavecreal')
			metavec.innerHTML = svgs.dbVec2;
			setAttributes(metavec.querySelector('svg'), {
				'height': '20px',
				'width': '20px',
				'fill': GRAY,
			});
			
			// set cache icon
			cacheInfo.querySelector(`#ydxcachelink-${serpItem.serp_id}`).setAttribute('serp_id', serpItem.serp_id);
			setCacheIcon(serpItem.serp_id, serpItem.cache_status, serpItem.metacnt);
			
			const pathElement = serpElement.querySelector('.path__item')
			if (serpItem.ident) {
				// overwrite path
				pathElement.textContent = serpItem.ident;
				
				// insert svg
				var kindVec = document.createElement('div')
				kindVec.style = 'display: flex; align-items: center; margin-right: 4px;';
				var color = GRAY
				switch (serpItem.ident_type) {
					case 'track': kindVec.innerHTML = svgs.trackVec; var color=CYAN; break;
					case 'set': kindVec.innerHTML = svgs.setVec; var color=GREEN; break;
					case 'user': kindVec.innerHTML = svgs.userVec; var color=CYAN; break;}
				setAttributes(kindVec.querySelector('svg'), {
					'height': '16px', 'width': '16px', 'fill': color});
				pathElement.parentElement.prepend(kindVec);
			}
			
			// highlight url
			if (serpItem.is_target) {
				pathElement.style.color = HIGHLIGHTED;
			}
			
			//highlight cache year
			if (serpItem.cy_hl) {
				document.getElementById(`cacheyr-${serpItem.serp_id}`).classList.add('scraper_highlight');
			}
		}
	}
	
	// auto-paginate if desired
	if (localStorage.getItem('paginate') === 'true') {
		scrapeAll();
	}
}

// make sure we have unique user id (garbage chatgpt code)
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

// fetch svgs and add navbar
let iconsPreloaded = false;
(async () => {
	loadSvgs().then(() => {
		iconsPreloaded = true;
		addNavbar();
	});
})();

// set navbar
setInterval(() => {
	var navbars = document.querySelectorAll('#scraperNavbar');
	
	while (navbars.length > 1) {
		navbars[0].remove();
		navbars = document.querySelectorAll('#scraperNavbar');
	}
	if (navbars.length < 1 && iconsPreloaded) {
		addNavbar();
	}
	
	if (document.querySelector('.HeaderDesktopPlaceholder').style.paddingTop != `${document.querySelector('.HeaderDesktop').offsetHeight}px`) {
		document.querySelector('.HeaderDesktopPlaceholder').style = `padding-top: ${document.querySelector('.HeaderDesktop').offsetHeight}px`;
	}
}
, 50);

// send serp body, retrieve info
(async () => {
	access_token = await getAccessToken();
	// console.log('ACCESS TOKEN:', access_token);
	
	// await loadSvgs();
	
	loadSvgs().then(() => {
	fetch(api_root + '/yandex_serp', {
		method: 'POST',
		body: JSON.stringify({
			url: document.documentURI,
			html: document.documentElement.outerHTML,
		}),
		headers: {'x-bloodpact-token': access_token}
	})
	.then(response => {
		if (response.status == 401) {
			// redirect to login prompt
			window.location = chrome.runtime.getURL('/html/login.html');
			throw new Error('YAY 401');
		} else if (!response.ok) {throw new Error('BAD YDX SERP API RESPONSE!');}
		return response.json();
	})
	.then(data => {
		updatePage(data);
		apiResp.data = data;
	})
	.catch(error => {console.error(error)});
	});
})();

// rotate loading icons
setInterval(() => document.querySelectorAll('[loadervec=true]').forEach(el => el.style.transform = `rotate(${(parseInt(el.style.transform.replace('rotate(', '').replace('deg)', '') || 0) + 11) % 360}deg)`), 50);

// update results cnt
setInterval(() => updateResultsCnt(), 150);

// poll currently open tabs cnt
setInterval(() => chrome.runtime.sendMessage({action: 'pollOpenYdxCacheTabs'}), 200);

chrome.runtime.onMessage.addListener((message) => {
	if (message.action === 'cache_status') {
		// listen for cache updates
		const cacheLink = document.querySelector(`#ydxcachelink-${message.serp_id}`);
		if (cacheLink){
			setCacheIcon(message.serp_id, message.cache_status, message.metacnt);
			uniqCacheStatus[message.ident] = message.cache_status;
			cacheStatus[message.serp_id] = message.cache_status;
		}
	} else if (message.action === 'currentlyOpenYdxCacheTabs') {
		openCacheTabs = message.count;
	}
});
