import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { request } from 'node:http';
import { createGREServer, MODEL, REASONING_EFFORT } from '../server.mjs';

const answer = text => ({status:'completed',model:MODEL,output:[{type:'reasoning',summary:[]},{type:'message',content:[{type:'output_text',text}]}]});
const fixtureKey = 'not-a-real-key-for-connection-tests';
async function gateway(t, options = {}) {
  const server = createGREServer({apiKey:'',...options});
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const post = (route, data, headers = {}) => fetch(origin + route, {method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
  return {origin,post};
}

test('local app offers Terra High without disclosing a configured key or serving source files', async t => {
  const {origin} = await gateway(t,{apiKey:fixtureKey});
  const page = await (await fetch(origin)).text();
  assert.match(page,/window.GRE_OPENAI_SERVER=\{"model":"gpt-6.1-terra","reasoningEffort":"high","configured":true\}/);
  assert.ok(!page.includes(fixtureKey));
  assert.equal((await fetch(origin+'/server.mjs')).status,404);
  assert.equal((await fetch(origin+'/.env')).status,404);
});

test('a missing key blocks AI; key setup returns only status, and every request stays pinned to Terra High', async t => {
  let called=0, request;
  const {origin,post} = await gateway(t,{fetchImpl:async(url,options)=>{
    called++; request={url,...options,body:JSON.parse(options.body)};
    return new Response(JSON.stringify(answer('{"ready":true}')),{status:200});
  }});
  assert.equal((await post('/api/ai',{messages:[{role:'user',content:'Hello'}]})).status,503);
  assert.equal(called,0);
  const configured=await post('/api/configure',{apiKey:fixtureKey});
  assert.deepEqual(await configured.json(),{model:MODEL,reasoningEffort:REASONING_EFFORT,configured:true});
  const result=await post('/api/ai',{model:'some-other-model',reasoningEffort:'none',messages:[{role:'user',content:'Return JSON with ready=true.'}],json:true});
  assert.equal(result.status,200);
  assert.equal((await result.json()).text,'{"ready":true}');
  assert.equal(request.url,'https://api.openai.com/v1/responses');
  assert.equal(request.body.model,MODEL);
  assert.deepEqual(request.body.reasoning,{effort:'high'});
  assert.equal(request.body.max_output_tokens,25000);
  assert.equal(request.body.store,false);
  assert.deepEqual(request.body.text,{format:{type:'json_object'}});
  assert.ok(!('temperature' in request.body));
  assert.equal(request.headers.Authorization,'Bearer '+fixtureKey);
  assert.ok(!(await (await fetch(origin)).text()).includes(fixtureKey));
});

test('foreign origins, invalid host names, and malformed message bodies cannot use the gateway', async t => {
  let called=0;
  const {origin,post} = await gateway(t,{apiKey:fixtureKey,fetchImpl:async()=>{called++; throw new Error('must not call');}});
  assert.equal((await post('/api/configure',{apiKey:fixtureKey},{Origin:'https://unrelated.example'})).status,403);
  assert.equal((await fetch(origin+'/api/configure',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiKey:fixtureKey})})).status,403);
  const hostStatus=await new Promise((resolve,reject)=>{const req=request(origin+'/api/status',{headers:{Host:'unrelated.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});
  assert.equal(hostStatus,403);
  for(const messages of [[],[{role:'tool',content:'wrong role'}],[{role:'user',content:{text:'not plain text'}}],[{role:'user',content:'x'.repeat(120001)}]]) {
    assert.equal((await post('/api/ai',{messages})).status,400);
  }
  assert.equal(called,0);
});

test('unfinished and refused upstream responses fail explicitly rather than appearing connected', async t => {
  let data={status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output:[]};
  const {post}=await gateway(t,{apiKey:fixtureKey,fetchImpl:async()=>new Response(JSON.stringify(data),{status:200})});
  let result=await post('/api/ai',{messages:[{role:'user',content:'Hello'}]});
  assert.equal(result.status,502); assert.match((await result.json()).error,/before finishing/);
  data={status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'No'}]}]};
  result=await post('/api/ai',{messages:[{role:'user',content:'Hello'}]});
  assert.equal(result.status,502); assert.match((await result.json()).error,/declined/);
});

