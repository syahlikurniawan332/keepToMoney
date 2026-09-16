"""Aturan domain Arus. Semua uang integer rupiah; tanpa layanan eksternal."""
import copy
import datetime as dt
import hashlib
import json
import re
import uuid

MAX = 10**12
ZONES = {'Asia/Jakarta': 7, 'Asia/Makassar': 8, 'Asia/Jayapura': 9, 'UTC': 0}

class Invalid(ValueError):
    pass

def require(ok, message):
    if not ok:
        raise Invalid(message)

def uid():
    return uuid.uuid4().hex

def text(value, maximum=120):
    require(isinstance(value, str), 'Teks tidak valid.')
    value = value.strip()
    require(0 < len(value) <= maximum, f'Isi teks 1–{maximum} karakter.')
    return value

def money(n, positive=False):
    require(type(n) is int and abs(n) <= MAX and (not positive or n > 0), 'Nominal harus rupiah bulat, maksimal 1 triliun.')
    return n

def date(s):
    require(isinstance(s, str), 'Tanggal tidak valid.')
    try:
        d = dt.date.fromisoformat(s)
    except (ValueError, TypeError):
        raise Invalid('Tanggal tidak valid.')
    require(d.isoformat() == s and 2000 <= d.year <= 2100, 'Tanggal harus antara 2000–2100.')
    return s

def today(zone='Asia/Jakarta', now=None):
    return ((now or dt.datetime.now(dt.timezone.utc)) + dt.timedelta(hours=ZONES[zone])).date().isoformat()

def blank():
    s = dict(accounts=[], categories=[], tags=[], transactions=[], budgets=[], checkins={}, plans=[])
    for kind, names in [('income', ['Gaji','Freelance','Bonus','Penjualan','Hadiah','Pendapatan lainnya']), ('expense', ['Makanan dan minuman','Transportasi','Tempat tinggal','Tagihan','Belanja','Kesehatan','Pendidikan','Hiburan','Langganan','Keluarga','Sedekah dan donasi','Biaya administrasi','Pengeluaran lainnya'])]:
        for name in names:
            s['categories'].append(dict(id=uid(), name=name, kind=kind, archived=False))
    s['preferences'] = dict(name='Pengguna Arus', zone='Asia/Jakarta', reminder=False, reminder_email='', time='20:30', days=[0,1,2,3,4,5,6], pause_until='', ai_consent=False)
    return s

def get(s, table, id):
    item = next((x for x in s[table] if x['id'] == id), None)
    require(item is not None, 'Data tidak ditemukan atau bukan milik akun Anda.')
    return item

def ids(s, table, values):
    require(isinstance(values, list) and len(values) <= 100, 'Pilihan tidak valid.')
    require(len(values) == len(set(values)), 'Pilihan ganda tidak valid.')
    for v in values:
        get(s, table, v)
    return values

def validate_transaction(s, t, existing=None):
    require(t['kind'] in ['income','expense','transfer','adjustment','refund'], 'Jenis transaksi tidak valid.')
    money(t['amount'], t['kind'] != 'adjustment')
    require(t['amount'] != 0, 'Nominal tidak boleh nol.')
    date(t['date'])
    require(t['date'] <= today(s['preferences']['zone']), 'Transaksi masa depan belum dapat dicatat.')
    require(isinstance(t['note'], str) and len(t['note']) <= 500, 'Catatan maksimal 500 karakter.')
    a = get(s, 'accounts', t['account'])
    require(not a['archived'] or (existing and existing['account']==a['id']), 'Sumber uang sudah diarsipkan.')
    require(t['date'] >= a['opening_date'], 'Tanggal mendahului saldo awal sumber uang.')
    ids(s, 'tags', t['tags'])
    if t['kind'] in ['income','expense']:
        c = get(s, 'categories', t['category'])
        require(c['kind'] == t['kind'], 'Kategori harus sesuai jenis transaksi.')
        require(not c['archived'] or (existing and existing['category']==c['id']), 'Kategori sudah diarsipkan.')
        require(not t['target'] and not t['original'], 'Relasi transaksi tidak sesuai jenis.')
    elif t['kind'] == 'transfer':
        b = get(s, 'accounts', t['target'])
        require(b['id'] != a['id'], 'Akun asal dan tujuan harus berbeda.')
        require(not b['archived'] or (existing and existing['target']==b['id']), 'Akun tujuan diarsipkan.')
        require(t['date'] >= b['opening_date'], 'Tanggal mendahului saldo awal akun tujuan.')
        require(not t['category'] and not t['original'], 'Transfer tidak menggunakan kategori.')
    elif t['kind'] == 'refund':
        original = get(s, 'transactions', t['original'])
        require(original['kind']=='expense' and t['date'] >= original['date'], 'Refund harus menaut ke pengeluaran sebelumnya.')
        require(t['category']==original['category'] and not t['target'], 'Kategori refund mengikuti pengeluaran asal.')
        used = sum(x['amount'] for x in s['transactions'] if x['kind']=='refund' and x['original']==original['id'] and x['id']!=t['id'])
        require(used+t['amount'] <= original['amount'], 'Total refund melebihi pengeluaran asal.')
    else:
        require(bool(t['note'].strip()), 'Penyesuaian saldo wajib menyertakan alasan.')
        require(not t['category'] and not t['target'] and not t['original'], 'Relasi penyesuaian tidak valid.')

