//////////////////////////////////////////////////
///// IMPORTS
//////////////////////////////////////////////////
import {fireAuth,UserRecord,fsBucket,fsDocRef,lstnUserDocs,lstnSettingsDocs,DocumentReference} from '../fire/config';
import {DocumentData} from 'firebase-admin/firestore';
import {dbQ,allSQLUTable,addIA,remIA,dbGetSett,dbGetU,dbUpdU,dbFCTMatchDPT,dbFCTMatchFET,dbFCTSet,dbFCTGet,dbGetAllUNotif,dbSetNotifList,dbGetAllNotifLists} from './sqldb-helper-fns';
import {gUT,nowNice,ttlTime,addMins} from './timedate-fns';
import {logger} from '../logger';
import {consFn,myDiff,isValidJSON,diffStr} from '../helpers';
import {promises as fs} from 'fs';
import {ListUsersResult} from 'firebase-admin/auth';
import {defaultAUSettings,defaultDBUserSettings,DBUserSettings,defaultDBUData,DBUserData,DBUserNotif,defaultDBUNotif} from '../appObjects';
import { serverMode } from '../index';
import {isBefore} from 'date-fns';
import nodeSchedule=require('node-schedule');
import {appNotifCheckTask} from './app-notif-sched';
import {doDPAPIRefresh} from './dpapi-helper-fns';
import {checkUTRefreshJob} from './cron-jobs-sched';
import _ from 'lodash';
//////////////////////////////////////////////////
///// GVARS/GFUNCTIONS
//////////////////////////////////////////////////
let fireUDReady:boolean=false;
let fireSDReady:boolean=false;
let dpAuthConsCount:any={count:<number>0,init:<boolean>true}; 
type FBUserInfo={userDoc:any,hasPrefs:boolean|null,hasDBBU:boolean|null};
type FBBasicUI={email:string,password:string,fb_uid:string,signedin:string};
type FBDetailUI={id:null,email:string,password:string,dp_token:string,dp_refresh:string,dp_expires:string,dp_domain:string|null,fcm_token:string|null,fb_uid:string,app_uuk:string,app_prefs:number|null,app_dbbu:number|null,signedin:string|number,modified:null};
//////////////////////////////////////////////////
export async function requestFCT(email:string,token:string):Promise<any>{
  let dbTokenQRes:boolean=false;
  if(token.length===32){dbTokenQRes=await dbFCTMatchDPT(email,token)}
  else{dbTokenQRes=await dbFCTMatchFET(email,token)};
  if(dbTokenQRes){
    const dbFCTGRes:any=await dbFCTGet(email);
    if(dbFCTGRes.result){
      if(dbFCTGRes.data!==null){return Promise.resolve({result:true,data:dbFCTGRes.data})}
      else{
        const sNFTRes:any=await setNewFCToken(email,null);
        if(sNFTRes.result){return Promise.resolve({result:true,data:sNFTRes.data})}
        else{return Promise.resolve({result:false,data:{code:500,msg:'ERROR: Failed to SET new FCT'}})}
      }
    }else{return Promise.resolve({result:false,data:{code:500,msg:'ERROR: Retrieving User/Email Row|custom_token from user_data table'}})}
  }else{return Promise.resolve({result:false,data:{code:401,msg:'REQUEST TOKEN vs DB TOKEN (user>dp_token|user_data>custom_token.fe_token) = Mismatch'}})}
}
//////////////////////////////////////////////////
export async function setNewFCToken(email:string,existFET:string|null):Promise<any> {
  const randStr=(l:number):string=>{
    let aCA=[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'],aLA=[...'abcdefghijklmnopqrstuvwxyz'],aN=[..."0123456789"],b=[...aCA,...aLA,...aN];
    return[...Array(l)].map(()=>b[Math.random()*b.length|0]).join('');
  };
  const ctExpUTS=():number=>{const expD:Date=addMins(new Date(),59);const expUTS:number=gUT(expD);return expUTS};
  try{
    let newCTO:any={custom_token:<string>'',expires_at:<number>0,fe_token:''}; 
    const newCTStr:string=randStr(16);
    newCTO.custom_token=await fireAuth.createCustomToken(newCTStr);
    newCTO.expires_at=ctExpUTS();
    if(existFET!==null&&typeof existFET==='string'&&existFET.length===16){newCTO.fe_token=existFET}else{newCTO.fe_token=randStr(16)};
    const dbFCTSRes:boolean=await dbFCTSet(email,newCTO);
    if(dbFCTSRes){logger.info(nowNice()+' - 🔑🔥♻️ [CustomToken|setNewFCTToken] ( 🟢 SUCCESS): '+email+' - FCT: '+newCTO.custom_token.substring(0,16)+'... | EXP: '+newCTO.expires_at+'... | FET: '+newCTO.fe_token.substring(0,16)+'...');return Promise.resolve({result:true,data:newCTO})}
    else{logger.info(nowNice()+' - 🔑🔥♻️ [CustomToken|setNewFCToken] ( 🔴 ERROR): Setting custom_token column in "user_data" table');return Promise.resolve({result:false})}
  }catch(rCTErr){logger.info(nowNice()+' - 🔑🔥♻️ [CustomToken|setNewFCToken] ( 🔴 ERROR): '+JSON.stringify(rCTErr));return Promise.resolve(false)}
}
//////////////////////////////////////////////////
export async function fbCustTokenCheckTask():Promise<boolean> {
  let sqlAllUsers:any[]=[];
  sqlAllUsers=await allSQLUTable('users');
  if(sqlAllUsers.length>0){
    for(let i=0;i<sqlAllUsers.length;i++){
      const tU:any=sqlAllUsers[i];
      const dbFCTGRes:any=await dbFCTGet(tU.email);
      if(dbFCTGRes.result){
        const eFCTObj:any=dbFCTGRes.data;
        if(eFCTObj!==null
          &&eFCTObj.hasOwnProperty('custom_token')
          &&eFCTObj.custom_token
          &&eFCTObj.hasOwnProperty('fe_token')
          &&eFCTObj.fe_token
          &&eFCTObj.hasOwnProperty('expires_at')
          &&eFCTObj.expires_at
          ){
            const existFEToken:string=dbFCTGRes.data.fe_token;
            await setNewFCToken(tU.email,existFEToken)
        }else{await setNewFCToken(tU.email,null)}
      }
    };
    return Promise.resolve(true);
  }else{return Promise.resolve(true)} 
};
//////////////////////////////////////////////////
export async function initDPAuthCheck():Promise<boolean> {
  let fnST:Date=new Date(),utValid:number=0,utInvalid:number=0;
  const sqlAllUsers:any[]=await allSQLUTable('users');
  for(let i=0;i<sqlAllUsers.length;i++){const tU:any=sqlAllUsers[i];
    const doUAuthRefRes:boolean=await doDPAPIRefresh(tU.email,tU.dp_domain,tU.dp_refresh);
    if(doUAuthRefRes){remIA(tU.email);utValid++}else{addIA(tU.email);utInvalid++}
  };
  logger.info(nowNice()+' - '+ttlTime(fnST)+' - [Function|initDPAuthCheck] 🏁🔑🎫 (📋 SUMMARY): ✔️ '+utValid+' / ❌ '+utInvalid+' | 🎫 '+sqlAllUsers.length);
  if(utValid>0){return Promise.resolve(true)}else{return Promise.resolve(false)}
}
//////////////////////////////////////////////////
export const getUserByEmail=async(email:string):Promise<object>=>{
  consFn('d','user','info','getUserByEmail',null);
  try{const gUBERes:UserRecord=await fireAuth.getUserByEmail(email);return Promise.resolve({result:true,data:gUBERes.toJSON()})}
  catch(gUBEErr){return Promise.resolve({result:false,data:gUBEErr})}
}
//////////////////////////////////////////////////
export async function getFBSettingsDoc(uEmail:string):Promise<any> {
  try{const settDocRef=await fsDocRef('settings',String(uEmail)).get();if(!settDocRef.exists){return Promise.resolve({result:false})}
  else{const uSettDocData:any=settDocRef.data();return Promise.resolve({result:true,data:uSettDocData})}}
  catch(e){return Promise.resolve({result:false})}
}
//////////////////////////////////////////////////
export async function getFBUsersDoc(uEmail:string):Promise<any> {
  try{const usersDocRef=await fsDocRef('users',String(uEmail)).get();if(!usersDocRef.exists){return Promise.resolve({result:false})}
  else{const usersDocData:any=usersDocRef.data();return Promise.resolve({result:true,data:usersDocData})}}
  catch(e){return Promise.resolve({result:false})}
}
//////////////////////////////////////////////////
export async function checkChangeNotifs(email:string,diffO:any):Promise<boolean>{
  logger.info(nowNice()+' - [Function 🗜️ checkChangeNotifs] ()...');
  let redoUserNotifSched:boolean=false,dontRedoTxt:string='',allCronJIds:string[]=[],hasErrs:boolean=false;
  const allCronJs:any=nodeSchedule.scheduledJobs;
  if(!_.isEmpty(allCronJs)){
    allCronJIds=Object.keys(allCronJs);
    if(Object.keys(diffO).length>1){dontRedoTxt='>1 Setting Changes - Aborted'}
    else{
      const settCatKey:string=Object.keys(diffO)[0];
      if(settCatKey==='payrates'){
        // payrate settings
        if(diffO.payrates.hasOwnProperty('options')&&diffO.payrates.options.show.hasOwnProperty('value')){
          const getAllUListRes:any=await dbGetAllNotifLists(email);
            if(getAllUListRes.result){const allULObj:any=getAllUListRes.data;
              let hasJCatNames:string[]=[],comboUJIds:string[]=[],didCancJIds:string[]=[];
              for(const[k,v]of Object.entries(allULObj)){if(v!==null&&Array.isArray(v)){hasJCatNames.push(k);for(let i=0;i<v.length;i++){comboUJIds.push(v[i].id)}}};
              if(comboUJIds.length>0){
                for(let i=0;i<comboUJIds.length;i++){
                  const cancJId:string=comboUJIds[i];
                  if(allCronJIds.includes(cancJId)){const cJ:nodeSchedule.Job=allCronJs[cancJId];cJ.cancel();redoUserNotifSched=true;didCancJIds.push(cancJId)}
                };
                let cLTxt:string='';if(didCancJIds.length>0){didCancJIds.length>1?cLTxt=' - Notifs: '+didCancJIds.join(', '):cLTxt=' Notifs: '+didCancJIds[0]}else{cLTxt=''};
                consFn('settnotifchange',null,'warn',null,'- '+email+' - Cancelled '+didCancJIds.length+'/'+comboUJIds.length+cLTxt); 
              }else{consFn('settnotifchange',null,'ok',null,'- '+email+' - No DB Notifs Found')}
            }else{consFn('settnotifchange',null,'err',null,'- '+email+' - DB Returned Error|NIL Notif Jobs for '+email)}
        }else{dontRedoTxt='Payrate Setting !== SHOW on/off'}
      }else{
        // alerts setting
        if(diffO.alerts.hasOwnProperty('options')){
          if(diffO.alerts.options.hasOwnProperty('alertCal')
          ||(diffO.alerts.options.hasOwnProperty('alertMethods')
            &&diffO.alerts.options.alertMethods.hasOwnProperty('value')
            &&diffO.alerts.options.alertMethods.value.hasOwnProperty('calendar'))
            ){consFn('settnotifchange',null,'ok',null,'- '+email+' - Alert Setting !== Impact Notifs')}
          else{
            const getAllUListRes:any=await dbGetAllNotifLists(email);
            if(getAllUListRes.result){const allULObj:any=getAllUListRes.data;
              let hasJCatNames:string[]=[],comboUJIds:string[]=[],didCancJIds:string[]=[];
              for(const[k,v]of Object.entries(allULObj)){if(v!==null&&Array.isArray(v)){hasJCatNames.push(k);for(let i=0;i<v.length;i++){comboUJIds.push(v[i].id)}}};
              if(comboUJIds.length>0){
                for(let i=0;i<comboUJIds.length;i++){
                  const cancJId:string=comboUJIds[i];
                  if(allCronJIds.includes(cancJId)){const cJ:nodeSchedule.Job=allCronJs[cancJId];cJ.cancel();redoUserNotifSched=true;didCancJIds.push(cancJId)}
                };
                let cLTxt:string='';if(didCancJIds.length>0){didCancJIds.length>1?cLTxt=' - Notifs: '+didCancJIds.join(', '):cLTxt=' Notifs: '+didCancJIds[0]}else{cLTxt=''};
                consFn('settnotifchange',null,'warn',null,'- '+email+' - Cancelled '+didCancJIds.length+'/'+comboUJIds.length+cLTxt); 
              }else{consFn('settnotifchange',null,'ok',null,'- '+email+' - No DB Notifs Found')}
            }else{consFn('settnotifchange',null,'err',null,'- '+email+' - DB Returned Error|NIL Notif Jobs for '+email)}
          }
        }else{dontRedoTxt='Alert Setting !== Impact Notifs'}
      }
    }
  }else{dontRedoTxt='No Cron Jobs Scheduled'};
  if(redoUserNotifSched){await appNotifCheckTask(email,false);consFn('settnotifchange',null,'ok',null,'- '+email+' - All Notif Updates Finished');return Promise.resolve(true)}
  else{consFn('settnotifchange',null,'ok',null,'- '+email+' - No Updates: '+dontRedoTxt);return Promise.resolve(true)}
}
//////////////////////////////////////////////////
export async function startFBSettingsDocListen(uEmails:string[]):Promise<boolean>{
  const fnST:Date=new Date();let lstnD:number=0;logger.info(nowNice()+' - [Function 🗜️ startFBSettingsDocListen] ()...');
  const subErr=(e:Error|null,x:string)=>{let eD:string;e===null?eD=x:eD=x+': '+e.stack+', '+e.name+', '+e.message;consFn('f','listen','err','startFBListen',eD)};
  const allLDs:any[]=lstnSettingsDocs(uEmails);
  for(let i=0;i<allLDs.length;i++){lstnD++;
    const lE:string=allLDs[i].e;
    const lD:DocumentReference=await allLDs[i].r;
    const unSub=lD.onSnapshot(async(dSS:FirebaseFirestore.DocumentData)=>{
      if(!dSS.exists){unSub();subErr(null,'[settingsDoc] - DocRef: '+lD.id+'@'+lD.path+' !== EXIST.')}
      else{
        if(fireSDReady){
          logger.info(nowNice()+' - (🔥|👂): [settingsDoc] - FireDoc.onSnapshot EVENT | Change | Doc: 🔥 fireStore/=> ⚙️ settings/=> 📄 '+String(lD.id).toUpperCase());
          const origD:any=await dbGetSett(lE);
          const newD:DocumentData=dSS.data();
          if(origD!==null){
            if(!_.isEqual(origD,newD)){
              const diffObj:object=await myDiff(newD,origD);  
              if(diffObj&&!_.isEmpty(diffObj)){
                const fKs:any[]=Object.keys(diffObj);
                let fixKV:string[]=[];for(const[k,v]of Object.entries(diffObj)){let fStr:string='';if(typeof v==='string'){fStr=k+' => '+String(v)}else{fStr=diffStr(v)};fixKV.push(fStr)};
                consFn('sync','settings','warn','- SnapshotSYNC','> '+lE+' - (SQLTable): settings [!==] (fireDoc) settings/'+lE+', Fixing ['+fKs.length+'] DB values...');
                const fixDBRes:boolean=await dbUpdU(lE,'settings',{settings:JSON.stringify(newD)});
                if(fixDBRes){
                  consFn('d','settings','ok','- SnapshotSYNC','> '+lE+' - 🛠️ Fixed ['+fKs.length+']: '+fixKV.join(', '));
                  if(fKs.includes('alerts')||fKs.includes('payrates')){
                    await checkChangeNotifs(lE,diffObj);
                  }
                }else{consFn('d','settings','err','- SnapshotSYNC','> '+lE+' - 🛠️ Fixing ['+fKs.length+']: '+fKs.join(', '))}
              }
            };
          };
        }else{logger.info(nowNice()+' - (🔥|👂|💤): [settingsDoc] - FireDoc.onSnapshot (Change) EVENT > !IGNORED! (<5s Init)...')}
      }
    },(sSErr:Error)=>{unSub();subErr(sSErr,'[settingsDoc] - Failed to Snapshot - DocRef: '+lD.id+'@'+lD.path)});
  };
  logger.info(nowNice()+' - (🔥|👂|🟠): [settingsDoc] - startListen = 5s | !INITDELAY! Started...');
  setTimeout(()=>{fireSDReady=true;logger.info(nowNice()+' - '+ttlTime(fnST)+' - (🔥|👂|🟢): [settingsDoc] - startListen > 5s | !STARTED! Listening to ['+String(lstnD)+'] fireDocs...')},5000);
  return Promise.resolve(true);
}
//////////////////////////////////////////////////
export async function startFBUserDocListen(uEmails:string[]):Promise<boolean>{
  const fnST:Date=new Date();let lstnD:number=0;logger.info(nowNice()+' - [Function 🗜️ startFBUserDocListen] ()...');
  const subErr=(e:Error|null,x:string)=>{let eD:string;e===null?eD=x:eD=x+': '+e.stack+', '+e.name+', '+e.message;consFn('f','listen','err','startFBListen',eD)};
  const allLDs:any[]=lstnUserDocs(uEmails);
  for(let i=0;i<allLDs.length;i++){lstnD++;
    const lE:string=allLDs[i].e;
    const lD:DocumentReference=await allLDs[i].r;
    const unSub=lD.onSnapshot(async(dSS:FirebaseFirestore.DocumentData)=>{
      if(!dSS.exists){unSub();subErr(null,'[usersDoc] - DocRef: '+lD.id+'@'+lD.path+' !== EXIST.')}
      else{
        if(fireUDReady){
          logger.info(nowNice()+' - (🔥|👂): [usersDoc] - FireDoc.onSnapshot EVENT | Change | Doc: 🔥 fireStore/=> 🧑 users/=> 📄 '+String(lD.id).toUpperCase());
          const origD:any=await dbGetU(lE,null);
          const newD:DocumentData=dSS.data();
          if(origD!==null){ 
            if(!_.isEqual(origD,newD)){
              const diffObj:object=await myDiff(newD,origD);
              if(diffObj&&!_.isEmpty){
                let fKs:any[]=Object.keys(diffObj),fixKV:string[]=[];
                for(const[k,v]of Object.entries(diffObj)){fixKV.push(String(k)+': '+origD[String(k)]+' ===> '+newD[String(v)])};
                consFn('sync','user','warn','- SnapshotSYNC','> '+lE+' - (SQLTable): users [!==] (fireDoc) users/'+lE+', Fixing ['+fKs.length+'] DB values...');
                const fixDBRes:boolean=await dbUpdU(lE,'users',diffObj);
                if(fixDBRes){
                  remIA(lE);consFn('d','user','ok','- SnapshotSYNC','> '+lE+' - 🛠️ Fixed ['+fKs.length+']: '+fixKV.join(', '));
                  await checkUTRefreshJob(lE);
                }else{if(fKs.includes('dp_')){addIA(lE)};consFn('d','user','err','- SnapshotSYNC','> '+lE+' - 🛠️ Fixing ['+fKs.length+']: '+fKs.join(', '))}
              }
            }
          }
        }else{logger.info(nowNice()+' - (🔥|👂|💤): [usersDoc] - FireDoc.onSnapshot (Change) EVENT > !IGNORED! (<5s Init)...')}
      }
    },(sSErr:Error)=>{unSub();subErr(sSErr,'[userDoc] - Failed to Snapshot - DocRef: '+lD.id+'@'+lD.path)});
  };
  logger.info(nowNice()+' - (🔥|👂|🟠): [usersDoc] - startListen = 5s | !INITDELAY! Started...');
  setTimeout(()=>{fireUDReady=true;logger.info(nowNice()+' - '+ttlTime(fnST)+' - (🔥|👂|🟢): [userDoc] - startListen > 5s | !STARTED! Listening to ['+String(lstnD)+'] fireDocs...')},5000);
  return Promise.resolve(true);
}
//////////////////////////////////////////////////
async function getFUDBBUFile(email:string):Promise<boolean> {
  const lFPath:string='/home/sheriff/NETS/userFiles/'+email+'/backups/sqlite/'+email+'.db';
  const getLFSize=async():Promise<number>=>{try{const s:number=(await fs.stat(lFPath)).size;if(typeof s==='number'&&s>0){return Promise.resolve(s)}else{return Promise.resolve(0)}}
  catch{return Promise.resolve(0)}};
  const lFSize:number=await getLFSize();
  const fFSize:number=(await fsBucket.file('dbBackups/'+email+'.db').getMetadata())[0].size;
  if(lFSize!==fFSize){
    try{fsBucket.file('dbBackups/'+email+'.db').download({destination:lFPath});return Promise.resolve(true)}
    catch(e){logger.info('[FireSQLSync|getFUDBBUFile] (ERROR): '+JSON.stringify(e));return Promise.resolve(false)}
  }else{return Promise.resolve(true)}
}
//////////////////////////////////////////////////
async function getFBUserInfo(email:string):Promise<FBUserInfo> {
  let fbUserI:FBUserInfo={userDoc:{result:null,data:null},hasPrefs:null,hasDBBU:null};
  try{const uDocRef=await fsDocRef('users',email).get();
    if(!uDocRef.exists){fbUserI.userDoc.result=false;return Promise.resolve(fbUserI)}
    else{
      fbUserI.userDoc.result=true;fbUserI.userDoc.data=uDocRef.data();
      [fbUserI.hasDBBU]=await fsBucket.file('dbBackups/'+email+'.db').exists();
      fbUserI.hasPrefs=(await fsDocRef('settings',email).get()).exists;
      if(fbUserI.hasPrefs){await getFUDBBUFile(email)};
      return Promise.resolve(fbUserI);
    }
  }catch(e){logger.info(nowNice()+' - '+e);fbUserI.userDoc.result=false;return Promise.resolve(fbUserI)}
}
//////////////////////////////////////////////////
async function getFireUsers(emails:string[]|null):Promise<FBDetailUI[]> {
  let basicArr:FBBasicUI[]=[];let detailArr:FBDetailUI[]=[];
  const allFireUsers:ListUsersResult=await fireAuth.listUsers(1000);
  allFireUsers.users.forEach(async(fireUser:UserRecord)=>{
    basicArr.push({
      email:<string>String(fireUser.email),
      password:<string>String(fireUser.passwordHash+'|'+fireUser.passwordSalt),
      fb_uid:<string>fireUser.uid,
      signedin:<string>String(gUT(fireUser.metadata.lastSignInTime))
    }); 
  });  
  if(emails!==null){basicArr=basicArr.filter(bAObj=>emails.includes(bAObj.email))};
  if(serverMode==='debug'){basicArr=basicArr.filter(bAObj=>String(bAObj.email)==='owenlenegan@gmail.com')};
  for(let i=0;i<basicArr.length;i++){
    const fbUIRes:FBUserInfo=await getFBUserInfo(basicArr[i].email);
    if(fbUIRes.userDoc!==null&&fbUIRes.userDoc.result){
      let prefInt:number;fbUIRes.hasPrefs?prefInt=1:prefInt=0; 
      let dbbuInt:number;fbUIRes.hasDBBU?dbbuInt=1:dbbuInt=0;
      let fUDObj:any={
        id:<null>null,
        email:<string>String(basicArr[i].email),
        password:<string>String(basicArr[i].password),
        dp_token:<string>String(fbUIRes.userDoc.data.dp_token),
        dp_refresh:<string>String(fbUIRes.userDoc.data.dp_refresh),
        dp_expires:<string>String(fbUIRes.userDoc.data.dp_expires),
        dp_domain:<string>String(fbUIRes.userDoc.data.dp_domain),
        fcm_token:<string>String(fbUIRes.userDoc.data.fcm_token),
        fb_uid:<string>String(basicArr[i].fb_uid),
        app_uuk:<string>String(basicArr[i].email.replace('@','').replace('.','')),
        app_prefs:<number>Number(prefInt),
        app_dbbu:<number>Number(dbbuInt),
        signedin:<number>Number(basicArr[i].signedin),
        modified:<null>null
      };
      if(prefInt===0){let newSettO:any|null=null;
        const getDSRes:object|null=await dbGetSett(basicArr[i].email);
        if(getDSRes!==null){newSettO=getDSRes}else{newSettO=defaultAUSettings()};
        try{const uSettDocRef=fsDocRef('settings',basicArr[i].email);await uSettDocRef.set(newSettO);fUDObj.app_prefs=1;detailArr.push(fUDObj)}
        catch{detailArr.push(fUDObj)}
      }else{detailArr.push(fUDObj)}
    }
  };
  return Promise.resolve(detailArr); 
}
//////////////////////////////////////////////////
export async function initFireSQLSync():Promise<any>{logger.info(nowNice()+' - [Function 🗜️ initFireSync] ()...');
  consFn('sync','time','info','fireSqlSync',nowNice());
  // FETCH USER ARRS (SQL/FIRE) -----------------
  const fbUsers:FBDetailUI[]=await getFireUsers(null);
  const dbUsers:any[]=await allSQLUTable('users');
  const dbUData:any[]=await allSQLUTable('user_data');
  const dbSetts:any[]=await allSQLUTable('settings');
  const dbNotif:any[]=await allSQLUTable('user_notif');
  // CREATE COMP EMAIL ARRS ---------------------
  const fbEmails:string[]=fbUsers.map(fUO=>fUO.email); // master
  const dbEmails:string[]=dbUsers.map(dUO=>dUO.email); // slave
  const dbDataEmails:string[]=dbUData.map(dDUO=>dDUO.email); // slave
  const dbSettEmails:string[]=dbSetts.map(dSUO=>dSUO.email); // slave
  const dbNotifEmails:string[]=dbNotif.map(dNUO=>dNUO.email); // slave
  // CREATE SYNC ACTION ARRS --------------------
  const addDBUsers:string[]=fbEmails.filter(e=>!dbEmails.includes(e)); // missing users
  const delDBUsers:string[]=dbEmails.filter(e=>!fbEmails.includes(e)); // deprecated users/user_data/settings
  const addDBData:string[]=fbEmails.filter(e=>!dbDataEmails.includes(e)); // missing user_data
  const addDBSett:string[]=fbEmails.filter(e=>!dbSettEmails.includes(e)); // missing settings
  const addDBNotif:string[]=fbEmails.filter(e=>!dbNotifEmails.includes(e)); // missing notifs
  // ADD NEW USERS ------------------------------
  if(addDBUsers.length>0){
    const newDBUsers:FBDetailUI[]=fbUsers.filter(fUO=>addDBUsers.includes(fUO.email));
    consFn('sync','users','info','fireSqlSync','Adding ['+newDBUsers.length+'] *NEW* Users to SQL DB...');
    let addOK:number=0;let addErr:number=0;let addTtl:number=newDBUsers.length;
    for(let i=0;i<newDBUsers.length;i++){
      const newDBUserObj:FBDetailUI=newDBUsers[i];
      const nDUE:string=newDBUserObj.email;
      const defDBDataObj:DBUserData=defaultDBUData(nDUE);
      let newDBSettObj:DBUserSettings=defaultDBUserSettings(nDUE,null);
      const defDBNotifObj:DBUserNotif=defaultDBUNotif(nDUE);
      if(newDBUserObj.app_prefs===1){const fSDocRes:any=await getFBSettingsDoc(nDUE);if(fSDocRes.result){newDBSettObj=defaultDBUserSettings(nDUE,fSDocRes.data)}};
      const insNewDBUserRes:any=await dbQ('INSERT INTO `users` SET ?',[newDBUserObj]);
      const insDefDBDataRes:any=await dbQ('INSERT INTO `user_data` SET ?',[defDBDataObj]);
      const insDefDBSettRes:any=await dbQ('INSERT INTO `settings` SET ?',[newDBSettObj]);
      const insDefDBNotifRes:any=await dbQ('INSERT INTO `users_notif` SET ?',[defDBNotifObj]);
      if(insNewDBUserRes.r&&insDefDBDataRes.r&&insDefDBSettRes.r&&insDefDBNotifRes.r){addOK++;
        const fPs:string[]=['images/colleagues','images/core','backups/sqlite'];
        for(let i=0;i<fPs.length;i++){await fs.mkdir('./userFiles/'+nDUE+'/'+fPs[i],{recursive:true})}
        consFn('d','userdatasett','ok','fireSqlSync','ADDED + Synced [NEW USER] '+nDUE);
      }else{addErr++;
        const eRs:any[]=[{n:'users',r:insNewDBUserRes.r},{n:'user_data',r:insDefDBDataRes.r},{n:'settings',r:insDefDBSettRes.r},{n:'user_notif',r:insDefDBNotifRes.r}];
        let errMsg:string='ADDING [NEW USER]: ';let eT:string[]=[];
        for(let i=0;i<eRs.length;i++){eT.push(eRs[i].n+' = '+eRs[i].r?'✔️':'❌')};
        consFn('d','userdatasett','warn','fireSqlSync',errMsg+eT.join(', '));
      }
    };
    consFn('sync','user','info','fireSqlSync','ADDED: '+addOK+'/'+addTtl+' ('+addErr+' errors) from "users" & "user_data" Tables.');
  }else{consFn('sync','user','info','fireSqlSync','No NEW Users to Add (-> "users" Table)')};
  // REMOVE OLD USERS ----------------------------
  if(delDBUsers.length>0){
    let delOK:number=0;let delErr:number=0;let delTtl:number=delDBUsers.length;
    consFn('sync','users','info','fireSqlSync','Removing ['+delDBUsers.length+'] Old Users from SQL DB...');
    for(let i=0;i<delDBUsers.length;i++){const rDUE:string=delDBUsers[i];
      let dTs:any[]=[{n:'users',r:null,t:'user = '},{n:'user_data',r:null,t:'user_data = '},{n:'settings',r:null,t:'settings = '},{n:'user_notif',r:null,t:'user_notif = '}];
      for(let i=0;i<dTs.length;i++){dTs[i].r=(await dbQ('DELETE FROM `'+dTs[i].n+'` WHERE `email` = ?',[rDUE])).r;dTs[i].r?dTs[i].t+='✔️':dTs[i].t+='❌'};
      if(dTs[0].r&&dTs[1].r&&dTs[2].r){delOK++;await fs.rmdir('./userFiles/'+rDUE,{recursive:true});consFn('d','userdatasett','ok','fireSqlSync','REMOVED + Synced [OLD USER] '+rDUE)}
      else{delErr++;consFn('d','userdatasett','warn','fireSqlSync','REMOVING [OLD USER]: '+dTs.map(tO=>tO.t).join(', '))}
    };
    consFn('sync','user','info','fireSqlSync','REMOVED: '+delOK+'/'+delTtl+' ('+delErr+' errors) from users / user_data / settings tables');
  }else{consFn('sync','user','info','fireSqlSync','No OLD Users to Remove (users / user_data / settings tables)')}; 
  // CHECK USER_DATA TABLE -----------------------
  if(addDBData.length>0){
    consFn('sync','userdata','info','fireSqlSync','Fixing ['+addDBData.length+'] *MISSING* User(s) from "user_data" Table...');
    let addOK:number=0;let addErr:number=0;let addTtl:number=addDBData.length;
    for(let i=0;i<addDBData.length;i++){const fdUE:string=addDBData[i];const defDBDataObj:DBUserData=defaultDBUData(fdUE);
      if((await dbQ('INSERT INTO `user_data` SET ?',[defDBDataObj])).r){addOK++;consFn('d','userdata','ok','fireSqlSync','FIXED [MISSING] user_data table for: '+fdUE)}
      else{addErr++;consFn('d','userdata','err','fireSqlSync','FIXING [MISSING] user_data table for: '+fdUE)}
    };
    consFn('sync','userdata','info','fireSqlSync','ADDED: '+addOK+'/'+addTtl+' ('+addErr+' errors) to "user_data" Table.');
  }else{consFn('sync','userdata','info','fireSqlSync','No EXISTING Users to Add (-> "user_data" Table)')};
  // CHECK SETTINGS -----------------------------
  if(addDBSett.length>0){
    consFn('sync','settings','info','fireSqlSync','Fixing ['+addDBSett.length+'] *MISSING* Users from "settings" Table...');
    let addOK:number=0;let addErr:number=0;let addTtl:number=addDBSett.length;
    for(let i=0;i<addDBSett.length;i++){const fsUE:string=addDBSett[i];const matchFBUObj:any=fbUsers.filter(fUO=>fUO.email===fsUE)[0];
      let newDBSettObj:DBUserSettings=defaultDBUserSettings(fsUE,null);
      if(matchFBUObj.app_prefs===1){const fSDocRes:any=await getFBSettingsDoc(fsUE);if(fSDocRes.result){newDBSettObj=defaultDBUserSettings(fsUE,fSDocRes.data)}};
      if((await dbQ('INSERT INTO `settings` SET ?',[newDBSettObj])).r){addOK++;consFn('d','settings','ok','fireSqlSync','FIXED [MISSING] settings table for: '+fsUE)}
      else{addErr++;consFn('d','settings','err','fireSqlSync','FIXING [MISSING] settings table for: '+fsUE)}
    };
    consFn('sync','settings','info','fireSqlSync','ADDED: '+addOK+'/'+addTtl+' ('+addErr+' errors) to "settings" Table.');
  }else{consFn('sync','settings','info','fireSqlSync','No EXISTING Users to Add (-> "settings" Table)')};
  // CHECK USER_NOTIF ---------------------------
  if(addDBNotif.length>0){
    consFn('sync','notif','info','fireSqlSync','Fixing ['+addDBNotif.length+'] *MISSING* Users from "user_notif" Table...');
    let addOK:number=0;let addErr:number=0;let addTtl:number=addDBNotif.length;
    for(let i=0;i<addDBNotif.length;i++){const fnUE:string=addDBNotif[i];const defNO:DBUserNotif=defaultDBUNotif(fnUE);
      if((await dbQ('INSERT INTO `user_notif` SET ?',[defNO])).r){addOK++;consFn('d','notif','ok','fireSqlSync','FIXED [MISSING] settings table for: '+fnUE)}
      else{addErr++;consFn('d','notif','err','fireSqlSync','FIXING [MISSING] settings table for: '+fnUE)}
    };
    consFn('sync','notif','info','fireSqlSync','ADDED: '+addOK+'/'+addTtl+' ('+addErr+' errors) to "user_notif" Table.');
  }else{consFn('sync','notif','info','fireSqlSync','No EXISTING Users to Add (-> "user_notif" Table)')};
  // USER DIR CHECK ------------------------------
  for(let i=0;i<fbEmails.length;i++){const uEml:string=fbEmails[i];
    try{const statPplDir:any=await fs.stat('./userFiles/'+uEml+'/images/colleagues');if(!statPplDir.isDirectory()){await fs.mkdir('./userFiles/'+uEml+'/images/colleagues',{recursive:true})}
    }catch{await fs.mkdir('./userFiles/'+uEml+'/images/colleagues',{recursive:true})};
    try{const statCoreDir:any=await fs.stat('./userFiles/'+uEml+'/images/core');if(!statCoreDir.isDirectory()){await fs.mkdir('./userFiles/'+uEml+'/images/core',{recursive:true})}
    }catch{await fs.mkdir('./userFiles/'+uEml+'/images/core',{recursive:true})};
    try{const statSQLiteDir:any=await fs.stat('./userFiles/'+uEml+'/backups/sqlite');if(!statSQLiteDir.isDirectory()){await fs.mkdir('./userFiles/'+uEml+'/backups/sqlite',{recursive:true})}
    }catch{await fs.mkdir('./userFiles/'+uEml+'/backups/sqlite',{recursive:true})};
  }
  // DEEP VAL CHECK [userObj] --------------------
  let sqlDVCArr:any[]=await allSQLUTable('users');
  let fireDVCArr:any[]=fbUsers;
  const remPs=async(o:object):Promise<boolean>=>{if(_.unset(o,'id')&&_.unset(o,'modified')){return Promise.resolve(true)}else{return Promise.resolve(false)}};
  if(sqlDVCArr.length!==fireDVCArr.length){consFn('sync','user','err','!DeepValueCheck!','Total No. SQL!==FB User Rows');return Promise.resolve({result:false})};
  let remPSQL:boolean=true;for(let i=0;i<sqlDVCArr.length;i++){const tO:object=sqlDVCArr[i];if(!(await remPs(tO))){remPSQL=false}};
  if(!remPSQL){consFn('sync','user','ok','!DeepValueCheck!','Failed to Remove id/modified Object Ptys for Comparison.');return Promise.resolve({result:false})};
  let remPFire:boolean=true;for(let i=0;i<fireDVCArr.length;i++){const tO:object=fireDVCArr[i];if(!(await remPs(tO))){remPFire=false}};
  if(!remPFire){consFn('sync','user','ok','!DeepValueCheck!','Failed to Remove id/modified Object Ptys for Comparison.');return Promise.resolve({result:false})};
  for(let i=0;i<sqlDVCArr.length;i++){
    const sqlO:any=sqlDVCArr[i];const sEml:string=sqlO.email;
    const fireO:any=fireDVCArr.filter(fO=>fO.email===sEml)[0];
    let sqlStrO:any=sqlO;for(const [key,value]of Object.entries(sqlStrO)){if(typeof value!=='string'){sqlStrO[key]=String(value)}};
    let fireStrO:any=fireO;for(const [key,value]of Object.entries(fireStrO)){if(typeof value!=='string'){fireStrO[key]=String(value)}};
    if(!_.isEqual(sqlStrO,fireStrO)){
      const diffObj:object=await myDiff(fireO,sqlO);
      if(diffObj&&!_.isEmpty(diffObj)){
        consFn('sync','user','warn','!DeepValueCheck!','Object !== | '+sEml+' | '+JSON.stringify(diffObj)+' | Correcting...');
        const dbRes:any=await dbQ('UPDATE `users` SET ? WHERE `email` = ?',[diffObj,sEml]);
        if(dbRes.r){consFn('d','user','ok','!DeepValueCheck!',dbRes.d.msg+' = 🛠️ '+sEml)}
        else{consFn('sync','user','err','!DeepValueCheck!',dbRes.d)}
      }
    }else{consFn('sync','user','ok','(isEqual?): '+sEml,'User DB Object === User Fire Object')}
  };
  consFn('sync','user','ok','!DeepValueCheck - USERS Table','🔥Firebase 🔗Synced 🗄️SQL');
  // DEEP VAL CHECK [settingsObj] --------------- 
  const fireUsArr:any[]=fireDVCArr;
  for(let i=0;i<fireUsArr.length;i++){
    const fUObj:any=fireUsArr[i];
    const fUEmail:string=String(fUObj.email);
    const fUHasSett=():boolean=>{if(Number(fUObj.app_prefs)===1){return true}else{return false}};
    if(fUHasSett()){
      let fSettO:any|null=null;const getFSRes:any=await getFBSettingsDoc(fUEmail);if(getFSRes.result){fSettO=getFSRes.data};
      let dbSettO:any|null=await dbGetSett(fUEmail);
      if(fSettO&&dbSettO){
        if(!_.isEqual(dbSettO,fSettO)){
          const diffObj:any=await myDiff(fSettO,dbSettO);
          if(diffObj&&!_.isEmpty(diffObj)){
            consFn('sync','settings','warn','!DeepValueCheck!','Object !== | '+fUEmail+' | '+JSON.stringify(diffObj)+' | Correcting...');
            const newSettO:string=JSON.stringify(fSettO);
            const dbRes:any=await dbQ('UPDATE `settings` SET ? WHERE `email` = ?',[{settings:newSettO},fUEmail]);
            if(dbRes.r){consFn('d','settings','ok','!DeepValueCheck!',dbRes.d.msg+' = 🛠️ '+fUEmail)}
            else{consFn('d','user','err','!DeepValueCheck!',dbRes.d)}
          }
        }
      }else{consFn('sync','settings','err','!DeepValueCheck! - SETTINGS Table','Missing/Invalid fbDoc &| dbRow for '+fUEmail)}
    }else{consFn('sync','settings','warn','!DeepValueCheck!','users/'+fUEmail+'.app_prefs=FALSE')}
  };
  consFn('sync','settings','ok','!DeepValueCheck! - SETTINGS Table','🔥Firebase 🔗Synced 🗄️SQL');
  // USER NOTIF SYNC ----------------------------
  const dbAllUNotifsRes:any=await dbGetAllUNotif();
  if(dbAllUNotifsRes.result&&dbAllUNotifsRes.data.length>0){
    for(let i=0;i<dbAllUNotifsRes.data.length;i++){
      let uNChangeArr:string[]=[];
      const uNRow:any=dbAllUNotifsRes.data[i];
      const uEmail:string=dbAllUNotifsRes.data[i].email;
      for(const[rK,rV]of Object.entries(uNRow)){
        if(rK!=='id'&&rK!=='email'){
          if(rV&&rV!==null&&rV!==undefined&&typeof rV==='string'&&isValidJSON(rV)){
            let nListArr:any[]=JSON.parse(rV);
            if(Array.isArray(nListArr)&&nListArr.length>0){
              const filtListArr:any[]=nListArr.filter(nLO=>isBefore(new Date(),new Date(nLO.tt))&&!nLO.id.includes('9999'));
              if(filtListArr.length<nListArr.length){
                const listNames:string[]=nListArr.map(nO=>nO.id);
                const filtNames:string[]=filtListArr.map(nO=>nO.id);
                const remNames:string[]=listNames.filter(rN=>!filtNames.includes(rN));
                let resStr:string='('+rK+'): '+remNames.join(',')+' - ';
                const remOldJRes:boolean=await dbSetNotifList(uNRow.email,rK,filtListArr);
                if(remOldJRes){resStr+='✔️'}else{resStr+='❌'};
                uNChangeArr.push(resStr);
              }
            }  
          }
        }
      };
      if(uNChangeArr.length>0){consFn('sync','notif','warn','!OldNotifCheck!',' - '+uEmail+' - 🛠️ Remove Old Notifs: '+uNChangeArr.join(', '))};
    };
  }else{consFn('sync','notif','ok','!OldNotifCheck!','No Rows in "user_notif" Table')};
  //---------------------------------------------
  return Promise.resolve({result:true,data:fbEmails});
}
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////
