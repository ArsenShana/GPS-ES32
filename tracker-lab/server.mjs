import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.stl':'model/stl','.glb':'model/gltf-binary','.bin':'application/octet-stream'};
http.createServer(async (req,res)=>{
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, '.'+(path.endsWith('/')?path+'index.html':path));
    if(!file.startsWith(root+sep)) {res.writeHead(403);res.end();return;}
    const data = await readFile(file);
    res.writeHead(200, {'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);
  } catch {res.writeHead(404);res.end('Файл не найден');}
}).listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log('Tracker Lab: http://localhost:'+(process.env.PORT||4173)));
