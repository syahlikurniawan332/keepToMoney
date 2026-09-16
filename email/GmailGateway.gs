// Arus: signed HTTPS email gateway and scheduled reminder trigger.
// Set script properties; NEVER put secrets in frontend JavaScript.
function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return json_({ok:false});
  try {
    const props=PropertiesService.getScriptProperties();
    const secret=props.getProperty('GATEWAY_SECRET');
    if (!secret || secret.length<32) throw new Error('Configure secret');
    const envelope=JSON.parse(e.postData.contents);
    if (typeof envelope.payload!=='string'||envelope.payload.length>20000) throw new Error('Payload');
    const bytes=Utilities.computeHmacSha256Signature(envelope.payload,secret,Utilities.Charset.UTF_8);
    const expected=bytes.map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
    if (expected!==envelope.signature) throw new Error('Signature');
    const p=JSON.parse(envelope.payload);
    if (Math.abs(Date.now()/1000-p.timestamp)>300 || !/^[a-f0-9]{32}$/.test(p.nonce)) throw new Error('Expired');
    if (!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(p.to)) throw new Error('Address');
    if (typeof p.subject!=='string'||p.subject.length>200||typeof p.body!=='string'||p.body.length>16000) throw new Error('Content');
    const cache=CacheService.getScriptCache();
    if (cache.get(p.nonce)) throw new Error('Duplicate');
    if (MailApp.getRemainingDailyQuota()<5) throw new Error('Quota reserve');
    cache.put(p.nonce,'claimed',600);
    MailApp.sendEmail({to:p.to,subject:p.subject,body:p.body,name:'Arus'});
    return json_({ok:true});
  } catch (_) { return json_({ok:false}); }
  finally { lock.releaseLock(); }
}
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }

// Run manually once, then add a time-driven trigger (every 15 minutes).
// It performs the user's actual reminder task; it is not a keep-alive heartbeat.
function periksaPengingat() {
  const p=PropertiesService.getScriptProperties();
  const url=p.getProperty('ARUS_URL');
  const secret=p.getProperty('CRON_SECRET');
  if (!url||!url.startsWith('https://')||!secret||secret.length<32) throw new Error('Atur ARUS_URL dan CRON_SECRET');
  const r=UrlFetchApp.fetch(url.replace(/\/$/,'')+'/internal/reminders',{
    method:'post',headers:{Authorization:'Bearer '+secret},muteHttpExceptions:true
  });
  if(r.getResponseCode()!==200) throw new Error('Pengingat gagal. Coba pada jadwal berikutnya.');
}
function otorisasiPengirim() {
  // Run once to grant MailApp permission; no email is sent by this function.
  console.log('Kuota penerima tersisa: '+MailApp.getRemainingDailyQuota());
}
