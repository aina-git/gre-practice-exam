const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1].split('/* ---------------------------------------------------------------------------\n   11. Boot')[0];
const elements = new Map(), storage = new Map();
let now = 1000000, nextInterval = 0;
class ClockDate extends Date { static now() { return now; } }
const element = id => {
  if (!elements.has(id)) elements.set(id, {style:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},querySelectorAll(){return [];},addEventListener(){},innerHTML:'',textContent:'',hidden:false});
  return elements.get(id);
};
const ctx = vm.createContext({ console, Date:ClockDate, Math, Set, JSON, Number, String, Array, Object, RegExp, Promise,
  document:{getElementById:element,querySelectorAll(){return [];},addEventListener(){}},
  window:{scrollTo(){}}, localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  setTimeout(){return 1;},clearTimeout(){},setInterval(){return ++nextInterval;},clearInterval(){}, Event:class {},
});
vm.runInContext(script,ctx);
const run = code => vm.runInContext(code,ctx);
let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name);}
test('published section counts and 118-minute total',()=>{
  assert.equal(run('Object.values(SECTIONS).reduce((s,c)=>s+c.time,0)'),118*60);
  for(const level of ['easy','medium','hard']) for(const n of [12,15]) for(let i=0;i<50;i++){
    assert.equal(run(`totalQuestions(buildVerbalSection(${n},'${level}'))`),n);
    assert.equal(run(`buildVerbalSection(${n},'${level}').every(q=>q.type!=='rc'||q.subs.length===1)`),true);
    assert.equal(run(`totalQuestions(buildQuantSection(${n},'${level}'))`),n);
  }
});
test('reading formats are present and passage questions stay consecutive',()=>{
  for(const level of ['easy','medium','hard']){
    assert.equal(run(`(()=>{const q=buildVerbalSection(12,'${level}');return ['multi','sentence'].every(f=>q.some(x=>x.type==='rc'&&x.subs[0].format===f));})()`),true);
    assert.equal(run(`(()=>{const q=buildVerbalSection(15,'${level}');const pos={};q.forEach((x,i)=>{if(x.passageId)(pos[x.passageId] ||= []).push(i)});return Object.values(pos).every(a=>a.every((p,i)=>i===0||p===a[i-1]+1));})()`),true);
  }
});
test('variable full-test order preserves each measure order',()=>{
  const orders=new Set();
  for(let i=0;i<100;i++){
    const p=JSON.parse(run('JSON.stringify(fullPlan())'));
    assert.equal(p[0],'writing'); assert.equal(new Set(p).size,5);
    assert.ok(p.indexOf('verbal1')<p.indexOf('verbal2'));
    assert.ok(p.indexOf('quant1')<p.indexOf('quant2')); orders.add(p.join(','));
  }
  assert.ok(orders.size>1);
});
test('verbal difficulty selection respects available labels',()=>{
  for(const lv of ['easy','medium','hard']) assert.equal(run(`pickVerbalByType('tc1',1,'${lv}').every(q=>q.difficulty==='${lv}')`),true);
});
test('numeric grammar accepts signed decimals and fractions, rejects junk',()=>{
  for(const [s,n] of [['.5',.5],['-0.25',-.25],['+3',3],['6/8',.75],['2.',2],[' -3 / 4 ',-.75]]) assert.equal(run(`evalNumeric(${JSON.stringify(s)})`),n);
  for(const s of ['2junk','2%','$2','1,000','1/0','1/0x','1e3','Infinity','2+3','']) assert.equal(run(`evalNumeric(${JSON.stringify(s)})`),null);
});
test('two-box fractions require both integers and accept equivalent fractions',()=>{
  assert.equal(run(`validFractionEntry('6/8')`),true);
  for(const raw of ['/8','6/','0.75','6/0','3.0/4']) assert.equal(run(`validFractionEntry(${JSON.stringify(raw)})`),false);
  assert.equal(run(`scoreSection({cfg:{kind:'quant'},questions:[{_id:'f',type:'ne',entryFormat:'fraction',answer:0.75}],answers:{f:'6/8'}}).correct`),1);
  assert.equal(run(`scoreSection({cfg:{kind:'quant'},questions:[{_id:'f',type:'ne',entryFormat:'fraction',answer:0.75}],answers:{f:'0.75'}}).correct`),0);
  assert.equal(run(`buildQuantSection(12,'medium').some(q=>q.entryFormat==='fraction')`),true);
});
test('reading multiple-answer is all-or-nothing; sentence answer is exact',()=>{
  run(`exam=null; const passage=shuffleVerbal(VBANK.rc.find(q=>q.subs[0].format==='multi')); globalThis.readQ=flattenReading([passage]);`);
  assert.equal(run(`(()=>{const q=readQ[0];return scoreSection({cfg:{kind:'verbal'},questions:[q],answers:{[q._id+'_0']:q.subs[0].answer.slice()}}).correct;})()`),1);
  assert.equal(run(`(()=>{const q=readQ[0];return scoreSection({cfg:{kind:'verbal'},questions:[q],answers:{[q._id+'_0']:[q.subs[0].answer[0]]}}).correct;})()`),0);
  assert.equal(run(`(()=>{const q=readQ[1];return scoreSection({cfg:{kind:'verbal'},questions:[q],answers:{[q._id+'_0']:q.subs[0].answer}}).correct;})()`),1);
});
test('answered counts include every response through Array.filter',()=>{
  run(`exam={sec:{questions:[{type:'mc',_id:'a'},{type:'se',_id:'b'},{type:'ne',_id:'c',entryFormat:'fraction'}],answers:{a:0,b:[0,1],c:'6/8'}}};`);
  assert.equal(run('exam.sec.questions.filter(isAnswered).length'),3);
  assert.equal(run("isAnswered({type:'ne',_id:'x',entryFormat:'fraction'},{x:'6/'})"),false);
});
test('writing instructions distinguish claim/reason tasks',()=>{
  assert.match(run(`issueInstructions({prompt:'Claim: X Reason: Y'})`),/both the claim/);
  assert.match(run(`issueInstructions({prompt:'Some people believe X; others Y'})`),/both views/);
});
test('full exam disables pause and stop dialog leaves deadline running',()=>{
  run(`startExam('full'); beginSection();`);
  assert.equal(run('exam.strict'),true);
  const end=run('exam.sec.endAt');
  run('exitPractice();'); now+=4000;
  assert.equal(run('exam.sec.endAt'),end);
  assert.match(element('modal').innerHTML,/clock continues/);
  run('pauseAndExit();');assert.equal(run('exam.inSection'),true);
  run('closeModal();timerStep();'); assert.equal(run('exam.sec.timeLeft'),1796);
});
test('writing omits calculator and spellcheck',()=>{
  assert.equal(element('calc-btn').hidden,true);
  assert.match(element('q-host').innerHTML,/spellcheck="false"/);
  run('toggleCalculator();'); assert.equal(element('calculator').hidden,true);
});
test('full exam advances directly and preserves prior essay on recovery',()=>{
  run(`exam.sec.answers[curQ()._id]='A saved essay response.';submitSection(false);saveActiveSnapshot();`);
  assert.equal(run('exam.secIdx'),1); assert.equal(run('exam.inSection'),true);
  assert.equal(run('loadActiveSnapshot().prior[0].essay.text'),'A saved essay response.');
  const before=run('exam.sec.endAt');now+=10000;
  run('exam=null;resumeRecovered();');
  assert.equal(run('exam.sec.endAt'),before);
  assert.equal(run('exam.sectionResults[0].essay.text'),'A saved essay response.');
  assert.equal(run('exam.sec.timeLeft'),run('Math.max(0,Math.ceil((exam.sec.endAt-Date.now())/1000))'));
});
test('expired recovered section submits once and starts next section',()=>{
  run('saveActiveSnapshot();'); now=run('exam.sec.endAt')+5000;
  run('exam=null;resumeRecovered();');
  assert.equal(run('exam.secIdx'),2); assert.equal(run('exam.sectionResults.length'),2);
  assert.equal(run('exam.inSection'),true);assert.ok(run('exam.sec.timeLeft')>0);
});
test('calculator arithmetic, memory, square root, parentheses, limits and error recovery',()=>{
  run(`stopTimer();exam={strict:false,inSection:true,sec:{cfg:{kind:'quant'},qi:0,questions:[{type:'ne',_id:'num'}],answers:{}}};`);
  for(const [keys,want] of [[['C','2','+','3','×','4','='],'14'],[['C','9','√'],'3'],[['C','(','2','+','3',')','×','4','='],'20'],[['C','1','÷','1','0','0','0','0','0','0','0','='],'0.0000001'],[['C','9','9','9','9','9','9','9','9','+','1','='],'Error'],[['C','5','M+','C','MR'],'5'],[['C','1','÷','0','='],'Error']]){
    run(`calc.memory=0;${keys.map(k=>`calculatorKey(${JSON.stringify(k)})`).join(';')}`); assert.equal(run('calc.display'),want);
  }
  run(`calculatorKey('C');calculatorKey('2');`);assert.equal(run('calc.error'),false);
  run(`exam.sec.cfg.kind='verbal'; calculatorKey('9');`); assert.equal(run('calc.display'),'2');
});
test('calculator nested parentheses and unary operations respect precedence',()=>{
  run(`exam.sec.cfg.kind='quant';`);
  for(const [tokens,want] of [[['2','×','(','3','+','(','4','×','5',')',')','='],'46'],[['(','9','+','7',')','√','+','2','='],'6'],[['2','+','3','CE','4','='],'6']]){
    run(`calculatorKey('C');${tokens.map(k=>`calculatorKey(${JSON.stringify(k)})`).join(';')}`);assert.equal(run('calc.display'),want);
  }
});
test('practice clocks remain pausable after recovery',()=>{
  run(`startExam('quantMix');beginSection();pauseAndExit();`);
  const left=run('loadActiveSnapshot().timeLeft'); now+=3600000;
  run('resumeRecovered();'); assert.equal(run('exam.sec.timeLeft'),left);assert.equal(run('exam.strict'),false);
});
test('ungraded essay gets no length-based score and scores claim no percentiles',()=>{
  assert.equal(run(`buildEntryAndStore([{name:'Writing',kind:'writing',total:0,correct:0,raw:0,detail:[],essay:{text:'however for example therefore ultimately '.repeat(150),prompt:'X',q:{prompt:'X'}}}],'writing',false).entry.essay`),null);
  assert.doesNotMatch(run(`scoreBox(160,'130–170','Verbal')`),/percentile/);
  assert.doesNotMatch(html,/zero hallucinations|typically within a few points|calibrated to ETS practice-test behavior/);
});
console.log(`${count} test groups passed`);