test('upstream errors redact keys and preserve actionable status', async t => {
  const {post}=await gateway(t,{apiKey:fixtureKey,fetchImpl:async()=>new Response(JSON.stringify({error:{message:'Invalid key '+fixtureKey}}),{status:401})});
  const result=await post('/api/ai',{messages:[{role:'user',content:'Hello'}]});
  assert.equal(result.status,401);
  const body=await result.text(); assert.ok(!body.includes(fixtureKey)); assert.match(body,/redacted/);
});

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
function pageContext(fetchImpl,bootstrap) {
  const elements=new Map(), stored=new Map();
  const get=id=>{
    if(!elements.has(id)) elements.set(id,{value:'',style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},querySelectorAll(){return [];},addEventListener(){}});
    return elements.get(id);
  };
  const context=vm.createContext({console,AbortController,setTimeout,clearTimeout,setInterval(){return 1;},clearInterval(){},fetch:fetchImpl,location:{origin:'http://127.0.0.1:8787'},window:{GRE_OPENAI_SERVER:bootstrap,scrollTo(){}},document:{getElementById:get,querySelectorAll(){return [];}},localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)}});
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1].split('/* ---------------------------------------------------------------------------\n   11. Boot')[0],context);
  return {run:code=>vm.runInContext(code,context),get,stored};
}

test('browser OpenAI adapter uses Responses and High reasoning without obsolete sampling or tiny budgets', async () => {
  let sent;
  const {run}=pageContext(async(url,options)=>{sent={url,body:JSON.parse(options.body)};return new Response(JSON.stringify(answer('ready')));});
  run(`S.settings={provider:'openai',model:'gpt-6.1-terra',reasoningEffort:'high',apiKey:'${fixtureKey}'};`);
  assert.equal(await run(`callAI([{role:'user',content:'Return JSON.'}],{json:true,max_tokens:10,temperature:0.2})`),'ready');
  assert.equal(sent.url,'https://api.openai.com/v1/responses');
  assert.deepEqual(sent.body.reasoning,{effort:'high'});
  assert.ok(!('temperature' in sent.body));
  assert.ok(sent.body.max_output_tokens>=25000);
  assert.deepEqual(sent.body.text,{format:{type:'json_object'}});
  run(`S.settings.model='gpt-4.1-mini';`);
  await run(`callAI([{role:'user',content:'Hello'}],{temperature:0.2,max_tokens:400})`);
  assert.equal(sent.body.temperature,0.2); assert.equal(sent.body.max_output_tokens,400); assert.ok(!('reasoning' in sent.body));
});

test('local key setup never saves the key in browser state or forwards it with tutoring requests', async () => {
  const sent=[];
  const {run,get,stored}=pageContext(async(url,options)=>{
    sent.push({url,body:JSON.parse(options.body),headers:options.headers});
    return new Response(JSON.stringify(url==='/api/configure'?{model:MODEL,reasoningEffort:'high',configured:true}:{text:'ready',model:MODEL,reasoningEffort:'high'}));
  },{model:MODEL,reasoningEffort:'high',configured:false});
  Object.assign(get('set-provider'),{value:'openai-server'});
  get('set-key').value=fixtureKey; get('set-model').value=MODEL; get('set-reasoning').value='high'; get('set-customurl').value=''; get('set-autograde').checked=true;
  await run('settingsFromFields().then(s=>{S.settings=s;save();})');
  assert.equal(run('S.settings.apiKey'),''); assert.equal(get('set-key').value,'');
  assert.ok(![...stored.values()].join('').includes(fixtureKey));
  assert.equal(await run(`callAI([{role:'user',content:'Hello'}])`),'ready');
  assert.equal(sent[1].url,'/api/ai'); assert.ok(!JSON.stringify(sent[1]).includes(fixtureKey));
  assert.ok(!('Authorization' in sent[1].headers));
});

test('AI answer choices are rendered as text, including less-than signs and untrusted HTML', () => {
  const {run}=pageContext();
  assert.match(run(`choiceHTML('q',0,'<img src=x onerror=alert(1)>',false,false)`),/&lt;img/);
  assert.match(run(`choiceHTML('q',0,'x < 3',false,false)`),/x &lt; 3/);
});

