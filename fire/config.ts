//////////////////////////////////////////////////
///// IMPORTS
//////////////////////////////////////////////////
import {publish} from '../services/events';
import {consFn} from '../helpers';
import { initializeApp, App, ServiceAccount, cert } from 'firebase-admin/app';
import { getAuth, Auth, UserRecord } from 'firebase-admin/auth';
import { getStorage, Storage } from 'firebase-admin/storage';
import { getFirestore, Firestore, CollectionReference, DocumentSnapshot, FieldPath, DocumentReference, DocumentChangeType, QueryDocumentSnapshot,DocumentData } from 'firebase-admin/firestore';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import { Bucket } from '@google-cloud/storage';
import { FirestoreError, SnapshotListenOptions} from 'firebase/firestore';
const fbSA: ServiceAccount=require('./fbSA.json');
//////////////////////////////////////////////////
export const fireApp:App=initializeApp({
  credential:cert(fbSA),
  projectId:'sherifffb-90311',
  storageBucket:'sherifffb-90311.appspot.com',
  databaseURL: "https://sherifffb-90311-default-rtdb.asia-southeast1.firebasedatabase.app"
});
export const dpDomain:string='6a199e28095242.au.deputy.com';
export const meUID:string='mJTtEJXEZiOVjZCOSQDm69prfuK2';
export const fcmToken:string='dHWPnWz6TZeXaf_LpS04ow:APA91bE4E4-jBshZ2dGeVvQJExrS_2BwT8C83bNHBdZtInFMzzPYEB86NA1owQJ47cVYiRhxZr0zROVWzCFB_WIa_yHaiBe5D6uNgNAOn6ZZc-0nkP3808k_btDsYkVBdPTkpBjcAR82';
export const fireAuth:Auth=getAuth();  
export type {UserRecord,Storage,Bucket,CollectionReference,DocumentReference,DocumentSnapshot,DocumentChangeType,QueryDocumentSnapshot,FieldPath,FirestoreError,SnapshotListenOptions};
export const fireStorage:Storage=getStorage();
export const fStore:Storage=getStorage(fireApp);
export const fsBucket:Bucket=fireStorage.bucket('sherifffb-90311.appspot.com');
export function fsDocRef(coll:string,doc:string):DocumentReference{return fireStore.collection(coll).doc(doc)};
export function lstnUserDocs(uEmails:string[]){
  let udRefs:any[]=[];
  for(let i=0;i<uEmails.length;i++){
    const e:string=uEmails[i];
    const r:DocumentReference=fsDocRef('users',e);
    udRefs.push({e:e,r:r});
  };
  return udRefs;
};
export function lstnSettingsDocs(uEmails:string[]){
  let sRefs:any[]=[];
  for(let i=0;i<uEmails.length;i++){
    const e:string=uEmails[i];
    const r:DocumentReference=fsDocRef('settings',e);
    sRefs.push({e:e,r:r});
  };
  return sRefs;
};
export const fireStore:Firestore=getFirestore();
export const fireMsg:Messaging=getMessaging();
//////////////////////////////////////////////////
export async function verifyFireConnect(){
  consFn('f','plug','info','verifyFireConnect',null);
  try{
    const gUBERes:UserRecord=await fireAuth.getUser(meUID);
    if(gUBERes&&!gUBERes.disabled){consFn('f','plug','ok','verifyFireConnect','fireUser: '+gUBERes.email);publish('initChecks',true)}
    else{consFn('f','plug','err','verifyFireConnect','fireConnect FAILED.');publish('initChecks',false)};
  }catch(cErr:any){publish('initChecks',false);consFn('f','plug','err','verifyFireConnect',JSON.stringify(cErr))};
}
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////