//////////////////////////////////////////////////
///// IMPORTS ////////////////////////////////////
//////////////////////////////////////////////////
import {logger} from '../logger';
import {dbQ,allSQLUTable,dbGetUD} from './sqldb-helper-fns';
import {qGAPI} from './dpapi-helper-fns';
import {isA,nowNice,ttlTime} from './timedate-fns';
import {promises as fs} from 'fs';
import {consFn,myDiff,isValidJSON} from '../helpers';
import {publish} from '../services/events';
import {appNotifCheckTask} from './app-notif-sched';
import nodeSchedule=require('node-schedule');
import {doCancelNotifJob} from './cron-jobs-sched';
const probe=require('probe-image-size');
const imageDownload=require('image-download');
const imageType=require('image-type');
import _ from 'lodash';
//////////////////////////////////////////////////
///// GVARS/GFNS /////////////////////////////////
//////////////////////////////////////////////////
let dpSyncUDConsCount:any={count:<number>0,init:<boolean>true};
//////////////////////////////////////////////////
export async function getAPIUserData(u:any):Promise<any>{
  const uDKs:string[]=['me','my','colleagues','rosters','timesheets','tasks','memos'];let apiDObs:any[]=[];
  for(let i=0;i<uDKs.length;i++){
    let EP:string='';if(uDKs[i]!=='me'&&uDKs[i]!=='my'){EP='my/'+uDKs[i]}else{uDKs[i]==='me'?EP='me':EP='my/setup'};
    const udReqRes:any=await qGAPI(u,EP);
    if(udReqRes.r){apiDObs.push({name:uDKs[i],result:true,data:udReqRes.d})}
    else{apiDObs.push({name:uDKs[i],result:false,data:''})}
  };
  return Promise.resolve({result:true,data:apiDObs});
};
//////////////////////////////////////////////////
export async function getDBUData(u:any,colName:string):Promise<any>{
  try{
    const dbDataRes:any=await dbQ('SELECT `'+colName+'` FROM `user_data` WHERE `email` = "'+u.email+'"',null)
    if(dbDataRes.r&&dbDataRes.d&&dbDataRes.d.length&&dbDataRes.d[0][colName]!==null&&String(dbDataRes.d[0][colName]).toLowerCase()!==null&&isValidJSON(dbDataRes.d[0][colName])){const parsedDO:any=JSON.parse(dbDataRes.d[0][colName]);return Promise.resolve({result:true,data:parsedDO})}
    else{return Promise.resolve({result:true,data:[]})}
  }catch(gDBUDErr){logger.info('[getDBUData|ERROR]: '+JSON.stringify(gDBUDErr));return Promise.resolve({result:false,data:JSON.stringify(gDBUDErr)})}
};
//////////////////////////////////////////////////
export async function setDBUData(u:any,colName:string,newDObj:any):Promise<any>{
  let newData:string='';typeof newDObj!=='string'?newData=JSON.stringify(newDObj):newData=newDObj;
  let newValO:any={};newValO[colName]=newData;
  try{const dbDataRes:any=await dbQ('UPDATE `user_data` SET ? WHERE `email` = ?',[newValO,u.email]);
  if(dbDataRes.r){
    if(dpSyncUDConsCount.count===30||dpSyncUDConsCount.init){consFn('d','userdata','ok','UPDATED user_data > '+colName,dbDataRes.d.msg+' = 🛠️ '+u.email)};
    return Promise.resolve({result:true});
  }else{consFn('d','user','err','Failed to UPDATE user_data > '+colName,dbDataRes.d);return Promise.resolve({result:false})};
}catch(sDBUDErr){logger.info('[setDBUData|ERROR]: '+JSON.stringify(sDBUDErr));return Promise.resolve({result:false,data:JSON.stringify(sDBUDErr)})}
}
//////////////////////////////////////////////////
const imgCons=(u:any,eid:string,url:string|null,r:string,a:string,e:string|null)=>{let eStr:string='';e!==null?eStr=' | '+e:eStr='';let uStr:string='';if(url!==null){uStr=' - webURL: '+url};let rStr:string='';r!=='s'?rStr='(🔴 FAIL): '+uStr+eStr:rStr='(🟢 SUCCESS)';let aStr:string='';if(a==='d'){aStr='[DELETE]'}else{a==='u'?aStr='[UPDATE]':aStr='[ADD]'};return logger.info(nowNice()+' - '+u.email+' - (🖼️ ColleagueImg) '+aStr+' Img for Colleague #'+eid+' '+rStr)};
const sameImg=async(u:any,dir:string,fname:string,imgURL:string):Promise<boolean>=>{
  const localFN:any=await hasImg(u,dir,fname);
  if(localFN.result){
    const localFData:any=await fs.readFile('./userFiles/'+u.email+'/images/'+dir+'/'+localFN.data);
    const localFInfo:any=await probe.sync(localFData);
    const webFInfo:any=await probe(imgURL);
    const isDiff:any=await myDiff(localFInfo,webFInfo);
    if(Object.keys(isDiff).length>0){return Promise.resolve(false)}else{return Promise.resolve(true)};
  }else{return Promise.resolve(false)}
};
// -----------------------------------------------
const hasImg=async(u:any,dir:string,fname:string):Promise<any>=>{
  const imgDirL:string[]=await fs.readdir('./userFiles/'+u.email+'/images/'+dir);
  const matchIStr=imgDirL.filter(i=>i.includes(fname+'.'));
  if(matchIStr.length>0){return Promise.resolve({result:true,data:matchIStr[0]})}
  else{return Promise.resolve({result:false})}
};
// -----------------------------------------------
const delImg=async(u:any,dir:string,fname:string):Promise<boolean>=>{
  const hIRes:any=await hasImg(u,dir,fname);
  if(hIRes.result){
    try{
      await fs.unlink('./userFiles/'+u.email+'/images/'+dir+'/'+hIRes.data);
      imgCons(u,fname,null,'s','d',null);
      return Promise.resolve(true);
    }catch(e){imgCons(u,fname,null,'e','d',JSON.stringify(e));return Promise.resolve(false)}
  }else{imgCons(u,fname,null,'s','d',null);return Promise.resolve(true)}
};
// -----------------------------------------------
const addImg=async(u:any,dir:string,fname:string,imgURL:string):Promise<boolean>=>{
  try{const{buffer,type}=await imageDownload.withType(imgURL);
    await fs.writeFile('./userFiles/'+u.email+'/images/'+dir+'/'+fname+'.'+type.ext,buffer);
    imgCons(u,fname,imgURL,'s','a',null);
    return Promise.resolve(true);
  }catch(e){imgCons(u,fname,imgURL,'e','a',JSON.stringify(e));return Promise.resolve(false)}
};
// -----------------------------------------------
const updImg=async(u:any,dir:string,fname:string,imgURL:string):Promise<boolean>=>{
  const doDel:boolean=await delImg(u,dir,fname);
  if(doDel){
    try{const{buffer,type}=await imageDownload.withType(imgURL);
      await fs.writeFile('./userFiles/'+u.email+'/images/'+dir+'/'+fname+'.'+type.ext,buffer);
      imgCons(u,fname,imgURL,'s','u',null);
      return Promise.resolve(true)
    }catch(e){imgCons(u,fname,imgURL,'e','u',JSON.stringify(e));return Promise.resolve(false)}
  }else{imgCons(u,fname,imgURL,'e','u',null);return Promise.resolve(false)}
};
//////////////////////////////////////////////////
export async function compareAPIvDBObjs(email:string,oldDBStrOs:any,allNewAPIOs:any[]):Promise<boolean>{
  const udKeys:string[]=['rosters','timesheets','tasks'];
  let oDBParsedOs:any[]=[],nAPIOs:any[]=[];
  for(let i=0;i<udKeys.length;i++){const kN:string=udKeys[i];
    if(oldDBStrOs[kN]&&isValidJSON(oldDBStrOs[kN])){
      const oDBOA:any=JSON.parse(oldDBStrOs[kN]);
      if(Array.isArray(oDBOA)){oDBParsedOs.push({name:kN,result:true,data:oDBOA})}
      else{oDBParsedOs.push({name:kN,result:false,data:null})};
    }else{oDBParsedOs.push({name:kN,result:false,data:null})};
    const matchAPIOArr:any[]=allNewAPIOs.filter(aO=>aO.name===kN);
    if(matchAPIOArr.length>0){nAPIOs.push(matchAPIOArr[0])};
  };
  //----------------------------------------------
  let modNotifs:boolean=false;
  let ttlObjCountsArr:string[]=[];
  for(let i=0;i<udKeys.length;i++){const kN:string=udKeys[i];
    let dbOArr:any[]=[],dbONo:number=0;
    if(oDBParsedOs[i]['result']){dbOArr=oDBParsedOs[i].data;dbONo=dbOArr.length};
    let apiOArr:any[]=[],apiONo:number=0;
    if(nAPIOs[i]['result']){apiOArr=nAPIOs[i].data;apiONo=apiOArr.length};
    ttlObjCountsArr.push(kN.toUpperCase()+': '+dbONo+'|'+apiONo);
    if(kN==='timesheets'){
      if(apiONo>dbONo){ // NEW TS ADDED
        const oldTSOIds:number[]=dbOArr.map(o=>Number(o.Id));
        const newTSOsArr:any[]=apiOArr.filter(nO=>!oldTSOIds.includes(Number(nO.Id)));
        if(newTSOsArr.length>0){
          for(let i=0;i<newTSOsArr.length;i++){
            const newTSO:any=newTSOsArr[i];
            if(String(newTSO.IsInProgress).toLowerCase()==='true'){
              const matchRosId:number=Number(newTSO.Id);
              await doCancelNotifJob(email,'tsheeton',matchRosId);
              modNotifs=true;
              logger.info(nowNice()+' - '+email+' - ( + ⚱️) [udata-sched|compareAPIvDBObjs] - TSHEET PROG START - Cancelling NotifJob tsheeton'+matchRosId);
            }
          }
        }
      }else if(apiONo===dbONo){ // SAME NO TS
        const prevDBTSO:any=_.sortBy(dbOArr,'Id');const latestAPITSO:any=_.sortBy(apiOArr,'Id');
        const isTSOInProg=(tsO:any):boolean=>{if(String(tsO.IsInProgress).toLowerCase()==='false'){return false}else{return true}};
        if(Number(prevDBTSO.Id)===Number(latestAPITSO.Id)){
          if(isTSOInProg(prevDBTSO)&&!isTSOInProg(latestAPITSO)){
            const matchRosId:number=Number(latestAPITSO.Id);
            await doCancelNotifJob(email,'tsheetoff',matchRosId);
            modNotifs=true;
            logger.info(nowNice()+' - '+email+' - ( = ⚱️) [udata-sched|compareAPIvDBObjs] - TSHEET PROG STOP - Cancelling NotifJob tsheetoff'+matchRosId);
          }
        }
      }else if(apiONo<dbONo){ // TS REM/DEL
        const newTSOIds:number[]=apiOArr.map(o=>Number(o.Id));
        const remTSOsArr:any[]=dbOArr.filter(rO=>!newTSOIds.includes(Number(rO.Id)));
        if(remTSOsArr.length>0){
          for(let i=0;i<remTSOsArr.length;i++){
            const remTSO:any=remTSOsArr[i];
            const matchRosId:number=Number(remTSO.Id);
            await doCancelNotifJob(email,'tsheeton',matchRosId);
            await doCancelNotifJob(email,'tsheetoff',matchRosId);
            modNotifs=true;
            logger.info(nowNice()+' - '+email+' - ( - ⚱️) [udata-sched|compareAPIvDBObjs] - REM/DEL TSHEETS - Check Cancel for TSHEET NotifJobs tsheeton'+matchRosId+'/tsheetoff'+matchRosId);
          }
        }
      }
    }else{
      if(dbONo!==apiONo){
        if(apiONo>dbONo){ // SHIFT|TASK ADDED
          logger.info(nowNice()+' - '+email+' - ( + ⚱️) [udata-sched|compareAPIvDBObjs] - (+) ADDED '+kN.toUpperCase()+' - Running NotifCheck');
          await appNotifCheckTask(email,false);
          modNotifs=true;
        }else{ // SHIFT|TASK REM/DEL
          let typeT:'shift'|'task'='shift';kN==='rosters'?typeT='shift':typeT='task';
          const newOIds:number[]=apiOArr.map(o=>Number(o.Id));
          const remOsArr:any[]=dbOArr.filter(rO=>!newOIds.includes(Number(rO.Id)));
          if(remOsArr.length>0){
            for(let i=0;i<remOsArr.length;i++){
              const remO:any=remOsArr[i];
              const matchEvId:number=Number(remO.Id);
              await doCancelNotifJob(email,typeT,matchEvId);
              modNotifs=true;
              logger.info(nowNice()+' - '+email+' - ( - ⚱️) [udata-sched|compareAPIvDBObjs] - REM/DEL '+kN.toUpperCase()+' - Check Cancel for '+matchEvId);
            }
          }
        }
      }
    };
  };
  let updI:string='';modNotifs?updI='🟢 ':updI='';
  if(!modNotifs){if(dpSyncUDConsCount.count===30||dpSyncUDConsCount.init){logger.info(nowNice()+' - '+email+' - [Function|dpSyncUserDataTask] (📋 DBAPIUDCounts): ✔️ NO CHANGES')}}
  else{logger.info(nowNice()+' - '+email+' - (Compare ⚱️) [udata-sched|compareAPIvDBObjs] - Total Items (DB|API) - '+ttlObjCountsArr.join(', ')+' - modNotifs? '+updI+String(modNotifs).toUpperCase())};
  return Promise.resolve(true);
};
//////////////////////////////////////////////////
export async function dpSyncUserDataTask():Promise<boolean> {
  let uDOK:number=0;let uDErr:number=0;const fnST:Date=new Date();
  const sqlAllUsers:any[]=await allSQLUTable('users');
  if(sqlAllUsers.length>0){
    for(let i=0;i<sqlAllUsers.length;i++){
      const tU:any=sqlAllUsers[i];
      const getAPIUDRes:any=await getAPIUserData(tU);
      const getUExistDBUDRowRes:any=await dbGetUD(tU.email,null);
      if(getUExistDBUDRowRes.result){await compareAPIvDBObjs(tU.email,getUExistDBUDRowRes.data,getAPIUDRes.data)};
      for(let i=0;i<getAPIUDRes.data.length;i++){const getAPIUDResO:any=getAPIUDRes.data[i];
        if(getAPIUDResO.result){uDOK++;
          const oResult:boolean=getAPIUDResO.result;
          const oName:string=getAPIUDResO.name;
          const apiOData:any=getAPIUDResO.data;
          if(oResult){
            await setDBUData(tU,oName,apiOData);
            const getDBUDRes:any=await getDBUData(tU,oName);
            if(getDBUDRes.result){ 
              const dbOData:any=getDBUDRes.data;
               // Update DBO=APIO
              if(oName==='me'){const isSameIRes:boolean=await sameImg(tU,'core','me',String(apiOData.UserObjectForAPI.Photo));
                if(!isSameIRes){const hasIRes:any=await hasImg(tU,'core','me');
                  if(hasIRes.result){await updImg(tU,'core','me',String(apiOData.UserObjectForAPI.Photo))}
                  else{await addImg(tU,'core','me',String(apiOData.UserObjectForAPI.Photo))}
                }
              };
              if(oName==='my'){const isSameIRes:boolean=await sameImg(tU,'core','work',String(apiOData.PortfolioLogoUrl));
                if(!isSameIRes){const hasIRes:any=await hasImg(tU,'core','work');
                  if(hasIRes.result){await updImg(tU,'core','work',String(apiOData.PortfolioLogoUrl))}
                  else{await addImg(tU,'core','work',String(apiOData.PortfolioLogoUrl))}
                }
              };
              if(oName==='colleagues'){ // Add/Remove Person Check
                let apiEmpIds:string[]=[];for(let i=0;i<apiOData.length;i++){apiEmpIds.push(String(apiOData[i].EmpId))};
                let dbEmpIds:string[]=[];for(let i=0;i<dbOData.length;i++){dbEmpIds.push(String(dbOData[i].EmpId))};
                let addEmpIds:string[]=apiEmpIds.filter(eid=>!dbEmpIds.includes(eid));
                let remEmpIds:string[]=dbEmpIds.filter(eid=>!apiEmpIds.includes(eid));
                if(addEmpIds.length>0){ // Add Missing Ppl Imgs
                  for(let i=0;i<addEmpIds.length;i++){
                    const eIdStr:string=addEmpIds[i];const imgUrl:string=apiOData.filter((pO:any)=>pO.EmpId.toString()===eIdStr)[0].Photo;
                    const hIRes:any=await hasImg(tU,'colleagues',eIdStr);if(hIRes.result){await updImg(tU,'colleagues',eIdStr,imgUrl)}else{await addImg(tU,'colleagues',eIdStr,imgUrl)}
                  }
                };
                if(remEmpIds.length>0){ // Remove Deprecated Ppl Imgs
                  for(let i=0;i<remEmpIds.length;i++){await delImg(tU,'colleagues',remEmpIds[i])}
                };
                for(let i=0;i<apiOData.length;i++){ // Deep Val Ppl Obj Check
                  const apiPModD:Date=new Date(apiOData[i].Modified);
                  if(dbOData.length>0){
                    const dbMatchPArr:any[]=dbOData.filter((dbPO:any)=>String(dbPO.EmpId)===String(apiOData[i].EmpId));
                    if(dbMatchPArr&&dbMatchPArr.length>0){
                      const dbPO:any=dbMatchPArr[0];
                      const dbPModD:Date=new Date(dbPO.Modified);
                      if(isA(apiPModD,dbPModD)){await updImg(tU,'colleagues',String(apiOData[i].EmpId),String(apiOData[i].Photo))};
                    }
                  }
                };
              };
            }else{uDErr++}
          }else{uDErr++};
        }else{uDErr++}
      }
    };
    if(dpSyncUDConsCount.init){publish('authDataChecks',true)};
    dpSyncUDConsCount.count=dpSyncUDConsCount.count+1;
    if(uDErr===0){
      if(dpSyncUDConsCount.count===30||dpSyncUDConsCount.init){
        logger.info(nowNice()+' - '+ttlTime(fnST)+' - [Function|dpSyncUserDataTask]  ( 📋 USERDATA ): ✔️ ALL OK');
        dpSyncUDConsCount.count===30?dpSyncUDConsCount.count=0:dpSyncUDConsCount.init=false;
      }
    }else{logger.info(nowNice()+' - '+ttlTime(fnST)+' - [Function|dpSyncUserDataTask] 🧑 USER DATA:'+sqlAllUsers.length+', ✔️ OK:'+uDOK+', ❌ Error: '+uDErr)};
    return Promise.resolve(true);
  }else{return Promise.resolve(true)}
} 
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////