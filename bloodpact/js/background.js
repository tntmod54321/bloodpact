const manifest = chrome.runtime.getManifest();
const api_root = manifest.context === 'dev' ? 'http://localhost:11803' : 'https://sc-cache-api.strangled.net';
let access_token;
let is_polling = false;

// disable js on cache urls to prevent bad redirects
chrome.webRequest.onHeadersReceived.addListener(
    function(details) {
        const headers = details.responseHeaders.filter(header => 
            header.name.toLowerCase() !== 'content-security-policy'
        );
        headers.push({
            name: "Content-Security-Policy",
            value: "script-src 'none';"
        });
        return { responseHeaders: headers };
    },
    { urls: ["*://yandexwebcache.net/*", "*://cc.bingj.com/*"] },
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
  }

});

startPolling();