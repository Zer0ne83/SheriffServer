//////////////////////////////////////////////////
///// IMPORTS ////////////////////////////////////
//////////////////////////////////////////////////
import {logger} from './logger';
import {nowNice} from './schedule/timedate-fns';
import {FirebaseScrypt} from 'firebase-scrypt';
const firebaseParameters={memCost:14,rounds:8,saltSeparator:'Bw==',signerKey:'9JrmDonD/5X5Uqoml647Ln4u4FkOhg5m1lk1FBVWeFCo+CPgMQ1Q+HPccEm9zsfo79tIpZRGMpb42sdfDFMOuQ=='};
const scrypt = new FirebaseScrypt(firebaseParameters);
import _ from 'lodash';
//////////////////////////////////////////////////
export const icoObj:any={fire:'🔥',f:'🔥',db:'🗄️',d:'🗄️',userdata:'🧑💾',user:'🧑',userdatasett:'🧑💾⚙️🔔',back:'💾',sett:'⚙️',settings:'⚙️',notif:'🔔',sche:'📅',info:'📋',key:'🔑',plug:'🔌',shield:'🛡️',listen:'👂',sync:'♻️',time:'⏲️',error:'❌',req:'✈️',notifsched:'🔔⏲️',emailmsg:'📧🔔',emailsend:'➡️',api:'🚨',settnotifchange:'⚙️🔔⏲️'};
//////////////////////////////////////////////////
export function cLine(){return logger.info(('-'.repeat(80)))};
//////////////////////////////////////////////////
export function consFn(ctype:string,sub:string|null,res:string,fn:string|null,xtra:string|null|undefined){
  const ctO:any={c:' [Controller] ',d:' [MySQL] ',f:'[FireBase] ',h:' [Helper] ',s:' [Service] ',r:' [Route] ',o:' [Other] ',sync:' [Sync] ',req:' [Request]',notifsched:' [App|Notif|Sched] ',emailmsg:' [EmailMsg] ',api:' [API|Request] ',settnotifchange:' [checkChangeNotifs] '}
  let resStr;if(res==='err'){resStr=' (❌ ERROR)'}else if(res==='ok'){resStr=' (✔️ SUCCESS)'}else if(res==='warn'){resStr=' (⚠️ WARNING)'}else{resStr=' (📋 INFO)'};
  let subIco;sub!==null?subIco=icoObj[sub]+' ':subIco='';
  let xtraStr;if(typeof xtra==='string'){xtraStr=': '+xtra}else{xtraStr=''};
  const tsStr:string=nowNice();
  let fnT:string='';if(fn!==null){fnT=fn};
  return logger.info(tsStr+' - '+icoObj[ctype]+ctO[ctype]+subIco+fnT+' -'+resStr+xtraStr);
};
//////////////////////////////////////////////////
export async function verifyAUPassword(pwGuess:string,dbHash:string):Promise<boolean> {
  const [hash,salt]=dbHash.split('|');
  logger.info('Testing > [SALT]:'+salt+' & [HASH]:'+hash+' & [GUESS]:'+pwGuess);
  const testRes:boolean=await scrypt.verify(pwGuess,salt,hash);
  logger.info('Test Result:'+testRes);
  if(testRes){return Promise.resolve(true)}else{return Promise.resolve(false)};
};
//////////////////////////////////////////////////
export const isValidJSON=(jsonStr:string):boolean=>{try{JSON.parse(jsonStr)}catch(e){return false}return true};
//////////////////////////////////////////////////
export const diffStr=(diffO:any):string=>{
  const dA:string[]=JSON.stringify(diffO).replace(/"|{|}/gi,'').split(':');
  const dV:string=dA[dA.length-1];
  dA.pop();
  return dA.join('.')+' => '+dV;
}
//////////////////////////////////////////////////
/**
// @param  {Object} object Obj compared
// @param  {Object} base   Obj to compare
// @return {Object} return Obj the Difference
*/
export async function myDiff(object:any,base:any) {
	function changes(object:any,base:any){return _.transform(object,function(result:any,value:any,key:any){if(!_.isEqual(value,base[key])){result[key]=(_.isObject(value)&&_.isObject(base[key]))?changes(value,base[key]):value}})};return changes(object,base)
}
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////