def invalidate_days(s, *days):
    for d in set(days):
        if d in s['checkins']:
            s['checkins'][d]['status']='recheck'

def balances(s):
    out = {a['id']: a['opening'] for a in s['accounts']}
    for t in s['transactions']:
        out[t['account']] += t['amount'] * (-1 if t['kind'] in ['expense','transfer'] else 1)
        if t['kind']=='transfer':
            out[t['target']] += t['amount']
    return out

def filtered(s, f):
    start, end = f.get('start','2000-01-01'), f.get('end','2100-12-31')
    date(start); date(end)
    require(start <= end, 'Tanggal awal harus sebelum tanggal akhir.')
    selected_tags = f.get('tags', [])
    selected_categories = f.get('categories', [])
    return [t for t in s['transactions'] if start <= t['date'] <= end
        and (not f.get('account') or f['account'] in (t['account'],t['target']))
        and (not f.get('kind') or t['kind']==f['kind'])
        and (not selected_categories or t['category'] in selected_categories)
        and (not selected_tags or set(selected_tags).intersection(t['tags']))
        and (not f.get('q') or f['q'].casefold() in (t['note']+' '+name(s,'categories',t['category'])+' '+name(s,'accounts',t['account'])).casefold())]

def name(s, table, id):
    return next((x['name'] for x in s[table] if x['id']==id), '')

def summary(s, f):
    rows = filtered(s,f)
    income = sum(t['amount'] for t in rows if t['kind']=='income')
    expense = sum(t['amount']*(1 if t['kind']=='expense' else -1) for t in rows if t['kind'] in ['expense','refund'])
    cats = {}
    for t in rows:
        if t['kind'] in ['expense','refund']:
            cats[t['category']]=cats.get(t['category'],0)+t['amount']*(1 if t['kind']=='expense' else -1)
    return dict(income=income, expense=expense, net=income-expense, count=len(rows), categories=sorted([dict(id=k,name=name(s,'categories',k),amount=v) for k,v in cats.items()],key=lambda x:-x['amount']))

def budget_used(s,b):
    return summary(s,dict(start=b['start'],end=b['end'],categories=b['categories'],tags=b['tags']))['expense']

def check_status(s, day):
    if day in s['checkins']:
        return s['checkins'][day]['status']
    return 'recorded' if any(t['date']==day for t in s['transactions']) else 'unchecked'

def fingerprint(s):
    return hashlib.sha256(json.dumps({k:v for k,v in s.items() if k!='plans'},sort_keys=True).encode()).hexdigest()

def validate_budget(s,b):
    text(b['name']); date(b['start']); date(b['end']); money(b['limit'],True)
    require(b['start'] <= b['end'], 'Periode anggaran tidak valid.')
    ids(s,'categories',b['categories']); ids(s,'tags',b['tags'])
    require(all(get(s,'categories',x)['kind']=='expense' for x in b['categories']), 'Anggaran hanya mencakup kategori pengeluaran.')

