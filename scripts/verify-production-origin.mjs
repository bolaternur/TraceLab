import {spawn} from 'node:child_process';
import {request as httpRequest} from 'node:http';
const origin='https://pilot.example.test';
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3001'],{cwd:process.cwd(),windowsHide:true,env:{...process.env,NODE_ENV:'production',APP_URL:origin,TRUST_PROXY:'true',MAIL_TRANSPORT:'local',MAIL_PREVIEW_ENABLED:'false',MAIL_ENABLE_EXTERNAL_DELIVERY:'false'},stdio:['ignore','pipe','pipe']});
try{
  await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(new Error('Production probe startup timed out')),20000);child.on('error',reject);child.on('exit',()=>reject(new Error('Production probe exited')));child.stdout.on('data',data=>{output+=data.toString();if(output.includes('Ready in')){clearTimeout(timer);resolve();}});});
  const cases=[
    {name:'public TLS proxy origin',host:'pilot.example.test',origin,proto:'https',expected:400},
    {name:'foreign browser origin',host:'pilot.example.test',origin:'https://foreign.example.test',proto:'https',expected:403},
    {name:'missing browser origin',host:'pilot.example.test',proto:'https',expected:403},
    {name:'foreign target host',host:'foreign.example.test',origin,proto:'https',expected:403},
  ];
  let passed=0;
  for(const item of cases){const headers={'Content-Type':'application/json',Host:item.host,'X-Forwarded-Proto':item.proto,'X-Forwarded-Host':item.host};if(item.origin)headers.Origin=item.origin;
    // http.request preserves the virtual Host header; Node's fetch may replace
    // that forbidden browser header with its connection destination.
    const response=await new Promise((resolve,reject)=>{const req=httpRequest({hostname:'127.0.0.1',port:3001,path:'/api/account/signup',method:'POST',headers:{...headers,'Content-Length':2}},res=>{let body='';res.on('data',chunk=>{body+=chunk;});res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(body)}));});req.on('error',reject);req.end('{}');}),data=response.data;
    const good=response.status===item.expected && data.code===(item.expected===400?'invalid_fields':'origin_rejected');
    console.log(JSON.stringify({check:item.name,status:response.status,code:data.code,passed:good}));if(!good)throw new Error('Proxy origin boundary did not match the expected response');passed++;
  }
  console.log(JSON.stringify({passed,externalMailSent:false,accountsCreated:0}));
}finally{child.kill();}