test('worked maths lessons reveal steps and give corrective feedback without an AI key', () => {
  const {run,get}=pageContext();
  const lessons=JSON.parse(run('JSON.stringify(MATH_LESSONS)'));
  assert.equal(lessons.length,6);
  for(const lesson of lessons){
    run(`showMathLesson(${JSON.stringify(lesson.id)})`);
    assert.match(get('math-lesson').innerHTML,/Step 1/);
    assert.ok(!get('math-lesson').innerHTML.includes('Step 2.'));
    run('mathLesson.step=4;renderMathLesson()');
    get('math-practice-answer').value=String(lesson.answer);
    run('checkMathPractice()');
    assert.match(get('math-practice-feedback').textContent,/^Yes\./);
    get('math-practice-answer').value='-999';run('checkMathPractice()');
    assert.match(get('math-practice-feedback').textContent,/^Try this next:/);
  }
  assert.equal(run('aiReady()'),false);
});

test('teaching a current maths question includes its data and pauses the practice clock', () => {
  const {run,get}=pageContext();
  run(`exam={mode:'quantMix',inSection:true,plan:[],sectionResults:[],secIdx:0,sec:{cfg:{name:'Quant',kind:'quant',time:120},qi:0,timeLeft:120,endAt:Date.now()+120000,questions:[{type:'mc',_id:'table-test',stem:'Find the total.',choices:['15','20','25','30','35'],answer:0,explanation:'Add 5 + 10 = 15.',table:{headers:['A','B'],rows:[[5,10]]}}],answers:{},flags:new Set(),qTime:{},qShownAt:null}};openTeacher({current:true});`);
  assert.equal(run('exam.paused'),true);
  assert.match(run('teach.ctx.text'),/A \| B/);
  assert.match(run('teach.ctx.text'),/5 \| 10/);
  assert.match(get('teach-msgs').innerHTML,/Stored worked solution/);
  assert.match(get('teach-msgs').innerHTML,/Connect AI/);
  run('closeTeacher()'); assert.equal(run('exam.paused'),false);
  run('stopTimer()');
});

test('maths tutor requests guided teaching and checks the answer key independently', async () => {
  let sent;
  const {run}=pageContext(async(url,options)=>{sent=JSON.parse(options.body);return new Response(JSON.stringify(answer('First subtract 7 from both sides. What is 22 − 7?')));});
  run(`S.settings={provider:'openai',model:'gpt-6.1-terra',reasoningEffort:'high',apiKey:'${fixtureKey}'};teach={key:'math-test',ctx:teacherContext({math:true,question:'3x + 7 = 22'}),msgs:[],busy:false};`);
  await run(`askTeacher('Explain one step at a time')`);
  assert.match(sent.input[0].content,/Independently check/);
  assert.match(sent.input[0].content,/wait/);
  assert.match(sent.input[0].content,/WHY/);
  assert.deepEqual(sent.reasoning,{effort:'high'});
  assert.match(run('teach.msgs.at(-1).content'),/subtract 7/);
});

test('one-button connection verifies and saves settings without persisting an unremembered key', async () => {
  const {run,get,stored}=pageContext(async()=>new Response(JSON.stringify(answer('ready'))));
  get('teacher-api-key').value=fixtureKey; get('remember-teacher-key').checked=false;
  await run('connectTeacherAI()');
  assert.equal(run('aiReady()'),true);
  assert.equal(run('S.settings.model'),'gpt-6.1-terra');
  assert.equal(run('S.settings.reasoningEffort'),'high');
  assert.equal(run('S.settings.apiKey'),'');
  assert.ok(![...stored.values()].join('').includes(fixtureKey));
  assert.equal(get('teacher-api-key').value,'');
});

test('failed tutoring offers connection repair and redacts echoed credentials', async () => {
  const {run,get}=pageContext(async()=>new Response(JSON.stringify({error:{message:'Invalid key '+fixtureKey}}),{status:401}));
  run(`S.settings={provider:'openai',model:'gpt-6.1-terra',reasoningEffort:'high',apiKey:'${fixtureKey}'};teach={key:'error-test',ctx:teacherContext({math:true,question:'Solve x+2=5'}),msgs:[],busy:false};`);
  await run(`askTeacher('Help me')`);
  assert.equal(run('S.aiConnection.state'),'error');
  assert.match(get('teach-msgs').innerHTML,/Connect AI/);
  assert.ok(!get('teach-msgs').innerHTML.includes(fixtureKey));
  assert.match(run('teach.msgs.at(-1).content'),/connection needs attention/);
});

