import { readFileSync, writeFileSync } from 'node:fs';
// Preserve newer production features absent from src/main.ts. Never rebuild from
// the older TS entry until those features have been reconciled.
let code = readFileSync('assets/index-BQsOLZTj.js', 'utf8');
function replace(before, after) {
  if (!code.includes(before)) throw new Error(`Missing patch target: ${before.slice(0, 80)}`);
  code = code.replace(before, after);
}
replace('_a=22,', '_a=50,');
replace('async function yM(){', 'async function unusedOldStartupPermissions(){');
replace('const e=await yM();Ut||', 'const permissions=yM();Ut||');
replace('Ut=await i.start()', 'Ut=await Promise.all([i.start(),cameraReady(i)]).then(results=>results[0])');
replace('ld.hidden=!0,zM(e),GM(e.gpsPosition,e.gpsError)', 'ld.hidden=!0,GM(),void permissions.then(zM)');
replace('Cr(i),wr()}finally{Ca.disabled', 'As(Zn(i,ie().arFailed)+" Muat ulang halaman untuk mencoba kamera lagi."),cameraNeedsReload=true,wr()}finally{Ca.disabled');
replace('async function HM(){if(!xa)', 'async function HM(){if(cameraNeedsReload){window.location.reload();return}if(!xa)');
replace('async function Cr(i){const e=await _y()', 'async function Cr(i){As(gpsHelp(i));gpsRetry.hidden=false;if(Fd(i)===1)Sd();const e=await withTimeout(_y(),1500,"unknown").catch(()=>"unknown")');
replace('console.info(a,i),As(a)', 'console.info(a,i)');
replace('function Ed(i,e,t){const n=', 'function Ed(i,e,t){gpsRetry.hidden=true;const n=');
const begin = code.indexOf('function vl(){');
const end = code.indexOf('function yd(', begin);
if (begin < 0 || end < 0) throw new Error('GPS function not found');
code = code.slice(0, begin) + 'function vl(){return gpsPosition()}' + code.slice(end);
replace('lM="20260723-19"', 'lM="0.1.1 (20261027-instiki-1)"');
const instiki = JSON.parse(readFileSync('src/instiki-location.json', 'utf8'));
const instikiKnowledge = JSON.parse(readFileSync('data/instiki-knowledge.json', 'utf8'));
const bajraSandhi = JSON.parse(readFileSync('data/bajra-sandhi-knowledge.json', 'utf8'));
replace('],$0=new URL(', ',' + [instiki, ...instikiKnowledge.locations, ...bajraSandhi.locations].map(location => JSON.stringify(location)).join(',') + '],$0=new URL(');
replace('locationCount:"4 Lokasi"', 'locationCount:`${ds.length} Lokasi`');
replace('locationCount:"4 Locations"', 'locationCount:`${ds.length} Locations`');
replace('r.textContent=e.name', 'r.textContent=e.id==="kampus-instiki"&&dr==="en"?"INSTIKI Campus":e.name');
replace('vM.textContent=(i==null?void 0:i.title)??""', 'vM.textContent=i?.id==="kampus-instiki"&&dr==="en"?"INSTIKI Campus":(i?.title??"")');
code = `import { cameraReady, withTimeout, gpsPosition, gpsHelp } from './permission-support-20261027.js';\n` + code + `
let cameraNeedsReload=false;
const gpsRetry=document.createElement('button');
gpsRetry.type='button';gpsRetry.className='compact-button';gpsRetry.textContent='Coba GPS lagi';gpsRetry.hidden=true;
eh.insertAdjacentElement('afterend',gpsRetry);
gpsRetry.addEventListener('click',()=>{if(Ut){As(null);GM()}});
async function yM(){
  // Sensor requests must start during the click gesture; neither can block camera.
  const motion=withTimeout(SM(),10000,'Sensor gerak belum merespons').then(()=>null,error=>error);
  const audio=withTimeout(EM(),3000,'Audio belum aktif').then(()=>null,error=>error);
  const [motionError,audioError]=await Promise.all([motion,audio]);
  // GPS owns its own status. Do not overwrite a later GPS error with warnings.
  if(motionError){console.info(motionError);wr()}
  if(audioError)console.info(audioError);
  return {gpsPosition:null,gpsError:null,motionError:null,audioError:null,microphoneError:null};
}
`;
// zM clears diagnostics for empty warnings; GPS diagnostics must remain visible.
replace('void permissions.then(zM)', 'void permissions');
// Keep the production translations and document title consistent with IKARI.
code = code.replaceAll('AR Penglipuran Bali', 'IKARI')
  .replaceAll('Penglipuran Bali AR', 'IKARI')
  .replaceAll('AI Penglipuran siap', 'IKARI siap')
  .replaceAll('Penglipuran AI ready', 'IKARI ready')
  .replaceAll('Tanya Penglipuran', 'Tanya IKARI')
  .replaceAll('Ask Penglipuran', 'Ask IKARI');
// Send a fresh browser position for both audio and server geofence validation.
replace('const n=new FormData;n.append("language",dr)', 'const position=await gpsPosition();const n=new FormData;n.append("latitude",String(position.coords.latitude)),n.append("longitude",String(position.coords.longitude)),n.append("language",dr)');
// Discard a response if the user has moved to another location while it was pending.
replace('fr=!0,In.disabled=!0,ci.textContent=ie().qaSending', 'const askedLocationId=Pt.id;fr=!0,In.disabled=!0,ci.textContent=ie().qaSending');
replace('if(!Pt||mt)return;const a=(e=r.answer)', 'if(!Pt||mt||Pt.id!==askedLocationId)return;const a=(e=r.answer)');
// Scale the wrapper rather than the animated skeleton; preserve marker positioning.
replace('o.position.y=6.35,t.add(o),', 'o.position.y=6.35,t.add(o),applyMarkerScale(t),');
code = "import { applyMarkerScale, bindScaleControls } from './scale-controls.js';\n" + code;
code += '\nbindScaleControls(() => _t.values());\n';
writeFileSync('assets/scale-controls.js', readFileSync('src/scale-controls.js'));
writeFileSync('assets/index-instiki-20261027-v011.js', code);
writeFileSync('assets/permission-support-20261027.js', readFileSync('src/permission-support.js'));
