"""Explicit one-time import. Refuses to overwrite a populated hosted database."""
import os, sys, sqlite3
from pathlib import Path
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'backend'))
from dotenv import load_dotenv
load_dotenv(ROOT/'.env')
import storage

def main():
    if not os.environ.get('DATABASE_URL'): raise SystemExit('Isi DATABASE_URL pada .env terlebih dahulu.')
    source=ROOT/'data'/'arus.sqlite3'
    if not source.is_file(): raise SystemExit('Database lokal tidak ditemukan.')
    storage.initialize_postgres()
    local=sqlite3.connect('file:'+source.as_posix()+'?mode=ro',uri=True)
    local.row_factory=sqlite3.Row
    remote=storage.Postgres()
    try:
        with remote:
            if remote.execute('SELECT COUNT(*) FROM users').fetchone()[0]:
                raise SystemExit('Dibatalkan: database hosting sudah berisi pengguna. Tidak ada data yang ditimpa.')
            counts={}
            for table in ['users','states']:
                rows=local.execute('SELECT * FROM '+table).fetchall()
                for row in rows:
                    columns=','.join(row.keys()); marks=','.join(['?']*len(row))
                    remote.execute('INSERT INTO '+table+'('+columns+') VALUES('+marks+')',tuple(row))
                counts[table]=len(rows)
            # Old sessions and tokens are deliberately NOT moved to hosting.
            print('Migrasi selesai:',counts)
    finally: remote.close(); local.close()
if __name__=='__main__': main()
