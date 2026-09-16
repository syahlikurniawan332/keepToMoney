import copy, http.cookiejar, json, tempfile, threading, unittest
from pathlib import Path
import urllib.request, urllib.error
from unittest.mock import patch
import legacy as server
import os
import domain as d

class API:
    def __init__(self,port):
        self.base=f'http://127.0.0.1:{port}'; self.csrf=''
        self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def call(self,path,data=None,headers=None):
        req=urllib.request.Request(self.base+'/api/'+path,data=json.dumps(data).encode() if data is not None else None,headers={'Content-Type':'application/json','X-Arus-Request':'1','X-CSRF-Token':self.csrf,**(headers or {})})
        try:r=self.opener.open(req)
        except urllib.error.HTTPError as e:r=e
        content=r.read();return r.status,json.loads(content) if r.headers.get('Content-Type','').startswith('application/json') else content.decode('utf-8-sig')
    def state(self):return self.call('state')[1]
    def change(self,action,data,key=None,revision=None):
        return self.call('mutate',dict(action=action,data=data,key=key or d.uid(),revision=self.state()['revision'] if revision is None else revision))

class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ['ARUS_ALLOW_REGISTER']='true'
        cls.tmp=tempfile.TemporaryDirectory();server.DATA=Path(cls.tmp.name);server.init();server.CONFIG={}
        cls.http=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler);server.PORT=cls.http.server_port
        threading.Thread(target=cls.http.serve_forever,daemon=True).start()
    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown();cls.http.server_close();cls.tmp.cleanup()
    def setUp(self):
        server.RATE.clear();self.api=API(server.PORT)
        self.assertEqual(self.api.call('register',dict(username=d.uid(),email=d.uid()+'@example.test',password='test-password-123',name='Unit Test'))[0],200)
        se=self.api.call('session')[1];self.api.csrf=se['csrf'];self.uid=se['user']['id']
        self.account=self.api.change('accounts',dict(name='Bank',kind='bank',opening=1000000,opening_date='2026-01-01'))[1]['result']['id']
        self.cat=next(x['id'] for x in self.api.state()['state']['categories'] if x['kind']=='expense')
    def tx(self):return dict(kind='expense',amount=50000,date=d.today(),account=self.account,category=self.cat,note='Test',tags=[])
    def test_auth_csrf_origin(self):
        self.assertEqual(API(server.PORT).call('state')[0],401)
        self.assertEqual(self.api.call('mutate',{},headers={'X-CSRF-Token':'wrong'})[0],400)
        self.assertEqual(self.api.call('state',headers={'Host':'evil.example'})[0],400)
        self.assertEqual(self.api.call('logout',{},headers={'Origin':'https://evil.example'})[0],400)
    def test_duplicate_and_conflict(self):
        key=d.uid();rev=self.api.state()['revision'];data=self.tx()
        self.assertEqual(self.api.change('transaction',data,key,rev)[0],200)
        self.assertTrue(self.api.change('transaction',data,key,rev)[1]['duplicate'])
        self.assertEqual(len(self.api.state()['state']['transactions']),1)
        self.assertEqual(self.api.change('transaction',data,revision=rev)[0],400)
    def test_cross_user(self):
        other=API(server.PORT);other.call('register',dict(username=d.uid(),email=d.uid()+'@example.test',password='test-password-123',name='Other'))
        other.csrf=other.call('session')[1]['csrf']
        self.assertEqual(other.change('transaction',self.tx())[0],400)
        self.assertEqual(len(other.state()['state']['transactions']),0)
    def test_backup_restore(self):
        self.api.change('transaction',self.tx());backup=self.api.call('backup')[1];before=self.api.state()['balances']
        self.api.change('transaction',self.tx())
        data=dict(backup=backup,revision=self.api.state()['revision'],key=d.uid(),password='test-password-123')
        self.assertEqual(self.api.call('restore',data)[0],200)
        self.assertEqual(self.api.state()['balances'],before)
        self.assertTrue(list((server.DATA/'backups').glob('*.json')))
        bad=copy.deepcopy(backup);bad['state']['transactions'][0]['account']='someone-else'
        data.update(backup=bad,revision=self.api.state()['revision'],key=d.uid())
        self.assertEqual(self.api.call('restore',data)[0],400)
        self.assertEqual(self.api.state()['balances'],before)
    def test_csv_injection_filter(self):
        t=self.tx();t['note']='=HYPERLINK("bad")';self.api.change('transaction',t)
        code,body=self.api.call('export');self.assertEqual(code,200);self.assertIn("'=HYPERLINK",body)
        self.assertNotIn('HYPERLINK',self.api.call('export?kind=income')[1])
    def test_token_requires_post_and_single_use(self):
        with server.db() as c:raw=server.token(c,self.uid,'verify')
        self.assertEqual(self.api.call('token?action=verify&token='+raw)[0],404)
        self.assertFalse(self.api.call('session')[1]['user']['verified'])
        self.assertEqual(self.api.call('token',dict(action='verify',token=raw))[0],200)
        self.assertTrue(self.api.call('session')[1]['user']['verified'])
        self.assertEqual(self.api.call('token',dict(action='verify',token=raw))[0],400)
    def test_reset_invalidates_session(self):
        with server.db() as c:raw=server.token(c,self.uid,'reset')
        self.assertEqual(self.api.call('token',dict(action='reset',token=raw,password='new-password-123'))[0],200)
        self.assertEqual(self.api.call('state')[0],401)
    def reminder_setup(self,complete=False):
        with server.db() as c:
            c.execute('UPDATE users SET verified=1 WHERE id=?',(self.uid,))
            s,r=server.load(c,self.uid);s['preferences'].update(reminder=True,time='00:00',reminder_email='test@example.test')
            if complete:d.mutate(s,'checkin',dict(date=d.today(),status='none'))
            server.save(c,self.uid,s,r,'test')
    def test_reminder_dedupe_unsubscribe(self):
        self.reminder_setup()
        with patch.object(server,'smtp_ready',return_value=True),patch.object(server,'send_mail') as mail:
            server.reminder_tick();server.reminder_tick();self.assertEqual(mail.call_count,1)
            with server.db() as c:raw=server.token(c,self.uid,'unsubscribe')
            self.api.call('token',dict(action='unsubscribe',token=raw))
            self.assertFalse(self.api.state()['state']['preferences']['reminder'])
    def test_no_reminder_for_complete(self):
        self.reminder_setup(True)
        with patch.object(server,'smtp_ready',return_value=True),patch.object(server,'send_mail') as mail:
            server.reminder_tick();self.assertEqual(mail.call_count,0)
    def test_ai_fallback(self):
        s=self.api.state()['state'];s['preferences']['ai_consent']=True
        p=dict(kind='budget',start=d.today(),end=d.today(),fund=100000,obligations=0,savings=0,reserve=0,categories=[self.cat],use_ai=True)
        with patch.object(server,'CONFIG',{'ollama':{'model':'test-model'}}),patch('urllib.request.OpenerDirector.open',side_effect=TimeoutError):
            plan=server.ai_plan(s,p);self.assertEqual(plan['origin'],'automatic');self.assertIn('ai_error',plan)
            self.assertEqual(plan['allocations'][0]['amount'],100000)
    def test_delete_user(self):
        self.api.change('transaction',self.tx())
        self.assertEqual(self.api.call('delete-user',{'password':'test-password-123'})[0],200)
        self.assertEqual(self.api.call('state')[0],401)
        with server.db() as c:self.assertIsNone(c.execute('SELECT 1 FROM states WHERE user_id=?',(self.uid,)).fetchone())

if __name__=='__main__':unittest.main()
