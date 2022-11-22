//////////////////////////////////////////////////
///// IMPORTS ////////////////////////////////////
//////////////////////////////////////////////////
import {logger} from '../logger';
import {dbQ,allSQLUTable,dbGetUD,dbGetUO} from './sqldb-helper-fns';
import {addMins,subMins,nowNice,ttlTime,dUT,subSecs} from './timedate-fns';
import {isBefore} from 'date-fns';
import {consFn} from '../helpers';
import {checkNotifSchedJobs} from './cron-jobs-sched';
import {qGAPI, qPAPI} from './dpapi-helper-fns';
import nodeSchedule=require('node-schedule');
import _ from 'lodash';
export type UserNotifCheckItem={userObj:any,notifCat:string,eventObj:any,b4Mins:number,showInc:boolean,pushMsgOn:boolean,mailMsgOn:boolean}
//////////////////////////////////////////////////
let appNotifCheckTaskCount:any={count:<number>0,init:<boolean>true};
//////////////////////////////////////////////////
export async function appNotifCheckTask(uEmail:string|null,isQO:boolean):Promise<any> {
  const fnST:Date=new Date();
  let tDate:Date=new Date();
  let pushMsgOn:boolean=true;
  let mailMsgOn:boolean=false;
  let evShift:any={on:false,b4m:0},evTask:any={on:false,b4m:0},evTS:any={on:false,b4m:0};
  let showInc:boolean=true;
  let thisUserO:any|null=null;
  let uMeO:any|null=null;
  let uEmpId:any|null=null;
  //==================================================
  const uHasSett=async():Promise<boolean>=>{const gDBURes:any=await dbQ('SELECT app_prefs FROM `users` WHERE `email` = "'+thisUserO.email+'"',null);if(gDBURes.r&&gDBURes.d&&gDBURes.d.length>0){if(Number(gDBURes.d[0]['app_prefs'])===1){return Promise.resolve(true)}else{return Promise.resolve(false)}}else{return Promise.resolve(false)}};
  //==================================================
  const getSetts=async():Promise<boolean>=>{
    const dbD:any=(await dbQ('SELECT settings FROM `settings` WHERE `email` = "'+thisUserO.email+'"',null));
    if(dbD.r&&dbD.d&&dbD.d.length>0&&dbD.d[0].settings){
      const uSO:any=JSON.parse(dbD.d[0].settings);const uSOAOs:any=uSO.alerts.options;
      const aMethods:any=uSOAOs.alertMethods.value;const aEvents:any=uSOAOs.alertEvents.value;const aBefore:any=uSOAOs.alertBefore.value;
      pushMsgOn=Boolean(aMethods.phone);
      mailMsgOn=Boolean(aMethods.email);
      showInc=uSO.payrates.options.show.value;
      evShift.on=Boolean(aEvents.shift);
      evShift.b4m=Number(aBefore.shift.mins);
      evTask.on=aEvents.task;
      evTask.b4m=Number(aBefore.task.mins);
      evTS.on=aEvents.tsheet;
      evTS.b4m=Number(aBefore.tsheet.mins);
      return Promise.resolve(true)
    }else{return Promise.resolve(false)}
  };
  //==================================================
  const getUMeObj=async():Promise<boolean>=>{
    async function getAPIMeO():Promise<boolean>{const{r,d}:any=await qGAPI(thisUserO,'me');if(r&&d){uMeO=d;uEmpId=Number(d.EmployeeId);return Promise.resolve(true)}else{return Promise.resolve(true)}};
    async function getDBMeO():Promise<boolean>{const{r,d}=await dbGetUD(thisUserO.email,'me');if(r&&d){uMeO=d;uEmpId=Number(d.EmployeeId);return Promise.resolve(true)}else{return Promise.resolve(false)}};
    const gAMORes:boolean=await getAPIMeO();if(gAMORes){return Promise.resolve(true)}else{const gDMORes:boolean=await getDBMeO();if(gDMORes){return Promise.resolve(true)}else{return Promise.resolve(false)}}
  };
  //==================================================
  const getURosArr=async():Promise<any>=>{
    async function getAPIRosArr():Promise<any>{const{r,d}:any=await qGAPI(thisUserO,'my/rosters');if(r){return Promise.resolve({result:r,data:d})}else{return Promise.resolve({result:false,data:null})}};
    async function getDBRosArr():Promise<any>{const{r,d}=await dbGetUD(thisUserO.email,'rosters');if(r){return Promise.resolve({result:r,data:d})}else{return Promise.resolve({result:false,data:null})}};
    const gARARes:any=await getAPIRosArr();if(gARARes.result){return Promise.resolve({result:true,data:gARARes.data})}else{const gDRARes:any=await getDBRosArr();if(gDRARes.result){return Promise.resolve({result:true,data:gDRARes.data})}else{return Promise.resolve({result:false})}}
  };
  //==================================================
  const getUTasksArr=async():Promise<any>=>{
    async function getAPITasksArr():Promise<any>{const{r,d}:any=await qGAPI(thisUserO,'resource/Task');if(r){return Promise.resolve({result:r,data:d})}else{return Promise.resolve({result:false,data:null})}}; 
    async function getDBTasksArr():Promise<any>{const{r,d}=await dbGetUD(thisUserO.email,'tasks');if(r){return Promise.resolve({result:r,data:d})}else{return Promise.resolve({result:false,data:null})}};
    const gATARes:any=await getAPITasksArr();if(gATARes.result){return Promise.resolve({result:true,data:gATARes.data})}else{const gDTARes:any=await getDBTasksArr();if(gDTARes.result){return Promise.resolve({result:true,data:gDTARes.data})}else{return Promise.resolve({result:false})}}
  };
  //==================================================
  const rosHasFutureAs=(rosO:any):boolean=>{
    let hasFAs:boolean=false,alertDs:Date[]=[];
    const rosST:Date=dUT(Number(rosO.StartTime));const rosET:Date=dUT(Number(rosO.EndTime));
    if(evShift.on){const shiftA:Date=subMins(rosST,evShift.b4m);alertDs.push(shiftA)};
    if(evTS.on){const tsOnA:Date=addMins(rosST,evTS.b4m);alertDs.push(tsOnA);const tsOnCA:Date=subSecs(tsOnA,30);alertDs.push(tsOnCA);const tsOffA:Date=addMins(rosET,evTS.b4m);alertDs.push(tsOffA);const tsOffCA:Date=subSecs(tsOffA,30);alertDs.push(tsOffCA)};
    for(let i=0;i<alertDs.length;i++){if(isBefore(tDate,alertDs[i])){hasFAs=true}};return hasFAs;
  };
   //==================================================
  const taskHasFutureAs=(taskO:any):boolean=>{
    if(evTask.on){const taskDT:Date=dUT(Number(taskO.DueTimestamp));const taskA:Date=subMins(taskDT,evTask.b4m);if(isBefore(tDate,taskA)){return true}else{return false}}else{return false}};
  //==================================================
  const alertIsFuture=(eO:any,cat:string,aB4M:number):boolean=>{
    const nowD:Date=new Date();let alertD:Date=new Date();
    if(cat==='shift'||cat==='tsheeton'){const shiftS:number=Number(eO.StartTime);const shiftSD:Date=dUT(shiftS);cat==='shift'?alertD=subMins(shiftSD,aB4M):alertD=addMins(shiftSD,aB4M)}
    else if(cat==='tsheetoff'){const shiftE:number=Number(eO.EndTime);const shiftED:Date=dUT(shiftE);alertD=addMins(shiftED,aB4M)}
    else if(cat==='task'){const taskDT:number=Number(eO.DueTimestamp);const taskDD:Date=dUT(taskDT);alertD=subMins(taskDD,aB4M)};
    if(isBefore(nowD,alertD)){return true}else{return false};
  }
  //==================================================
  let sqlAllUsers:any[]=[],isQOnly:boolean=false,qRes:string='';
  if(uEmail!==null){
    if(isQO){isQOnly=true;const{result,data}=await dbGetUO(uEmail);if(result){sqlAllUsers.push(data)}}
    else{isQOnly=false;sqlAllUsers=(await allSQLUTable('users')).filter(uO=>uO.email===uEmail)}
  }else{isQOnly=false;sqlAllUsers=await allSQLUTable('users')};
  let uHasRosters:boolean=false,uHasTasks:boolean=false;
  let uncOK:number=0,uncErr:number=0;
  if(sqlAllUsers.length>0){
    for(let i=0;i<sqlAllUsers.length;i++){
      let allUNCs:any=[];
      const tU:any=sqlAllUsers[i];thisUserO=tU;tDate=new Date();
      const hasSRes:boolean=await uHasSett();const getSRes:boolean=await getSetts();const getUMeRes:boolean=await getUMeObj();
      if(hasSRes&&getSRes&&getUMeRes){
        if((pushMsgOn||mailMsgOn)&&(evShift.on||evTS.on||evTask.on)){
          const gRosARes:any=await getURosArr();gRosARes.result&&gRosARes.data&&gRosARes.data.length>0?uHasRosters=true:uHasRosters=false;
          // TEST
          /* const gTRRes:any=getTestR();
          gRosARes.data.push(gTRRes); */
          // TEST
          const gTasksARes:any=await getUTasksArr();gTasksARes.result&&gTasksARes.data&&gTasksARes.data.length>0?uHasTasks=true:uHasTasks=false;
          if(uHasRosters||uHasTasks){
            let uRosA:any[]=[];for(let i=0;i<gRosARes.data.length;i++){const rO:any=gRosARes.data[i];if(rosHasFutureAs(rO)){uRosA.push(rO)}};
            uRosA.length>0?uHasRosters=true:uHasRosters=false;
            let uTasksA:any[]=[];for(let i=0;i<gTasksARes.data.length;i++){const tO:any=gTasksARes.data[i];if(taskHasFutureAs(tO)){uTasksA.push(tO)}};
            uTasksA.length>0?uHasTasks=true:uHasTasks=false;
            if(uHasRosters||uHasTasks){
              for(let i=0;i<uRosA.length;i++){const uRO:any=uRosA[i];
                if(evShift.on){
                  if(alertIsFuture(uRO,'shift',Number(evShift.b4m))){
                    allUNCs.push({userObj:thisUserO,notifCat:'shift',eventObj:uRO,b4Mins:Number(evShift.b4m),showInc:showInc,pushMsgOn:pushMsgOn,mailMsgOn:mailMsgOn})
                  }
                };
                if(evTS.on){
                  if(alertIsFuture(uRO,'tsheeton',Number(evTS.b4m))){ 
                    allUNCs.push({userObj:thisUserO,notifCat:'tsheeton',eventObj:uRO,b4Mins:Number(evTS.b4m),showInc:showInc,pushMsgOn:pushMsgOn,mailMsgOn:mailMsgOn})
                  };
                  if(alertIsFuture(uRO,'tsheetoff',Number(evTS.b4m))){
                    allUNCs.push({userObj:thisUserO,notifCat:'tsheetoff',eventObj:uRO,b4Mins:Number(evTS.b4m),showInc:showInc,pushMsgOn:pushMsgOn,mailMsgOn:mailMsgOn})
                  };
                }
              };
              if(evTask.on){
                for(let i=0;i<uTasksA.length;i++){const uTO:any=uTasksA[i];
                  if(alertIsFuture(uTO,'task',Number(evTask.b4m))){
                    allUNCs.push({userObj:thisUserO,notifCat:'task',eventObj:uTO,b4Mins:Number(evTask.b4m),showInc:showInc,pushMsgOn:pushMsgOn,mailMsgOn:mailMsgOn})
                  }
                };
              };
              ////////////////////////////////////////////////
              if(allUNCs.length>0){
                const cNSJRes:any=await checkNotifSchedJobs(allUNCs,isQOnly);
                if(isQOnly){qRes=cNSJRes}else{if(cNSJRes){uncOK++}else{uncErr++;consFn('notifsched','notifsched','err',tU.email,String(allUNCs.length)+' NotifJobs')}}
              };
              ////////////////////////////////////////////////
            }else{uncOK++;logger.info('[appNotifSched|appNotifCheckTask] No Roster/Task Objs with Future Alerts - Done')}
          }else{uncOK++;logger.info('[appNotifSched|appNotifCheckTask] ERROR|0 Roster && Task Objects Found - Aborted')}
        }else{uncOK++;logger.info('[appNotifSched|appNotifCheckTask] Phone & Email Methods = BOTH OFF || Shift, Timesheet & Task Events = ALL OFF - Aborted')}
      }else{uncErr++;logger.info('[appNotifSched|appNotifCheckTask] Failed to get User meObj|Data|Settings from API &/| DB - Aborted')};
    };
    if(!isQOnly){
      appNotifCheckTaskCount.count++;
      if(uncErr===0){
        if(appNotifCheckTaskCount.count===12||appNotifCheckTaskCount.init){
          logger.info(nowNice()+' - '+ttlTime(fnST)+' - [Function|appNotifCheckTask] ( 📋 NOTIFCHECK ): ✔️ ALL OK');
          appNotifCheckTaskCount.count===12?appNotifCheckTaskCount.count=0:appNotifCheckTaskCount.init=false;
        }
      }else{logger.info(nowNice()+' - '+ttlTime(fnST)+' - [Function|appNotifCheckTask] 🧑🔔👓 ( 📋 SUMMARY ): ✔️ OK:'+uncOK+', ❌ Error:'+uncErr+' | 🎫 TOTAL:'+sqlAllUsers.length)};
      return Promise.resolve(true);
    }else{return Promise.resolve(qRes)}
  }else{logger.info('[appNotifSched|appNotifCheckTask] No SQL Users Found - Aborted');return Promise.resolve(true)}
}
//////////////////////////////////////////////////
export async function checkTSheetCancelJob(uEmail:string,cancelJobId:string):Promise<boolean>{
  let tsAlertJob:nodeSchedule.Job|null=null,freshUserO:any|null=null,freshMeO:any|null=null,freshEmpId:number|null=null,onOff:string|null=null;
  const cjIdArr:string[]=cancelJobId.split('_');
  const rosId:number=Number(cjIdArr[1]);
  onOff=cjIdArr[0].replace('tsheet','');
  //----------------------------------------------
  const getMeObj=async():Promise<boolean>=>{try{const gAPIMeORes:any=await qGAPI(freshUserO,'me');if(gAPIMeORes.r&&gAPIMeORes.d){freshMeO=gAPIMeORes.d;freshEmpId=Number(gAPIMeORes.d.EmployeeId);return Promise.resolve(true)}else{return Promise.resolve(false)}}catch{return Promise.resolve(false)}};
  //----------------------------------------------
  const didStartRos=async():Promise<any>=>{
    async function checkAPIRos():Promise<any>{
      try{const apiRosRes:any=await qGAPI(freshUserO,'supervise/roster/'+String(rosId));
        if(apiRosRes.r&&!_.isEmpty(apiRosRes.d)&&apiRosRes.d.hasOwnProperty('MatchedByTimesheet')&&apiRosRes.d.MatchedByTimesheet&&Number(apiRosRes.d.MatchedByTimesheet)>0){return Promise.resolve({result:true,docancel:true})}else{return Promise.resolve({result:true,docancel:false})}
      }catch{return Promise.resolve({result:false})}
    };
    async function checkAPIByTS():Promise<any>{
      try{const tsArrRes:any=await qPAPI(freshUserO,'resource/Timesheet/QUERY',{search:{s1:{field:'Employee',type:'eq',data:freshEmpId}},sort:{Modified:'desc'},max:1});
        if(tsArrRes.r&&tsArrRes.d.length>0&&tsArrRes.d[0].Roster&&Number(tsArrRes.d[0].Roster)>0&&Number(tsArrRes.d[0].Roster)===Number(rosId)){return Promise.resolve({result:true,didstart:true})}else{return Promise.resolve({result:true,didstart:false})}
      }catch{return Promise.resolve({result:false})}
    };
    function checkInProgRos():any{if(freshMeO!==null){if(freshMeO.hasOwnProperty('InProgressTS')&&freshMeO.InProgressTS&&typeof freshMeO.InProgressTS==='object'&&freshMeO.InProgressTS.hasOwnProperty('Roster')&&freshMeO.InProgressTS.Roster&&Number(freshMeO.InProgressTS.Roster)>0&&Number(freshMeO.InProgressTS.Roster)===rosId){return {result:true,docancel:true}}else{return {result:true,docancel:false}}}else{return {result:false}}};
    const checkAPIRosRes:any=await checkAPIRos();
    if(checkAPIRosRes.result){return Promise.resolve(checkAPIRosRes)}
    else{const checkAPIByTSRes:any=await checkAPIByTS();
      if(checkAPIByTSRes.result){return Promise.resolve(checkAPIByTSRes)}
      else{const checkInProgRosRes:any=checkInProgRos();
        if(checkInProgRosRes.result){return Promise.resolve(checkInProgRosRes)}
        else{return Promise.resolve({result:false})}
      }
    }   
  }
  //----------------------------------------------------
  const didStopRos=async():Promise<any>=>{
    function meObjTSInProg():any{if(freshMeO!==null){if(freshMeO.hasOwnProperty('InProgressTS')&&freshMeO.InProgressTS&&typeof freshMeO.InProgressTS==='object'&&freshMeO.InProgressTS.hasOwnProperty('Roster')&&freshMeO.InProgressTS.Roster&&Number(freshMeO.InProgressTS.Roster)>0&&Number(freshMeO.InProgressTS.Roster)===rosId){return {result:true,docancel:false}}else{return {result:true,docancel:true}}}else{return {result:false}}};
    async function apiGetMatchTS():Promise<any>{
      try{const apiRosRes:any=await qGAPI(freshUserO,'supervise/roster/'+String(rosId));
        if(apiRosRes.r&&!_.isEmpty(apiRosRes.d)&&apiRosRes.d.hasOwnProperty('MatchedByTimesheet')&&apiRosRes.d.MatchedByTimesheet&&Number(apiRosRes.d.MatchedByTimesheet)>0){return Promise.resolve({result:true,tsId:Number(apiRosRes.d.MatchedByTimesheet)})}else{return Promise.resolve({result:false})}
      }catch{return Promise.resolve({result:false})}
    };
    async function apiGetTSInProg(tsId:number):Promise<any>{
      try{const tsArrRes:any=await qPAPI(freshUserO,'resource/Timesheet/QUERY',{search:{s1:{field:'Id',type:'eq',data:Number(tsId)}},sort:{Modified:'desc'},max:1});
        if(tsArrRes.r&&tsArrRes.d.length>0){const tfResStr:string=tsArrRes.d[0].IsInProgress.toString().toLowerCase();if(tfResStr==='false'){return Promise.resolve({result:true,docancel:true})}else if(tfResStr==='true'){return Promise.resolve({result:true,docancel:false})}else{return Promise.resolve({result:false})}}else{return Promise.resolve({result:false})}
      }catch{return Promise.resolve({result:false})}};
    const meObjIPRes:any=meObjTSInProg();
    if(meObjIPRes.result){return Promise.resolve(meObjIPRes)}
    else{const gAMatchTSRes:any=await apiGetMatchTS();
      if(gAMatchTSRes.result){
        const aGTSIPRes:any=await apiGetTSInProg(gAMatchTSRes.tsId);
        if(aGTSIPRes.result){return Promise.resolve(aGTSIPRes)}
        else{return Promise.resolve({result:false})}
      }else{return Promise.resolve({result:false})}
    }
  }
  //----------------------------------------------------
  const nCancCons=(r:string,m:string)=>{let rT:string='';if(r==='okc'){rT='🟢 CANCELLED'}else if(r==='oknc'){rT='🟠 NOT CANCELLED'}else{rT='❌ CANCEL ERROR'};logger.info(nowNice()+' - 🕰️👓 [app-notif-sched|checkTSheetCancelJob]  - '+uEmail+' -  ( '+rT+' ): '+m)};
  //----------------------------------------------------
  const cjId:string=cancelJobId;const tsjId:string=cjId.replace('_c','');
  if(nodeSchedule.scheduledJobs.hasOwnProperty(tsjId)&&nodeSchedule.scheduledJobs[tsjId]){
    tsAlertJob=nodeSchedule.scheduledJobs[tsjId]
    const getUserORes:any=await dbGetUO(uEmail);
    if(getUserORes.result){
      freshUserO=getUserORes.data;
      const getMeORes:boolean=await getMeObj();
      if(getMeORes){
        let doCancelRes:any={};
        if(onOff==='on'){doCancelRes=await didStartRos()}else{doCancelRes=await didStopRos()};
        if(doCancelRes.result){
          if(doCancelRes.docancel){
            const cancRes:boolean=tsAlertJob.cancel(false);
            nCancCons('okc','Clock-['+onOff.toUpperCase()+'] for Roster Id #'+rosId+' [WAS] Detected > Cancelled? = '+String(cancRes).toUpperCase());
            return Promise.resolve(true)
          }else{nCancCons('oknc','Clock-['+onOff.toUpperCase()+'] for Roster Id #'+rosId+' [WAS NOT] Detected > Not Cancelled');return Promise.resolve(true)}
        }else{nCancCons('e','Error Confirming If User Clocked ['+onOff.toUpperCase()+'] for RosterId #'+rosId);return Promise.resolve(false)}
      }else{nCancCons('e','Failed to Retrieve Fresh meObj from API');return Promise.resolve(false)}
    }else{nCancCons('e','Failed to Retrieve Fresh User Object from SQDB');return Promise.resolve(false)};
  }else{nCancCons('e','nodeSchedule List !include '+tsjId+' - Nothing to Cancel');return Promise.resolve(false)}
}
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////