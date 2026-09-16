import os,sys,json,sqlite3,tempfile,unittest,copy
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
from fastapi.testclient import TestClient
import app
import legacy as service
import domain as d

class ModernTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.env=patch.dict(os.environ,{'ARUS_ALLOW_REGISTER':'true','ARUS_SCHEDULER':'false','DATABASE_URL':'','ARUS_APP_URL':'http://127.0.0.1:8765'})
        self.env.start();self.old_data=service.DATA;service.DATA=Path(self.tmp.name)
        service.RATE.clear()
        self.client=TestClient(app.app,base_url='http://127.0.0.1:8765')
        self.client.__enter__()
        self.headers={'X-Arus-Request':'1'}
        r=self.post('register',{'username':'tester','password':'test-password-123','name':'Test'})
        self.assertEqual(r.status_code,200,r.text)
        self.headers['X-CSRF-Token']=self.client.get('/api/session').json()['csrf']
    def tearDown(self):
        self.client.__exit__(None,None,None);service.DATA=self.old_data;self.env.stop();self.tmp.cleanup()
    def post(self,path,p):return self.client.post('/api/'+path,json=p,headers=self.headers)
    def state(self):return self.client.get('/api/state').json()
    def mutate(self,action,data,key=None,revision=None):
        return self.post('mutate',{'action':action,'data':data,'revision':self.state()['revision'] if revision is None else revision,'key':key or d.uid()})
    def test_login_password_csrf(self):
        r=self.post('password',{'current':'wrong','password':'new-password-123'});self.assertEqual(r.status_code,400)
        r=self.post('password',{'current':'test-password-123','password':'new-password-123'});self.assertEqual(r.status_code,200)
        self.post('logout',{})
        self.assertEqual(self.client.get('/api/state').status_code,401)
        self.assertEqual(self.post('login',{'username':'tester','password':'new-password-123'}).status_code,200)
    def test_transfer_and_duplicate(self):
        a=self.mutate('accounts',{'name':'Cash','kind':'cash','opening':1000000,'opening_date':d.today()}).json()['result']['id']
        b=self.mutate('accounts',{'name':'Bank','kind':'bank','opening':0,'opening_date':d.today()}).json()['result']['id']
        p={'kind':'transfer','account':a,'target':b,'amount':200000,'date':d.today(),'note':'Transfer','tags':[]}
        key=d.uid();revision=self.state()['revision'];r=self.mutate('transaction',p,key,revision);self.assertEqual(r.status_code,200,r.text)
        self.assertTrue(self.mutate('transaction',p,key,revision).json()['duplicate'])
        state=self.state();self.assertEqual(state['balances'][a],800000);self.assertEqual(state['balances'][b],200000)
        self.assertEqual(self.mutate('transaction',p,revision=revision).status_code,400)
    def test_email_confirm_scheduler(self):
        p=self.state()['state']['preferences'];p.update(reminder=True,reminder_email='owner@example.test',time='00:00')
        self.assertEqual(self.mutate('preferences',p).status_code,200)
        with patch.object(service,'smtp_ready',return_value=True),patch.object(service,'send_mail') as mail:
            service.reminder_tick();service.reminder_tick();self.assertEqual(mail.call_count,1)
        self.assertEqual(self.client.post('/internal/reminders').status_code,401)
    def test_core_backup_restore(self):
        self.mutate('accounts',{'name':'Cash','kind':'cash','opening':500,'opening_date':d.today()})
        backup=self.client.get('/api/backup').json()
        self.mutate('accounts',{'name':'Bank','kind':'bank','opening':600,'opening_date':d.today()})
        r=self.post('restore',{'key':d.uid(),'revision':self.state()['revision'],'password':'test-password-123','backup':backup})
        self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(len(self.state()['state']['accounts']),1)
        self.assertTrue(list(service.DATA.glob('backups/*')))
    def test_no_cross_user_state(self):
        first=self.state()['state']['categories'][0]['id']
        self.post('logout',{})
        self.post('register',{'username':'second','password':'test-password-123','name':'Second'})
        self.headers['X-CSRF-Token']=self.client.get('/api/session').json()['csrf']
        self.assertEqual(self.mutate('categories',{'id':first,'name':'Change','kind':'income'}).status_code,400)
    def test_static_and_no_secret_exposure(self):
        for path in ['/','/.env','/data/arus.sqlite3','/config.json','/original-backups/terbaru.sqlite3']:
            r=self.client.get(path)
            self.assertIn('text/html',r.headers['content-type'])
            self.assertNotIn('SQLite format',r.text)
            self.assertIn("frame-ancestors 'none'",r.headers['content-security-policy'])

class DataPreservationTests(unittest.TestCase):
    def test_archive_data_and_requested_login(self):
        root=Path(__file__).resolve().parents[1]
        with sqlite3.connect('file:'+str(root/'data/arus.sqlite3')+'?mode=ro',uri=True) as c,sqlite3.connect('file:'+str(root/'original-backups/terbaru.sqlite3')+'?mode=ro',uri=True) as old:
            self.assertEqual(c.execute('select body from states').fetchone()[0],old.execute('select body from states').fetchone()[0])
            u=c.execute('select username,password from users').fetchone()
            self.assertEqual(u[0],'demo');self.assertTrue(service.password_ok('demo123456',u[1]))
            s=json.loads(c.execute('select body from states').fetchone()[0])
            self.assertEqual(len(s['transactions']),33);self.assertEqual(len(s['budgets']),5)

if __name__=='__main__':unittest.main()
