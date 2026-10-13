const board=require('../lib/board.cjs');
const {setTimeout:delay}=require('node:timers/promises');
module.exports=async function handler(req,res){
 const action=new URL(req.url,'https://local.invalid').pathname.split('/').filter(Boolean).pop();
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const send=(code,data)=>{res.statusCode=code;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(data));};
 if(!['board','events','name','messages','likes'].includes(action))return send(404,{error:'接口不存在。'});
 const read=['board','events'].includes(action);
 if(req.method!==(read?'GET':'POST')){res.setHeader('Allow',read?'GET':'POST');return send(405,{error:'请求方式不正确。'});}
 if(!read){
  const origin=req.headers.origin;
  const host=req.headers.host;
  if((origin&&origin!==`https://${host}`&&origin!==`http://${host}`)||req.headers['sec-fetch-site']==='cross-site')return send(403,{error:'请从当前网站提交。'});
  if(!String(req.headers['content-type']||'').startsWith('application/json'))return send(400,{error:'提交内容格式不正确。'});
  if(Number(req.headers['content-length']||0)>8192)return send(413,{error:'提交内容过长。'});
 }
 try{
  const who=await board.identify(req.headers.cookie);
  if(who.cookie)res.setHeader('Set-Cookie',who.cookie);
  if(action==='board')return send(200,await board.snapshot(who.id));
  if(action==='events'){
   res.statusCode=200;res.setHeader('Content-Type','text/event-stream; charset=utf-8');res.setHeader('X-Accel-Buffering','no');res.flushHeaders?.();
   let stopped=false;res.on('close',()=>{stopped=true;});
   let last='';const deadline=Date.now()+24000;
   while(!stopped&&Date.now()<deadline){
    const state=await board.snapshot(who.id);const key=state.revision+':'+state.day;
    if(key!==last){res.write('retry: 2000\nevent: board\ndata: '+JSON.stringify(state)+'\n\n');last=key;}
    else res.write(': heartbeat\n\n');
    await delay(3000);
   }
   return res.end();
  }
  const data=typeof req.body==='string'?JSON.parse(req.body):req.body;
  if(!data||typeof data!=='object'||Array.isArray(data)||Buffer.byteLength(JSON.stringify(data))>8192)return send(400,{error:'提交内容格式不正确。'});
  const [status,error]=await board.change(who.id,action,data);
  return send(status,status===200?await board.snapshot(who.id):{error});
 }catch(error){
  if(res.headersSent){res.end();return;}
  // Do not log database URLs, visitor cookies, or message contents.
  console.error('Board request failed:',error.name);
  send(error instanceof SyntaxError?400:503,{error:error instanceof SyntaxError?'提交内容格式不正确。':'留言板暂时连接不上，请稍后重试。'});
 }
};
