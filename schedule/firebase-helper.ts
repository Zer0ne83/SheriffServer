//////////////////////////////////////////////////
///// IMPORTS ////////////////////////////////////
//////////////////////////////////////////////////
import {fsDocRef,DocumentReference} from '../fire/config';
import {WriteResult} from 'firebase-admin/firestore';
import { consFn } from '../helpers';
import _ from 'lodash';
//////////////////////////////////////////////////
///// GVARS/GFNS /////////////////////////////////
//////////////////////////////////////////////////

 
//////////////////////////////////////////////////
export async function setFBUFCMToken(uEmail:string,fcm:string):Promise<boolean> {
  try{
    const usersDocRef=fsDocRef('users',String(uEmail));
    const updateRes:WriteResult=await usersDocRef.update({'fcm_token':fcm});
    consFn('f','key','ok','!FCMToken!','🛠️✔️ SUCCESS for: [SET] fireStore/ > users/ > '+uEmail+'/ > .fcm_token'+' | '+updateRes.writeTime);
    return Promise.resolve(true);
  }catch{
    consFn('f','key','err','!FCMToken!','🛠️❌ ERROR for: [SET] fireStore/ > users/ > '+uEmail+'/ > .fcm_token');
    return Promise.resolve(false)
  }
}
//////////////////////////////////////////////////
export async function setDPAuthFire(uEmail:string,fbUsersO:any):Promise<boolean>{
  try{
    const userDocRef:DocumentReference=fsDocRef('users',uEmail);
    const updateRes:WriteResult=await userDocRef.set(fbUsersO);
    consFn('f','key','ok','!USERS!','🛠️✔️ SUCCESS for: [SET] fireStore/ > users/ > '+uEmail+'/ > [ALL] | '+updateRes.writeTime);
    return Promise.resolve(true);
  }catch{
    consFn('f','key','err','!USERS!','🛠️❌ ERROR for: [SET] fireStore/ > users/ > '+uEmail+'/ > [ALL]');
    return Promise.resolve(false)
  };
};
//////////////////////////////////////////////////
export async function updateDPAuthFire(uEmail:string,fbUsersO:any):Promise<boolean>{
  try{
    const updO:any={'dp_domain':fbUsersO.dp_domain,'dp_expires':fbUsersO.dp_expires,'dp_refresh':fbUsersO.dp_refresh,'dp_token':fbUsersO.dp_token,'fcm_token':fbUsersO.fcm_token};
    const userDocRef:DocumentReference=fsDocRef('users',uEmail);
    const updateRes:WriteResult=await userDocRef.update(updO);
    consFn('f','key','ok','!USERS!','🛠️✔️ SUCCESS for: [SET] fireStore/ > users/ > '+uEmail+'/ > [ALL] | '+updateRes.writeTime);
    return Promise.resolve(true);
  }catch{
    consFn('f','key','err','!USERS!','🛠️❌ ERROR for: [SET] fireStore/ > users/ > '+uEmail+'/ > [ALL]');
    return Promise.resolve(false)
  };
};
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////