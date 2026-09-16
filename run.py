import os
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'backend'))
from dotenv import load_dotenv
load_dotenv(ROOT/'.env')
if __name__=='__main__':
    import uvicorn
    port=int(os.environ.get('PORT','8765'))
    host=os.environ.get('ARUS_HOST','127.0.0.1')
    print(f'Arus Modern: http://127.0.0.1:{port}')
    uvicorn.run('app:app',host=host,port=port,workers=1,access_log=False)
