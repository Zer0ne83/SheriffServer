//////////////////////////////////////////////////
///// IMPORTS
//////////////////////////////////////////////////
import {strFormat,dUT,nowNice,durToNow,addMins,subMins,subSecs} from './timedate-fns';
import {logger} from '../logger';
import nodeSchedule=require('node-schedule');
import {sendAppNotifMsg} from './pushmsg-fns';
import {dbGetSchedNotifJob,dbGetAllNotifLists,dbMatchSchedNotifJob,dbSetNotifList,dbGetUO} from './sqldb-helper-fns';
import {checkTSheetCancelJob} from './app-notif-sched';
import {doDPAPIRefresh} from './dpapi-helper-fns';
import _ from 'lodash';
//////////////////////////////////////////////////
export let jobs:any[]=[];
export type NotifJDMatchData={jobId:string,dpId:number,cat:string,catList:any[],jdObj:any};
export type NotifJDMatchResult={result:boolean,data:NotifJDMatchData|null};
export type NotifJobTCData={userO:any,eventObj:any,b4m:number,showInc:boolean,pushOn:boolean,mailOn:boolean};
export type NotifJob={id:string,tt:Date,tcData:NotifJobTCData};
export type NotifJ2JDI={name:string,cat:string,dpId:string};
export type UserNotifCheckItem={
  userObj:any,
  notifCat:string,
  eventObj:any,
  b4Mins:number,
  showInc:boolean,
  pushMsgOn:boolean,
  mailMsgOn:boolean
};
export type UserNotifRow={
  id:number,
  email:string,
  shift:NotifJob[],
  tsheeton:NotifJob[],
  tsheetoff:NotifJob[],
  task:NotifJob[],
  memo:NotifJob[],
  snoop:NotifJob[],
  sheriff:NotifJob[],
  test:NotifJob[]
};
//////////////////////////////////////////////////
export function job2JDInfo(job:nodeSchedule.Job|string):NotifJ2JDI{
  let jobKey:string='';typeof job==='string'?jobKey=job:jobKey=String(job.name);
  const jNA:string[]=String(jobKey).split('_');
  return {name:jobKey,cat:jNA[0],dpId:jNA[1]};
}
//////////////////////////////////////////////////
export function isJSched(job:nodeSchedule.Job|string):Promise<boolean>{
  const sJLO:any=nodeSchedule.scheduledJobs;
  if(_.isEmpty(sJLO)){return Promise.resolve(false)}
  else{
    let jobKey:string='';if(typeof job==='string'){jobKey=job}else{jobKey=job.name};
    if(Object.keys(sJLO).includes(jobKey)){return Promise.resolve(true)}else{return Promise.resolve(false)}
  }
}
//////////////////////////////////////////////////
export async function matchJob2DBJD(email:string,job:nodeSchedule.Job|string):Promise<NotifJDMatchResult> {
  let jobKey:string='';typeof job==='string'?jobKey=job:jobKey=String(job.name);
  const jdIRes:NotifJ2JDI=job2JDInfo(jobKey);
  const dbMatchRes:any=await dbMatchSchedNotifJob(email,jdIRes.cat,jdIRes.name);
  if(dbMatchRes.result&&dbMatchRes.data!==null){
    const mList:any[]=dbMatchRes.data.list;
    let mJob:any|null=null;dbMatchRes.data.job!==null?mJob=dbMatchRes.data.job:mJob=null;
    const mJData:NotifJDMatchData={jobId:jdIRes.name,dpId:Number(jdIRes.dpId),cat:jdIRes.cat,catList:mList,jdObj:mJob};
    return Promise.resolve({result:true,data:mJData});
  }else{return Promise.resolve({result:false,data:null})}
}
//////////////////////////////////////////////////
export async function remJobData(email:string,job:nodeSchedule.Job|string):Promise<boolean> {
  let jobN:string='';typeof job==='string'?jobN=job:jobN=job.name;
  const rJDErr=()=>{logger.info(nowNice()+' - ➕🕰️ [Cron|REM|JobData] - '+email+' - ( ❌ ERROR ): JobId '+jobN+' REM FAILED')};
  const rJDWarn=()=>{logger.info(nowNice()+' - ➕🕰️ [Cron|REM|JobData] - '+email+' - ( 🟠 WARN ): JobId '+jobN+' SKIP NOT FOUND')};
  const dbMatchRes:NotifJDMatchResult=await matchJob2DBJD(email,job);
  if(dbMatchRes.result&&dbMatchRes.data!==null){
    let existList:any[]=dbMatchRes.data.catList;
    const trimList:any[]=existList.filter(jdO=>String(jdO.id)!==jobN);
    const remJDRes:boolean=await dbSetNotifList(email,dbMatchRes.data.cat,trimList);
    if(remJDRes){return Promise.resolve(true)}
    else{rJDErr();return Promise.resolve(false)}
  }else{rJDWarn();return Promise.resolve(true)}
}
//////////////////////////////////////////////////
export async function addJobData(email:string,job:nodeSchedule.Job,dataO:NotifJob):Promise<boolean> {
  const aJDErr=()=>{logger.info(nowNice()+' - ➕🕰️ [Cron|ADD|JobData] - '+email+' - ( ❌ ERROR ): JobId '+job.name+' ADD FAILED')};
  const aJDWarn=()=>{logger.info(nowNice()+' - ➕🕰️ [Cron|ADD|JobData] - '+email+' - ( 🟠 WARN ): JobId '+job.name+' SKIP EXISTS')};
  const jdIRes:NotifJ2JDI=job2JDInfo(job);
  const dbMRes:NotifJDMatchResult=await matchJob2DBJD(email,job);
  if(dbMRes.result){
    if(dbMRes.data!==null&&dbMRes.data.hasOwnProperty('jdObj')&&dbMRes.data.jdObj!==null){aJDWarn();return Promise.resolve(true)}
    else{
      let updArr:any[]=[];if(dbMRes.data!==null){updArr=dbMRes.data.catList;updArr.push(dataO)}else{updArr.push(dataO)};
      const dbSRes:boolean=await dbSetNotifList(email,jdIRes.cat,updArr);
      if(dbSRes){return Promise.resolve(true)}else{aJDErr();return Promise.resolve(false)}
    }
  }else{aJDErr();return Promise.resolve(false)}
}
//////////////////////////////////////////////////
export async function addJobListener(email:string,job:nodeSchedule.Job):Promise<boolean> {
  const aJLJN:string=String(job.name);let CCJ:boolean=false;const jobNArr:string[]=aJLJN.split('_');jobNArr.length>2?CCJ=true:CCJ=false;
  try{
    const existJLs:any[]=job.eventNames();
    if(!existJLs.includes('canceled')){
      job.on('canceled',async()=>{
        const canceledE:string=email;const canceledJ:nodeSchedule.Job=job;const isCCJ:boolean=CCJ;
        logger.info(nowNice()+' - 🕰️👂 [Cron|JobListeners] EVENT for '+canceledE+' > ( 🛑 CANCELED ) - NotifJob: '+canceledJ.name);
        if(!isCCJ){await remJobData(canceledE,canceledJ)};
        await remJobListeners(canceledE,canceledJ);
      });
    };
    if(!existJLs.includes('error')){
      job.on('error',async()=>{
        const errorE:string=email;const errorJ:nodeSchedule.Job=job;const isCCJ:boolean=CCJ;
        logger.info(nowNice()+' - 🕰️👂 [Cron|JobListeners] EVENT for '+errorE+' > ( ❌ ERROR ) - NotifJob: '+errorJ.name);
        const isSchedRes:boolean=await isJSched(errorJ);
        if(isSchedRes){errorJ.cancel()};
        if(!isCCJ){await remJobData(errorE,errorJ)};
        await remJobListeners(errorE,errorJ);
      });
    };
    if(!existJLs.includes('success')){
      job.on('success',async()=>{
        const successE:string=email;const successJ:nodeSchedule.Job=job;const isCCJ:boolean=CCJ;
        logger.info(nowNice()+' - 🕰️👂 [Cron|JobListeners] EVENT for '+successE+' > ( 🟢 SUCCESS ) - NotifJob: '+successJ.name);
        if(!isCCJ){await remJobData(successE,successJ)};
        await remJobListeners(successE,successJ);
      }); 
    };
    return Promise.resolve(true);
  }catch{logger.info(nowNice()+' - ➕👂 [Cron|ADD|JobListen] - '+email+' - ( ❌ ERROR ): JobId '+job.name+' ADD FAILED');return Promise.resolve(false)}
  
}
//////////////////////////////////////////////////
export async function remJobListeners(email:string,job:nodeSchedule.Job):Promise<boolean>{
  if(job.eventNames().length>0){
    try{job.removeAllListeners();return Promise.resolve(true)}
    catch{logger.info(nowNice()+' - ➕👂 [Cron|ADD|JobListen] - '+email+' - ( ❌ ERROR ): JobId '+job.name+' ADD FAILED');return Promise.resolve(false)}
  }else{return Promise.resolve(true)};
}
//////////////////////////////////////////////////
export async function checkNotifSchedJobs(cNSJs:UserNotifCheckItem[],isQO:boolean):Promise<any> {
  //////////////////////////////////////////////////
  const uEmail:string=cNSJs[0].userObj.email;
  let allIds:string[]=[],allNSJOs:UserNotifCheckItem[]=[],hasErrs:boolean=false,errArr:any[]=[],okArr:any[]=[];
  for(let i=0;i<cNSJs.length;i++){
    const jId:string=cNSJs[i].notifCat+'_'+String(cNSJs[i].eventObj.Id);
    allIds.push(jId);
    allNSJOs.push(cNSJs[i]);
    if(cNSJs[i].notifCat.includes('tsheet')){allIds.push(jId+'_c');allNSJOs.push(cNSJs[i])}
  };
  //////////////////////////////////////////////////
  for(let i=0;i<cNSJs.length;i++){
    const nsjO:UserNotifCheckItem=cNSJs[i];
    const cUserO:any=nsjO.userObj;
    const cEventObj:any=nsjO.eventObj;
    const cEventCat:string=nsjO.notifCat; 
    const cB4m:number=nsjO.b4Mins;
    const cShowInc:boolean=nsjO.showInc;
    const cPushMsgOn:boolean=nsjO.pushMsgOn;
    const cMailMsgOn:boolean=nsjO.mailMsgOn;
    //////////////////////////////////////////////////
    const paramsCheck=():any=>{
      const vCatsArr:string[]=['shift','tsheeton','tsheetoff','task'];
      if(cUserO&&typeof cUserO==='object'&&cUserO.hasOwnProperty('email')&&cUserO.email){
        if(vCatsArr.includes(cEventCat)){
          if(cEventObj&&typeof cEventObj==='object'&&cEventObj.hasOwnProperty('Id')&&cEventObj.Id){
            if(cB4m&&typeof cB4m==='number'){
              if(typeof cShowInc==='boolean'){return {r:true}}
              else{return {r:false,d:'Missing/Invalid showInc Param or Type (boolean)'}}
            }else{ return {r:false,d:'Missing/Invalid b4m Param or Type (number)'}}
          }else{return {r:false,d:'Missing/Invalid EventObject|event.Id Pty'}}
        }else{return {r:false,d:'Missing/Invalid Event Category (shift,tsheet-on,tsheet-off,task)'}};
      }else{return {r:false,d:'Missing/Invalid UserObject|user.email Pty'}}
    };
    const genTT=async():Promise<Date>=>{
      let fTT:Date=new Date();
      if(cEventCat==='shift'){const evT:Date=dUT(Number(cEventObj.StartTime));fTT=subMins(evT,cB4m)}
      else if(cEventCat==='tsheeton'){const evT:Date=dUT(Number(cEventObj.StartTime));fTT=addMins(evT,cB4m)}
      else if(cEventCat==='tsheetoff'){const evT:Date=dUT(Number(cEventObj.EndTime));fTT=addMins(evT,cB4m)}
      else if(cEventCat==='task'){const evT:Date=dUT(Number(cEventObj.DueTimestamp));fTT=subMins(evT,cB4m)};
      return Promise.resolve(fTT);
    };
    //--------------------------------
    let checkNAJObj:NotifJob={id:cEventCat+'_'+String(cEventObj.Id),tt:new Date(),tcData:{userO:{},eventObj:{},b4m:0,showInc:false,pushOn:false,mailOn:false}};
    // Valid Params Check
    const pCRes:any=paramsCheck();
    if(pCRes.r){
      const email:string=cUserO.email;
      checkNAJObj.tcData.userO=cUserO;
      checkNAJObj.tcData.eventObj=cEventObj;
      checkNAJObj.tcData.b4m=cB4m;
      checkNAJObj.tcData.showInc=cShowInc;
      checkNAJObj.tcData.pushOn=cPushMsgOn;
      checkNAJObj.tcData.mailOn=cMailMsgOn;
      checkNAJObj.id=cEventCat+'_'+String(cEventObj.Id);
      checkNAJObj.tt=await genTT();
      // Check Cron & DB for Existing Job
      const cronJExists:boolean=(await isJSched(checkNAJObj.id));
      let isCCJob:boolean=false,ccjId:string='',ccjExists:boolean=false;
      if(cEventCat.includes('tsheet')){isCCJob=true;ccjId=String(checkNAJObj.id)+'_c';ccjExists=(await isJSched(ccjId))}else{isCCJob=false};
      let dbJExists:boolean|null=null;const checkDBRes:any=await dbGetSchedNotifJob(cUserO.email,cEventCat,checkNAJObj.id);
      if(!checkDBRes.result){hasErrs=true;errArr.push({id:checkNAJObj.id,err:'Error Retrieving List from user_notif table'})}
      else{checkDBRes.data!==null?dbJExists=true:dbJExists=false};
      let wasF:boolean=false;
      if(!cronJExists){
        if(dbJExists!==null&&dbJExists===true){const rJDRes:boolean=await remJobData(email,checkNAJObj.id);
          if(rJDRes){wasF=true}else{hasErrs=true;errArr.push({id:checkNAJObj.id,err:'Error Removing Existing JobData from DB'})}
        };
        if(isCCJob&&ccjExists){const cancCCJRes:any=nodeSchedule.cancelJob(ccjId);if(cancCCJRes){wasF=true}
        else{hasErrs=true;errArr.push({id:checkNAJObj.id,err:'Error Cancelling Existing TSHEET CancelJob'})}};
        const addRes:any=await addNotifyJobFn(cEventCat,checkNAJObj);
        if(addRes.result){
          let isAorF:string='';wasF?isAorF=' (F✓)':isAorF=' (+A)';
          const tt:string=strFormat(checkNAJObj.tt,'EEEE, d MMM h:mm:ssaa');
          const okTxt:string=isAorF+' - TA: '+tt;
          okArr.push({id:checkNAJObj.id,ok:okTxt});
          if(isCCJob){
            const cTT:Date=subSecs(checkNAJObj.tt,30);
            const cTTStr:string=strFormat(cTT,'EEEE, d MMM h:mm:ssaa');
            const cOkTxt:string=isAorF+' - CA: '+cTTStr;
            okArr.push({id:String(checkNAJObj.id)+'_c',ok:cOkTxt});
          }
        }else{hasErrs=true;errArr.push({id:checkNAJObj.id,err:addRes.data.join(', ')})}
      }else{
        if(isCCJob&&!ccjExists){
          const addCNJRes:any=await addNotifCancelJobFn(checkNAJObj);
          if(!addCNJRes.result){hasErrs=true;errArr.push({id:checkNAJObj.id,err:addCNJRes.data})}
        };
        if(dbJExists!==null&&dbJExists===false){
          const existCJ:nodeSchedule.Job=nodeSchedule.scheduledJobs[checkNAJObj.id];
          const aJDRes:boolean=await addJobData(email,existCJ,checkNAJObj);
          if(!aJDRes){hasErrs=true;errArr.push({id:checkNAJObj.id,err:'Error Adding Missing JobData to DB'})}
        };
      };
    }else{hasErrs=true;errArr.push({id:checkNAJObj.id,err:'Params Check Failed'});console.log(pCRes.d)}
  };
  //////////////////////////////////////////////////
  const finalCons=(r:string)=>{
    const preT:string=nowNice()+' - 👓🕰️ [Cron|CHECK|NotifJs] 🧑 '+uEmail+' - ';
    let rI:string='';r==='s'?rI='(🟢 OK)':rI='(🔴 ERRORS)';
    const rTxt:string=rI+' [ (TTL): '+allIds.length+' | (OK): '+okArr.length+' | (ERR) : '+errArr.length+' ]'; 
    let aTxt:string[]=[];
    if(r='s'){
      logger.info(preT+rTxt);
      for(let i=0;i<okArr.length;i++){
        const nN:number=i+1;let numT:string='';nN>9?numT='('+nN+') ':numT='('+nN+'.) ';
        logger.info(preT+numT+okArr[i].id+okArr[i].ok)
      }
    }else{
      for(let i=0;i<allIds.length;i++){const tId:string=allIds[i]; 
        let jobResArr:string[]=[];
        if(okArr&&okArr.length>0){const mOk:any[]=okArr.filter(oI=>oI.id===tId);if(mOk&&mOk.length){jobResArr.push('✔️ '+mOk[0].ok)}};
        if(errArr&&errArr.length>0){const mEr:any[]=errArr.filter(eI=>eI.id===tId);if(mEr&&mEr.length>0){for(let i=0;i<mEr.length;i++){jobResArr.push('❌ '+mEr[i].err)}}};
        aTxt.push('['+tId.toUpperCase()+']: '+jobResArr.join(', '));
      };
      logger.info(preT+rTxt);
      for(let i=0;i<aTxt.length;i++){
        const nN:number=i+1;let numT:string='';i>9?numT='('+nN+'.) ':numT='('+nN+') ';
        logger.info(preT+numT+' - '+aTxt[i])
      }
    }
  };
  if(isQO){
    const genTT=async(qJO:any):Promise<Date>=>{
      const cEventCat:string=qJO.notifCat;const cEventObj:any=qJO.eventObj;const cB4m:number=qJO.b4Mins;let fTT:Date=new Date();
      if(cEventCat==='shift'){const evT:Date=dUT(Number(cEventObj.StartTime));fTT=subMins(evT,cB4m)}
      else if(cEventCat==='tsheeton'){const evT:Date=dUT(Number(cEventObj.StartTime));fTT=addMins(evT,cB4m)}
      else if(cEventCat==='tsheetoff'){const evT:Date=dUT(Number(cEventObj.EndTime));fTT=addMins(evT,cB4m)}
      else if(cEventCat==='task'){const evT:Date=dUT(Number(cEventObj.DueTimestamp));fTT=subMins(evT,cB4m)};
      return Promise.resolve(fTT);
    };
    let qORes:string='';
    const preT:string=nowNice()+' - 👓🕰️ [Cron|CHECK|NotifJs] 🧑 '+uEmail+' - ';
    let rI:string='';if(errArr.length===0){rI='(🟢)'}else{rI='(🔴)'};const rT:string=rI+' [ (TTL): '+allIds.length+' | (OK): '+okArr.length+' | (ERR) : '+errArr.length+' ]';
    qORes+=preT+rT;
    for(let i=0;i<allIds.length;i++){
      const qJId:string=allIds[i];const qJO:any=allNSJOs[i];let isCC:boolean=false;if(qJId.split('_').length>2){isCC=true}else{isCC=false};
      let ttPref:string='';
      const gTTD:Date=await genTT(qJO);
      let qTTD:Date=gTTD;
      if(isCC){ttPref=' - CA: ';qTTD=subSecs(gTTD,30)}else{ttPref=' - TA: ';qTTD=gTTD};
      const qTT:string=ttPref+strFormat(qTTD,'EEEE, d MMM h:mm:ssaa');
      const nN:number=i+1;let numT:string='';nN>9?numT='('+nN+') ':numT='('+nN+'.) ';
      qORes+='\n'+preT+numT+qJId+qTT;
    };
    return Promise.resolve(qORes);
  }else{
    if(!hasErrs&&errArr.length===0){
      if(okArr.length>0){finalCons('s')};return Promise.resolve(true)
    }else{finalCons('e');return Promise.resolve(false)}};
};
//////////////////////////////////////////////////
export async function checkUTRefreshJob(userEmail:string):Promise<boolean> {
  let newExistTxt:string='';
  const schedJList:any=nodeSchedule.scheduledJobs;
  const hasExistJ=(pref:string):Promise<any>=>{
    const matchJP:any[]=Object.keys(schedJList).filter(jN=>jN.includes(pref));
    if(matchJP.length>0){newExistTxt='Rescheduled Existing';return Promise.resolve({result:true,id:matchJP[0]})}
    else{newExistTxt='Scheduled New';return Promise.resolve({result:false})}
  };
  const getDBUserORes:any=await dbGetUO(userEmail);
  if(getDBUserORes.result){
    const tU:any=getDBUserORes.data;const utrPrefix:string='trefresh_u'+String(tU.id)+'_';
    const existTRJRes:any=await hasExistJ(utrPrefix);
    if(existTRJRes.result){schedJList[existTRJRes.data].cancel()};
    const newTRExp:Date=dUT(Number(tU.dp_expires));
    const newTRTT:Date=subMins(newTRExp,5);
    const newTRTTNice:string=strFormat(newTRTT,'d MMM, h:mmaaa');
    const newTRJId:string=String(utrPrefix+tU.dp_expires);
    const newTRJob:nodeSchedule.Job=nodeSchedule.scheduleJob(newTRJId,newTRTT,()=>{doDPAPIRefresh(tU.email,tU.dp_domain,tU.dp_refresh)});
    const existJLs:any[]=newTRJob.eventNames();
    if(!existJLs.includes('cancelled')){
      newTRJob.on('cancelled',()=>{
        const cancJ:nodeSchedule.Job=newTRJob;const cancUE:string=userEmail;const cancJId:string=newTRJob.name;const cancB4TT:string=durToNow(newTRTT);
        logger.info(nowNice()+' - 🕰️👂 [Cron|JobListeners] EVENT for '+cancUE+' > ( 🛑 CANCELLED ) - UserTRefreshJob: '+cancJId+' - '+cancB4TT+' BEFORE EXPIRY');
        if(cancJ.eventNames().length>0){cancJ.removeAllListeners()}
      });
    };
    if(!existJLs.includes('error')){
      newTRJob.on('error',()=>{
        const errJ:nodeSchedule.Job=newTRJob;const errUE:string=userEmail;const errJId:string=newTRJob.name;
        const freshJList:any=nodeSchedule.scheduledJobs;
        if(freshJList.hasOwnProperty(errJId)){errJ.cancel()};
        logger.info(nowNice()+' - 🕰️👂 [Cron|JobListeners] EVENT for '+errUE+' > ( ❌ ERROR ) - UserTRefreshJob: '+errJId);
        if(errJ.eventNames().length>0){errJ.removeAllListeners()}
      });
    };
    if(!existJLs.includes('success')){
      newTRJob.on('success',async()=>{
        const okJ:nodeSchedule.Job=newTRJob;const okUE:string=userEmail;const okJId:string=newTRJob.name;
        logger.info(nowNice()+' - 🕰️👂 [Cron|JobListeners] EVENT for '+okUE+' > ( 🟢 SUCCESS ) - UserTRefreshJob: '+okJId+' - 5min BEFORE EXPIRY');
        if(okJ.eventNames().length>0){okJ.removeAllListeners()}
      });
    };
    logger.info(nowNice()+' - 👓🕰️ [Cron|CHECK|UTRefreshJob] 🧑 '+userEmail+' - ( 🟢 SUCCESS ): '+newExistTxt+' UserTRefreshJob - [TT]: '+newTRTTNice+' (in '+durToNow(newTRTT)+')');
    return Promise.resolve(true);
  }else{
    logger.info(nowNice()+' - 👓🕰️ [Cron|CHECK|UTRefreshJob] 🧑 '+userEmail+' - (❌ ERROR): dbGetUO returned {result:false}');
    return Promise.resolve(false);
  }
}
//////////////////////////////////////////////////
export async function doCancelNotifJob(email:string,jType:'shift'|'task'|'tsheeton'|'tsheetoff',eventId:number):Promise<boolean> {
  let isCJob:boolean|null=null;jType.includes('tsheet')?isCJob=true:isCJob=false;
  const nowCronList:any=nodeSchedule.scheduledJobs;
  const jId:string=jType+'_'+String(eventId);const jcId:string=jType+'_'+String(eventId)+'_c';
  if(nowCronList.hasOwnProperty(jId)||nowCronList.hasOwnProperty(jcId)){
    const hasJ:boolean=nowCronList.hasOwnProperty(jId);const hasCJ:boolean=nowCronList.hasOwnProperty(jcId);let cT:string[]=[];if(hasJ){cT.push(jId)};if(hasCJ){cT.push(jcId)};
    logger.info(nowNice()+' - 👓🕰️ [Cron|doCancelNotifJob] 🧑 '+email+' - ( FOUND/MUST CANCEL ): '+cT.join(','));
    if(isCJob){
      if(nowCronList.hasOwnProperty(jId)){const j=nowCronList[jId];await remJobListeners(email,j);j.cancel();await remJobData(email,j)}
      else{await remJobData(email,jId)};
      if(nowCronList.hasOwnProperty(jcId)){const jc=nowCronList[jcId];await remJobListeners(email,jc);jc.cancel()};
      logger.info(nowNice()+' - 👓🕰️ [Cron|doCancelNotifJob] 🧑 '+email+' - ( 🟢 CANCELLED ): BOTH '+jId+' & '+jcId);
      return Promise.resolve(true);
    }else{
      if(nowCronList.hasOwnProperty(jId)){const j=nowCronList[jId];await remJobListeners(email,j);j.cancel();await remJobData(email,j)}
      else{await remJobData(email,jId)};
      logger.info(nowNice()+' - 👓🕰️ [Cron|doCancelNotifJob] 🧑 '+email+' - ( 🟢 CANCELLED ): '+jId);
      return Promise.resolve(true);
    }
  }else{logger.info(nowNice()+' - 👓🕰️ [Cron|doCancelNotifJob] 🧑 '+email+' - ( NOTHING TO CANCEL ): '+jId+'/'+jcId);return Promise.resolve(true)}
}
//////////////////////////////////////////////////
async function addNotifCancelJobFn(ajO:NotifJob):Promise<any> {
  const cjEmail:string=ajO.tcData.userO.email;
  const ccjId:string=ajO.id+'_c';const ccjTT:Date=subSecs(ajO.tt,30);
  const newNotifCJob:nodeSchedule.Job=nodeSchedule.scheduleJob(ccjId,ccjTT,()=>{checkTSheetCancelJob(cjEmail,ccjId)});
  if(newNotifCJob!==null){
    const addCJListenRes:boolean=await addJobListener(cjEmail,newNotifCJob);
    if(addCJListenRes){return Promise.resolve({result:true})}else{return Promise.resolve({result:false,data:'CancelJobSched: 🟢, CancelJobListener: ❌'})}
  }else{return Promise.resolve({result:false,data:'CancelJobSched: ❌, CancelJobListener: ❌'})}
}
//////////////////////////////////////////////////
async function addNotifyJobFn(notifCat:string,addJobObj:NotifJob):Promise<any> {
  const jEmail:string=addJobObj.tcData.userO.email;const jTT:Date=addJobObj.tt;const jId:string=addJobObj.id;const jEO:any=addJobObj.tcData.eventObj;const jTC:any=addJobObj.tcData;
  let isCCJ:boolean=false;notifCat.includes('tsheet')?isCCJ=true:isCCJ=false;
  const newNotifJob:nodeSchedule.Job=nodeSchedule.scheduleJob(jId,jTT,()=>{sendAppNotifMsg(jEmail,notifCat,jEO,jTC.b4m,jTC.showInc,jTC.pushOn,jTC.mailOn)});
  let ccjRes:any|null=null;
  if(isCCJ){
    const ccjId:string=addJobObj.id+'_c';const ccjTT:Date=subSecs(addJobObj.tt,30);
    const newNotifCJob:nodeSchedule.Job=nodeSchedule.scheduleJob(ccjId,ccjTT,()=>{checkTSheetCancelJob(jEmail,ccjId)});
    if(newNotifCJob!==null){
      const addCJListenRes:boolean=await addJobListener(jEmail,newNotifCJob);
      if(addCJListenRes){ccjRes={result:true}}else{ccjRes={result:false,data:'CancelJobSched: 🟢, CancelJobListener: ❌'}}
    }else{ccjRes={result:false,data:'CancelJobSched: ❌, CancelJobListener: ❌'}}
  };
  const newNJData:NotifJob={id:addJobObj.id,tt:addJobObj.tt,tcData:addJobObj.tcData};
  const addNJDRes:boolean=await addJobData(jEmail,newNotifJob,newNJData);
  const addNJListenRes=await addJobListener(jEmail,newNotifJob);
  const finalRes=():boolean=>{
    if(isCCJ){if(newNotifJob!==null&&addNJDRes&&addNJListenRes&&ccjRes.result){return true}else{return false}}
    else{if(newNotifJob!==null&&addNJDRes&&addNJListenRes){return true}else{return false}}
  };
  if(finalRes()){return Promise.resolve({result:true,data:{id:addJobObj.id,tt:addJobObj.tt}})}
  else{let errArr:string[]=[];
    if(!newNotifJob){errArr.push('JobSched: ❌')}else{errArr.push('JobSched: 🟢')};
    if(!addNJDRes){errArr.push('JobData: ❌')}else{errArr.push('JobData: 🟢')};
    if(!addNJListenRes){errArr.push('JobListener: ❌')}else{errArr.push('JobListener: 🟢')};
    if(isCCJ&&!ccjRes.result){errArr.push(ccjRes.data)};
    return Promise.resolve({result:false,data:errArr})
  }
}
//////////////////////////////////////////////////
export async function getSchedJobs(uEmail:string):Promise<any> {
  const doSTxt=()=>{logger.info(nowNice()+' - 📑🕰️ [Cron|listJobs] --------------------[LIST START]--------------------')};
  const doETxt=()=>{logger.info(nowNice()+' - 📑🕰️ [Cron|listJobs] ---------------------[LIST END]----------------------')};
  const padTxt=()=>{return      nowNice()+'   | '};
  const p2=()=>{return '  '};
  let dbColList:any={
    shift:[],
    tsheeton:[],
    tsheetoff:[],
    task:[],
    memo:[],
    snoop:[],
    sheriff:[]
  };
  let cronColList:any={
    shift:[],
    tsheeton:[],
    tsheetoff:[],
    task:[],
    memo:[],
    snoop:[],
    sheriff:[]
  };
  let catsArr:string[]=['shift','tsheeton','tsheetoff','task','memo','snoop','sheriff'];
  let cronList:any|null=null,dbList:any|null=null,cronCount:number=0,dbCount=0,jobCountsEq:boolean|null=null;
  const dbSJListRes:any=await dbGetAllNotifLists(uEmail);
  if(dbSJListRes.result){
    dbList=dbSJListRes.data;
    for(const[k,v]of Object.entries(dbList)){
      const dbK:string=String(k);const dbV:any=v;
      if(dbV!==null){
        dbColList[dbK]=dbV;
        dbCount+=dbV.length;
      }
    };
  }else{logger.info(nowNice()+' - 📑🕰️ [Cron|getSchedJobs] ERROR: Failed to Retrieve DB Sched Lists');return Promise.resolve({result:false})};
  cronList=nodeSchedule.scheduledJobs;
  cronCount=Object.keys(cronList).length;
  if(cronCount===dbCount){jobCountsEq=true}else{jobCountsEq=false};
  if(cronCount>0){
    for(const[k,v] of Object.entries(cronList)){
      const cV:any=v;
      const cJName:string=cV.name;
      const cJNArr:string[]=cJName.split('_');
      const cJCatStr:string=cJNArr[0];
      if(cJNArr.length===2){
        cronColList[cJCatStr].push(cV)
      }
    };
  }else{doSTxt();logger.info(nowNice()+' - 📑🕰️ [Cron|listJobs] 0/NIL JOBS are SCHEDULED.');doETxt();return Promise.resolve(true)};
  doSTxt();logger.info(padTxt()+'Total Jobs: [CRON] = '+cronCount+', [SQL] = '+dbCount+', EQUAL= '+jobCountsEq);
  for(let i=0;i<catsArr.length;i++){
    const catN:string=catsArr[i];
    const dbArr:any[]=dbColList[catN];
    const cronArr:any[]=cronColList[catN];
    logger.info(padTxt()+catN.toUpperCase()+': '+dbArr.length+'/'+cronArr.length);
    let cronCatItems:string[]=[];for(let i=0;i<cronArr.length;i++){cronCatItems.push(cronArr[i].name)};
    logger.info(padTxt()+p2()+'Cron Jobs: '+cronCatItems.join(', '));
    let dbCatItems:string[]=[];for(let i=0;i<dbArr.length;i++){dbCatItems.push(dbArr[i].id)};
    logger.info(padTxt()+p2()+'DB Jobs: '+dbCatItems.join(', '));
  };
  doETxt();
  return Promise.resolve(true);
}
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////
