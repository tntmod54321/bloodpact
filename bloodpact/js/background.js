const manifest = chrome.runtime.getManifest();
const api_root = manifest.context === 'dev' ? 'http://localhost:11803' : 'https://sc-cache-api.strangled.net';
let access_token;
let is_polling = false;

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

chrome.webRequest.onHeadersReceived.addListener(
    function(details) {
		// disable js on cache urls to prevent bad redirects
        const headers = details.responseHeaders.filter(header => 
            header.name.toLowerCase() !== 'content-security-policy'
        );
        headers.push({
            name: "Content-Security-Policy",
            value: "script-src 'none';"
        });
		
		let redirect;
		if (details.statusCode === 302) {
			redirect = details.responseHeaders.find(header => header.name.toLowerCase() === "location").value;
		};
		
		if (details.statusCode === 302 && redirect && redirect.includes('ya.ru/404') && !(details.url.includes('/favicon.ico'))) {
			(async () => {
				access_token = await getAccessToken();
				await fetch(api_root + '/yandex_cache', {
					method: 'POST',
					body: JSON.stringify({url: details.url, html: '', error: '404'}),
					headers: {'x-bloodpact-token': access_token}
				});
			})();
			chrome.tabs.remove(details.tabId);
			return {};
		}
		
        return { responseHeaders: headers };
    },
    { urls: ["*://yandexwebcache.net/*"] },
    ["blocking", "responseHeaders"]
);

// block lazy serp loads, redirect requesting page
chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    const url = new URL(details.url);

    if (url.searchParams.has("ajax") && /^\/search\/?$/.test(url.pathname)) {
      url.searchParams.delete("ajax");

	  // redirect req
      chrome.tabs.update(details.tabId, { url: url.toString() });
      return { cancel: true };
    }
    return { cancel: false };
  },
  {
    urls: ["*://yandex.com/search*"],
	types: ["xmlhttprequest"]
  },
  ["blocking"]
);

// yandex serp api poller
let ydxPollingQueue = {};

function ydxAddToQueue(id, tab_id) {
  ydxPollingQueue[Number(id)] = tab_id;
}

function startPolling() {
  setInterval(() => {
    if (!is_polling && Object.keys(ydxPollingQueue).length > 0) {
      is_polling = true;
      ydxPollApi(ydxPollingQueue).then((scraped_serps) => {
		  // remove finished ids
		  Array.from(scraped_serps).forEach(function (serp_id) {delete ydxPollingQueue[serp_id]})
	  }).finally(() => {
		is_polling = false; 
	  });
    }
  }, 500);
}

// Function to make a batched API request
async function ydxPollApi(batchIds) {
  try {
    const response = await fetch(api_root + '/yandex_cachepoll', {
      method: 'POST',
      body: JSON.stringify({ serp_ids: [...Object.keys(ydxPollingQueue)] }),
	  headers: {'x-bloodpact-token': access_token}
    });
	return await ydxHandleApiResponse(batchIds, await response.json());
  } catch (error) {
    console.error("Error polling ydx API:", error);
  }
}

// Function to handle the API response and update tabs
function ydxHandleApiResponse(pollQueue, apiResp) {
  let scraped_serps = new Set();
  // update cache icons
  for (const [serp_id, data] of Object.entries(apiResp)) {
    let serp_tab = pollQueue[serp_id];
    if (data['status'] === 'scraped' || data['status'] === 'metadata') {
		scraped_serps.add(Number(serp_id));
		chrome.tabs.get(serp_tab, (tab) => {
			if (chrome.runtime.lastError) {
				console.error("Error fetching tab:", chrome.runtime.lastError.message);
			} else {
				chrome.tabs.sendMessage(serp_tab, {action: 'cache_status', 'cache_status': data['status'], 'ident': data['ident'], 'metacnt': data['metacnt'], 'serp_id': serp_id});
			}
		});
	}
  }
  return scraped_serps;
}

let reloadTracker = {};

async function getAllTabIds() {
    return new Promise((resolve) => {
        chrome.tabs.query({}, (tabs) => {
            resolve(tabs.map(tab => tab.id));
        });
    });
}

async function cleanUpMissingTabs() {
    let existingTabIds = await getAllTabIds();
    for (let tabId in reloadTracker) {
        if (!existingTabIds.includes(Number(tabId))) {
            delete reloadTracker[tabId];
        }
    }
}

async function getStorageValues(defaults) {
    return new Promise((resolve) => {
        chrome.storage.local.get(Object.keys(defaults), (result) => {
            let finalValues = {};
            for (let key in defaults) {
                finalValues[key] = result[key] !== undefined ? result[key] : defaults[key];
            }
            resolve(finalValues);
        });
    });
}

// automatically reload errored pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete") {
        handleTabUpdate(tabId, tab);
    }
});

async function handleTabUpdate(tabId, tab) {
    try {
        let url = new URL(tab.url);
        if (url.hostname.includes('yandexwebcache.net')) { // check loaded yandex cache tabs
            
            if (!(tabId in reloadTracker)) {
                reloadTracker[tabId] = 0;
            }

            const { retries, retry_delay } = await getStorageValues({
                retries: 0,
                retry_delay: 10
            });
			
            if (reloadTracker[tabId] < retries) {
                setTimeout(() => {
					chrome.tabs.get(tabId, (tab) => {
						if (chrome.runtime.lastError || !tab) {delete reloadTracker[tabId]; return;}
						
						chrome.tabs.reload(tabId, () => {
							if (chrome.runtime.lastError) {
								delete reloadTracker[tabId];
							} else {
								console.log(`Reloaded tab ${tabId} (${reloadTracker[tabId]}/${retries})`);
							}
						});
					});
					reloadTracker[tabId]++; //? was moving it here a good idea?
				}, retry_delay * 1000);
            }
			
            await cleanUpMissingTabs();
        }
    } catch (e) {
        console.error(`Error reloading tab: ${tab.url}`, e);
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "closeTab") {
	// close tab on script request
    if (sender.tab && sender.tab.id) {
      chrome.tabs.remove(sender.tab.id, () => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError.message);
        }
      });
    }
  } else if (message.action === "ydxAddToQueue") {
	// add ydx serp id to cache poll queue
	access_token = message.access_token;
	ydxAddToQueue(message.serp_id, sender.tab.id);
  } else if (message.action === 'pollOpenYdxCacheTabs') {
	  // get open ydx cache tabs
	  chrome.tabs.query({}, function(tabs) {
		  const count = tabs.filter(t => (t.url || t.pendingUrl).includes('yandexwebcache') && new URL((t.url || t.pendingUrl)).host == 'yandexwebcache.net').length;
		  chrome.tabs.sendMessage(sender.tab.id, {action: "currentlyOpenYdxCacheTabs", count: count})
	  });
  } else if (message.action === 'openTabInBg') {
	  chrome.tabs.create({ url: message.url, active: false });
  } else if (message.action === 'checkTabRetries') {
	  sendResponse({retries: reloadTracker[sender.tab.id]});
  }

});

startPolling();