(() => {
  const byId = id => document.getElementById(id);
  const board = byId('messageBoard');
  const textarea = byId('boardText');
  const submit = byId('boardSubmit');
  const form = byId('boardForm');
  const list = byId('boardList');
  const dialog = byId('nameDialog');
  const nameForm = byId('nameForm');
  const nameInput = byId('visitorName');
  let state = null, submitting = false, asking = false, suppressPrompt = false;
  let events, started = false, retryTimer, wanted = false, requestId = null;
  const moderation = window.TafaModeration;
  const pendingLikes = new Set();
  function feedback(text, error = false) {
    byId('boardFeedback').textContent = text;
    byId('boardFeedback').dataset.error = String(error);
  }
  async function api(path, data) {
    const response = await fetch(path, {credentials:'same-origin', cache:'no-store', signal:AbortSignal.timeout(10000),
      ...(data ? {method:'POST', headers:{'Content-Type':'application/json'},body:JSON.stringify(data)} : {})});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '暂时无法连接，请稍后重试。');
    return result;
  }
  function connection(online) {
    byId('boardConnection').dataset.online = String(online);
    byId('boardConnection').textContent = online ? '实时更新中' : '连接中，稍后自动重试';
  }
  function refreshComposer() {
    const posted = Boolean(state && state.remaining === 0);
    form.dataset.posted = String(posted);
    textarea.disabled = posted || submitting;
    textarea.readOnly = !state?.name;
    submit.disabled = !state || !state.name || posted || submitting || !textarea.value.trim() || moderation.blocked(textarea.value);
    submit.textContent = posted ? '今日已达上限' : submitting ? '提交中…' : '确定';
    byId('boardIdentity').textContent = posted ? `${state.name}，今天已留言两次，北京时间明天零点恢复额度。` : state?.name ? `以「${state.name}」的名字留言 · 今日还可留言 ${state.remaining} 次` : '点击输入框，先留下你的名字';
    textarea.placeholder = '写下你想说的话（每天最多两次）';
    byId('boardCounter').textContent = `${textarea.value.length} / 500`;
  }
  function render(next) {
    if (state && next.revision < state.revision) return;
    state = next;
    const previouslyFocused = list.contains(document.activeElement) ? document.activeElement?.dataset.message : null;
    const scroll = list.scrollTop;
    const fragment = document.createDocumentFragment();
    for (const message of state.messages) {
      const row = document.createElement('li');
      row.className = 'board-message';
      const paragraph = document.createElement('p');
      const author = document.createElement('strong');
      author.textContent = message.name + '：';
      paragraph.append(author, document.createTextNode(message.body));
      if (message.mine) { const own = document.createElement('span');own.className='board-own';own.textContent='我的留言';paragraph.append(own); }
      const like = document.createElement('button');
      like.type = 'button';like.className='board-like';like.dataset.message=String(message.id);
      like.setAttribute('aria-pressed',String(Boolean(message.liked)));
      like.setAttribute('aria-label',`${message.liked ? '已点赞' : '点赞'}${message.name}的留言，${message.likes}赞`);
      like.disabled = Boolean(message.liked) || pendingLikes.has(message.id);
      // Only the fixed icon uses markup. Visitor content is always text.
      like.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10v11H3V10h4zm0 1 5-8c1-1 3 0 2 3l-1 4h6c2 0 2 2 1 4l-2 7H7"/></svg>';
      like.append(document.createTextNode(`${message.liked ? '已赞' : '赞'} ${message.likes}`));
      like.addEventListener('click',() => likeMessage(message.id));
      row.append(paragraph,like);fragment.append(row);
    }
    list.replaceChildren(fragment);
    list.scrollTop=scroll;
    if (previouslyFocused) list.querySelector(`[data-message="${previouslyFocused}"]`)?.focus({preventScroll:true});
    byId('boardEmpty').hidden=state.messages.length>0;
    byId('boardCount').textContent=`大家的留言 · ${state.messages.length}`;
    refreshComposer();
  }
  async function reload() { render(await api('/api/board')); }
  function listen() {
    events?.close();
    events=new EventSource('/api/events');
    events.addEventListener('board',event=>{render(JSON.parse(event.data));connection(true);});
    events.onerror=()=>connection(false);
  }
  async function start() {
    if (started) return;
    started=true;
    try { await reload(); if(wanted && !document.hidden) listen(); else started=false; }
    catch (error) { started=false;connection(false);feedback(location.protocol==='file:'?'请使用文件夹里的“启动留言板预览.cmd”打开本版。':'暂时连不上留言板，正在重试。',true);retryTimer=setTimeout(()=>{if(wanted && !document.hidden)start();},4000); }
  }
  function requestName() {
    if (state?.name || state?.remaining===0 || asking || suppressPrompt) return;
    if (!state) { feedback('留言板正在连接，请稍候再试。',true);return; }
    asking=true;byId('nameError').textContent='';nameInput.value='';dialog.showModal();nameInput.focus();
  }
  function closeName() {
    suppressPrompt=true;asking=false;dialog.close();
    if (state?.name) { textarea.readOnly=false;textarea.focus({preventScroll:true}); }
    else byId('boardTitle').focus({preventScroll:true});
    setTimeout(()=>{suppressPrompt=false;},300);
  }
  textarea.addEventListener('pointerdown',event=>{if(!state?.name){event.preventDefault();requestName();}});
  textarea.addEventListener('focus',requestName);
  textarea.addEventListener('input',()=>{
    requestId=null;
    if(moderation.blocked(textarea.value))feedback(moderation.warning,true);
    else if(byId('boardFeedback').textContent===moderation.warning)feedback('');
    refreshComposer();
  });
  nameInput.addEventListener('input',()=>{byId('nameError').textContent=moderation.blocked(nameInput.value)?moderation.warning:'';});
  byId('nameCancel').addEventListener('click',closeName);
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeName();});
  nameForm.addEventListener('submit',async event=>{
    event.preventDefault();const value=nameInput.value.trim();
    if(!value){byId('nameError').textContent='请先填写你的名字。';nameInput.focus();return;}
    if(moderation.blocked(value)){byId('nameError').textContent=moderation.warning;return;}
    byId('nameSubmit').disabled=true;
    try {render(await api('/api/name',{name:value}));closeName();feedback('名字已记住，写下你想说的话吧。');}
    catch(error){byId('nameError').textContent=error.message;}
    finally {byId('nameSubmit').disabled=false;}
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if (!state?.name){requestName();return;}
    if(state.remaining===0||submitting||!textarea.value.trim())return;
    if(moderation.blocked(textarea.value)){feedback(moderation.warning,true);return;}
    requestId ||= crypto.randomUUID();
    submitting=true;refreshComposer();
    try {render(await api('/api/messages',{body:textarea.value.trim(),requestId}));textarea.value='';requestId=null;feedback('留言已发布，其他访客现在也能看到了。');}
    catch(error){feedback(error.message,true);try{await reload();}catch{}}
    finally{submitting=false;refreshComposer();}
  });
  async function likeMessage(id) {
    if(pendingLikes.has(id))return;
    pendingLikes.add(id);render(state);
    try {render(await api('/api/likes',{messageId:id}));feedback('点赞成功，留言已按赞数重新排序。');}
    catch(error){feedback(error.message,true);try{await reload();}catch{}}
    finally{pendingLikes.delete(id);render(state);}
  }
  // Keep the realtime connection only while the board is being viewed.
  function suspend(){clearTimeout(retryTimer);events?.close();started=false;}
  if(location.protocol==='file:')feedback('请通过“启动留言板预览.cmd”启动服务后查看留言板。',true);
  else {
    new IntersectionObserver(entries=>{
      wanted=entries.some(entry=>entry.isIntersecting);
      if(wanted&&!document.hidden)start();else suspend();
    },{rootMargin:'150px'}).observe(board);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();else if(wanted)start();});
    window.addEventListener('pagehide',suspend);
    window.addEventListener('pageshow',event=>{if(event.persisted&&wanted)start();});
  }
})();