test('simple OpenAI setup never reuses another provider’s key', async () => {
  let called=false;
  const {run,get}=pageContext(async()=>{called=true;throw new Error('must not call');});
  run(`S.settings={provider:'gemini',model:'different-model',apiKey:'another-provider-private-key'};`);
  get('teacher-api-key').value='';
  await run('connectTeacherAI()');
  assert.equal(called,false);
  assert.match(get('connect-teacher-result').textContent,/Enter your OpenAI API key/);
  assert.equal(run('S.settings.provider'),'gemini');
});

test('completed essay feedback refreshes the essay-only result headline', async () => {
  const feedback={score:4,summary:'A clear position with relevant support.',strengths:['Clear position'],improvements:['Develop the counterargument'],rubric:{thesis:4,development:4,organization:4,language:4}};
  const {run,get}=pageContext(async()=>new Response(JSON.stringify(answer(JSON.stringify(feedback)))));
  run(`S.settings={provider:'openai',model:'gpt-6.1-terra',apiKey:'${fixtureKey}',reasoningEffort:'high'};var essayFixture={essay:{prompt:'Education should encourage independent thinking.',text:'An education should help students examine evidence and develop their own conclusions. A clear method for questioning a claim helps them use knowledge responsibly throughout their lives.'}};var essayEntry={date:'essay-fixture',verbal:null,quant:null,essay:null};S.history=[essayEntry];S.lastSession={entry:essayEntry,results:[essayFixture]};displayedResultDate='essay-fixture';`);
  await run('gradeEssayAI(essayFixture,essayEntry)');
  assert.equal(get('result-headline').textContent,'4 / 6');
  assert.match(get('result-description').textContent,/AI practice feedback/);
  assert.equal(run('S.lastSession.entry.essay'),4);
});

test('expanded written pool has valid keys and the maths pool contains 80 templates', () => {
  const {run}=pageContext();
  const bank=JSON.parse(run('JSON.stringify(EXTRA_BANK)'));
  let count=0;
  for(const [type,items] of Object.entries(bank))for(const item of items){
    const subs=type==='rc'?item.subs:[item];
    for(const q of subs){
      count++;
      if(type==='tc2'){assert.equal(q.groups.length,2);assert.ok(q.answer.every((v,i)=>v>=0&&v<q.groups[i].length));}
      else{const keys=Array.isArray(q.answer)?q.answer:[q.answer];assert.ok(keys.every(i=>Number.isInteger(i)&&i>=0&&i<q.choices.length));assert.equal(new Set(q.choices).size,q.choices.length);}
      assert.ok(q.explanation.length>20);
      if(q.format==='sentence') assert.ok(item.passage.includes(q.choices[q.answer]));
    }
  }
  assert.equal(count,100);
  assert.equal(run('Object.keys(GEN).length'),80);
  assert.equal(run(`Object.entries(VBANK).filter(([k])=>k!=='issue').reduce((n,[k,a])=>n+a.reduce((sum,q)=>sum+subCount(q),0),0)`),418);
  for(const key of JSON.parse(run('JSON.stringify(Object.keys(GEN_EXPANSION))')))for(let i=0;i<20;i++){
    const q=JSON.parse(run(`JSON.stringify(GEN[${JSON.stringify(key)}]())`));
    if(q.choices)assert.equal(new Set(q.choices).size,q.choices.length);
    if(q.type==='ne')assert.ok(Number.isFinite(q.answer));
  }
});

test('written questions rotate before reuse, and recent generated maths repeats are avoided', () => {
  const {run}=pageContext();
  assert.equal(run(`(()=>{S.seen={};const a=pickVerbalByType('tc1',50),b=pickVerbalByType('tc1',50);const seen=new Set(a.map(fingerprint));return b.every(q=>!seen.has(fingerprint(q)));})()`),true);
  assert.equal(run(`(()=>{S.seen.quantItems=[];const a=Array.from({length:100},()=>genQuant('mc'));return new Set(a.map(fingerprint)).size;})()`),100);
  assert.equal(run(`(()=>{S.seen.t_issue=[];const a=Array.from({length:VBANK.issue.length},()=>pickIssue());return new Set(a.map(q=>q.prompt)).size;})()`),run('VBANK.issue.length'));
});
