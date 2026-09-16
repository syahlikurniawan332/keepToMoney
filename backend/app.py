"""FastAPI transport around the preserved, tested Arus business service."""
import io
import os
import json
import hmac
import threading
import asyncio
from pathlib import Path
from contextlib import asynccontextmanager
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent/'.env')
import legacy as service
from fastapi import FastAPI, Request
from fastapi.responses import Response, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

@asynccontextmanager
async def lifespan(app):
    if os.environ.get('ARUS_HOST')=='0.0.0.0' and not os.environ.get('DATABASE_URL') and os.environ.get('ARUS_PERSISTENT_SQLITE')!='true':
        raise RuntimeError('Hosting memerlukan DATABASE_URL persisten. Gunakan ARUS_PERSISTENT_SQLITE=true hanya jika Anda menyediakan disk persisten sendiri.')
    service.PORT=int(os.environ.get('PORT','8765'))
    service.init()
    stop=threading.Event()
    def loop():
        while not stop.wait(30):
            try: service.reminder_tick()
            except Exception: print('Pengingat belum terkirim; periksa konfigurasi pengirim/database.')
    worker=None
    if os.environ.get('ARUS_SCHEDULER','true')=='true':
        worker=threading.Thread(target=loop,daemon=True); worker.start()
    yield
    stop.set()

app=FastAPI(title='Arus Modern',docs_url=None,redoc_url=None,openapi_url=None,lifespan=lifespan)

@app.middleware('http')
async def headers(request,call_next):
    response=await call_next(request)
    response.headers.update({'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Cache-Control':'no-store',
      'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"})
    return response

class RequestService(service.Handler):
    """Adapt HTTP inputs, retaining the same auth/CSRF/transaction behavior."""
    def __init__(self,request,body):
        self.path=request.url.path+('?' + request.url.query if request.url.query else '')
        self.headers=dict(request.headers)
        # Email headers are case insensitive in the original service.
        from email.message import Message
        headers=Message()
        for k,v in request.headers.items(): headers[k]=v
        headers.replace_header('content-length',str(len(body))) if headers.get('content-length') else headers.add_header('content-length',str(len(body)))
        self.headers=headers
        self.rfile=io.BytesIO(body)
        self.client_address=(request.client.host if request.client else 'unknown',0)
        self.response=None
    def respond(self,status,data,headers=None,kind='application/json; charset=utf-8'):
        content=json.dumps(data,ensure_ascii=False).encode() if kind.startswith('application/json') else data
        self.response=Response(content,status_code=status,headers=headers,media_type=kind)

@app.api_route('/api/{path:path}',methods=['GET','POST'])
async def api(request:Request,path:str):
    body=bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body)>8*1024*1024: return JSONResponse({'error':'Permintaan maksimal 8 MB.'},413)
    adapter=RequestService(request,bytes(body))
    await run_in_threadpool(adapter.handle_request,request.method=='POST')
    return adapter.response or JSONResponse({'error':'Operasi tidak selesai.'},500)

@app.post('/internal/reminders')
async def reminders(request:Request):
    secret=os.environ.get('ARUS_CRON_SECRET','')
    if len(secret)<32 or not hmac.compare_digest(request.headers.get('Authorization',''),'Bearer '+secret):
        return JSONResponse({'error':'Unauthorized'},401)
    await run_in_threadpool(service.reminder_tick)
    return {'ok':True}

@app.get('/health')
def health(): return {'ok':True,'application':'Arus Modern'}

DIST=Path(__file__).resolve().parent.parent/'frontend'/'dist'
if (DIST/'assets').exists(): app.mount('/assets',StaticFiles(directory=DIST/'assets'),name='assets')

@app.get('/')
@app.get('/{path:path}')
def index(path:str=''):
    if not (DIST/'index.html').exists(): return JSONResponse({'error':'Frontend belum dibangun. Jalankan npm run build di frontend.'},503)
    return FileResponse(DIST/'index.html')
