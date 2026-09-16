import os,sys,sqlite3,json,datetime
from pathlib import Path
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'backend'))
from dotenv import load_dotenv
load_dotenv(ROOT/'.env')
import storage
def main():
    folder=ROOT/'data'/'backups';folder.mkdir(parents=True,exist_ok=True)
    stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    if not os.environ.get('DATABASE_URL'):
        source=ROOT/'data'/'arus.sqlite3'
        if not source.is_file():raise SystemExit('Database belum tersedia.')
        output=folder/('arus-'+stamp+'.sqlite3')
        with sqlite3.connect('file:'+source.as_posix()+'?mode=ro',uri=True) as src,sqlite3.connect(output) as dst:src.backup(dst)
    else:
        output=folder/('arus-postgres-'+stamp+'.json')
        c=storage.Postgres()
        try:
            with c:
                payload={t:[dict(r) for r in c.execute('SELECT * FROM '+t).fetchall()] for t in ['users','states']}
                output.write_text(json.dumps({'format':'arus-postgres-full','version':1,'tables':payload}),encoding='utf-8')
        finally:c.close()
    try:os.chmod(output,0o600)
    except OSError:pass
    print('Backup:',output)
if __name__=='__main__':main()