def mutate(s, action, p):
    """Dipanggil di dalam transaksi SQLite; exception membatalkan seluruh perubahan."""
    if action in ['accounts','categories','tags']:
        table=action
        old=get(s,table,p['id']) if p.get('id') else None
        item=dict(id=old['id'] if old else uid(), name=text(p.get('name')), archived=bool(p.get('archived',False)))
        if table=='accounts':
            item.update(kind=p.get('kind'),opening=money(p.get('opening')), opening_date=date(p.get('opening_date')))
            require(item['kind'] in ['cash','bank','ewallet'],'Tipe sumber uang tidak valid.')
            require(item['opening_date']<=today(s['preferences']['zone']),'Saldo awal tidak boleh bertanggal masa depan.')
            related=[t for t in s['transactions'] if item['id'] in (t['account'],t['target'])]
            require(not related or item['opening_date']<=min(t['date'] for t in related),'Saldo awal mendahului transaksi pertama.')
        if table=='categories':
            item['kind']=p.get('kind')
            require(item['kind'] in ['income','expense'],'Jenis kategori tidak valid.')
            if old and old['kind']!=item['kind']:
                require(not any(t['category']==item['id'] for t in s['transactions']) and not any(item['id'] in b['categories'] for b in s['budgets']),'Kategori yang digunakan tidak dapat diganti jenis.')
        if old:
            s[table][s[table].index(old)]=item
        else:
            require(len(s[table])<500,'Batas 500 item tercapai.')
            s[table].append(item)
        return item
    if action=='delete-item':
        table=p.get('table'); require(table in ['accounts','categories','tags','budgets'],'Jenis data tidak valid.')
        item=get(s,table,p['id'])
        if table!='budgets':
            used=any((item['id'] in (t['account'],t['target']) if table=='accounts' else t['category']==item['id'] if table=='categories' else item['id'] in t['tags']) for t in s['transactions'])
            used=used or any(item['id'] in b.get(table,[]) for b in s['budgets'])
            require(not used,'Data sudah digunakan. Arsipkan agar riwayat tetap utuh.')
        s[table].remove(item); return {}
    if action=='transaction':
        old=get(s,'transactions',p['id']) if p.get('id') else None
        t={k:p.get(k,'') for k in ['kind','account','target','category','date','note','original']}
        t.update(id=old['id'] if old else uid(),amount=p.get('amount'),tags=p.get('tags',[]),created_at=old['created_at'] if old else dt.datetime.now(dt.timezone.utc).isoformat())
        if t['kind']=='refund':
            t['category']=get(s,'transactions',t['original'])['category']
        validate_transaction(s,t,old)
        if old:
            related=[x for x in s['transactions'] if x['original']==old['id']]
            require(not related or (t['kind']=='expense' and t['category']==old['category'] and t['date']<=min(x['date'] for x in related) and t['amount']>=sum(x['amount'] for x in related)), 'Perubahan bertentangan dengan refund tertaut.')
            s['transactions'][s['transactions'].index(old)]=t
            invalidate_days(s,old['date'])
        else:
            require(len(s['transactions'])<20000,'Batas pilot 20.000 transaksi per akun pengguna tercapai.')
            s['transactions'].append(t)
        invalidate_days(s,t['date'])
        return t
    if action=='delete-transaction':
        t=get(s,'transactions',p['id'])
        require(not any(x['original']==t['id'] for x in s['transactions']),'Hapus refund tertaut lebih dahulu.')
        s['transactions'].remove(t); invalidate_days(s,t['date']); return {}
    if action=='budget':
        old=get(s,'budgets',p['id']) if p.get('id') else None
        b=dict(id=old['id'] if old else uid(),name=p.get('name'),start=p.get('start'),end=p.get('end'),limit=p.get('limit'),categories=p.get('categories',[]),tags=p.get('tags',[]))
        validate_budget(s,b)
        if old: s['budgets'][s['budgets'].index(old)]=b
        else: s['budgets'].append(b)
        return b
    if action=='checkin':
        day=date(p.get('date')); status=p.get('status')
        require(day<=today(s['preferences']['zone']),'Hari mendatang belum dapat diperiksa.')
        require(status in ['complete','none'],'Status pemeriksaan tidak valid.')
        require(status!='none' or not any(t['date']==day for t in s['transactions']),'Hari ini memiliki transaksi. Pilih Sudah lengkap.')
        s['checkins'][day]=dict(status=status,at=dt.datetime.now(dt.timezone.utc).isoformat()); return {}
    if action=='preferences':
        v=p.copy(); require(v.get('zone') in ZONES,'Zona waktu tidak didukung.')
        text(v.get('name'))
        require(isinstance(v.get('time'),str) and len(v['time'])==5,'Jam tidak valid.')
        try: dt.datetime.strptime(v['time'],'%H:%M')
        except ValueError: raise Invalid('Jam tidak valid.')
        require(isinstance(v.get('days'),list) and len(v['days'])<=7 and all(type(x) is int and 0<=x<=6 for x in v['days']),'Hari pengingat tidak valid.')
        if v.get('pause_until'): date(v['pause_until'])
        s['preferences']={k:v[k] for k in ['name','zone','time','days']}
        reminder_email=v.get('reminder_email','') or ''
        require(isinstance(reminder_email,str) and len(reminder_email)<=254,'Email pengingat terlalu panjang.')
        reminder_email=reminder_email.strip().lower()
        if reminder_email:
            require(re.fullmatch(r'[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+',reminder_email) is not None,'Format email pengingat tidak valid.')
        s['preferences'].update(reminder=bool(v.get('reminder')),reminder_email=reminder_email,ai_consent=bool(v.get('ai_consent')),pause_until=v.get('pause_until',''))
        return {}
    if action=='edit-plan':
        plan=get(s,'plans',p['id'])
        require(plan['kind'] in ['budget','savings'] and not plan.get('applied'),'Draft tidak dapat diedit.')
        require(plan['source']==fingerprint(s),'Data sudah berubah. Susun ulang rencana.')
        values=p.get('allocations')
        require(isinstance(values,list) and len(values)==len(plan['allocations']),'Alokasi tidak lengkap.')
        require([x['category'] for x in values]==[x['category'] for x in plan['allocations']],'Kategori draft tidak boleh berubah.')
        for new,old in zip(values,plan['allocations']):
            money(new['amount']); require(new['amount']>=0,'Alokasi tidak boleh negatif.')
            if plan['kind']=='savings': require(new['amount']<=old['before'],'Batas penghematan melebihi riwayat.')
        if plan['kind']=='budget': require(sum(x['amount'] for x in values)==plan['available'],'Total alokasi harus sama dengan dana yang dibagikan.')
        else: require(sum(old['before']-new['amount'] for new,old in zip(values,plan['allocations']))==plan['target'],'Total penghematan harus sama dengan target.')
        for new,old in zip(values,plan['allocations']):
            old['amount']=new['amount']
            if plan['kind']=='savings':old['saving']=old['before']-new['amount']
        plan['edited']=True
        plan.pop('cache_key',None)
        return plan
    if action=='apply-plan':
        plan=get(s,'plans',p['id'])
        require(plan['kind'] in ['budget','savings'] and not plan.get('applied'),'Draft tidak dapat diterapkan.')
        require(plan['source']==fingerprint(s),'Data sudah berubah. Susun ulang rencana sebelum menerapkan.')
        for a in plan['allocations']:
            if a['amount']<=0: continue
            mutate(s,'budget',dict(name=plan['title']+' · '+name(s,'categories',a['category']),start=plan['start'],end=plan['end'],limit=a['amount'],categories=[a['category']],tags=[]))
        plan['applied']=True
        return {}
    raise Invalid('Aksi tidak dikenali.')

