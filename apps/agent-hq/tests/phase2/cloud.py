"""Cloud UI integration with intercepted test Auth/Edge/REST. No live services."""
import os,json,base64,time
from playwright.sync_api import sync_playwright,expect
URL=os.environ.get('ORBIT_BASE_URL','http://127.0.0.1:5176')
ORG='11111111-1111-4111-8111-111111111111';TASK='22222222-2222-4222-8222-222222222222';AGENT='33333333-3333-4333-8333-333333333333';USER='44444444-4444-4444-8444-444444444444';DRAFT='55555555-5555-4555-8555-555555555555'
def encode(value):return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')
token=encode({'alg':'HS256','typ':'JWT'})+'.'+encode({'sub':USER,'role':'authenticated','exp':int(time.time())+3600})+'.test'
user={'id':USER,'aud':'authenticated','role':'authenticated','email':'ui-test@example.test','email_confirmed_at':'2026-11-03T00:00:00Z','app_metadata':{},'user_metadata':{},'identities':[],'created_at':'2026-11-03T00:00:00Z'}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 for role in ['admin','member']:
  context=browser.new_context(viewport={'width':1440,'height':1100});page=context.new_page();errors=[];calls=[];unexpected=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(URL);page.get_by_label('ພາສາ / Language').select_option('en')
  local=page.evaluate('localStorage.getItem("orbit-office-v1")');configuration=json.loads(local)['agents'][0]
  configuration.update({'department':'sales','fields':'Task details','permissions':['Generate drafts','Export documents','Request human approval']})
  agents=[{'id':AGENT,'organization_id':ORG,'department':'sales','kind':'marketing','active':True,'revision':1,'configuration':configuration}]
  tasks=[{'id':TASK,'organization_id':ORG,'title':'Authorized cloud task','status':'Waiting for information','agent_id':AGENT,'requester_id':USER,'created_at':'2026-11-03T00:00:00Z','inputs':{'Task details':''},'current_draft_id':None}];drafts=[]
  def remote(route):
   req=route.request;path=req.url.split('.co',1)[1]
   if req.method=='OPTIONS':route.fulfill(status=204,headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'});return
   data=None
   if path.startswith('/auth/v1/token'):
    data={'access_token':token,'token_type':'bearer','expires_in':3600,'refresh_token':'test-refresh-token-only','user':user}
   elif path.startswith('/auth/v1/logout'):route.fulfill(status=204,headers={'Access-Control-Allow-Origin':'*'});return
   elif path.startswith('/auth/v1/user'):data=user
   elif path.startswith('/rest/v1/memberships'):data=[{'organization_id':ORG,'user_id':USER,'role':role,'department':'sales','active':True,'organizations':{'name':'UI Test Company'}}]
   elif path.startswith('/rest/v1/agents'):data=agents
   elif path.startswith('/rest/v1/tasks'):data=tasks
   elif path.startswith('/rest/v1/drafts'):data=drafts
   elif path.startswith('/functions/v1/agent-api'):
    payload=req.post_data_json;calls.append(payload);action=payload['action'];result=None
    assert req.headers.get('authorization')=='Bearer '+token
    if action=='updateInputs':tasks[0].update({'inputs':payload['inputs'],'status':'New','current_draft_id':None})
    elif action=='execute':
     tasks[0].update({'status':'Draft ready','current_draft_id':DRAFT});drafts.append({'id':DRAFT,'task_id':TASK,'content':'<script>not executable</script>\nReviewable test fixture','content_hash':'a'*64,'revision':1});result={'status':'Draft ready','draft_id':DRAFT}
    elif action=='submitReview':tasks[0]['status']='Awaiting approval'
    elif action=='review':
     assert role=='admin' and payload['contentHash']=='a'*64
     tasks[0]['status']='Approved'
    elif action=='export':result={'content':drafts[0]['content']};tasks[0]['status']='Completed'
    elif action=='saveAgent':result={'id':AGENT}
    else:unexpected.append(action)
    data={'data':result}
   else:unexpected.append(path);route.abort();return
   route.fulfill(status=200,content_type='application/json',body=json.dumps(data),headers={'Access-Control-Allow-Origin':'*'})
  context.route('https://phase2-test.supabase.co/**',remote)
  page.locator('.sidebar nav').get_by_role('button',name='Cloud workspace',exact=True).click()
  expect(page.get_by_role('heading',name='Sign in to company workspace')).to_be_visible()
  page.get_by_label('Email',exact=True).fill('ui-test@example.test');page.get_by_label('Password',exact=True).fill('test-only-password');page.get_by_role('button',name='Sign in',exact=True).click()
  expect(page.get_by_label('Organization',exact=True)).to_have_value(ORG)
  workspace=page.locator('.cloud-workspace')
  expect(workspace.get_by_role('button',name='Manage access',exact=True)).to_have_count(1 if role=='admin' else 0)
  if role=='admin':
   workspace.get_by_role('button',name='AI employees',exact=True).click();workspace.get_by_role('button',name='Create AI employee',exact=True).click()
   dialog=page.get_by_role('dialog');dialog.get_by_label('Agent capability').select_option('ceo');dialog.get_by_label('Employee name').fill('Cloud CEO');dialog.get_by_label('Job title').fill('CEO');dialog.get_by_role('button',name='Save employee').click();expect(page.get_by_role('dialog')).to_have_count(0)
   assert calls[-1]['kind']=='ceo'
  workspace.get_by_role('button',name='Task center',exact=True).click();workspace.get_by_role('button',name='Authorized cloud task',exact=False).click()
  dialog=page.get_by_role('dialog')
  tasks[0].update({'status':'In progress','updated_at':'2000-01-01T00:00:00Z'});dialog.get_by_role('button',name='Refresh',exact=True).click();expect(dialog.get_by_role('button',name='Retry expired execution')).to_be_enabled()
  tasks[0]['status']='Waiting for information';dialog.get_by_role('button',name='Refresh',exact=True).click();expect(dialog.locator('.badge').first).to_have_text('Waiting for information');dialog.get_by_role('button',name='Edit authorized task inputs').click();dialog.get_by_label('Authorized task inputs (JSON)',exact=True).fill('{"Task details":"Approved campaign"}');dialog.get_by_role('button',name='Save task inputs').click()
  expect(dialog.locator('.badge').first).to_have_text('New');dialog.get_by_role('button',name='Execute with AI').click();expect(dialog.locator('.badge').first).to_have_text('Draft ready');expect(dialog.locator('pre')).to_contain_text('<script>not executable</script>');assert page.locator('script').filter(has_text='not executable').count()==0
  dialog.get_by_role('button',name='Request review').click();expect(dialog.locator('.badge').first).to_have_text('Awaiting approval')
  if role=='admin':
   page.once('dialog',lambda d:d.accept());dialog.get_by_role('button',name='Approve reviewed draft').click();expect(dialog.locator('.badge').first).to_have_text('Approved')
   with page.expect_download() as download:dialog.get_by_role('button',name='Export approved .txt').click()
   assert download.value.suggested_filename=='approved-report.txt';expect(dialog.locator('.badge').first).to_have_text('Completed')
  else:expect(dialog.get_by_role('button',name='Approve reviewed draft')).to_have_count(0)
  dialog.get_by_role('button',name='Close dialog').click()
  assert page.evaluate('localStorage.getItem("orbit-office-v1")')==local
  assert 'test-refresh-token-only' not in page.evaluate('JSON.stringify(localStorage)')
  workspace.get_by_role('button',name='Sign out',exact=True).click();expect(page.get_by_role('heading',name='Sign in to company workspace')).to_be_visible();expect(page.get_by_text('Authorized cloud task',exact=True)).to_have_count(0)
  assert page.evaluate('localStorage.getItem("orbit-office-v1")')==local
  page.reload();page.locator('.sidebar nav').get_by_role('button',name='Cloud workspace',exact=True).click();expect(page.get_by_role('heading',name='Sign in to company workspace')).to_be_visible()
  assert errors==[],errors
  assert unexpected==[],unexpected
  context.close()
 browser.close()
 print(json.dumps({'result':'passed','checks':['real Auth UI contract with intercepted test services','admin/member controls','all agent kinds selectable','correct task inputs','AI draft/review/export workflow','safe plain-text rendering','memory sessions and sign-out','local workspace preserved'],'errors':[]}))
