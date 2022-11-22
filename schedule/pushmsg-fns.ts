//////////////////////////////////////////////////
///// IMPORTS ////////////////////////////////////
//////////////////////////////////////////////////
import {getShiftPay} from './pay-calc';
import {logger} from '../logger';
import {dbQ,allSQLUTable,dbGetU,dbGetUD} from './sqldb-helper-fns';
import {qGAPI,qPAPI} from './dpapi-helper-fns';
import {fireMsg} from '../fire/config';
import {MyMsgData,MyMsgNotification,MyMsgAndroidConfig,MyMsgAndroidNotification,MyMsgWebPushConfig,MyMsgWebPushNotification,MyMsgWebPushFCMOptions,MyMsgFCMConfig} from '../appObjects';
import {strFormat,dUT,isSD,isYD,nowNice,isTM,isSY,durToNow} from './timedate-fns';
import {sendEmailMsg} from './emailmsg-fns';
//////////////////////////////////////////////////
///// GVARS/GFNS /////////////////////////////////
//////////////////////////////////////////////////
function tsStatsStr(tsO:any):string{
  let seStr:string='',ttStr:string='';
  const sD:Date=dUT(Number(tsO.StartTime));const eD:Date=dUT(Number(tsO.EndTime));const sS:string=strFormat(sD,'h:mmaaa');const eS:string=strFormat(eD,'h:mmaaa');let A2P:boolean|null=null;sS.charAt(sS.length-2)===eS.charAt(eS.length-2)?A2P=false:A2P=true;if(A2P){seStr=sS+' ➔ '+eS}else{const sA:string[]=sS.split(':');seStr=sA[0]+':'+sA[1].substring(0,2)+' ➔ '+eS};
  ttStr=' = '+String(tsO.TotalTime)+'hrs';
  const tDiff:number=Number(tsO.TotalTime)-Number(tsO.TotalTimeInv);
  let isDiff:boolean|null=null,diffIco:string='';if(Math.sign(tDiff)===1){isDiff=true;diffIco='☝️'}else if(Math.sign(tDiff)===-1){isDiff=true;diffIco='👇'}else{isDiff=false};
  if(isDiff){let fTD:string='',rawTD:number=Math.abs(tDiff);if(rawTD<1){fTD=String(Math.round(rawTD*60))+'mins'}else{fTD=Number(rawTD).toFixed(1)+'hrs'};ttStr+=' ('+diffIco+fTD+')'};
  return seStr+ttStr;
};
//////////////////////////////////////////////////
const myMsgData=(iaDisplay:string|null,fTyp:string|null,orsDataObj:any|null):Promise<MyMsgData>=>{
  let mmD:MyMsgData={inAppDisplay:'none'};
  if(iaDisplay){mmD.inAppDisplay=String(iaDisplay)};
  if(fTyp){mmD['fnType']=String(fTyp)};
  if(orsDataObj!==null){for(const[k,v] of Object.entries(orsDataObj)){mmD[String(k)]=String(v)}};
  return Promise.resolve(mmD);
};
// Notification Object ---------------------------
const myMsgNotification=(mmBody:string,mmImage:string|null,mmTitle:string):Promise<MyMsgNotification>=>{
  let mmNotif:MyMsgNotification={title:String(mmTitle),body:String(mmBody)};
  if(mmImage){mmNotif['image']=String(mmImage)};
  return Promise.resolve(mmNotif)
};
// Android Object --------------------------------
const myMsgAndroidConfig=(
  mmData:MyMsgData,
  mmNotif:MyMsgNotification,
  mmIco:string|null,mmColor:string|null,mmSound:string|null,mmTag:string|null,mmChanId:string|null,mmStick:boolean|null,mmCount:string|number|null):Promise<MyMsgAndroidConfig>=>{
  let mmAConfig:MyMsgAndroidConfig={collapseKey:'dev.zer0ne.sheriff',priority:'high',data:mmData};
  let mmANotif:MyMsgAndroidNotification={title:mmNotif.title,body:mmNotif.body,defaultSound:false,priority:'max',lightSettings:{color:'#FF9800',lightOnDurationMillis:250,lightOffDurationMillis:250},defaultLightSettings:false,visibility:'public'};
  if(mmNotif.hasOwnProperty('image')&&mmNotif.image){mmANotif['imageUrl']=String(mmNotif.image)};
  mmIco?mmANotif['icon']=String(mmIco):mmANotif['icon']='ic_stat_sheriffnote';
  mmColor?mmANotif['color']=String(mmColor):mmANotif['color']='#FF9800';
  mmSound?mmANotif['sound']=String(mmSound):mmANotif['sound']='sheriffnote.wav';
  if(mmTag){mmANotif['tag']=String(mmTag)};
  mmChanId?mmANotif['channelId']=String(mmChanId):mmANotif['channelId']='sheriff-alerts';
  mmStick!==null?mmANotif['sticky']=Boolean(mmStick):mmANotif['sticky']=false;
  mmCount!==null?mmANotif['notificationCount']=Number(mmCount):mmANotif['notificationCount']=1;
  mmAConfig['notification']=mmANotif;
  return Promise.resolve(mmAConfig);
};
// WebPush Object ---------------------------------
const myMsgWebPushConfig=(
  mmData:MyMsgData,
  mmNotif:MyMsgNotification,
  mmAConfig:MyMsgAndroidConfig,
  mmHeaders:any|null,mmActions:any[]|null,mmLink:string|null):Promise<MyMsgWebPushConfig>=>{
  let mmWPConfig:MyMsgWebPushConfig={data:mmData};
  let mmWPNotif:MyMsgWebPushNotification={title:mmNotif.title,body:mmNotif.body,data:mmData,requireInteraction:true,silent:false,renotify:false,vibrate:[100,100,1000]};
  let mmWPFCM:MyMsgWebPushFCMOptions={link:''};
  if(mmHeaders!==null){let mmH:any={};for(const[k,v] of Object.entries(mmHeaders)){mmH[String(k)]=String(v)};mmWPConfig['headers']=mmH};
  if(mmNotif.hasOwnProperty('image')&&mmNotif.image){mmWPNotif['image']=String(mmNotif.image)};
  if(mmAConfig.hasOwnProperty('notification')&&mmAConfig.notification&&mmAConfig.notification.hasOwnProperty('notificationCount')&&mmAConfig.notification.notificationCount&&typeof mmAConfig.notification.notificationCount==='number'){mmWPNotif['badge']=String(mmAConfig.notification.notificationCount)};
  if(mmAConfig.hasOwnProperty('notification')&&mmAConfig.notification&&mmAConfig.notification.hasOwnProperty('icon')&&mmAConfig.notification.icon){mmWPNotif['icon']=mmAConfig.notification.icon};
  if(mmAConfig.hasOwnProperty('notification')&&mmAConfig.notification&&mmAConfig.notification.hasOwnProperty('tag')&&mmAConfig.notification.tag){mmWPNotif['tag']=String(mmAConfig.notification.tag)};
  if(mmActions!==null&&mmActions.length>0){mmWPNotif['actions']=mmActions};
  mmWPConfig['notification']=mmWPNotif;
  if(mmLink){mmWPFCM.link=String(mmLink);mmWPConfig['fcmOptions']=mmWPFCM};
  return Promise.resolve(mmWPConfig);
};
// FCM Object --------------------------------------
const myMsgFCMConfig=(mmAnalLabel:string|null):Promise<MyMsgFCMConfig>=>{
  let mmFCMConfig:MyMsgFCMConfig={};
  if(mmAnalLabel){mmFCMConfig['analyticsLabel']=mmAnalLabel};
  return Promise.resolve(mmFCMConfig);
};
// Message Payload Object --------------------------
export async function sendMyMsg(mmToken:string|null,mmTitle:string|null,mmBody:string|null,mmImage:string|null,mmData:any|null,mmIco:string|null,mmColor:string|null,mmSound:string|null,mmTag:string|null,mmChanId:string|null,mmStick:boolean|null,mmCount:string|number|null,mmHeaders:any|null,mmActions:any[]|null,mmLink:string|null,mmAnalLabel:string|null):Promise<boolean>{
  let mToken:string='';let mTitle:string='';let mBody:string='';let mImage:string|null=null;let mData:any|null={iad:'',fnt:'',ors:{}};
  if(mmToken===null){mToken=(await dbQ('SELECT * FROM `users` WHERE `email` = ?',['owenlenegan@gmail.com'])).d[0].fcm_token}else{mToken=mmToken};
  mmTitle?mTitle=String(mmTitle):mTitle=`🛡️ Sheriff Alert`;
  mmBody?mBody=String(mmBody):mBody=`I am your notification message body text and I say stuff.`;
  mmImage?mImage=String(mmImage):mImage=null;
  if(mmData===null){mData={iad:null,fnt:null,ors:null}}
  else{let rawDataObj:any=mmData;
    if(mmData.hasOwnProperty('inAppDisplay')&&mmData.inAppDisplay){mData.iad=mmData.inAppDisplay;delete rawDataObj.inAppDisplay}else{mData.iad=null};
    if(mmData.hasOwnProperty('fnType')&&mmData.fnType){mData.fnt=mmData.fnType;delete rawDataObj.fnType}else{mData.fnt=null};
    if(Object.keys(rawDataObj).length>0){for(const[k,v]of Object.entries(rawDataObj)){mData.ors[String(k)]=String(v)}}else{mData.ors=null};
  };
  let mmBaseMsg:any={token:mToken};
  const mmDataRes:MyMsgData=await myMsgData(mData.iad,mData.fnt,mData.ors);
  const mmNotifRes:MyMsgNotification=await myMsgNotification(mBody,mImage,mTitle);
  const mmAndroidRes:MyMsgAndroidConfig=await myMsgAndroidConfig(mmDataRes,mmNotifRes,mmIco,mmColor,mmSound,mmTag,mmChanId,mmStick,mmCount);
  const mmWebPushRes:MyMsgWebPushConfig=await myMsgWebPushConfig(mmDataRes,mmNotifRes,mmAndroidRes,mmHeaders,mmActions,mmLink);
  const mmFCMRes:MyMsgFCMConfig=await myMsgFCMConfig(mmAnalLabel);
  if(mmFCMRes.hasOwnProperty('analyticsLabel')&&mmFCMRes.analyticsLabel){mmBaseMsg['fcmOptions']=mmFCMRes};
  mmBaseMsg['data']=mmDataRes;
  mmBaseMsg['notification']=mmNotifRes;
  mmBaseMsg['android']=mmAndroidRes;
  mmBaseMsg['webpush']=mmWebPushRes;
  try{
    const mmSendRes:any=await fireMsg.send(mmBaseMsg);
    logger.info(nowNice()+' - (✉️|sendMyMsg) - [ ✔️ SUCCESS ]: Message(s) (Title: '+mTitle.substring(0,15)+'...) > FCM Id #'+mmSendRes);
    return Promise.resolve(true);
  }catch(sendMMErr:any){
    if(sendMMErr.hasOwnProperty('code')&&sendMMErr.hasOwnProperty('message')){
      logger.info(nowNice()+' - (✉️|sendMyMsg) CATCH ERROR >>> [CODE]: '+sendMMErr.code+' [MSG]: '+sendMMErr.message);return Promise.resolve(false)
    }else{logger.info(nowNice()+' - (✉️|sendMyMsg) CATCH ERROR >>> '+JSON.stringify(sendMMErr));return Promise.resolve(false)}
  }
};
////////////////////////////////////////////////////
export async function sendMsg(token:string|null,title:string|null,body:string|null,data:any):Promise<boolean>{
  let msgToken:string='';let msgTitle:string='';let msgBody:string='';let msgData:any;
  if(token===null){msgToken=(await dbQ('SELECT * FROM `users` WHERE `email` = ?',['owenlenegan@gmail.com'])).d[0].fcm_token}else{msgToken=token};
  title===null?msgTitle='':msgTitle=title;
  body===null?msgBody='':msgBody=body;
  data===null?msgData={inAppDisplay:'toast'}:msgData=data;
  let msgPLoad:any={data:msgData,notification:{title:msgTitle,body:msgBody}};
  let msgOpts:any={android:{ttl:8640000,restricted_package_name:'dev.zer0ne.sheriff',notification:{priority:'high',visibility:'public',channelId:'sheriff-alerts',title:msgTitle,body:msgBody,data:msgData}}};
  try{const mmSendRes:any=await fireMsg.sendToDevice(msgToken,msgPLoad,msgOpts);
    if(mmSendRes.failureCount===0){
      logger.info(nowNice()+' - (✉️|sendMyMsg) - [ ✔️ SUCCESS ]: '+String(mmSendRes.successCount)+'x Message(s) (Title: '+msgTitle.substring(0,15)+'...) > FCM Id #'+mmSendRes.results[0].messageId);
      return Promise.resolve(true);
    }else{
      let failArr:string[]=[];for(let i=0;i<mmSendRes.results.length;i++){if(mmSendRes.results[i].hasOwnProperty('error')&&mmSendRes.results[i].error!==undefined){failArr.push('[CODE]: '+String(mmSendRes.results[i].error.code))+' - [MSG]: '+String(mmSendRes.results[i].error.message)}};
      logger.info(nowNice()+' - (✉️|sendMyMsg) - [ ❌ ERROR(S) ]: '+String(mmSendRes.failureCount)+'/'+String(mmSendRes.successCount+mmSendRes.failureCount)+' Message(s) Failed: '+failArr.join(', '));
      return Promise.resolve(false);
    };
  }catch(sendMMErr:any){
    if(sendMMErr.hasOwnProperty('results')&&sendMMErr.results.length>0){
      let failArr:string[]=[];for(let i=0;i<sendMMErr.results.length;i++){if(sendMMErr.results[i].hasOwnProperty('error')&&sendMMErr.results[i].error!==undefined){failArr.push('[CODE]: '+String(sendMMErr.results[i].error.code))+' - [MSG]: '+String(sendMMErr.results[i].error.message)}};
      logger.info(nowNice()+' - (✉️|sendMyMsg) - [ ❌ ERROR(S) ]: '+String(sendMMErr.failureCount)+'/'+String(sendMMErr.successCount+sendMMErr.failureCount)+' Message(s) Failed: '+failArr.join(', '));
      return Promise.resolve(false);
    }else{logger.info(nowNice()+' - (✉️|sendMyMsg) CATCH ERROR >>> [CODE]: '+sendMMErr.code+' [MSG]: '+sendMMErr.message);return Promise.resolve(false)}
  }
}
//////////////////////////////////////////////////
export async function testWorkMsg(evDataObj:any):Promise<boolean>{
  const testUserObj:any=(await allSQLUTable('users'))[0];
  const testType:number=Number(evDataObj.UsageType);
  const testDataObj:any=evDataObj;
  const testRes:boolean=await sendWorkEventMsg(testUserObj,testType,testDataObj);
  if(testRes){return Promise.resolve(true)}
  else{return Promise.resolve(false)}
}
//////////////////////////////////////////////////
export async function sendWorkEventMsg(userObj:any,evType:number,evDataObj:any):Promise<boolean> {
  const workEvTypes:any={
    2:{subTitle:'𝘌𝘮𝘱𝘭𝘰𝘺𝘦𝘦',action:'Employee activated',ico:'🚀'},
    10:{subTitle:'𝘛𝘪𝘮𝘦𝘴𝘩𝘦𝘦𝘵',action:'Timesheet submitted',ico:'⏲️'},
    11:{subTitle:'𝘙𝘰𝘴𝘵𝘦𝘳',action:'Roster published',ico:'📅'},
    21:{subTitle:'𝘈𝘤𝘵𝘪𝘷𝘪𝘵𝘺',action:'Activity in TSA',ico:'⚙️'},
    22:{subTitle:'𝘈𝘤𝘵𝘪𝘷𝘪𝘵𝘺',action:'Activity in rosters',ico:'⚙️'},
    23:{subTitle:'𝘈𝘤𝘵𝘪𝘷𝘪𝘵𝘺',action:'Activity in TSE',ico:'⚙️'},
    25:{subTitle:'𝘙𝘦𝘱𝘰𝘳𝘵',action:'Report generated',opts:['Schedule vs Timesheet vs Sales','Employee Details','Journal Usage','Timesheet Geo Locations','Time Off & Schedules'],ico:'📋'},
    26:{subTitle:'𝘑𝘰𝘶𝘳𝘯𝘢𝘭',action:'Journal submitted',ico:'📔'},
    28:{subTitle:'𝘓𝘦𝘢𝘷𝘦',action:'Leave approved',ico:'✈️'},
  };
  // Fetch Users API Data
  const uDDBR:any=(await dbQ('SELECT * FROM `user_data` WHERE `email` = ?',[userObj.email])).d[0];
  let udOArr:any[]=[{col:'me',obj:null},{col:'my',obj:null},{col:'colleagues',obj:null}];
  for(let i=0;i<udOArr.length;i++){const tUDO:any=udOArr[i];if(uDDBR[tUDO.col]!==null&&uDDBR[tUDO.col]!=='null'&&uDDBR[tUDO.col]!=='NULL'&&uDDBR[tUDO.col]!==undefined&&uDDBR[tUDO.col]!=='undefined'&&uDDBR[tUDO.col]!=='[object Object]'){tUDO.obj=JSON.parse(uDDBR[tUDO.col])}};
  // Users Name & EmpId
  let uEmpId:number|null=null,uName:string|null=null;
  if(udOArr[0].obj){
    if(udOArr[0].obj.FirstName!==''&&udOArr[0].obj.FirstName.length>1){uName=String(udOArr[0].obj.CompanyObject.FirstName)}
    else if(udOArr[0].obj.Name!==''&&udOArr[0].obj.Name.length>1){const nameArr:string[]=udOArr[0].obj.Name.split(' ');nameArr.length>0?uName=String(nameArr[0]):uName=String(udOArr[0].obj.Name)}
    else if(udOArr[0].obj.UserObjectForAPI.DisplayName!==''&&udOArr[0].obj.UserObjectForAPI.DisplayName.length>0){const nameArr:string[]=udOArr[0].obj.UserObjectForAPI.DisplayName.split(' ');nameArr.length>0?uName=String(nameArr[0]):uName=String(udOArr[0].obj.UserObjectForAPI.DisplayName)}
    else{uName='𝗬𝗼𝘂'};
    if(udOArr[0].obj.EmployeeId&&Number(udOArr[0].obj.EmployeeId)>0){uEmpId=Number(udOArr[0].obj.EmployeeId)}
    else if(udOArr[0].obj.UserId&&Number(udOArr[0].obj.UserId)>0){uEmpId=Number(udOArr[0].obj.UserId)}
    else if(udOArr[0].obj.UserObjectForAPI.Employee&&Number(udOArr[0].obj.UserObjectForAPI.Employee)>0){uEmpId=Number(udOArr[0].obj.UserObjectForAPI.Employee)}
    else if(udOArr[0].obj.UserObjectForAPI.Id&&Number(udOArr[0].obj.UserObjectForAPI.Id)>0){uEmpId=Number(udOArr[0].obj.UserObjectForAPI.Id)}
    else{uEmpId=0}
  }else{uName='𝗬𝗼𝘂';uEmpId=0};
  // Company ID/Name
  let workPlaces:any[]=[],wpId:number=0,wpCode:string='',wpName:string='';
  if(udOArr[1].obj){if(udOArr[1].obj.Workplace&&udOArr[1].obj.Workplace.length>0){workPlaces=udOArr[1].obj.Workplace}};
  if(udOArr[0].obj){
    if(udOArr[0].obj.CompanyObject.Code&&udOArr[0].obj.CompanyObject.Code!==''&&udOArr[0].obj.CompanyObject.Code.length===3){wpCode=String(udOArr[0].obj.CompanyObject.Code)}
    else if(udOArr[0].obj.CompanyObject.CompanyName&&udOArr[0].obj.CompanyObject.CompanyName!==''&&udOArr[0].obj.CompanyObject.CompanyName.length>2){wpCode=udOArr[0].obj.CompanyObject.CompanyName.substring(0,3)}
    else{wpCode='UNK'};
    if(udOArr[0].obj.CompanyObject.CompanyName&&udOArr[0].obj.CompanyObject.CompanyName!==''&&udOArr[0].obj.CompanyObject.CompanyName.length>1){wpName=String(udOArr[0].obj.CompanyObject.CompanyName)}
    else if(udOArr[0].obj.Portfolio&&udOArr[0].obj.Portfolio!==''&&udOArr[0].obj.Portfolio.length>1){wpName=String(udOArr[0].obj.Portfolio)}
    else{wpName='Your Workplace'};
    if(udOArr[0].obj.Company&&Number(udOArr[0].obj.Company)>0){wpId=Number(udOArr[0].obj.Company)}
    else if(udOArr[0].obj.CompanyObject.Id&&Number(udOArr[0].obj.CompanyObject.Id)>0){wpId=Number(udOArr[0].obj.CompanyObject.Id)}
    else{wpId=0}
  };
  // Work/Company Code
  const compCodeName=(cId:string|number):string[]|null=>{if(Number(wpId)>0){if(Number(cId)===Number(wpId)){return [wpCode,wpName]}else{if(workPlaces.length>0){const matchCompArr:any=workPlaces.filter(w=>Number(w.Id)===Number(cId));if(matchCompArr&&matchCompArr.length>0){return [String(matchCompArr[0].Code),String(matchCompArr[0].CompanyName)]}else{return null}}else{return null}}}else{return null}};
  let fWPCode:string='';const matchWP:string[]|null=compCodeName(Number(evDataObj.CompanyId));if(matchWP){fWPCode=' ('+matchWP[0]+')'};
  // Work Areas
  let wpAreas:any[]|null=null;if(udOArr[1].obj&&udOArr[1].obj.length>0){wpAreas=udOArr[1].obj.Department};
  // Colleagues
  let wpPpl:any[]|null=null;if(udOArr[2].obj&&udOArr[2].obj.length>0){wpPpl=udOArr[2].obj};
  // Gendered Icons
  const gendIco=(eId:string|number):string=>{let defI:string='🧑';if(wpPpl!==null&&wpPpl&&wpPpl.length>0){const matchPArr:any[]=wpPpl.filter(p=>Number(p.EmpId)===Number(eId));if(matchPArr&&matchPArr.length>0){const pNVal:number=Number(matchPArr[0].Pronouns);if(pNVal===1||pNVal===2){pNVal===1?defI='👨':defI='👩';return defI}else{return defI}}else{return defI}}else{return defI}};
  // Short Names
  const shortDName=(dName:string):string=>{let matchPObj:any=null;let shortD:string='';
    if(wpPpl){const matchPArr:any[]=wpPpl.filter(p=>String(p.DisplayName)===dName);if(matchPArr&&matchPArr.length>0){matchPObj=matchPArr[0]}};
    let shortFName:string='',initialLName:string='';
    const rawDNameArr:string[]=dName.split(' ');
    rawDNameArr&&rawDNameArr.length>0?shortFName=rawDNameArr[0]:shortFName=dName;
    if(rawDNameArr&&rawDNameArr.length>1){initialLName=rawDNameArr[rawDNameArr.length-1].charAt(0)};
    if(wpPpl&&matchPObj&&matchPObj.LastName&&matchPObj.LastName!==''&&matchPObj.LastName.length>1){initialLName=matchPObj.LastName.charAt(0)};
    shortD=String(shortFName+' '+initialLName);
    return shortD;
  };
  // Template Matches
  let matchedEvType:any={};
  if(evType===0){ // HEAD COUNT EVENT
    if(evDataObj.hasOwnProperty('added')||evDataObj.hasOwnProperty('removed')){
      let addRemEmpEvType:any={subTitle:'Employee',action:'',ico:''},aIco:string='➕',rIco:string='🗑️',bIco:string='➕|🗑️';
      if(evDataObj.added.count>0&&evDataObj.removed.count>0){addRemEmpEvType.action='Employees added and removed';addRemEmpEvType.ico=bIco} //both
      else if(evDataObj.added.count>0&&evDataObj.removed.count<1){let Es:string='';if(evDataObj.added>1){Es='s'};addRemEmpEvType.action='Employee'+Es+' added';addRemEmpEvType.ico=aIco} //added only
      else if(evDataObj.added.count<1&&evDataObj.removed.count>1){let Es:string='';if(evDataObj.removed>1){Es='s'};addRemEmpEvType.action='Employee'+Es+' removed';addRemEmpEvType.ico=rIco}; //removed only
      matchedEvType=addRemEmpEvType;
    };
  }else{matchedEvType=workEvTypes[evType]};
  //////////////////////////////////////////////////////////////////////////
  // TITLE LIMIT 65 chars, BODY LIMIT 240 chars, IDEAL LINE 47 chars
  // -----------------------------------------------
  // | 𝗪𝗼𝗿𝗸 𝗘𝘃𝗲𝗻𝘁 (DOG) | Timesheet
  // | ⏲️ Timesheet submitted by Renee C for Ben T
  // |  • ᴀᴛ: 11:21pm Today
  // |  • ɪᴅ #Timesheet #6587
  // -----------------------------------------------
  //////////////////////////////////////////////////////////////////////////
  let finalMsgObject:any={};
  //////////////////////////////////////////////////////////////////////////
  const genFinalMsg=(byForToActionTxt:string,detailLinesTxt:string[]):any=>{
    let fMsgO:any={fTitle:'Work Event'+fWPCode+' | '+matchedEvType.subTitle,fBody:matchedEvType.ico+' '+matchedEvType.action+' '+byForToActionTxt};
    let fTimeLStr:string='';if(evType!==0){const nowModD:Date=new Date();const evModD:Date=new Date(evDataObj.Modified);const timeStr:string=strFormat(evModD,'h:mmaaa');let dayStr:string='';if(isSD(evModD,nowModD)){dayStr='Today'}else{if(isYD(evModD)){'Yesterday'}else{dayStr='on '+strFormat(evModD,'EEE, d MMM yyyy')}};fTimeLStr=timeStr+' '+dayStr;}
    else{if(evDataObj.hasOwnProperty('added')||evDataObj.hasOwnProperty('removed')){fTimeLStr='Midnight ('+strFormat(new Date(),'EEE, d MMM YYYY')+')'}else{fTimeLStr=strFormat(new Date(),'h:mmaaa EEE, d MMM yyyy')}};
    fMsgO.fBody+='\n • ᴀᴛ: '+fTimeLStr;
    const exclTypesArr:number[]=[0,21,22,23,28];
    if(!exclTypesArr.includes(evType)){fMsgO.fBody+='\n • ɪᴅ: '+matchedEvType.action.split(' ')[0]+' #'+String(evDataObj.UsageRecordId)};
    if(detailLinesTxt.length>0){for(let i=0;i<detailLinesTxt.length;i++){fMsgO.fBody+='\n • '+detailLinesTxt[i]}};
    return fMsgO;
  };
  //////////////////////////////////////////////////////////////////////////
  // ROLE CALL / ADDED/REMOVED EMPS
  //////////////////////////////////////////////////////////////////////////
  if(evType===0){
    const byForTxt:string='in 🖥️System';
    let deetLines:string[]=[];
    if(evDataObj.hasOwnProperty('added')&&evDataObj.added.count>0){
      let addedEsL:string='ᴀᴅᴅᴇᴅ: ';let addedENs:string[]=[];
      for(let i=0;i<evDataObj.added.emps.length;i++){addedENs.push(evDataObj.added.emps[i].name)};
      if(addedENs.length>0){addedEsL+=addedENs.join(', ');deetLines.push(addedEsL)}
    };
    if(evDataObj.hasOwnProperty('removed')&&evDataObj.removed.count>0){
      let removedEsL:string='ʀᴇᴍᴏᴠᴇᴅ: ';let removedENs:string[]=[];
      for(let i=0;i<evDataObj.removed.emps.length;i++){removedENs.push(evDataObj.removed.emps[i].name)};
      if(removedENs.length>0){removedEsL+=removedENs.join(', ');deetLines.push(removedEsL)}
    };
    finalMsgObject=genFinalMsg(byForTxt,deetLines);
  };
  //////////////////////////////////////////////////////////////////////////
  // OTHER EVENTS
  //////////////////////////////////////////////////////////////////////////
  if(evType!==0){
    let xtraDetailLines:string[]=[];
    //----------------------------------------------
    const pForEID:number=Number(evDataObj.EmpId);let pForName:string='Employee ID #'+String(pForEID);
    const pByEID:number=Number(evDataObj._DPMetaData.CreatorInfo.Id);
    let pByName:string=shortDName(String(evDataObj._DPMetaData.CreatorInfo.DisplayName));
    if(uEmpId===pByEID){pByName='𝗬𝗼𝘂'}else{pByName=pByName};
    let pByForFinalStr:string='';
    if(pByEID===pForEID){pByForFinalStr='by '+gendIco(pByEID)+pByName}
    else{
      if(uEmpId===pForEID){pForName=gendIco(pForEID)+'𝗬𝗼𝘂'}
      else{if(wpPpl!==null&&wpPpl.length>0){const matchPArr:any[]=wpPpl.filter(p=>Number(p.EmpId)===pForEID);if(matchPArr&&matchPArr.length>0){const matchNStr:string=matchPArr[0].DisplayName.toString();if(matchNStr&&matchNStr!==''&&matchNStr.length>1){pForName=gendIco(pForEID)+shortDName(matchNStr)}}}};
      pByForFinalStr='by '+gendIco(pByEID)+pByName+' for '+pForName;
    };
    // TIMESHEETS ---------------------------------
    if(evType===10&&Number(evDataObj.EmpId)===uEmpId){
      const getTSParams:any={search:{s1:{field:'Id',type:'gt',data:0}},sort:{Modified:'desc'},'max':1};
      const getTSRes:any=await qPAPI(userObj,'resource/Timesheet/QUERY',getTSParams);
      if(getTSRes.r&&getTSRes.d&&getTSRes.length>0){xtraDetailLines.push('ꜱᴛᴀᴛꜱ: '+tsStatsStr(getTSRes.d[0]))}
      else{logger.info('[sendWorkEventMsg|OwnTSPerf] (ERROR): Failed to Get TS')}
    };
    // REPORTS ------------------------------------
    if(evType===25){const rptTypeIndex:number=workEvTypes[evType].opts.findIndex((o:string)=>evDataObj.Description.includes(o));if(rptTypeIndex!==-1){xtraDetailLines.push('ᴛʏᴘᴇ: '+workEvTypes[evType].opts[rptTypeIndex])}else{xtraDetailLines.push('ᴛʏᴘᴇ: General Report')}}
    // --------------------------------------------
    finalMsgObject=genFinalMsg(pByForFinalStr,xtraDetailLines);
  };
  //////////////////////////////////////////////////
  await sendMyMsg(userObj.fcm_token,finalMsgObject.fTitle,finalMsgObject.fBody,null,null,null,'#AAAAAA','sheriffpst.wav',null,'snoop-alerts',null,null,null,null,null,null);
  return Promise.resolve(true);
}
//////////////////////////////////////////////////
export async function sendServerSUPMsg():Promise<boolean>{
  const meFCMT:string=(await allSQLUTable('users')).filter(uO=>uO.email==='owenlenegan@gmail.com')[0].fcm_token;
  const sSUPObj:any={title:'Sheriff Server',subTitle:'Started',action:'Server started',ico:'🛡️'};
  const nowD:Date=new Date();const startTS:string=strFormat(nowD,'h:mmaaa');const startDS:string=strFormat(nowD,'d MMM yyyy');
  let fMsgO:any={fTitle:sSUPObj.title+' | '+sSUPObj.subTitle,fBody:sSUPObj.ico+' '+sSUPObj.action+' at '+startTS+' on '+startDS};
  fMsgO.fBody+='\n • ᴜʀʟ: http://sheriff.zer0ne.dev:6969';
  fMsgO.fBody+='\n • ʟᴏɢ: https://sheriff.zer0ne.dev/logs';
  fMsgO.fBody+='\n • ᴍᴏɴ: 🟢ON | ⏱️60s | 🏁UP';
  await sendMyMsg(meFCMT,fMsgO.fTitle,fMsgO.fBody,null,null,null,'#AAAAAA','sheriffpst.wav',null,'snoop-alerts',null,null,null,null,null,null);
  await sendEmailMsg('owenlenegan@gmail.com',fMsgO.fTitle,fMsgO.fBody);
  return Promise.resolve(true);
}
//////////////////////////////////////////////////
// DP AUTH TOKEN MESSAGES 
//////////////////////////////////////////////////
export async function sendAuthTokenMsg(userObj:any,authObj:any,pushDataObj:any|null):Promise<boolean>{
  let fPushMsgData:any|null=null;if(pushDataObj!==null){fPushMsgData=pushDataObj};
  const sSUPObj:any={title:'Deputy Access',subTitle:'Renewed',action:'Deputy refreshed API access for Sheriff',ico:'🔑'};
  const nowD:Date=new Date();const expAtD:Date=dUT(Number(authObj.expires_at));const expAtTime:string=strFormat(expAtD,'h:mmaaa');let expAtDayStr:string='';const expInTxt:string=durToNow(expAtD);
  if(isSD(nowD,expAtD)){expAtDayStr='today'}
  else if(isTM(expAtD)){expAtDayStr='tomorrow'}
  else{expAtDayStr=strFormat(expAtD,'d MMM');if(!isSY(nowD,expAtD)){expAtDayStr+=' '+strFormat(expAtD,'yyyy')}};
  const fExpTxt:string=expAtDayStr+' at '+expAtTime+' (in '+expInTxt+')'; 
  let fMsgO:any={fTitle:sSUPObj.title+' | '+sSUPObj.subTitle,fBody:sSUPObj.ico+' '+sSUPObj.action};
  fMsgO.fBody+='\n • ᴛᴏᴋᴇɴꜱ: '+authObj.access_token.substring(0,12)+'... | '+authObj.refresh_token.substring(0,12)+'...';
  fMsgO.fBody+='\n • ᴅᴏᴍᴀɪɴ: '+authObj.endpoint;
  fMsgO.fBody+='\n • ᴇxᴘɪʀᴇꜱ: '+fExpTxt;
  await sendMyMsg(userObj.fcm_token,fMsgO.fTitle,fMsgO.fBody,null,fPushMsgData,'ic_deputy_official','#F26A60','sheriffother.wav',null,'deputy-alerts',null,null,null,null,null,null);
  await sendEmailMsg(userObj.email,fMsgO.fTitle,fMsgO.fBody);
  return Promise.resolve(true);
}
//////////////////////////////////////////////////
// APP EVENT NOTIF MESSAGES
//////////////////////////////////////////////////
export async function sendAppNotifMsg(uEmail:string,appNoteType:string,shiftTaskObj:any,b4m:number,showInc:boolean,pushOn:boolean,mailOn:boolean):Promise<boolean> {
  // Get Fresh UserObj (stale dp_token,fcm_token?)
  let uO:any={};
  const freshURes:null|object|string=await dbGetU(uEmail,null);
  if(freshURes!==null&&typeof freshURes=='object'){uO=freshURes};
  // Short Fn Params /////////////////////////////
  const nT:string=appNoteType;const evO:any=shiftTaskObj;
  // Fetch uData (me,my,colleagues) //////////////
  let udO:any={ me: {col:'me',ep:'me',obj:<any|null>null}, my: {col:'my',ep:'my/setup',obj:<any|null>null}, colleagues: {col:'colleagues',ep:'my/colleagues',obj:<any[]|null>null} };
  let meO:any|null=null,myO:any|null=null,pplArr:any[]|null=null;
  const uDAPIR=async():Promise<any>=>{
    let epsArr:string[]=Object.keys(udO),errArr:string[]=[];
    for(let i=0;i<epsArr.length;i++){
      const tK:string=String(epsArr[i]);
      const apiR:any=await qGAPI(uO,udO[tK].ep);
      if(apiR.r){udO[tK].obj=apiR.d}else{udO[tK].obj=null;errArr.push(tK)}
    };
    if(errArr.length>0){return Promise.resolve({result:false,data:errArr})}else{return Promise.resolve({result:true})}
  };
  const uDDBR=async(errUD:string[]):Promise<any>=>{
    for(let i=0;i<errUD.length;i++){
      const udCol:string=errUD[i];
      const dbUDRes:any=await dbGetUD(uEmail,udCol);
      if(dbUDRes.result){udO[udCol].obj=dbUDRes.data}
    }
  };
  const apiUDRes:any=await uDAPIR();
  if(!apiUDRes.result){await uDDBR(apiUDRes.data)};
  if(udO.me.obj!==null){meO=udO.me.obj};
  if(udO.my.obj!==null){myO=udO.my.obj};
  if(udO.colleagues.obj!==null){pplArr=udO.colleagues.obj};
  // User SName/EmpId ////////////////////////////
  let uEmpId:number|null=null;
  if(meO!==null){
    if(meO.EmployeeId&&Number(meO.EmployeeId)>0){
      uEmpId=Number(meO.EmployeeId)}else if(meO.UserObjectForAPI.Employee&&Number(meO.UserObjectForAPI.Employee)>0){uEmpId=Number(meO.UserObjectForAPI.Employee)}else if(meO.UserId&&Number(meO.UserId)>0){uEmpId=Number(meO.UserId)}else if(meO.meO.UserObjectForAPI.Id&&Number(meO.meO.UserObjectForAPI.Id)>0){uEmpId=Number(meO.meO.UserObjectForAPI.Id)}else{uEmpId=0}}else{uEmpId=0};
  // User WPlaces[],uWPId,uWPCode,uWPName ////////
  let uWPlaces:any[]=[];let uCompanyO:any={};let uWPId:number|null=null;let uWPCode:string|null=null;let uWPName:string|null=null;
  if(myO&&myO.Workplace&&myO.Workplace.length>0){uWPlaces=myO.Workplace} // uWPlaces
  else{const apiRes:any=await qGAPI(uO,'resource/Company');if(apiRes.r&&apiRes.d.length>0){uWPlaces=apiRes.d}}
  if(meO&&meO.hasOwnProperty('CompanyObject')&&meO.CompanyObject){uCompanyO=meO.CompanyObject} // uWCompanyO
  else if(meO&&meO.Company&&Number(meO.Company)>0){uCompanyO=uWPlaces.filter(cO=>Number(cO.Id)===Number(meO.Company))[0]}
  else if(myO&&myO.Portfolio&&myO.Portfolio.length!==''&&myO.Portfolio.length>1){uCompanyO=uWPlaces.filter(cO=>String(cO.CompanyName)===String(myO.Portfolio))[0]}
  else{
    if(nT==='shift'||nT==='tsheeton'||nT==='tsheetoff'){
      if(evO.OperationalUnitObject.hasOwnProperty('Comapny')&&evO.OperationalUnitObject.Company&&Number(evO.OperationalUnitObject.Company)>0){uCompanyO=uWPlaces.filter(cO=>Number(cO.Id)===Number(evO.OperationalUnitObject.Company))[0]}else if(evO._DPMetaData.OperationalUnitInfo.hasOwnProperty('Company')&&evO._DPMetaData.OperationalUnitInfo.Company&&Number(evO._DPMetaData.OperationalUnitInfo.Company)>0){uCompanyO=uWPlaces.filter(cO=>Number(cO.Id)===Number(evO._DPMetaData.OperationalUnitInfo.Company))[0]}else{uCompanyO=null}
    }else{if(uWPlaces.length>0){uCompanyO=uWPlaces[0]}}
  };
  uWPId=Number(uCompanyO.Id); // uWPId,uWPCode,uWPName
  if(uCompanyO&&uCompanyO.CompanyName!==''&&uCompanyO.CompanyName.length>1){uWPName=String(uCompanyO.CompanyName)}
  else if(myO&&myO.Portfolio&&myO.Portfolio.length!==''&&myO.Portfolio.length>1){uWPName=String(myO.Portfolio)}
  else if(uCompanyO&&uCompanyO.TradingName!==''&&uCompanyO.TradingName.length>1){uWPName=String(uCompanyO.TradingName)}
  else{uWPName='Your Company'};
  if(uCompanyO.Code&&uCompanyO.Code!==''&&uCompanyO.Code.length>1){uWPCode=String(uCompanyO.Code).substring(0,3)}
  else if(uWPName!=='Your Company'){
    const uWPNArr:string[]=uWPName.split(' ');
    if(uWPNArr.length>=3){uWPCode=uWPNArr[0].charAt(0)+uWPNArr[1].charAt(0)+uWPNArr[2].charAt(0)}
    else if(uWPNArr.length===0){uWPCode=uWPName.toUpperCase().substring(0,3)}
    else{uWPCode=uWPName.replace(' ','').toUpperCase().substring(0,3)}
  }else{uWPCode=null};
  // Work Areas //////////////////////////////////
  let wpAreas:any[]|null=null;
  if(myO&&myO.Department.length>0){wpAreas=myO.Department}else{const apiRes:any=await qGAPI(uO,'resource/OperationalUnit');if(apiRes.r&&apiRes.d.length>0){wpAreas=apiRes.d}};
  // Helper Fns //////////////////////////////////
  // Gendered Icons
  const gendIco=(eId:string|number):string=>{let defI:string='🧑';if(pplArr!==null&&pplArr&&pplArr.length>0){const matchPArr:any[]=pplArr.filter(p=>Number(p.EmpId)===Number(eId));if(matchPArr&&matchPArr.length>0){const pNVal:number=Number(matchPArr[0].Pronouns);if(pNVal===1||pNVal===2){pNVal===1?defI='👨':defI='👩';return defI}else{return defI}}else{return defI}}else{return defI}};
  // Short Names
  const shortDName=(dName:string):string=>{let matchPObj:any=null;let shortD:string='';
    if(pplArr&&pplArr.length>0){const matchPArr:any[]=pplArr.filter(p=>String(p.DisplayName)===dName);if(matchPArr&&matchPArr.length>0){matchPObj=matchPArr[0]}};
    let shortFName:string='',initialLName:string='';
    const rawDNameArr:string[]=dName.split(' ');
    rawDNameArr&&rawDNameArr.length>0?shortFName=rawDNameArr[0]:shortFName=dName;
    if(rawDNameArr&&rawDNameArr.length>1){initialLName=rawDNameArr[rawDNameArr.length-1].charAt(0)};
    if(pplArr&&matchPObj&&matchPObj.LastName&&matchPObj.LastName!==''&&matchPObj.LastName.length>1){initialLName=matchPObj.LastName.charAt(0)};
    shortD=String(shortFName+' '+initialLName);
    return shortD;
  };
  // Shift Mates
  const getShiftMates=async():Promise<string>=>{
    const tDate:Date=new Date();
    const apiD:string=strFormat(tDate,'yyyy-MM-dd');
    try{
      const getAPRosRes:any=await qGAPI(uO,'supervise/roster/'+apiD);
      if(getAPRosRes.r&&getAPRosRes.d.length>0){
        const dayRosArr:any[]=getAPRosRes.d;
        const mySTUTS:number=Number(evO.StartTime);const myETUTS:number=Number(evO.EndTime);
        let allWMEmpIds:number[]=dayRosArr.map(rO=>rO.Employee);
        allWMEmpIds=allWMEmpIds.filter(eId=>Number(eId)!==Number(uEmpId));
        for(let i=0;i<dayRosArr.length;i++){const tRO:any=dayRosArr[i];
          const wmEmpId:number=Number(tRO.Employee);const wmSTUTS:number=Number(tRO.StartTime);const wmETUTS:number=Number(tRO.EndTime);
          if(wmETUTS<mySTUTS||wmSTUTS>myETUTS){allWMEmpIds=allWMEmpIds.filter(eId=>Number(eId)!==Number(wmEmpId))};
        };
        const todayCoWsIdArr:number[]=allWMEmpIds;
        if(todayCoWsIdArr.length>0){
          let todayCWIcoNameStrArr:string[]=[];
          for(let i=0;i<todayCoWsIdArr.length;i++){const cWId:number=allWMEmpIds[i];
            let cWIcoStr:string='',cWNameStr:string='';
            let cWObj:any|null=null;
            if(pplArr&&pplArr.length>0){const cWArr:any[]=pplArr.filter(pO=>Number(pO.EmpId)===Number(cWId));cWArr&&cWArr.length>0?cWObj=cWArr[0]:cWObj=null}else{cWObj=null};
            if(cWObj!==null){cWIcoStr=gendIco(cWId);cWNameStr=shortDName(String(cWObj.DisplayName))}
            else{cWIcoStr='🧑';cWNameStr='#'+String(cWId)};
            todayCWIcoNameStrArr.push(cWIcoStr+cWNameStr);
          };
          let wMatesStr:string='';const ttlCWINs:number=todayCWIcoNameStrArr.length;
          if(ttlCWINs>3){const trim3CWsArr:string[]=todayCWIcoNameStrArr.slice(0,3);const orsCWNo:number=ttlCWINs-3;wMatesStr+=trim3CWsArr.join(', ')+' ➕ '+String(orsCWNo)+' more'}
          else{wMatesStr=todayCWIcoNameStrArr.join(', ')};
          return Promise.resolve(wMatesStr);
        }else{return Promise.resolve('NIL')};
      }else{return Promise.resolve('NIL')}
    }catch{return Promise.resolve('NIL')}
  };
  // Shift Income Txt
  const getShiftIncome=async():Promise<string>=>{const payRes:any=await getShiftPay(evO);if(payRes){return Promise.resolve('$'+String(Math.round(payRes.t)))}else{return Promise.resolve('$NK')}};
  // Shift Time Span
  const getShiftTSpan=async():Promise<string>=>{
    let seStr:string='',ttStr:string='';
    const sD:Date=dUT(Number(evO.StartTime));
    const eD:Date=dUT(Number(evO.EndTime));
    const sS:string=strFormat(sD,'h:mmaaa');
    const eS:string=strFormat(eD,'h:mmaaa');
    let A2P:boolean|null=null;
    sS.charAt(sS.length-2)===eS.charAt(eS.length-2)?A2P=false:A2P=true;
    if(A2P){seStr=sS+' ➔ '+eS}else{const sA:string[]=sS.split(':');seStr=sA[0]+':'+sA[1].substring(0,2)+' ➔ '+eS};
    let fIncTxt:string='';
    if(showInc){const ttlInc:string=await getShiftIncome();fIncTxt='/'+ttlInc};
    ttStr=String(evO.TotalTime)+'h';
    return Promise.resolve(seStr+' ('+ttStr+fIncTxt+')');
  };
  // Shift B4 Txt
  const b4Txt=(b4m:number):string=>{let fTxt:string='';if(appNoteType==='shift'||appNoteType==='task'||appNoteType==='test'){
    switch(b4m){
        case 30:fTxt='30min';break
        case 60:fTxt='an hour';break
        default:fTxt=String(b4m/60)+'hrs';
      };return fTxt;
    }else{fTxt=String(b4m)+'min';return fTxt}
  };
  // Roster Area Name
  const gRosAreaN=():string|null=>{let fStr:string|null=null;const rosOpUnitId:number=Number(evO.OperationalUnitObject.Id);const rosOpUnitName:string=String(evO.OperationalUnitObject.OperationalUnitName);
    if(rosOpUnitName&&rosOpUnitName!=='null'&&rosOpUnitName!=='undefined'&&rosOpUnitName!==''&&rosOpUnitName!==' '){fStr=rosOpUnitName}else{if(rosOpUnitId&&rosOpUnitId>0){fStr='Area #'+String(rosOpUnitId)}};
    return fStr;
  };
  // Extra Task Data
  const gTaskD=():any=>{const tO:any=evO;let tDescTxt:string=String(tO.Question);
    if(tDescTxt.length>30){tDescTxt=tDescTxt.substring(0,30)+'...'};
    const createD:Date=dUT(Number(tO.OrigDayTimestamp));let cDayStr:string='';if(isSD(new Date(),createD)){cDayStr='Today'}else{isYD(createD)?cDayStr='Tomorrow':cDayStr=strFormat(createD,'d MMM')};
    const createDTStr:string=cDayStr+' at '+strFormat(createD,'h:mmaaa');
    const dueD:Date=dUT(Number(tO.DueTimestamp));let dDayStr:string='';if(isSD(new Date(),dueD)){dDayStr='Today'}else{isTM(dueD)?dDayStr='Tomorrow':dDayStr=strFormat(dueD,'d MMM')};
    const dueDTStr:string=dDayStr+' at '+strFormat(dueD,'h:mmaaa');
    const aPerO:any=tO._DPMetaData.UserEntryInfo;
    let assPerTxt:string='';if(Number(aPerO.Id)===Number(uEmpId)){assPerTxt='You'}else{assPerTxt=gendIco(Number(aPerO.Id))+shortDName(String(aPerO.DisplayName))};
    const gTaskObj={id:Number(tO.Id),desc:tDescTxt,created:{d:createD,str:createDTStr},due:{d:dueD,str:dueDTStr},assigned:assPerTxt};
    return gTaskObj
  };
  //////////////////////////////////////////////////
  let finalMsgObject:any={};
  // Chars Max: Title=65, Body=240, Ideal Line=47
  //////////////////////////////////////////////////
  // 'shift':{title:'Shift Reminder',subTitle:'𝘜𝘱𝘤𝘰𝘮𝘪𝘯𝘨 𝘚𝘩𝘪𝘧𝘵',action:'Your shift at' ,ico:'📅'}
  // -----------------------------------------------
  // | 𝗦𝗵𝗶𝗳𝘁 𝗥𝗲𝗺𝗶𝗻𝗱𝗲𝗿 (𝗗𝗢𝗚) | 𝙐𝙥𝙘𝙤𝙢𝙞𝙣𝙜 𝙎𝙝𝙞𝙛𝙩         
  // | 📅 Your shift at DOG (Bar) starts in 60 mins 
  // | • ꜰʀᴏᴍ: 5:30 ᴛᴏ 11:30pm Today (6h/$192)     
  // | • ᴡɪᴛʜ: Ben C, Rubie O, Liam S & 3 more     
  // | • ɪᴅ: Roster #7744
  // -----------------------------------------------
  if(nT==='shift'){
    let jCode:string='',wCodeTitle:string='',wCodeArea:string='';
    const evOCode:string=String(evO.OperationalUnitObject.CompanyCode).toUpperCase();
    if(evOCode&&evOCode!==''&&evOCode.length===3){jCode=evOCode;wCodeTitle='('+evOCode+') '}else if(uWPCode){jCode=uWPCode;wCodeTitle='('+uWPCode+') '}else{jCode='';wCodeTitle=''};
    const fB4T:string=b4Txt(b4m);
    const wAreaT:string|null=gRosAreaN();
    let addAreaBodyL:boolean|null=null;
    if(wAreaT===null){addAreaBodyL=false}
    else{const xtraChars:number=fB4T.length+wAreaT.length;
      if(xtraChars<13){wCodeArea=jCode+' ('+wAreaT+')';addAreaBodyL=false}
      else{addAreaBodyL=true}
    };
    const sTSpan:string=await getShiftTSpan();
    const sCWLine:string=await getShiftMates();
    //----------------------------------------------
    let fMsgO:any={
      fTitle: 'Shift Reminder '+wCodeTitle+'| Upcoming Shift',
       fBody: '📅 Your shift at '+wCodeArea+' starts in '+b4Txt(b4m)
    };
    fMsgO.fBody+='\n • ᴛɪᴍᴇ: '+sTSpan;
    if(addAreaBodyL){fMsgO.fBody+='\n • ᴀʀᴇᴀ: '+wAreaT};
    fMsgO.fBody+='\n • ᴡɪᴛʜ: '+sCWLine;
    fMsgO.fBody+='\n • ɪᴅ: Roster #'+String(evO.Id);
    finalMsgObject=fMsgO;
  };
  //////////////////////////////////////////////////
  // 'tsheet-on':{title:'Timesheet Warning',subTitle:'𝘓𝘢𝘵𝘦 𝘚𝘵𝘢𝘳𝘵',action:'You failed to clock-on',ico:'😟'}
  // -----------------------------------------------
  // | 𝗧𝗶𝗺𝗲𝘀𝗵𝗲𝗲𝘁 𝗪𝗮𝗿𝗻𝗶𝗻𝗴 (𝗗𝗢𝗚) | 𝙇𝙖𝙩𝙚 𝙎𝙩𝙖𝙧𝙩
  // | 😟 You failed to clock-on - 15 mins ago
  // | • ꜱʜɪꜰᴛ: Roster #6969 | ꜱᴛᴀʀᴛᴇᴅ: 5:30pm
  // | • ᴡɪᴛʜ: Ben C, Ruby O, Liam S & 3 more     
  // -----------------------------------------------
  if(nT==='tsheeton'){
    let jCode:string='',wCodeTitle:string='';
    const evOCode:string=String(evO.OperationalUnitObject.CompanyCode).toUpperCase();
    if(evOCode&&evOCode!==''&&evOCode.length===3){jCode=evOCode;wCodeTitle='('+evOCode+') '}else if(uWPCode){jCode=uWPCode;wCodeTitle='('+uWPCode+') '}else{jCode='';wCodeTitle=''};
    const wAreaT:string|null=gRosAreaN();
    const startD:Date=dUT(Number(evO.StartTime));
    const startStr:string=strFormat(startD,'h:mmaaa');
    const sCWLine:string=await getShiftMates();
    //----------------------------------------------
    let fMsgO:any={
      fTitle: 'Timesheet Warning '+wCodeTitle+'| Late Start',
       fBody: '😟 You failed to clock-on - '+b4Txt(b4m)+' ago'
    };
    fMsgO.fBody+='\n • ꜱʜɪꜰᴛ: Roster #'+String(evO.Id)+' | ꜱᴛᴀʀᴛᴇᴅ: '+startStr
    if(wAreaT!==null){fMsgO.fBody+='\n • ᴀʀᴇᴀ: '+wAreaT};
    fMsgO.fBody+='\n • ᴡɪᴛʜ: '+sCWLine;
    finalMsgObject=fMsgO;
  };
  //////////////////////////////////////////////////
  // 'tsheet-off':{title:'Timesheet Warning',subTitle:'𝘓𝘢𝘵𝘦 𝘍𝘪𝘯𝘪𝘴𝘩',action:'You failed to clock-off',ico:'😕'}
  // -----------------------------------------------
  // | 𝗧𝗶𝗺𝗲𝘀𝗵𝗲𝗲𝘁 𝗪𝗮𝗿𝗻𝗶𝗻𝗴 (𝗗𝗢𝗚) | 𝙇𝙖𝙩𝙚 𝙁𝙞𝙣𝙞𝙨𝙝
  // | 😕 You failed to clock-off - 15 mins ago
  // | • ꜱʜɪꜰᴛ: Roster #6969 | ᴇɴᴅᴇᴅ: 11:00pm
  // | • ᴡɪᴛʜ: Ben C, Ruby O, Liam S & 3 more     
  // -----------------------------------------------
  if(nT==='tsheetoff'){
    let jCode:string='',wCodeTitle:string='';
    const evOCode:string=String(evO.OperationalUnitObject.CompanyCode).toUpperCase();
    if(evOCode&&evOCode!==''&&evOCode.length===3){jCode=evOCode;wCodeTitle='('+evOCode+') '}else if(uWPCode){jCode=uWPCode;wCodeTitle='('+uWPCode+') '}else{jCode='';wCodeTitle=''};
    const wAreaT:string|null=gRosAreaN();
    const endD:Date=dUT(Number(evO.EndTime));
    const endStr:string=strFormat(endD,'h:mmaaa');
    const sCWLine:string=await getShiftMates();
    let fMsgO:any={
      fTitle: 'Timesheet Warning '+wCodeTitle+'| Late Finish', 
       fBody: '😕 You failed to clock-off - '+b4Txt(b4m)+' ago'
    };
    fMsgO.fBody+='\n • ꜱʜɪꜰᴛ: Roster #'+String(evO.Id)+' | ᴇɴᴅᴇᴅ: '+endStr;
    if(wAreaT!==null){fMsgO.fBody+='\n • ᴀʀᴇᴀ: '+wAreaT};
    fMsgO.fBody+='\n • ᴡɪᴛʜ: '+sCWLine;
    finalMsgObject=fMsgO;
  };
  //////////////////////////////////////////////////
  // 'task':{title:'Task Reminder',subTitle:'𝘗𝘦𝘯𝘥𝘪𝘯𝘨 𝘛𝘢𝘴𝘬',action:'Task #',ico:'📑'}
  // -----------------------------------------------
  // | 𝗧𝗮𝘀𝗸 𝗥𝗲𝗺𝗶𝗻𝗱𝗲𝗿 (𝗗𝗢𝗚) | 𝙋𝙚𝙣𝙙𝙞𝙣𝙜 𝙏𝙖𝙨𝙠 
  // | 📑 Task #66 is due in 2 hours
  // | • ᴅᴜᴇ: Today at 3:30pm - You
  // | • ꜱᴇᴛ: 12 Jan at 11:12pm - 🧑Ben C
  // | • ᴅᴇꜱᴄ: Wash down all hard surfaces and...
  // -----------------------------------------------
  //////////////////////////////////////////////////
  if(appNoteType==='task'){
    let jCode:string='',wCodeTitle:string='';
    const evOCode:string=String(evO.OperationalUnitObject.CompanyCode).toUpperCase();
    if(evOCode&&evOCode!==''&&evOCode.length===3){jCode=evOCode;wCodeTitle='('+evOCode+') '}else if(uWPCode){jCode=uWPCode;wCodeTitle='('+uWPCode+') '}else{jCode='';wCodeTitle=''};
    const tDO:any=gTaskD();
    let fMsgO:any={
      fTitle: 'Task Reminder '+wCodeTitle+'| Pending Task',
       fBody: '📑 Task #'+tDO.id+' is due in '+b4Txt(b4m)
    };
    fMsgO.fBody+='\n • ᴅᴜᴇ: '+tDO.due.str+' - You';
    fMsgO.fBody+='\n • ꜱᴇᴛ: '+tDO.created.str+' - '+tDO.assigned;
    fMsgO.fBody+='\n • ᴅᴏ: '+tDO.desc;
    finalMsgObject=fMsgO;
  };
  //////////////////////////////////////////////////
  //'test':{title:'Test Notification',subTitle:'𝘛𝘦𝘴𝘵 𝘈𝘭𝘦𝘳𝘵',action:'Event #',ico:'🧪'}
  // -----------------------------------------------
  // | 𝗧𝗲𝘀𝘁 𝗡𝗼𝘁𝗶𝗳𝗶𝗰𝗮𝘁𝗶𝗼𝗻 | 𝙏𝙚𝙨𝙩 𝘼𝙡𝙚𝙧𝙩
  // | 🧪 Event #1234 is due in 30min
  // | • ᴇᴠᴇɴᴛ: Today at 5:00pm
  // | • ʙᴇꜰᴏʀᴇ: 45min | ɪɴᴄᴏᴍᴇ: 
  // | • ᴍꜱɢ: Arbitrary text for test here
  // -----------------------------------------------
  //////////////////////////////////////////////////
  if(appNoteType==='test'){
    const tO:any=evO;
    const td:Date=new Date();
    const testEventTime:Date=tO.EventTime;
    let tEvDay:string='';if(isSD(td,testEventTime)){tEvDay='Today'}else{isTM(testEventTime)?tEvDay='Tomorrow':tEvDay=strFormat(testEventTime,'d MMM')};
    const tEvTime:string=strFormat(testEventTime,'h:mmaaa');
    const tEvTxt:string=tEvDay+' at '+tEvTime;
    let incOnOff:string='';showInc?incOnOff='ON':incOnOff='OFF';
    let fMsgO:any={
      fTitle: 'Test Notification | 𝘛𝘦𝘴𝘵 𝘈𝘭𝘦𝘳𝘵',
       fBody: '🧪 Event '+tO.dpOId+' is due in '+b4Txt(b4m)
    };
    fMsgO.fBody+='\n • ᴇᴠᴇɴᴛ: '+tEvTxt;
    fMsgO.fBody+='\n • ʙᴇꜰᴏʀᴇ: '+b4Txt(b4m)+' | ɪɴᴄᴏᴍᴇ: '+incOnOff;
    fMsgO.fBody+='\n • ᴍꜱɢ: '+tO.Message;
    finalMsgObject=fMsgO;
  };
  //////////////////////////////////////////////////
  if(pushOn){await sendMyMsg(uO.fcm_token,finalMsgObject.fTitle,finalMsgObject.fBody,null,null,'ic_stat_sheriffnote','#FF9800','sheriffnote.wav',null,'sheriff-alerts',null,null,null,null,null,null)};
  if(mailOn){
    let subjectTime:string='';
    if(appNoteType.includes('tsheet')){subjectTime=' | '+b4Txt(b4m)+' ago'}else{subjectTime=' | in '+b4Txt(b4m)};
    await sendEmailMsg(uEmail,finalMsgObject.fTitle+subjectTime,finalMsgObject.fBody)
  };
  return Promise.resolve(true);
  //////////////////////////////////////////////////
}
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////