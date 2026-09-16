"""SQLite locally, isolated PostgreSQL schema for a single hosted service."""
import os
import sqlite3

SCHEMA = '''
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,email TEXT UNIQUE,password TEXT NOT NULL,verified INTEGER NOT NULL DEFAULT 0,created BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS states(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,revision INTEGER NOT NULL DEFAULT 0,body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,csrf TEXT NOT NULL,expires BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS tokens(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,kind TEXT NOT NULL,expires BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS requests(user_id TEXT REFERENCES users(id) ON DELETE CASCADE,key TEXT NOT NULL,PRIMARY KEY(user_id,key));
CREATE TABLE IF NOT EXISTS deliveries(user_id TEXT REFERENCES users(id) ON DELETE CASCADE,day TEXT NOT NULL,slot INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL,at BIGINT NOT NULL,PRIMARY KEY(user_id,day,slot));
CREATE TABLE IF NOT EXISTS snoozes(user_id TEXT REFERENCES users(id) ON DELETE CASCADE,day TEXT NOT NULL,due BIGINT NOT NULL,PRIMARY KEY(user_id,day));
CREATE TABLE IF NOT EXISTS audit(id BIGSERIAL PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,action TEXT NOT NULL,at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS recovery_backups(id BIGSERIAL PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,body TEXT NOT NULL,created BIGINT NOT NULL);
'''

class Row(dict):
    def __getitem__(self, key):
        return list(self.values())[key] if isinstance(key, int) else super().__getitem__(key)

def row_factory(cursor):
    if cursor.description is None: return lambda values: Row()
    columns = [c.name for c in cursor.description]
    return lambda values: Row(zip(columns, values))

class Postgres:
    def __init__(self):
        import psycopg
        self.conn = psycopg.connect(os.environ['DATABASE_URL'], row_factory=row_factory,
                                   connect_timeout=15, prepare_threshold=None)
        self.conn.execute('SET search_path TO arus_app')
        # Serialize this small-pilot state store across API and scheduler processes.
        self.conn.execute('SELECT pg_advisory_xact_lock(74190321)')
    def execute(self, sql, params=()):
        return self.conn.execute(sql.replace('?', '%s'), params)
    def commit(self): self.conn.commit()
    def close(self): self.conn.close()
    def __enter__(self): return self
    def __exit__(self, typ, value, tb):
        if typ: self.conn.rollback()
        else: self.conn.commit()

def initialize_postgres():
    import psycopg
    with psycopg.connect(os.environ['DATABASE_URL'], connect_timeout=15, prepare_threshold=None) as c:
        c.execute('CREATE SCHEMA IF NOT EXISTS arus_app')
        c.execute('SET search_path TO arus_app')
        for sql in SCHEMA.split(';'):
            if sql.strip(): c.execute(sql)
        # Nothing in this schema is intended for browser access via Supabase REST.
        c.execute('REVOKE ALL ON SCHEMA arus_app FROM PUBLIC')
        for table in ['users','states','sessions','tokens','requests','deliveries','snoozes','audit','recovery_backups']:
            c.execute('ALTER TABLE '+table+' ENABLE ROW LEVEL SECURITY')

def connect(directory):
    if os.environ.get('DATABASE_URL'): return Postgres()
    c = sqlite3.connect(directory/'arus.sqlite3', timeout=15)
    c.row_factory = sqlite3.Row
    c.execute('PRAGMA foreign_keys=ON')
    return c
