"""AGENT HQ preservation, pixel interaction and CEO delegation checks."""
import os,json
from playwright.sync_api import sync_playwright,expect
URL=os.environ.get('ORBIT_BASE_URL','http://127.0.0.1:5173')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':1440,'height':1100})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(URL);page.get_by_label('ພາສາ / Language').select_option('en')
 def nav(name):page.locator('.sidebar nav').get_by_role('button',name=name,exact=False).click()
 def office():
  nav('Office overview');expect(page.locator('.pixel-canvas')).to_have_attribute('data-ready','true',timeout=30000)
 office()
 # Click real canvas characters, not only React shortcuts.
 def character(x,y):
  bounds=page.locator('.pixel-canvas').bounding_box();scale=min(bounds['width']/1570,bounds['height']/1054)
  page.mouse.click(bounds['x']+(bounds['width']-1536*scale)/2+x*scale,bounds['y']+(bounds['height']-1024*scale)/2+y*scale)
 character(400,280);expect(page.get_by_role('heading',name='Central command',exact=True)).to_be_visible()
 for x,y,name in [(1120,280,'Mali'),(405,610,'Kham'),(1134,615,'Noy')]:
  office();character(x,y);expect(page.get_by_role('dialog')).to_have_attribute('aria-label',name+'’s workspace');page.get_by_role('button',name='Close dialog').click()
 office();page.get_by_role('button',name='Zoom in',exact=True).click();expect(page.locator('.pixel-camera b')).to_have_text('120%');page.get_by_role('button',name='Reset camera').click();expect(page.locator('.pixel-camera b')).to_have_text('100%')
 page.get_by_role('button',name='Team Meeting',exact=True).click();expect(page.get_by_role('dialog',name='Team Meeting',exact=True)).to_be_visible();page.get_by_role('button',name='Close dialog').click()
 page.get_by_role('button',name='Coffee Corner',exact=True).click();expect(page.locator('.coffee-note')).to_be_visible();expect(page.locator('.pixel-camera b')).to_have_text('160%');page.get_by_role('button',name='Reset camera').click()
 page.get_by_role('button',name='Lightweight view').click();expect(page.locator('.pixel-fallback')).to_be_visible()
 page.locator('.pixel-fallback').get_by_role('button',name='Mali',exact=True).click();expect(page.get_by_role('dialog')).to_have_attribute('aria-label','Mali’s workspace');page.get_by_role('button',name='Close dialog').click()
 page.get_by_role('button',name='Return to chibi office').click();expect(page.locator('.pixel-canvas')).to_have_attribute('data-ready','true',timeout=30000)
 # Seed representative pre-existing records, including a fourth employee.
 fixture=page.evaluate('JSON.parse(localStorage.getItem("orbit-office-v1"))')
 fixture['agents'][0].update({'name':'Preserved Mali','prompt':'KEEP THIS SYSTEM PROMPT','templates':'official-v7','folder':'existing-folder','spreadsheet':'existing-sheet','ranges':'Data!A1:F20','permissions':['Generate drafts','Request human approval','Export documents']})
 fourth={**fixture['agents'][2],'id':'custom-employee-42','name':'Fourth Agent','fields':'Approved input'}
 fixture['agents'].append(fourth)
 fixture['messages'].append({'id':'preserved-chat','agentId':'mali','role':'user','text':'Keep this conversation'})
 page.evaluate('(s)=>{localStorage.setItem("orbit-office-v1",JSON.stringify(s));localStorage.removeItem("agent-hq-preserved-workspace-v1");}',fixture)
 page.reload();expect(page.locator('.pixel-canvas')).to_have_attribute('data-ready','true',timeout=30000)
 expect(page.locator('.pixel-canvas')).to_have_attribute('data-employee-count','4')
 assert page.evaluate('JSON.parse(localStorage.getItem("orbit-office-v1"))')==fixture
 assert page.evaluate('JSON.parse(localStorage.getItem("agent-hq-preserved-workspace-v1"))')==fixture
 nav('CEO Command Center')
 for command in ['Please help','budget proposal and BAF']:
  page.get_by_label('CEO command',exact=True).fill(command);page.get_by_role('button',name='Send CEO command').click()
  expect(page.get_by_text('Please clarify:',exact=False).last).to_be_visible()
 assert page.evaluate('JSON.parse(localStorage.getItem("orbit-office-v1"))')==fixture
 for command,expected in [('Prepare budget proposal','mali'),('Prepare a BAF document','kham'),('Analyze monthly sales','noy')]:
  page.get_by_label('CEO command',exact=True).fill(command);page.get_by_role('button',name='Send CEO command').click()
  page.get_by_role('button',name='Review delegation').last.click();expect(page.get_by_label('Assign employee',exact=True)).to_have_value(expected)
  expect(page.get_by_label('Task title')).to_have_value(command)
  page.get_by_role('button',name='Cancel',exact=True).click()
 assert page.evaluate('JSON.parse(localStorage.getItem("orbit-office-v1"))')==fixture
 page.get_by_role('button',name='Agent Assignment',exact=True).click();page.get_by_label('Budget proposal',exact=True).select_option('custom-employee-42')
 page.get_by_role('button',name='Command Chat',exact=True).click();page.get_by_label('CEO command',exact=True).fill('New budget proposal');page.get_by_role('button',name='Send CEO command').click()
 page.get_by_role('button',name='Review delegation').last.click();expect(page.get_by_label('Assign employee',exact=True)).to_have_value('custom-employee-42')
 page.get_by_role('button',name='Create task',exact=True).click();expect(page.get_by_text('Waiting for information',exact=True)).to_be_visible();expect(page.get_by_role('button',name='Start demo simulation')).to_be_disabled()
 page.get_by_role('button',name='Close dialog').click();page.reload()
 saved=page.evaluate('JSON.parse(localStorage.getItem("orbit-office-v1"))')
 assert saved['agents']==fixture['agents'] and saved['messages']==fixture['messages'] and saved['tasks'][1:]==fixture['tasks']
 assert len(saved['agents'])==4 and len(saved['tasks'])==len(fixture['tasks'])+1
 assert page.evaluate('JSON.parse(localStorage.getItem("agent-hq-routes-v1")).budget')=='custom-employee-42'
 # Default three-person office screenshot, in a separate pristine browser context.
 clean=browser.new_page(viewport={'width':1440,'height':1100});clean.goto(URL);expect(clean.locator('.pixel-canvas')).to_have_attribute('data-ready','true',timeout=30000)
 clean.screenshot(path='tests/artifacts/chibi-desktop.png',full_page=True);clean.locator('.office-section').screenshot(path='tests/artifacts/chibi-office.png')
 clean.set_viewport_size({'width':390,'height':844});expect(clean.locator('.pixel-canvas')).to_have_attribute('data-ready','true');assert clean.evaluate('document.documentElement.scrollWidth<=innerWidth')
 clean.screenshot(path='tests/artifacts/chibi-mobile.png',full_page=True)
 clean.get_by_role('button',name='ຂະຫຍາຍມຸມເບິ່ງ',exact=True).click();expect(clean.locator('.pixel-camera b')).to_have_text('120%')
 # Corrupt saved data must never be silently overwritten by a fresh demo.
 corrupt=browser.new_page();corrupt.goto(URL);corrupt.evaluate('localStorage.setItem("orbit-office-v1","{broken-preserve-me")');corrupt.reload();expect(corrupt.get_by_role('status')).to_be_visible();assert corrupt.evaluate('localStorage.getItem("orbit-office-v1")')=='{broken-preserve-me'
 assert not errors,errors
 print(json.dumps({'result':'passed','checks':['CEO and all original canvas characters clickable','zoom/reset','fourth employee workstation','pre-existing configurations/sources/templates/history preserved','ambiguous commands request clarification','budget/BAF/sales routing','editable routing persists','delegated inputs remain gated','CEO never inserted into employee records','mobile layout','corrupt workspace preserved'],'errors':errors}))
 browser.close()