def validate_restore(s):
    require(isinstance(s,dict) and set(s)==set(blank()),'Struktur backup tidak cocok dengan versi ini.')
    require(all(isinstance(s[k],list) for k in ['accounts','categories','tags','transactions','budgets','plans']),'Struktur backup rusak.')
    require(len(s['transactions'])<=20000,'Backup terlalu besar.')
    for table in ['accounts','categories','tags','transactions','budgets','plans']:
        values=[x.get('id') for x in s[table]]
        require(all(isinstance(x,str) and len(x)==32 and all(c in '0123456789abcdef' for c in x) for x in values) and len(values)==len(set(values)),'ID backup tidak valid.')
    for table in ['accounts','categories','tags']:
        require(len(s[table])<=500,'Terlalu banyak item.')
        for x in s[table]:
            text(x['name']); require(type(x['archived']) is bool,'Status arsip tidak valid.')
            if table=='accounts':
                money(x['opening']); date(x['opening_date']); require(x['kind'] in ['cash','bank','ewallet'],'Jenis akun salah.')
            if table=='categories': require(x['kind'] in ['income','expense'],'Jenis kategori salah.')
    for t in s['transactions']: validate_transaction(s,t,t)
    for b in s['budgets']: validate_budget(s,b)
    require(isinstance(s['checkins'],dict),'Pemeriksaan tidak valid.')
    for d,v in s['checkins'].items():
        date(d); require(v['status'] in ['complete','none','recheck'],'Status salah.')
        require(v['status']!='none' or not any(t['date']==d for t in s['transactions']),'Status kosong bertentangan dengan transaksi.')
    mutate(s,'preferences',s['preferences'].copy())
    # Draft model dari file tidak dipercaya. Dana & riwayat tetap dipulihkan.
    s['plans']=[]
    s['preferences']['reminder']=False
    s['preferences']['ai_consent']=False
    return s

