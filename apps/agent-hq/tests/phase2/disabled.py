"""Disabled cloud preview preserves local data and makes no backend requests."""
import os,json
from playwright.sync_api import sync_playwright,expect
URL=os.environ.get('ORBIT_BASE_URL','http://127.0.0.1:5175')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':1440,'height':1100});errors=[];remote=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('request',lambda r:remote.append(r.url) if '.supabase.' in r.url else None)
 page.goto(URL);page.get_by_label('ພາສາ / Language').select_option('en')
 before=page.evaluate('JSON.stringify(localStorage)')
 page.locator('.sidebar nav').get_by_role('button',name='Cloud workspace',exact=True).click()
 expect(page.get_by_role('heading',name='Cloud workspace · review preview')).to_be_visible()
 expect(page.get_by_text('Cloud workspace is disabled pending review.',exact=True)).to_be_visible()
 expect(page.locator('.page-heading').get_by_role('button',name='Create a task')).to_have_count(0)
 assert page.evaluate('JSON.stringify(localStorage)')==before
 page.get_by_label('ພາສາ / Language').select_option('lo')
 expect(page.get_by_role('heading',name='ພື້ນທີ່ Cloud · ສະບັບລໍຖ້າກວດທານ')).to_be_visible()
 page.set_viewport_size({'width':390,'height':844})
 assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1')
 assert errors==[],errors
 assert remote==[],remote
 browser.close()
 print(json.dumps({'result':'passed','checks':['disabled by default','no cloud requests','no local changes','Lao/English preview','mobile layout'],'errors':errors}))
