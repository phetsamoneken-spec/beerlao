"""Real Chromium checks against a running Vite server. No remote APIs used."""
import json
import os
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('ORBIT_BASE_URL', 'http://127.0.0.1:5173')
ORIGIN = urlsplit(BASE).scheme + '://' + urlsplit(BASE).netloc
ARTIFACTS = Path(__file__).resolve().parent / 'artifacts'
ARTIFACTS.mkdir(exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
        args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width':1440, 'height':1100}, accept_downloads=True)
    errors = []
    remote = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('request', lambda r: remote.append(r.url) if not r.url.startswith(BASE) and not r.url.startswith('data:') and not r.url.startswith('blob:' + ORIGIN + '/') else None)
    page.goto(BASE)
    page.evaluate("localStorage.clear(); localStorage.setItem('orbit-language','en')")
    page.reload()
    expect(page.get_by_role('heading', name='A little space. Infinite potential.')).to_be_visible()
    expect(page.locator('canvas')).to_be_visible(timeout=30000)
    page.wait_for_timeout(2000)
    assert page.locator('canvas').evaluate('(c) => !!(c.getContext("webgl2") || c.getContext("webgl"))'), 'WebGL unavailable'
    page.screenshot(path=str(ARTIFACTS/'office-desktop.png'), full_page=True)

    # Agent configuration is editable and survives reload.
    page.get_by_role('button', name='AI employees', exact=True).click()
    page.get_by_role('button', name='Create AI employee').click()
    dlg=page.get_by_role('dialog')
    dlg.get_by_label('Employee name').fill('Seng')
    dlg.get_by_label('Job title').fill('Campaign Planner')
    dlg.get_by_label('Department', exact=True).fill('Marketing')
    dlg.get_by_label('Avatar style',exact=True).select_option('chibi-amber')
    dlg.get_by_role('button', name='Role & instructions').click()
    dlg.get_by_label('System prompt').fill('Use only approved campaign information.')
    dlg.get_by_label('Main responsibilities').fill('Plan approved campaigns.')
    dlg.get_by_label('Required input fields').fill('Campaign, Budget')
    dlg.get_by_label('Language', exact=True).select_option('English')
    dlg.get_by_role('button', name='Data sources').click()
    dlg.get_by_label('Google Drive folder ID').fill('demo-folder-reference')
    dlg.get_by_role('button', name='Outputs & permissions').click()
    dlg.get_by_label('Export documents', exact=True).check()
    dlg.get_by_role('button', name='Save employee').click()
    page.reload()
    page.get_by_role('button', name='AI employees', exact=True).click()
    expect(page.get_by_role('heading',name='Seng',exact=True)).to_be_visible()
    page.get_by_role('button',name='Edit Seng',exact=True).click()
    page.get_by_role('button', name='Data sources').click()
    expect(page.get_by_label('Google Drive folder ID')).to_have_value('demo-folder-reference')
    page.get_by_role('button',name='Close dialog').click()

    # Missing input must wait; no draft is fabricated.
    page.get_by_role('button',name='Task center',exact=False).first.click()
    page.get_by_role('button',name='Create a task',exact=True).click()
    page.get_by_label('Assign employee').select_option(label='Seng — Campaign Planner')
    page.get_by_label('Task title').fill('Campaign workflow test')
    page.get_by_label('Campaign',exact=True).fill('Fictional summer campaign')
    page.get_by_role('button',name='Create task',exact=True).click()
    dlg=page.get_by_role('dialog')
    expect(dlg.get_by_text('Waiting for information',exact=True)).to_be_visible()
    expect(dlg.get_by_role('button',name='Start demo simulation')).to_be_disabled()
    dlg.get_by_label('Budget',exact=True).fill('100 sample units')
    dlg.get_by_role('button',name='Save inputs',exact=True).click()
    dlg.get_by_role('button',name='Start demo simulation').click()
    expect(dlg.get_by_text('In progress',exact=True)).to_be_visible()
    dlg.get_by_role('button',name='Complete demo simulation').click()
    expect(dlg.get_by_label('Draft preview')).to_contain_text('Fictional summer campaign')
    expect(dlg.get_by_label('Draft preview')).to_contain_text('NOT AI GENERATED')
    dlg.get_by_role('button',name='Request review').click()
    dlg.get_by_label('Rejection reason').fill('Clarify the sample budget')
    dlg.get_by_role('button',name='Reject draft',exact=True).click()
    expect(dlg.get_by_text('Rejected',exact=True)).to_be_visible()
    dlg.get_by_role('button',name='Start demo simulation').click()
    dlg.get_by_role('button',name='Complete demo simulation').click()
    dlg.get_by_role('button',name='Request review').click()
    page.once('dialog',lambda d:d.accept())
    dlg.get_by_role('button',name='Approve reviewed draft').click()
    with page.expect_download() as info:
        dlg.get_by_role('button',name='Export approved .txt').click()
    output=info.value
    assert output.suggested_filename.endswith('.txt')
    output.save_as(str(ARTIFACTS/'approved-demo.txt'))
    expect(dlg.get_by_text('Completed',exact=True)).to_be_visible()
    dlg.get_by_role('button',name='Activity log').click()
    expect(dlg.get_by_text('Draft explicitly approved by Demo Admin.',exact=True)).to_be_visible()
    dlg.get_by_role('button',name='Close dialog').click()

    # Chat is clearly a local simulation and persists.
    page.get_by_role('button',name='AI employees',exact=True).click()
    card=page.locator('.agent-card').filter(has=page.get_by_role('heading',name='Seng',exact=True))
    card.get_by_role('button',name='Open workspace').click()
    page.get_by_label('Message employee').fill('Hello Seng')
    page.get_by_role('button',name='Send message').click()
    expect(page.get_by_text('Hello Seng',exact=True)).to_be_visible()
    expect(page.get_by_text('Demo response:',exact=False)).to_be_visible()
    page.get_by_role('button',name='Close dialog').click()
    page.reload()
    data=page.evaluate('JSON.parse(localStorage.getItem("orbit-office-v1"))')
    assert data['tasks'][0]['status']=='Completed'
    assert data['messages'][0]['text']=='Hello Seng'
    assert len(data['agents'])==4
    assert data['agents'][-1]['avatar']=='chibi-amber'

    # Responsive navigation and layout.
    page.set_viewport_size({'width':390,'height':844})
    page.get_by_role('button',name='Toggle navigation').click()
    page.get_by_role('button',name='AI employees',exact=True).click()
    expect(page.get_by_role('heading',name='Meet your AI team.')).to_be_visible()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Horizontal overflow'
    page.screenshot(path=str(ARTIFACTS/'employees-mobile.png'),full_page=True)
    assert not errors, errors
    assert not remote, remote
    print(json.dumps({'result':'passed','checks':['WebGL scene','agent creation and persistence','editable data source references','required-input gate','draft generation','rejection and retry','human approval','approved export','audit history','scripted chat','mobile navigation and layout','no external service requests'],'page_errors':errors}))
    browser.close()
