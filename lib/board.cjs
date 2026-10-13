const {neon}=require('@neondatabase/serverless');
const {randomBytes,createHash}=require('node:crypto');
const moderation=require('../public/moderation.js');
const COOKIE='tafa_board_visitor';
let client;
function sql(){return client ||= neon(process.env.DATABASE_URL || process.env.POSTGRES_URL,{fetchOptions:{signal:undefined}});}
async function identify(cookie){
 let token=(cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
 let fresh=false;
 if(!/^[A-Za-z0-9_-]{43}$/.test(token||'')){token=randomBytes(32).toString('base64url');fresh=true;}
 const id=createHash('sha256').update(token).digest('hex');
 await sql().query('INSERT INTO tafa_visitors(id) VALUES($1) ON CONFLICT DO NOTHING',[id]);
 return {id,cookie:fresh?`${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000`:null};
}
async function snapshot(visitor){
 const rows=await sql().query(`SELECT
  (SELECT value FROM tafa_version WHERE id=1) AS revision,
  (SELECT name FROM tafa_visitors WHERE id=$1) AS name,
  (now() AT TIME ZONE 'Asia/Shanghai')::date::text AS day,
  (SELECT count(*)::int FROM tafa_messages WHERE visitor=$1 AND day=(now() AT TIME ZONE 'Asia/Shanghai')::date) AS "todayCount",
  coalesce((SELECT json_agg(r ORDER BY likes DESC,created ASC,id ASC) FROM (
   SELECT m.id,m.name,m.body,extract(epoch FROM m.created)::float8 AS created,
    (SELECT count(*)::int FROM tafa_likes WHERE message=m.id) AS likes,
    EXISTS(SELECT 1 FROM tafa_likes WHERE message=m.id AND visitor=$1) AS liked,
    m.visitor=$1 AS mine FROM tafa_messages m
  ) r),'[]'::json) AS messages`,[visitor]);
 const state=rows[0];state.revision=Number(state.revision);state.remaining=Math.max(0,2-state.todayCount);return state;
}
function invalidText(value,max){return typeof value!=='string'||!value.trim()||[...value.trim()].length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value);}
async function change(visitor,action,data){
 let result;
 if(action==='name'){
  if(invalidText(data.name,24)||/[\r\n\t]/.test(data.name))return [400,'请填写1–24字的名字。'];
  if(moderation.blocked(data.name))return [422,moderation.warning];
  result=await sql().query('SELECT tafa_set_name($1,$2) AS result',[visitor,data.name.trim()]);
 }else if(action==='messages'){
  if(invalidText(data.body,500))return [400,'请填写1–500字的留言。'];
  if(moderation.blocked(data.body))return [422,moderation.warning];
  if(!/^[a-f0-9-]{36}$/.test(data.requestId||''))return [400,'提交标识无效，请刷新后重试。'];
  const names=await sql().query('SELECT name FROM tafa_visitors WHERE id=$1',[visitor]);
  if(moderation.blocked(names[0]?.name||''))return [422,moderation.warning];
  result=await sql().query('SELECT tafa_post($1,$2,$3) AS result',[visitor,data.body.trim(),data.requestId]);
 }else{
  if(!Number.isSafeInteger(data.messageId)||data.messageId<1||data.messageId>2147483647)return [404,'这条留言不存在。'];
  result=await sql().query('SELECT tafa_like($1,$2) AS result',[visitor,data.messageId]);
 }
 const code=result[0].result;
 return {ok:[200,''],name_locked:[409,'你已经留言，不能再修改署名。'],name_required:[400,'请先填写你的名字。'],daily_limit:[429,'今天已留言两次，请北京时间明天零点后再来。'],already_liked:[409,'你已经给这条留言点过赞了。'],missing:[404,'这条留言不存在。']}[code]||[503,'暂时无法保存，请稍后再试。'];
}
module.exports={identify,snapshot,change,sql,moderation};
