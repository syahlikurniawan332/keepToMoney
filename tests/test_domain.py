import copy
import unittest
import domain as d

class DomainTests(unittest.TestCase):
    def setUp(self):
        self.s=d.blank(); self.day=d.today()
        self.a=d.mutate(self.s,'accounts',dict(name='Tunai',kind='cash',opening=1000000,opening_date='2026-01-01'))['id']
        self.b=d.mutate(self.s,'accounts',dict(name='Bank',kind='bank',opening=500000,opening_date='2026-01-01'))['id']
        self.cat=next(c['id'] for c in self.s['categories'] if c['kind']=='expense')
    def tx(self,kind='expense',amount=100000,**kw):
        data=dict(kind=kind,amount=amount,account=self.a,date=self.day,category=self.cat if kind=='expense' else '',note='',tags=[])
        data.update(kw);return d.mutate(self.s,'transaction',data)
    def test_opening_and_transfer(self):
        self.assertEqual(d.summary(self.s,{})['income'],0)
        self.tx('transfer',200000,target=self.b)
        self.assertEqual(sum(d.balances(self.s).values()),1500000)
        self.tx(amount=2500)
        self.assertEqual(sum(d.balances(self.s).values()),1497500)
        self.assertEqual(d.summary(self.s,{})['expense'],2500)
    def test_invalid_transfer(self):
        with self.assertRaises(d.Invalid):self.tx('transfer',1,target=self.a)
        self.assertEqual(len(self.s['transactions']),0)
    def test_edit_delete(self):
        t=self.tx(); self.tx(id=t['id'],amount=200000)
        self.assertEqual(d.balances(self.s)[self.a],800000)
        d.mutate(self.s,'delete-transaction',{'id':t['id']})
        self.assertEqual(d.balances(self.s)[self.a],1000000)
    def test_multitag_count_once(self):
        tags=[d.mutate(self.s,'tags',{'name':n})['id'] for n in ['A','B']]
        self.tx(tags=tags)
        self.assertEqual(d.summary(self.s,{'tags':tags})['expense'],100000)
    def test_refund_and_protect_original(self):
        t=self.tx();self.tx('refund',30000,original=t['id'])
        self.assertEqual(d.summary(self.s,{})['expense'],70000)
        self.assertEqual(d.summary(self.s,{})['income'],0)
        with self.assertRaises(d.Invalid):self.tx('refund',80000,original=t['id'])
        with self.assertRaises(d.Invalid):d.mutate(self.s,'delete-transaction',{'id':t['id']})
    def test_checkin_invalidated(self):
        d.mutate(self.s,'checkin',{'date':self.day,'status':'none'})
        self.tx()
        self.assertEqual(d.check_status(self.s,self.day),'recheck')
        with self.assertRaises(d.Invalid):d.mutate(self.s,'checkin',{'date':self.day,'status':'none'})
    def test_ownership_and_types(self):
        with self.assertRaises(d.Invalid):self.tx(account='other-user-account')
        with self.assertRaises(d.Invalid):self.tx(amount=2.4)
        with self.assertRaises(d.Invalid):self.tx(amount=True)
    def test_archive_and_type_change(self):
        self.tx()
        with self.assertRaises(d.Invalid):d.mutate(self.s,'delete-item',{'table':'categories','id':self.cat})
        with self.assertRaises(d.Invalid):d.mutate(self.s,'categories',{'id':self.cat,'name':'Wrong','kind':'income'})
        d.mutate(self.s,'categories',{'id':self.cat,'name':'Old','kind':'expense','archived':True})
        with self.assertRaises(d.Invalid):self.tx()
        self.assertEqual(d.summary(self.s,{})['expense'],100000)
    def test_budget_categories_and_labels(self):
        tag=d.mutate(self.s,'tags',{'name':'Magang'})['id'];self.tx(tags=[tag]);self.tx(amount=25000)
        b=d.mutate(self.s,'budget',dict(name='Test',start='2026-01-01',end=self.day,limit=150000,categories=[self.cat],tags=[tag]))
        self.assertEqual(d.budget_used(self.s,b),100000)
    def plan(self):
        return d.make_plan(self.s,dict(kind='budget',start=self.day,end=self.day,categories=[self.cat],fund=1500000,obligations=200000,savings=300000,reserve=100000))
    def test_budget_plan_draft_and_stale(self):
        p=self.plan();self.assertEqual(p['available'],900000);self.assertEqual(sum(x['amount'] for x in p['allocations']),900000)
        self.s['plans'].append(p);self.assertEqual(len(self.s['budgets']),0)
        self.tx()
        with self.assertRaises(d.Invalid):d.mutate(self.s,'apply-plan',{'id':p['id']})
    def test_plan_apply(self):
        p=self.plan();self.s['plans'].append(p);d.mutate(self.s,'apply-plan',{'id':p['id']})
        self.assertEqual(self.s['budgets'][0]['limit'],900000)
        with self.assertRaises(d.Invalid):d.mutate(self.s,'apply-plan',{'id':p['id']})
    def test_edit_draft_validates_total(self):
        p=self.plan();self.s['plans'].append(p)
        with self.assertRaises(d.Invalid):d.mutate(self.s,'edit-plan',{'id':p['id'],'allocations':[{'category':self.cat,'amount':1}]})
        d.mutate(self.s,'edit-plan',{'id':p['id'],'allocations':[{'category':self.cat,'amount':900000}]})
        self.assertTrue(p['edited']);self.assertEqual(len(self.s['budgets']),0)
        d.mutate(self.s,'apply-plan',{'id':p['id']})
        self.assertEqual(self.s['budgets'][0]['limit'],900000)
    def test_restore_validation(self):
        self.tx();clone=d.validate_restore(copy.deepcopy(self.s))
        self.assertEqual(d.balances(clone),d.balances(self.s))
        clone['transactions'][0]['account']='foreign'
        with self.assertRaises(d.Invalid):d.validate_restore(clone)
    def test_adjustment(self):
        with self.assertRaises(d.Invalid):self.tx('adjustment',-10000)
        self.tx('adjustment',-10000,note='Koreksi hitung tunai')
        self.assertEqual(d.balances(self.s)[self.a],990000)
        self.assertEqual(d.summary(self.s,{})['expense'],0)
    def test_timezone(self):
        import datetime as dt
        instant=dt.datetime(2026,9,14,16,30,tzinfo=dt.timezone.utc)
        self.assertEqual(d.today('Asia/Jakarta',instant),'2026-09-14')
        self.assertEqual(d.today('Asia/Jayapura',instant),'2026-09-15')
    def test_savings_never_exceeds_selected(self):
        self.tx(date='2026-08-01')
        p=d.make_plan(self.s,dict(kind='savings',start='2026-09-01',end='2026-09-30',prior_start='2026-08-01',prior_end='2026-08-31',target=33333,categories=[self.cat]))
        self.assertEqual(sum(x['saving'] for x in p['allocations']),33333)
        self.assertTrue(all(x['amount']>=0 for x in p['allocations']))

if __name__=='__main__':unittest.main()
