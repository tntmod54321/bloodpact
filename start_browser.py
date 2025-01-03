import asyncio
import json
import os
from os.path import dirname, realpath, join, isfile, isdir
from playwright.async_api import async_playwright, Route
from playwright.sync_api import sync_playwright, Route
import requests
import shutil
import time
import zipfile

def updateext(ver):
    if isdir('./bloodpact.old'):
        shutil.rmtree('./bloodpact.old')
    if isdir('./bloodpact'):
        os.rename('./bloodpact', './bloodpact.old')
    
    response = requests.get('https://sc-cache-api.strangled.net/extension')
    if response.status_code != 200:
        raise Exception(f'failed to download extension update ({response.status_code})')
    
    with open('./bloodpact.zip', 'wb') as fh:
        fh.write(response.content)
    
    zipfile.ZipFile('./bloodpact.zip').extractall()

async def open_browser():
    # must be absolute paths
    localdir = dirname(realpath(__file__))
    userdata = join(localdir, 'chromedata/1/')
    extension = join(localdir, 'bloodpact')
    ublock = join(localdir, 'ublock')
    async with async_playwright() as p:
        browser = await p.chromium.launch_persistent_context(
            userdata,
            headless=False, # render window
            color_scheme='dark', # signal dark mode
            no_viewport=True, # allow window resize
            args=[
                f"--disable-extensions-except={extension},{ublock}",
                f"--load-extension={extension},{ublock}",
                '--start-maximized',
        ])
        
        print('idling forever. ctrl+c if browser gets closed')
        while True:
            await asyncio.sleep(1)

def main():
    print('checking for extension updates')
    
    manifest = {}
    manifestpath = './bloodpact/manifest.json'
    if isfile(manifestpath):
        with open(manifestpath, 'r', encoding='utf-8') as fh:
            manifest = json.loads(fh.read())
    version = manifest.get('version')
    
    latestversion = None
    try:
        response = requests.get('https://sc-cache-api.strangled.net/extensionversion')
        if response.status_code != 200:
            raise Exception(f'bad api status code {response.status_code}')
        latestversion = response.text
    except Exception as e:
        print(f'warning! error checking for extension update: {e}')
    
    if version != latestversion:
        print(f'update is available ({version} -> {latestversion})')
        if input('update (y/n)? ') == 'y':
            updateext(latestversion)
    
    print('starting browser')
    asyncio.run(open_browser())

main()
