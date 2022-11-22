//////////////////////////////////////////////////
///// IMPORTS ////////////////////////////////////
//////////////////////////////////////////////////
const axios=require('axios');//.default;
import {logger} from '../logger';
import { consFn } from '../helpers';
import {iAs} from './sqldb-helper-fns';
import { gUT,nowNice,ttlTime } from './timedate-fns';
import {dbUpdU} from './sqldb-helper-fns';
import {fsDocRef} from '../fire/config';
import { publish,subscribe,destroy } from '../services/events';
import {setDPAuthFire,updateDPAuthFire} from './firebase-helper';
import {checkUTRefreshJob} from './cron-jobs-sched';
import puppeteer from 'puppeteer';
import qs from 'qs';
//////////////////////////////////////////////////
///// GVARS/GFNS /////////////////////////////////
//////////////////////////////////////////////////
export let authCode:string='';
export let rawDPAuthO:any={};
let tempIABExpAtStr:string='';
export let authEmail:string='';
export let pURL:string='';
export let dpCreds:any={id:'d06f14114b6005d5935e1ea13af4f3658b889302',secret:'b9d5d47aa18cf73d890c933fabd156f469abedab',redirect:'http://localhost/callback',fcm_token:''};
//////////////////////////////////////////////////
export async function doDPLogin(email:string,pass:string):Promise<any> {
  const uEmail:string=email;const uPass:string=pass;
  const myBrowser=await puppeteer.launch({args:['--disable-gpu','--disable-dev-shm-usage','--no-sandbox','--disable-setuid-sandbox','--no-first-run','--no-zygote','--single-process']});
  const myPage=await myBrowser.newPage();
  let stageNo:number=0;const doCons=(s:number)=>{const sTO:any={1:'Login Form',2:'Auth Btn',3:'Code Page'};logger.info(nowNice()+' - '+uEmail+' - [Function|doDPLogin] 🔑🎫✨ - STAGE #'+String(s)+'/3: '+sTO[s])};
  myPage.on('load',async()=>{stageNo++;pURL=myPage.url();doCons(stageNo);
    if(pURL.includes('login?redirect_url')){await myPage.type('#login-email',uEmail);await myPage.type('#login-password',uPass);await myPage.click('#btnLoginSubmit')};
    if(pURL.includes('login?client_id')){await myPage.click('#btnAuthorize')};
    if(pURL.includes('code=')){const codePageURLArr:string[]=pURL.split('=');if(codePageURLArr.length>0&&codePageURLArr[1]){authCode=codePageURLArr[1]};
      if(!myPage.isClosed()){await myPage.close({runBeforeUnload:false})};
      if(myBrowser.isConnected()){myBrowser.disconnect()};
      await myBrowser.close();publish('gotFirstAuth',true)
    };
  });
  myPage.goto('https://once.deputy.com/my/login?redirect_url=https%3A%2F%2Fonce.deputy.com%2Fmy%2Foauth%2Flogin%3Fclient_id%3Dd06f14114b6005d5935e1ea13af4f3658b889302%26http%3A%2F%2Flocalhost/callback%26response_type%3Dcode%26scope%3Dlonglife_refresh_token');
}
//////////////////////////////////////////////////
export function getDPFirstAuth(email:string,pass:string){
  let uEmail:string='',uPass:string='';
  email!==null?uEmail=email:uEmail='owenlenegan@gmail.com';
  pass!==null?uPass=pass:uPass='lotto12';
  const fnST:Date=new Date();
  subscribe('gotFirstAuth',async()=>{destroy('gotFirstAuth');
    if(authCode!==null){
      const dpData:any={client_id:dpCreds.id,client_secret:dpCreds.secret,redirect_uri:dpCreds.redirect,scope:'longlife_refresh_token',grant_type:'authorization_code',code:authCode};
      const loginOpts:any={method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},data:qs.stringify(dpData),url:'https://once.deputy.com/my/oauth/access_token'};
      try{
        const{status,data}=await axios(loginOpts);
        if(status===200){
          rawDPAuthO=data;
          const convSaveRes:boolean=await convertSaveNewDPAuth(email,data);
          if(convSaveRes){
            logger.info(nowNice()+' - '+ttlTime(fnST)+' - '+authEmail+' - [Function|doDPLogin] 🔑🎫✨ - ( 🟢 SUCCESS ) NEW DPAuth Saved to DB/FireBase');
            if(rawDPAuthO.endpoint.includes('https://')){rawDPAuthO.endpoint.replace('https://','')};
            if(!rawDPAuthO.hasOwnProperty('expires_at')){rawDPAuthO['expires_at']=tempIABExpAtStr};
            publish('dpLoginDone',true)
          }else{publish('dpLoginDone',false)}
        }else{const cM:string='[Auth] (dpAuth|Puppet) ERROR: Status!==200';logger.info(cM);publish('dpLoginDone',false)}
      }catch(lErr){logger.info(JSON.stringify(lErr));publish('dpLoginDone',false)};
    }else{publish('dpLoginDone',false)}
  });
  doDPLogin(uEmail,uPass);
}
//////////////////////////////////////////////////
export async function convertSaveNewDPAuth(userEmail:string,rawDPAuthO:any):Promise<boolean>{
  const checkExistFBU=async():Promise<any>=>{
    try{
      const uDocRef=await fsDocRef('users',String(userEmail)).get();
      if(!uDocRef.exists){return Promise.resolve({result:false})}
      else{
        const uDocData:any=uDocRef.data();
        if(uDocData.hasOwnProperty('fcm_token')&&uDocData.fcm_token!==''&&uDocData.fcm_token.length>10){
          return Promise.resolve({result:true,fcmToken:uDocData.fcm_token})
        }else{return Promise.resolve({result:true,fcmToken:''})}
      }
    }catch(e){
      consFn('f','key','err','convertSaveNewDPAuth|isValidRawAuthO','🛠️❌ ERROR: '+JSON.stringify(e));
      return Promise.resolve({result:false})
    }
  };
  const isValidRawAuthO=():boolean=>{
    if(typeof rawDPAuthO==='object'
    &&rawDPAuthO.hasOwnProperty('access_token')
    &&rawDPAuthO.access_token
    &&typeof rawDPAuthO.access_token==='string'
    &&rawDPAuthO.access_token.length===32
    &&rawDPAuthO.hasOwnProperty('expires_in')
    &&rawDPAuthO.expires_in
    &&typeof rawDPAuthO.expires_in==='number'
    &&rawDPAuthO.hasOwnProperty('scope')
    &&typeof rawDPAuthO.scope==='string'
    &&rawDPAuthO.scope==='longlife_refresh_token'
    &&rawDPAuthO.hasOwnProperty('endpoint')
    &&rawDPAuthO.endpoint
    &&typeof rawDPAuthO.endpoint==='string'
    &&rawDPAuthO.hasOwnProperty('refresh_token')
    &&rawDPAuthO.refresh_token
    &&typeof rawDPAuthO.refresh_token==='string'
    &&rawDPAuthO.refresh_token.length===32
    ){return true}else{return false}
  };
  //----------------------------------------------
  let setOrUpdate:string='',actionTxt:string='';
  let finalFBDBAuthO:any={dp_domain:<string>'',dp_expires:<string>'',dp_refresh:<string>'',dp_token:<string>'',fcm_token:<string>''};
  const isVRes:boolean=isValidRawAuthO();
  if(isVRes){
    const existFCMRes:any=await checkExistFBU();
    if(existFCMRes){setOrUpdate='u';actionTxt='UPDATING';finalFBDBAuthO.fcm_token=existFCMRes.fcmToken}else{setOrUpdate='s',actionTxt='SETTING'};
    const newDPAuthO:any=rawDPAuthO;
    if(newDPAuthO.endpoint.includes('https://')){finalFBDBAuthO.dp_domain=newDPAuthO.endpoint.replace('https://','')}else{finalFBDBAuthO.dp_domain=newDPAuthO.endpoint};
    const nowUTS:number=gUT(new Date());
    const expAtUTS:number=nowUTS+Number(newDPAuthO.expires_in);
    finalFBDBAuthO.dp_expires=String(expAtUTS);
    tempIABExpAtStr=String(expAtUTS);
    finalFBDBAuthO.dp_refresh=newDPAuthO.refresh_token;
    finalFBDBAuthO.dp_token=newDPAuthO.access_token;
    let fbRes:boolean|null=null;
    if(setOrUpdate==='s'){fbRes=await setDPAuthFire(userEmail,finalFBDBAuthO)}else{fbRes=await updateDPAuthFire(userEmail,finalFBDBAuthO)};
    const dbRes:boolean=await dbUpdU(userEmail,'users',finalFBDBAuthO);
    const doCons=(res:string,fOrd:string)=>{let rT:string='';res==='ok'?rT='✔️ SUCCESS:':rT='❌ ERROR:'; consFn(fOrd,'key',res,'convertSaveNewDPAuth','🛠️'+rT+' '+actionTxt+' New DPAuth - '+userEmail)};
    if(fbRes){doCons('ok','f')}else{doCons('err','f')};
    if(dbRes){doCons('ok','d')}else{doCons('err','d')};
    if(fbRes&&dbRes){return Promise.resolve(true)}else{return Promise.resolve(false)}
  }else{consFn('f','key','err','convertSaveNewDPAuth|isValidRawAuthO','🛠️❌ ERROR: Raw DPAuthObj is INVALID');return Promise.resolve(false)}
}
//////////////////////////////////////////////////
export async function doDPAPIRefresh(userEmail:string,domain:string,refreshToken:string):Promise<boolean>{
  const dpData:any={
    client_id:dpCreds.id,
    client_secret:dpCreds.secret,
    redirect_uri:dpCreds.redirect,
    grant_type:'refresh_token',
    refresh_token:refreshToken,
    scope:'longlife_refresh_token'
  };
  const refreshOpts:any={method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},data:qs.stringify(dpData),url:'https://'+domain+'/oauth/access_token'};
  try{
    const{status,data}=await axios(refreshOpts);
    if(status===200){
      const convSaveRes:boolean=await convertSaveNewDPAuth(userEmail,data);
      if(convSaveRes){
        await checkUTRefreshJob(userEmail);
        logger.info(nowNice()+' - '+userEmail+' - [dpapi-helper-fns|doDPAPIRefresh] 🔑🎫✨ - ( 🟢 SUCCESS ) NEW DPAuth Saved to DB/FireBase');
        return Promise.resolve(true)}
      else{return Promise.resolve(false)}
    }else{const cM:string='[dpapi-helper-fns|doDPAPIRefresh] (ERROR): Status!==200';logger.info(cM);return Promise.resolve(false)}
  }catch(lErr){logger.info(JSON.stringify(lErr));return Promise.resolve(false)};
}
//////////////////////////////////////////////////
export async function qGAPI(uO:any,ep:string):Promise<{r:boolean,d:any|null}>{
  if(!uO||typeof uO!=='object'||iAs.includes(uO.email)){consFn('api','req','err','(dpapi-helper-fns|qGAPI)','Missing or Invalid UserObj');return Promise.resolve({r:false,d:null})};
  if(!ep||ep.length<2){consFn('api','req','err','(dpapi-helper-fns|qGAPI)','Missing or Invalid Endpoint');return Promise.resolve({r:false,d:null})};
  if(!uO.dp_domain||uO.dp_domain.length<14||uO.dp_domain.includes('https://')){consFn('api','req','err','(dpapi-helper-fns|qGAPI)','Missing or Invalid dp_domain');return Promise.resolve({r:false,d:null})};
  if(!uO.dp_token||uO.dp_token.length!==32){consFn('api','req','err','(dpapi-helper-fns|qGAPI)','Missing or Invalid dp_token');return Promise.resolve({r:false,d:null})};
  const qGAPIOpts:any={url:'https://'+uO.dp_domain+'/api/v1/'+ep,method:'get',headers:{'Authorization':'OAuth '+uO.dp_token},responseType:'json',timeout:10000};
  try{
    const{status,data}=await axios(qGAPIOpts);
    if(status===200){return Promise.resolve({r:true,d:data})}
    else{return Promise.resolve({r:false,d:null})}
  }catch(e:any){
    consFn('api','req','err','(dpapi-helper-fns|qGAPI)',JSON.stringify(e));
    return Promise.resolve({r:false,d:null});
  }
}
//////////////////////////////////////////////////
export async function qPAPI(uO:any,ep:string,paramD:any|null):Promise<{r:boolean,d:any|null}>{
  if(!uO||typeof uO!=='object'||iAs.includes(uO.email)){consFn('api','req','err','(dpapi-helper-fns|qPAPI)','Missing or Invalid UserObj');return Promise.resolve({r:false,d:null})};
  if(!ep||ep.length<2){consFn('api','req','err','(dpapi-helper-fns|qPAPI)','Missing or Invalid Endpoint');return Promise.resolve({r:false,d:null})};
  if(!uO.dp_domain||uO.dp_domain.length<14||uO.dp_domain.includes('https://')){consFn('api','req','err','(dpapi-helper-fns|qPAPI)','Missing or Invalid dp_domain');return Promise.resolve({r:false,d:null})};
  if(!uO.dp_token||uO.dp_token.length!==32){consFn('api','req','err','(dpapi-helper-fns|qPAPI)','Missing or Invalid dp_token');return Promise.resolve({r:false,d:null})};
  const qPAPIOpts:any={url:'https://'+uO.dp_domain+'/api/v1/'+ep,method:'post',headers:{'Authorization':'OAuth '+uO.dp_token},responseType:'json',timeout:10000};
  if(paramD!==null){qPAPIOpts['data']=paramD};
  try{
    const{status,data}=await axios(qPAPIOpts);
    if(status===200){return Promise.resolve({r:true,d:data})}
    else{return Promise.resolve({r:false,d:null})}
  }catch(e:any){
    consFn('api','req','err','(dpapi-helper-fns|qGAPI)',JSON.stringify(e));
    return Promise.resolve({r:false,d:null});
  }
}
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////