//////////////////////////////////////////////////
///// IMPORTS ////////////////////////////////////
//////////////////////////////////////////////////
import {serverMode} from '../index';
import {logger} from '../logger';
import {pool} from '../db/config';
import {nowNice} from './timedate-fns';
import {isValidJSON} from '../helpers';
//////////////////////////////////////////////////
///// GVARS/GFNS /////////////////////////////////
//////////////////////////////////////////////////
export let iAs:string[]=[];
//////////////////////////////////////////////////
export function addIA(email:string){if(!iAs.includes(email)){iAs.push(email);logger.info(nowNice()+' - [ 🔑🧑 + 🔴 ]: Added '+email+' to local [INVALID AUTHS] List.')}};
export function remIA(email:string){if(iAs.includes(email)){iAs=iAs.filter(e=>e!==email);logger.info(nowNice()+' - [ 🔑🧑 - 🟢 ]: Removed '+email+' from local [INVALID AUTHS] List.')}};
export function setIAs(emails:string[]){iAs=emails};
export function getIAs():string[]{return iAs};
//////////////////////////////////////////////////
export async function dbQ(q:string,v:any[]|null):Promise<any> {
  try{const db=await pool.getConnection();const [r,]:any=await db.query(q,v);db.release();
    if(Array.isArray(r)){return Promise.resolve({r:true,d:r})}
    else{
      const optPs:string[]=['fieldCount','warningCount','insertId'];let resObj:any={r:true,d:{type:null,raw:r,msg:null}};let mm:string='';
      r.constructor.name==='ResultSetHeader'?resObj.d.type='ResultSetHeader':resObj.d.type='OkPacket';
      for(const[key,value]of Object.entries(r)){const k:string=String(key);const v:any=value;if(optPs.includes(k)&&v>0){mm=mm+key+':'+v+' '}};
      if(!r.hasOwnProperty('changedRows')){mm=mm+'changes:'+r.affectedRows}else{if(r.changedRows>0){mm=mm+'changes:'+r.changedRows}else{mm=mm+'changes:'+r.affectedRows}};
      resObj.d.msg=mm;return Promise.resolve(resObj);
    }
  }catch(e){logger.info(nowNice()+' - '+e);return Promise.resolve({r:false,d:e})}
}
//////////////////////////////////////////////////
export const allSQLUTable=async(table:string):Promise<any[]>=>{
  let aUs:any[]=[],aVUs:any[]=[],resUs:any[]=[];
  const mode:string=serverMode;
  const allURes:any=await dbQ('SELECT * FROM `'+table+'`',null);
  if(allURes.r){aUs=allURes.d}else{aUs=[]};
  aVUs=aUs.filter((u:any)=>!iAs.includes(u.email));
  mode==='debug'?resUs=aVUs.filter((u:any)=>u.email==='owenlenegan@gmail.com'):resUs=aVUs; 
  return Promise.resolve(resUs);
};
//////////////////////////////////////////////////
export async function ssAuthCheck(email:string,ssauth:string):Promise<boolean>{
  const{r,d}=await dbQ('SELECT `dp_token` FROM `users` WHERE `email` = ?',[email]);
  if(r&&d&&d.length>0&&d[0]['dp_token']===ssauth){return Promise.resolve(true)}
  else{return Promise.resolve(false)}
}
//////////////////////////////////////////////////
export async function setFCMToken(email:string,fcmToken:string):Promise<boolean>{
  const{r}=await dbQ('UPDATE `users` SET ? WHERE `email` = ?',[{fcm_token:fcmToken},email]);
  if(r){return Promise.resolve(true)}else{return Promise.resolve(false)}
}
//////////////////////////////////////////////////
export async function dbFCTSet(uEmail:string,fctObj:any):Promise<boolean>{
  const fctStr:string=JSON.stringify(fctObj);
  const{r}=await dbQ('UPDATE `user_data` SET `custom_token` = ? WHERE `email` = ?',[fctStr,uEmail]);
  if(r){return Promise.resolve(true)}else{return Promise.resolve(false)};
}
//////////////////////////////////////////////////
export async function dbFCTGet(uEmail:string):Promise<any> {
  const{r,d}=await dbQ('SELECT `custom_token` FROM `user_data` WHERE `email` = ?',[uEmail]);
  if(r){
    const ctStr:any=d[0]['custom_token'];
    if(ctStr!==null&&isValidJSON(ctStr)){
      const ctObj:any=JSON.parse(ctStr);
      return Promise.resolve({result:true,data:ctObj})
    }else{return Promise.resolve({result:true,data:null})}
  }else{return Promise.resolve({result:false})}
}
//////////////////////////////////////////////////
export async function dbFCTMatchDPT(uEmail:string,dpToken:string):Promise<boolean> {
  const{r,d}=await dbQ('SELECT `dp_token` FROM `users` WHERE `email` = ?',[uEmail]);
  if(r){if(d[0]['dp_token']===dpToken){return Promise.resolve(true)}else{return Promise.resolve(false)}}
  else{return Promise.resolve(false)}
}
//////////////////////////////////////////////////
export async function dbFCTMatchFET(uEmail:string,feToken:string):Promise<boolean> {
  const{r,d}=await dbQ('SELECT `custom_token` FROM `user_data` WHERE `email` = ?',[uEmail]);
  if(r){
    const ctStr:any=d[0]['custom_token'];
    if(ctStr!==null&&isValidJSON(ctStr)){
      const ctObj:any=JSON.parse(ctStr);
      const ctFETStr:string=ctObj.fe_token;
      if(ctFETStr===feToken){return Promise.resolve(true)}
      else{return Promise.resolve(false)}
    }else{return Promise.resolve(false)}
  }else{return Promise.resolve(false)}
}
//////////////////////////////////////////////////
export async function dbIns(table:string,data:object):Promise<boolean>{return (await dbQ('INSERT INTO `'+table+'` SET ?',[data])).r}
//////////////////////////////////////////////////
export async function dbUpdU(email:string,table:string,data:object):Promise<boolean>{
  const{r}=await dbQ('UPDATE `'+table+'` SET ? WHERE `email` = ?',[data,email]);
  if(r){return Promise.resolve(true)}else{return Promise.resolve(false)}
}
//////////////////////////////////////////////////
export async function dbHasU(email:string):Promise<boolean>{
  const{r,d}=await dbQ('SELECT * FROM `users` WHERE `email` = ?',[email]);
  if(r&&d.length>0){return Promise.resolve(true)}else{return Promise.resolve(false)}
}
//////////////////////////////////////////////////
export async function dbUSnoop(email:string):Promise<any>{
  const{r,d}=await dbQ('SELECT * FROM `user_data` WHERE `email` = ?',[email]);
  if(r&&d.length>0){
    if(d[0]['snoop']&&isValidJSON(d[0]['snoop'])){
      const snoopUO:any=JSON.parse(d[0]['snoop']);
      return Promise.resolve({result:true,data:snoopUO})
    }else{return Promise.resolve(false)}
  }else{return Promise.resolve(false)}
}
//////////////////////////////////////////////////
export async function dbGetU(email:string,col:string|null):Promise<null|object|string>{let R:null|object|string;
  const{r,d}=await dbQ('SELECT * FROM `users` WHERE `email` = ?',[email]);
  if(r){col!==null?R=d[0][String(col)]:R=d[0]}else{R=null};
  return R
}
//////////////////////////////////////////////////
export async function dbGetUO(email:string):Promise<any>{
  const{r,d}=await dbQ('SELECT * FROM `users` WHERE `email` = ?',[email]);
  if(r&&d&&d.length>0){return Promise.resolve({result:true,data:d[0]})}
  else{return Promise.resolve({result:false})}
}
//////////////////////////////////////////////////
export async function dbGetUD(email:string,col:string|null):Promise<any>{
  const{r,d}=await dbQ('SELECT * FROM `user_data` WHERE `email` = ?',[email]);
  if(r){
    if(col!==null&&d[0][col]&&isValidJSON(d[0][col])){
      const colObj:any=JSON.parse(d[0][col]);
      return Promise.resolve({result:true,data:colObj})
    }else{return Promise.resolve({result:true,data:d[0]})}
  }else{return Promise.resolve({result:false})}
}
//////////////////////////////////////////////////
export async function dbGetSett(email:string):Promise<null|object>{let R:null|object;
  const{r,d}=await dbQ('SELECT * FROM `settings` WHERE `email` = ?',[email]);
  r&&isValidJSON(d[0].settings)?R=JSON.parse(d[0].settings):R=null;
  return R
};
//////////////////////////////////////////////////
export async function dbGetNotifUId(email:string):Promise<any>{
  const{r,d}=await dbQ('SELECT * FROM `user_notif` WHERE `email` = ?',[email]);
  if(r){const uNIdRes:string=String(d[0]['id']);return Promise.resolve({result:true,data:uNIdRes})}else{return Promise.resolve({result:false,data:null})}
}
//////////////////////////////////////////////////
export async function dbGetNotifList(email:string,cat:string):Promise<any>{
  const colCat:string=cat;
  const{r,d}=await dbQ('SELECT * FROM `user_notif` WHERE `email` = ?',[email]);
  if(r){
    const uNColStr:any=d[0][colCat];
    if(uNColStr&&uNColStr!==null&&uNColStr!==''&&uNColStr.toString().toLowerCase()!=='null'){
      if(isValidJSON(uNColStr)){const uNColArr:any=JSON.parse(uNColStr);return Promise.resolve({result:true,data:uNColArr})}
      else{return Promise.resolve({result:true,data:[]})}
    }else{return Promise.resolve({result:true,data:[]})}
  }else{return Promise.resolve({result:false,data:null})}
}
//////////////////////////////////////////////////
export async function dbGetAllUNotif():Promise<any>{
  const{r,d}=await dbQ('SELECT * FROM `user_notif`',null);
  if(r){return Promise.resolve({result:true,data:d})}
  else{return Promise.resolve({result:false})}
}
//////////////////////////////////////////////////
export async function dbGetAllNotifLists(email:string):Promise<any>{
  const{r,d}=await dbQ('SELECT * FROM `user_notif` WHERE `email` = ?',[email]);
  if(r&&d.length>0){const userNotifRow:any=d[0];let uNRObj:any={};
    for(const[col,val]of Object.entries(userNotifRow)){const colN:string=String(col);const rawV:any=val;
      if(colN!=='id'&&colN!=='email'){
        if(rawV&&rawV!==null&&rawV!==undefined&&typeof rawV==='string'&&isValidJSON(rawV)){
          const vArr:any=JSON.parse(rawV);
          if(Array.isArray(vArr)){uNRObj[colN]=vArr}else{uNRObj[colN]=null}
        }else{uNRObj[colN]=null}
      }
    };
    return Promise.resolve({result:true,data:uNRObj})
  }else{return Promise.resolve({result:false})}
}
//////////////////////////////////////////////////
export async function dbMatchSchedNotifJob(email:string,cat:string,jobId:string):Promise<any>{
  const{r,d}=await dbQ('SELECT * FROM `user_notif` WHERE `email` = ?',[email]);
  if(r){
    const uNColStr:any=d[0][cat];
    if(uNColStr&&uNColStr!==null&&uNColStr!==undefined&&typeof uNColStr==='string'){
      if(isValidJSON(uNColStr)){
        const uNColArr:any=JSON.parse(uNColStr);
        if(Array.isArray(uNColArr)){
          if(uNColArr.length>0){
            const matchJOArr:any[]=uNColArr.filter((jO:any)=>String(jO.id)===jobId);
            if(matchJOArr&&matchJOArr.length>0){return Promise.resolve({result:true,data:{list:uNColArr,job:matchJOArr[0]}})}
            else{return Promise.resolve({result:true,data:{list:uNColArr,job:null}})}
          }else{return Promise.resolve({result:true,data:{list:[],job:null}})}
        }else{return Promise.resolve({result:true,data:null})}
      }else{return Promise.resolve({result:true,data:null})}
    }else{return Promise.resolve({result:true,data:null})}
  }else{return Promise.resolve({result:false,data:null})}
}
//////////////////////////////////////////////////
export async function dbGetSchedNotifJob(email:string,cat:string,jobId:string):Promise<any>{
  const{r,d}=await dbQ('SELECT * FROM `user_notif` WHERE `email` = ?',[email]);
  if(r){
    const uNColStr:any=d[0][cat];
    if(uNColStr&&uNColStr!==null&&uNColStr!==undefined&&typeof uNColStr==='string'){
      if(isValidJSON(uNColStr)){
        const uNColArr:any=JSON.parse(uNColStr);
        if(Array.isArray(uNColArr)&&uNColArr.length>0){
          const matchJOArr:any[]=uNColArr.filter((jO:any)=>String(jO.id)===jobId);
          if(matchJOArr&&matchJOArr.length>0){
            return Promise.resolve({result:true,data:matchJOArr[0]})
          }else{return Promise.resolve({result:true,data:null})}
        }else{return Promise.resolve({result:true,data:null})}
      }else{return Promise.resolve({result:true,data:null})}
    }else{return Promise.resolve({result:true,data:null})}
  }else{return Promise.resolve({result:false,data:null})}
}
//////////////////////////////////////////////////
export async function dbSetNotifList(email:string,cat:string,listArr:any[]):Promise<boolean>{
  const newListStr:string=JSON.stringify(listArr);
  const{r}=await dbQ('UPDATE `user_notif` SET `'+cat+'` = ? WHERE `email` = ?',[newListStr,email]);
  if(r){return Promise.resolve(true)}else{return Promise.resolve(false)}
}
//////////////////////////////////////////////////
export async function dbSetSchedNotifJob(email:string,cat:string,jobDataO:any):Promise<boolean>{
  const uEmail:string=email;const nCat:string=cat;
  let newListArr:any[]=[];
  const getOldListRes:any=await dbGetNotifList(uEmail,nCat);
  if(getOldListRes.result&&getOldListRes.data!==[]){
    if(Array.isArray(getOldListRes.data)&&getOldListRes.data.length>0){newListArr=getOldListRes.data;newListArr.push(jobDataO)}
    else{newListArr=[jobDataO]}
  }else{newListArr=[jobDataO]};
  const newListStr:string=JSON.stringify(newListArr);
  const{r}=await dbQ('UPDATE `user_notif` SET `'+nCat+'` = ? WHERE `email` = ?',[newListStr,uEmail]);
  if(r){return Promise.resolve(true)}else{return Promise.resolve(false)}
}
//////////////////////////////////////////////////
export async function dbRemoveSchedNotifJob(email:string,cat:string,jobId:string):Promise<boolean>{
  const getOldListRes:any=await dbGetNotifList(email,cat);
  if(getOldListRes.r){
    if(getOldListRes.d!==[]&&Array.isArray(getOldListRes.data)&&getOldListRes.data.length>0){
      const oldListArr:any[]=getOldListRes.d;
      const newListArr:any[]=oldListArr.filter((nO:any)=>String(nO.id)!==jobId);
      const newListStr:string=JSON.stringify(newListArr);
      const{r}=await dbQ('UPDATE `user_notif` SET ? WHERE `email` = ?',[{cat:newListStr},email]);
      if(r){return Promise.resolve(true)}else{return Promise.resolve(false)}
    }else{return Promise.resolve(true)}
  }else{return Promise.resolve(false)}
};
//////////////////////////////////////////////////
/* export async function dbUpdNotifSchedList(email:string,cat:string,newJobsArr:any[]):Promise<boolean>{
  const stringJobArr:string=JSON.stringify(newJobsArr);
  const upDRes:boolean=(await dbQ('UPDATE `user_notif` SET `'+cat+'` = ? WHERE `email` = ?',[stringJobArr,email])).r;
  if(upDRes){return Promise.resolve(true)}else{return Promise.resolve(false)};
};
//////////////////////////////////////////////////
export async function dbInsNotifSched(email:string,cat:string,newJobsArr:any[]):Promise<boolean>{
  const stringJobArr:string=JSON.stringify(newJobsArr);
  let defRow:any=defaultDBUNotif(email);
  defRow[cat]=stringJobArr;
  const insDRes:boolean=(await dbQ('INSERT INTO `user_notif` SET ?',[defRow])).r;
  if(insDRes){return Promise.resolve(true)}else{return Promise.resolve(false)};
} */
//////////////////////////////////////////////////
//////////////////////////////////////////////////