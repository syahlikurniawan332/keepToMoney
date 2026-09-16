"""Restore full JSON backup to EMPTY PostgreSQL only, with explicit source argument."""
import os,sys,json,argparse
from pathlib import Path
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'backend'))
from dotenv import load_dotenv
load_dotenv(ROOT/'.env')
import storage
def main():
    parser=argparse.ArgumentParser(description='Restore backup penuh ke PostgreSQL kosong.')
    parser.add_argument('backup',type=Path)
    args=parser.parse_args()
    if not os.environ.get('DATABASE_URL'):raise SystemExit('Isi DATABASE_URL untuk database tujuan kosong.')
    backup=json.loads(args.backup.read_text('utf-8'))
    if backup.get('format')!='arus-postgres-full' or backup.get('version')!=1:raise SystemExit('Format backup penuh tidak valid.')
    storage.initialize_postgres();c=storage.Postgres()
    try:
        with c:
            if c.execute('SELECT COUNT(*) FROM users').fetchone()[0]:raise SystemExit('Dibatalkan: database tujuan sudah berisi pengguna.')
            fields={'users':['id','username','email','password','verified','created'],'states':['user_id','revision','body']}
            for table,columns in fields.items():
                for row in backup['tables'][table]:
                    if set(row)!=set(columns):raise ValueError('Kolom backup tidak sesuai.')
                    c.execute('INSERT INTO '+table+'('+','.join(columns)+') VALUES('+','.join(['?']*len(columns))+')',tuple(row[k] for k in columns))
        print('Pemulihan selesai. Sesi/token tidak dipulihkan; login kembali.')
    finally:c.close()
if __name__=='__main__':main()
