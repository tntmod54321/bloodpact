# bloodpact  
Yandex Cache scraper extension  

# installation  
on the cli:  
install dependencies using pip  
  windows: `py -m pip install -U -r requirements.txt`  
  unix: `python -m pip install -U -r requirements.txt`  
install chromium `playwright install chromium`  
run start_browser  
  windows: `py start_browser.py`  
  unix: `python start_browser.py`  

# usage  
upon visiting a yandex.com search page you will be redirected to a signup/login page,  
afterwards you can revist the search page and start browsing.  

While you can install the extension in your normal browser it is HIGHLY recommended to use  
the bundled browser script instead. Other installed extensions could affect functionality or compromise  
the archived data by modifying it. Plus the script includes automatic updates for the extension.  

## scraping
Any cache page you visit will be scraped and automatically closed, you can open a cache page by clicking  
the floppy disk icon, cache timestamp, or by clicking "save all" at the top of the page.  
The concurrency option is the number of pages that will be opened at once when clicking "save all".  
The auto-paginate option will go to the next page once there are no more pages left to scrape,  
The delay option is the minimum time before the page will be changed (default 20s).  
If the cache year is before the current year, it will be highlighted.  
The type of page (track/user/playlist) is guessed by the url and displayed next to it.  
If a username can be parsed out of your search query, then matching results urls will be highlighted.  
There is an icon indicating if the page is a mobile or desktop page.  

## writing good search queries
A query you might make is `site:soundcloud.com soundcloud.com/menthol100s`  
This should theoretically return all results from that url, however thare are some caveats.  
Yandex only serves up to 25 pages, with 10 results each, if there is a similar number of results  
then it may be necessary to further refine your search to find more. For one you can change `site:soundcloud.com`  
to `site:m.soundcloud.com`, which should return only mobile pages. Or you can add producers/features/etc to your query  
as well (one at a time). For example, `site:soundcloud.com soundcloud.com/menthol100s jacko`.  
It's generally good practice to do this anyway for searches that have more than a few results, as for whatever  
reason some pages are not always returned.  
You will want to search for all urls you've known that user to have like `soundcloud.com/{username}`, but it might also  
be a good idea to just search actual usernames they've had if they're distinctive enough, combining with prods/feats as need,
like `site:soundcloud.com wifiskeleton` or `site:soundcloud.com wifiskeleton keepsecrets`.  
One thing I've noticed is that when yandex is running thin on results for your query, sometimes it will just start returning  
random soundcloud pages that are only a few days old.

## failed captures
Sometimes yandex will return 404 pages when visiting a cached page,  
this can be for several reasons, either the url is expired (they only last a few hours),  
the capture has been deleted, or (very rarely) as an anti scraping measure.  
These pages will not be closed automatically.  

Sometimes a capture page will be completely blank with a header at the top stating to refresh the page,  
this is an error relating to yandex being overloaded, or too many cache pages being open(ed). You should be able  
to get it to reload by refreshing the page 1-3 times.  

However, if the page is not completely blank, and there is no header stating to refresh the page,  
then the extension may have failed to load. I don't know why this happens sometimes, but refresh once or twice.  

## Which pages should I scrape?  
We are targeting pages for deleted tracks/users, pages that are 2022 or earlier,  
or mobile pages (mobile pages contain MUCH more metadata, usually 10-30 tracks.)  
But really, everything. Please scrape as many soundcloud pages as you can/want.  
The pages are very small, they are stored compressed, and this data is extremely valuable.
My sample of 50k tracks/11k pages is less than 700MB.  
This data is so rare, and Yandex deletes old caches everyday. It's only a matter of time before they remove the feature entirely.  
Feel free to scrape non-soundcloud yandex cache pages for posterity.

## viewing captured data
You can view metadata scraped from a specific page by clicking the filing cabinet icon,  
you can view the raw page by clicking the page icon, or you can use the metadata search  
by clicking the home icon near the top of the page.  
**Please note that raw pages may be subject to periodic removal due to my server having a small hdd. removed raw pages can be made retrieved upon request if needed**

## data access
All metadata is available to all users by url/permalink/ids using the api or search page,  
Full metadata dumps and page dumps will be shared in the near future upon reaching milestones or yandex cache being shutdown.  

# api docs  
api root is sc-cache-api.strangled.net  
most requests require a valid token to be present in the x-bloodpact-token header,  
endpoints for listing and retrieving archived pages and metadata will be made available eventually  

## POST /login  
request body must be a json dict containing the keys "username", and "password",  
the user will either be created or a login attempt will be made.  

## POST /metadata_search  
request body must be a json dict containing the key "query", optionally "kinds", and "track_substring".  

the "query" value must be in the format of "{query_type}:{query}".  
The available query types are "url", "username", "userid", "trackid", "playlistid".  
Here are some example queries:  
```
url:https://soundcloud.com/menthol100s
userid:640711191
username:weejk
```
the "kinds" value must be a csv of the expected kinds to be returned by the query, "track", "user", and/or "playlist". Default value is "track,user,playlist".  
the "track_substring" value matches the first characters of a track's permalink, so if there is a track "/musicsong", then the substring "music" will match it,  
however it would not be matched if the substring was "song".  
If the track_substring query is ended by a "$" symbol, then it will only match that exact string. E.g. "music$" will only match "/music".  
Usually used for fetching a specific track by permalink but with a userid query.  