def make_plan(s,p,weights=None):
    kind=p.get('kind'); require(kind in ['budget','savings','weekly'],'Jenis rencana tidak valid.')
    start=date(p.get('start')); end=date(p.get('end'))
    require(start<=end,'Periode tidak valid.')
    days=(dt.date.fromisoformat(end)-dt.date.fromisoformat(start)).days+1
    require(days<=366,'Periode maksimal 366 hari.')
    categories=ids(s,'categories',p.get('categories',[]))
    require(all(get(s,'categories',c)['kind']=='expense' and not get(s,'categories',c)['archived'] for c in categories),'Pilih kategori pengeluaran aktif.')
    report=summary(s,dict(start=start,end=end))
    incomplete=sum(check_status(s,(dt.date.fromisoformat(start)+dt.timedelta(days=i)).isoformat()) not in ['complete','none'] for i in range(days) if (dt.date.fromisoformat(start)+dt.timedelta(days=i)).isoformat()<=today(s['preferences']['zone']))
    plan=dict(id=uid(),kind=kind,start=start,end=end,title={'budget':'Rencana anggaran','savings':'Rencana hemat','weekly':'Evaluasi periode'}[kind],source=fingerprint(s),allocations=[],applied=False,origin='automatic',incomplete=incomplete,summary=report,assumptions=['Kategori yang dipilih adalah kategori yang Anda izinkan untuk dialokasikan/dikurangi.'],created_at=dt.datetime.now(dt.timezone.utc).isoformat())
    if kind=='weekly':
        plan['budgets']=[dict(name=b['name'],limit=b['limit'],used=budget_used(s,b),start=b['start'],end=b['end']) for b in s['budgets'] if b['start']<=end and b['end']>=start]
        plan['explanation']='Pendapatan dan pengeluaran dihitung dari catatan dalam periode. Realisasi anggaran menggunakan periode masing-masing anggaran. Penyebab perubahan tidak disimpulkan otomatis.'
        return plan
    require(bool(categories),'Pilih minimal satu kategori.')
    if kind=='budget':
        fund=money(p.get('fund')); obligations=money(p.get('obligations')); savings=money(p.get('savings')); reserve=money(p.get('reserve'))
        require(min(fund,obligations,savings,reserve)>=0,'Dana dan alokasi tidak boleh negatif.')
        remaining=fund-obligations-savings-reserve
        require(remaining>=0,f'Dana kurang Rp{abs(remaining):,}. Sesuaikan kewajiban, tabungan, atau cadangan.')
        plan.update(available=remaining,per_day=remaining//days,fund=fund,obligations=obligations,savings=savings,reserve=reserve)
        w={c:1 for c in categories} if weights is None else weights
        require(set(w)==set(categories) and all(type(v) is int and 1<=v<=100 for v in w.values()),'Bobot AI tidak valid.')
        total=sum(w.values()); amounts={c:remaining*w[c]//total for c in categories}
        amounts[categories[-1]]+=remaining-sum(amounts.values())
        plan['allocations']=[dict(category=c,amount=amounts[c]) for c in categories]
        plan['explanation']='Sisa dana dibagi ke kategori pilihan. Kewajiban, tabungan dan cadangan dikurangi satu kali; jangan masukkan dana yang sudah dipisahkan. Pembagian otomatis sama rata jika AI tidak digunakan.'
    else:
        target=money(p.get('target'),True)
        prior_start=date(p.get('prior_start')); prior_end=date(p.get('prior_end'))
        require(prior_start<=prior_end and prior_end<start,'Riwayat penghematan harus sebelum periode rencana.')
        history=summary(s,dict(start=prior_start,end=prior_end))
        history_days=(dt.date.fromisoformat(prior_end)-dt.date.fromisoformat(prior_start)).days+1
        require(history_days<=366,'Periode riwayat maksimal 366 hari.')
        plan['history_incomplete']=sum(check_status(s,(dt.date.fromisoformat(prior_start)+dt.timedelta(days=i)).isoformat()) not in ['complete','none'] for i in range(history_days))
        spent={c:max(0,next((x['amount'] for x in history['categories'] if x['id']==c),0)) for c in categories}
        total=sum(spent.values()); require(total>0,'Belum ada pengeluaran pada kategori dan periode riwayat pilihan.')
        require(target<=total,'Target hemat melebihi seluruh pengeluaran kategori pilihan.')
        cuts={c:target*spent[c]//total for c in categories}; remainder=target-sum(cuts.values())
        for c in categories:
            delta=min(remainder,spent[c]-cuts[c]); cuts[c]+=delta; remainder-=delta
        plan['allocations']=[dict(category=c,before=spent[c],amount=spent[c]-cuts[c],saving=cuts[c]) for c in categories]
        plan.update(target=target,prior_start=prior_start,prior_end=prior_end)
        plan['explanation']='Pengurangan dibagi proporsional pada kategori yang Anda izinkan. Batas usulan merujuk nominal riwayat, tanpa menganggap kebutuhan tertentu tidak penting. Gunakan periode dengan durasi sebanding.'
    return plan
