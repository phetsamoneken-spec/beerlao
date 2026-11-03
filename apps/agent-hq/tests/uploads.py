"""Upload, persistence, safe preview, association and failure-path browser checks."""
import os,base64,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
URL=os.environ.get('ORBIT_BASE_URL','http://127.0.0.1:8077/beerlao/agent-hq/')
TEXT='ແບບຟອມທົດສອບ\n<script>window.uploadScriptRan=true</script>\nຂໍ້ມູນສົມມຸດ'.encode()
PNG=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 context=browser.new_context(viewport={'width':1440,'height':1050},accept_downloads=True)
 page=context.new_page();errors=[];sent=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('request',lambda r:sent.append(r.url) if r.method not in ['GET','HEAD'] else None)
 page.goto(URL);page.get_by_label('ພາສາ / Language').select_option('en')
 snapshot=page.evaluate('JSON.parse(localStorage.getItem("orbit-office-v1"))')
 def docs():page.locator('.sidebar nav').get_by_role('button',name='Documents',exact=True).click()
 def row(name):return page.locator('.uploaded-file').filter(has=page.get_by_text(name,exact=True))
 def picker():return page.locator('#workspace-upload-input')
 docs();expect(page.locator('.uploaded-file')).to_have_count(0)
 with page.expect_file_chooser() as chooser:page.locator('.page-heading').get_by_role('button',name='Upload files',exact=True).click()
 assert chooser.value.is_multiple()
 page.get_by_label('File purpose',exact=True).select_option('template');page.get_by_label('Assign uploaded files',exact=True).select_option('mali')
 picker().set_input_files([{'name':'company-template.txt','mimeType':'text/plain','buffer':TEXT},{'name':'sales.csv','mimeType':'text/csv','buffer':b'shop,month,total\nDEMO,2026-11,100\n'}])
 expect(page.locator('.uploaded-file')).to_have_count(2)
 expect(page.get_by_role('status')).to_contain_text('2 files saved')
 expect(page.get_by_label('Employee for company-template.txt')).to_have_value('mali')
 expect(page.get_by_label('Purpose for company-template.txt')).to_have_value('template')
 page.get_by_role('button',name='Preview company-template.txt',exact=True).click();expect(page.locator('.file-preview-content pre')).to_contain_text('<script>window.uploadScriptRan=true</script>');assert page.evaluate('window.uploadScriptRan') is None
 page.keyboard.press('Escape');expect(page.locator('.file-preview-dialog')).to_have_count(0)
 with page.expect_download() as download:page.get_by_role('button',name='Download company-template.txt',exact=True).click()
 assert download.value.suggested_filename=='company-template.txt';download.value.save_as('tests/artifacts/upload-roundtrip.txt');assert Path('tests/artifacts/upload-roundtrip.txt').read_bytes()==TEXT
 page.reload();docs();expect(page.locator('.uploaded-file')).to_have_count(2)
 picker().set_input_files({'name':'duplicate-with-another-name.txt','mimeType':'text/plain','buffer':TEXT});expect(page.get_by_role('status')).to_contain_text('Already in the library');expect(page.locator('.uploaded-file')).to_have_count(2)
 # Real drop event uses a File in DataTransfer, independent of the picker.
 page.get_by_label('Assign uploaded files',exact=True).select_option('mali')
 transfer=page.evaluate_handle('(bytes)=>{const d=new DataTransfer();d.items.add(new File([new Uint8Array(bytes)],"sample-image.png",{type:"image/png"}));return d;}',list(PNG))
 page.locator('.upload-drop').dispatch_event('drop',{'dataTransfer':transfer});expect(page.locator('.uploaded-file')).to_have_count(3)
 page.get_by_role('button',name='Preview sample-image.png',exact=True).click();expect(page.locator('.file-preview-dialog img')).to_be_visible();page.wait_for_function('document.querySelector(".file-preview-dialog img")?.naturalWidth===1');page.get_by_role('button',name='Close preview').click()
 picker().set_input_files({'name':'blocked.html','mimeType':'text/html','buffer':b'<script>alert(1)</script>'});expect(page.get_by_role('status')).to_contain_text('not supported');expect(page.locator('.uploaded-file')).to_have_count(3)
 expect(page.locator('.upload-drop')).to_be_enabled()
 too_large=page.evaluate_handle('()=>{const d=new DataTransfer();d.items.add(new File([new Uint8Array(20000001)],"too-large.pdf",{type:"application/pdf"}));return d;}')
 page.locator('.upload-drop').dispatch_event('drop',{'dataTransfer':too_large});expect(page.get_by_role('status')).to_contain_text('20 MB or smaller');expect(page.locator('.uploaded-file')).to_have_count(3)
 expect(page.locator('.upload-drop')).to_be_enabled()
 empty=page.evaluate_handle('()=>{const d=new DataTransfer();d.items.add(new File([],"empty.txt",{type:"text/plain"}));return d;}');page.locator('.upload-drop').dispatch_event('drop',{'dataTransfer':empty});expect(page.get_by_role('status')).to_contain_text('Empty files')
 expect(page.locator('.upload-drop')).to_be_enabled()
 too_many=page.evaluate_handle('()=>{const d=new DataTransfer();for(let i=0;i<11;i++)d.items.add(new File(["test "+i],"many-"+i+".txt"));return d;}');page.locator('.upload-drop').dispatch_event('drop',{'dataTransfer':too_many});expect(page.get_by_role('alert')).to_contain_text('up to 10 files');expect(page.locator('.uploaded-file')).to_have_count(3)
 page.get_by_label('Employee for sales.csv').select_option('noy');expect(page.get_by_label('Employee for sales.csv')).to_have_value('noy')
 # Assignment follows the agent without changing its configuration or task data.
 page.locator('.sidebar nav').get_by_role('button',name='AI employees',exact=True).click();page.locator('.agent-card').filter(has=page.get_by_role('heading',name='Mali',exact=True)).get_by_role('button',name='Open workspace').click()
 workspace=page.get_by_role('dialog',name='Mali’s workspace',exact=True);workspace.get_by_role('button',name='Files & templates',exact=True).click();expect(workspace.locator('.uploaded-file')).to_have_count(2);expect(workspace.get_by_text('sales.csv',exact=True)).to_have_count(0)
 workspace.get_by_role('button',name='Preview company-template.txt',exact=True).click();expect(page.locator('.file-preview-dialog')).to_be_visible();page.keyboard.press('Escape');expect(page.locator('.file-preview-dialog')).to_have_count(0);expect(workspace).to_be_visible()
 workspace.get_by_role('button',name='Close dialog').click();docs()
 # A canceled removal keeps the record; a confirmed removal removes only that record.
 page.once('dialog',lambda d:d.dismiss());page.get_by_role('button',name='Remove sample-image.png',exact=True).click();expect(row('sample-image.png')).to_have_count(1)
 page.once('dialog',lambda d:d.accept());page.get_by_role('button',name='Remove sample-image.png',exact=True).click();expect(page.locator('.uploaded-file')).to_have_count(2);expect(row('company-template.txt')).to_have_count(1)
 page.reload();docs();expect(page.locator('.uploaded-file')).to_have_count(2);expect(page.get_by_label('Employee for sales.csv')).to_have_value('noy')
 assert page.evaluate('JSON.parse(localStorage.getItem("orbit-office-v1"))')==snapshot
 page.get_by_label('ພາສາ / Language').select_option('lo');expect(page.locator('.file-library').get_by_role('heading',name='ໄຟລ໌ທີ່ອັບໂຫຼດ',exact=False)).to_be_visible();page.screenshot(path='tests/artifacts/uploads-desktop.png',full_page=True)
 page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path='tests/artifacts/uploads-mobile.png',full_page=True)
 # A blocked storage capability reports failure instead of pretending to save.
 denied=browser.new_context();denied.add_init_script('Object.defineProperty(window,"indexedDB",{get(){throw new Error("storage blocked for test")}})');broken=denied.new_page();broken.goto(URL);broken.get_by_label('ພາສາ / Language').select_option('en');broken.locator('.sidebar nav').get_by_role('button',name='Documents',exact=True).click();expect(broken.get_by_role('alert')).to_contain_text('Could not open the file library')
 assert not errors,errors
 assert not sent,sent
 print(json.dumps({'result':'passed','checks':['multi-file picker','drag and drop','persistent IndexedDB storage','duplicate detection','unchanged original download bytes','safe Lao text preview','image preview','type/size/empty/batch validation','persistent agent assignment','per-agent file view','nested preview Escape handling','cancel/confirm deletion','existing agents/tasks/history unchanged','Lao mobile layout','storage failure reporting','no file POST requests'],'page_errors':errors}))
 browser.close()
