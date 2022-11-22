//////////////////////////////////////////////////
///// IMPORTS
//////////////////////////////////////////////////
import {fireAuth,UserRecord,meUID} from './config';
import {publish} from '../services/events';
import {consFn} from '../helpers';
//////////////////////////////////////////////////
  export const uid2Email=async(uid:string):Promise<string|null>=>{const eRes:any=(await fireAuth.getUser(uid)).email;if(eRes!==undefined){return Promise.resolve(eRes)}else{return Promise.resolve(null)}}
  export const email2UID=async(email:string):Promise<string|null>=>{const uRes:any=(await fireAuth.getUserByEmail(email)).uid;if(uRes!==undefined){return Promise.resolve(uRes)}else{return Promise.resolve(null)}}
//////////////////////////////////////////////////
  export const verifyFireConnect=async()=>{ 
    consFn('d','key','info','verifyFireConnect',null);
    const gUBERes:UserRecord=await fireAuth.getUser(meUID);
    if(gUBERes&&!gUBERes.disabled){
      consFn('f','key','ok','verifyFireConnect','fireUser: '+gUBERes.email);
      publish('initChecks',true);
    }else{
      consFn('f','key','err','verifyFireConnect','fireConnect FAILED.');
      publish('initChecks',false);
    };
  }
//////////////////////////////////////////////////
  export const getUserByEmail=async(email:string):Promise<object>=>{
    consFn('d','user','info','getUserByEmail',null);
    try{
      const gUBERes:UserRecord=await fireAuth.getUserByEmail(email);
      return Promise.resolve({result:true,data:gUBERes.toJSON()
      })}
    catch(gUBEErr){return Promise.resolve({result:false,data:gUBEErr})}
  }
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////