//////////////////////////////////////////////////
///// IMPORTS ////////////////////////////////////
//////////////////////////////////////////////////
import {logger} from '../logger';
import {qGAPI,qPAPI} from './dpapi-helper-fns';
import {dbQ,allSQLUTable,dbUSnoop} from './sqldb-helper-fns';
import {strFormat,isB,isA,isSD,addMins,subDs,nowNice,ttlTime} from './timedate-fns';
import {consFn,myDiff} from '../helpers';
import {sendWorkEventMsg} from './pushmsg-fns';
////////////////////////////////////////////////// 
///// GVARS/GFNS /////////////////////////////////
//////////////////////////////////////////////////
let workLogConsCount:any={count:<number>0,init:<boolean>true};
let snoopConsCount:any={count:<number>0,init:<boolean>true};
//////////////////////////////////////////////////
export async function snoopHrs(email:string):Promise<any> {
  const getSHRes:any=await dbUSnoop(email);
  if(getSHRes.result){return Promise.resolve(getSHRes)}
  else{return Promise.resolve({result:false})}
}
//////////////////////////////////////////////////
export async function dpSnoopCheckTask():Promise<boolean> {
  const fnST:Date=new Date();const snoopDAPIStr:string=strFormat(fnST,'yyyy-MM-dd');const snoopDDBStr:string=strFormat(fnST,'yyyyMMdd');
  let scOK:number=0,scErr:number=0;
  const getDayAPISnoopRosArr=async(u:any):Promise<any>=>{
    const gSRORes:any=await qGAPI(u,'supervise/roster/'+snoopDAPIStr);
    if(gSRORes.r){return Promise.resolve({result:true,data:gSRORes.d})}
    else{logger.info('[dpSnoopCheckTask|getNewSnoopRos] ERROR');return Promise.resolve({result:false})}
  };
  const getDayDBSnoopRosArr=async(u:any):Promise<any>=>{
    const uDataArr:any[]=(await dbQ('SELECT * FROM `user_data` WHERE `email` = "'+u.email+'"',null)).d;
    if(uDataArr.length>0){const uDataRow:any=uDataArr[0];
      if(uDataRow.snoop!==null&&uDataRow.snoop!=='null'&&uDataRow.snoop!=='NULL'&&uDataRow.snoop!==undefined&&uDataRow.snoop!=='undefined'&&uDataRow.snoop!=='[object Object]'){
        const snoopDBObj:any=JSON.parse(uDataRow.snoop);
        if(snoopDBObj&&snoopDBObj.hasOwnProperty(String(snoopDDBStr))){
          const todayRosArr:any[]=snoopDBObj[String(snoopDDBStr)];
          return Promise.resolve({result:true,data:todayRosArr,obj:snoopDBObj})
        }else{logger.info(nowNice()+' - WARNING: No Roster Arr Found for Day with Key '+snoopDDBStr);return Promise.resolve({result:false,data:'noDay',obj:snoopDBObj})}
      }else{logger.info(nowNice()+' - WARNING: Snoop Data Obj (col) === null or malformed');return Promise.resolve({result:false,data:'noObj'})}
    }else{logger.info(nowNice()+' - ERROR: No row found for '+u.email+' in "user_data" Table.');return Promise.resolve({result:false,data:'error'})}
  };
  const setDayDBSnoopRosArr=async(u:any,snoopObj:any|null,newDayArr:any[]):Promise<boolean>=>{
    let newSnoopObj:any={};if(snoopObj!==null){newSnoopObj=snoopObj}else{newSnoopObj[String(snoopDDBStr)]=[]};
    newSnoopObj[String(snoopDDBStr)]=newDayArr;
    const newSnoopStr:string=JSON.stringify(newSnoopObj);
    const dbRes:any=await dbQ('UPDATE `user_data` SET ? WHERE `email` = ?',[{snoop:newSnoopStr},u.email]);
    if(dbRes.r){consFn('d','userdata','ok','UPDATED user_data > snoop',dbRes.d.msg+' = 🛠️ '+u.email);return Promise.resolve(true)}
    else{consFn('d','user','err','Failed to UPDATE user_data > snoop',dbRes.d);return Promise.resolve(false)};
  };
  const rosPerArea=(rO:any):string=>{
    let pName:string='',dName:string=rO._DPMetaData.EmployeeInfo.DisplayName,empId:string='Employee #'+String(rO._DPMetaData.EmployeeInfo.Employee);
    if(dName&&dName!==''&&dName.length>1){const dNArr:string[]=dName.split(' ');if(dNArr.length>0){pName=dNArr[0]+' '+dNArr[dNArr.length-1].charAt(0)}else{pName=dName}}else{pName=empId};
    let area:string='',label:string=rO._DPMetaData.OperationalUnitInfo.LabelWithCompany,unit:string=rO._DPMetaData.OperationalUnitInfo.OperationalUnitName;
    if(label&&label!==''&&label.split(' ').length>1){area=' in '+label}else if(unit&&unit!==''&&unit.length>1){area=' in '+unit};pName+=area;
    return pName;
  };
  //----------------------------------------------
  const sqlAllUsers:any[]=await allSQLUTable('users');
  if(sqlAllUsers.length>0){
    for(let i=0;i<sqlAllUsers.length;i++){ const tU:any=sqlAllUsers[i];
      const getDayAPIArr:any=await getDayAPISnoopRosArr(tU);
      if(getDayAPIArr.result){ const apiDayArr:any[]=getDayAPIArr.data;
        const getDayDBArr:any=await getDayDBSnoopRosArr(tU);
        if(getDayDBArr.result){ const dbDayArr:any[]=getDayDBArr.data;const dbSnoopObj:any=getDayDBArr.obj;
          if(dbDayArr.length>0&&dbDayArr!==[]){
            let mustUpdate:boolean=false,newRosIds:number[]=[];
            // Changed - Rosters Added/Removed
            if(apiDayArr.length!==dbDayArr.length){mustUpdate=true;
              const apiIds:number[]=apiDayArr.map(o=>Number(o.Id));const dbIds:number[]=dbDayArr.map(o=>Number(o.Id));
              const addRos:number[]=apiIds.filter(apiId=>!dbIds.includes(apiId));
              if(addRos.length>0){newRosIds=addRos;for(let i=0;i<addRos.length;i++){const addId:number=addRos[i];const addObj:any=apiDayArr.filter(r=>Number(r.Id)===Number(addId))[0];const rosId:string='Roster #'+String(addObj.Id)+' for ';const rosPA:string=rosPerArea(addObj);logger.info(nowNice()+' - ( 🕵🏻 | Rosters ) [+ADDED]: '+rosId+rosPA)}};
              const remRos:number[]=dbIds.filter(dbId=>!apiIds.includes(dbId));
              if(remRos.length>0){for(let i=0;i<remRos.length;i++){const remId:number=remRos[i];const remObj:any=dbDayArr.filter(r=>Number(r.Id)===Number(remId))[0];const rosId:string='Roster #'+String(remObj.Id)+' for ';const rosPA:string=rosPerArea(remObj);logger.info(nowNice()+' - ( 🕵🏻 | Rosters ) [-REMOVED]: '+rosId+rosPA)}};
            };
            // Changed - Rosters Modified
            for(let i=0;i<apiDayArr.length;i++){const apiRO:any=apiDayArr[i];const apiROId:number=Number(apiRO.Id);
              if(!newRosIds.includes(apiROId)){const dbRO:any=dbDayArr.filter(r=>Number(r.Id)===Number(apiRO.Id))[0];
                const dbROMod:string=String(dbRO.Modified);const apiROMod:string=String(apiRO.Modified);
                if(dbROMod!==apiROMod){mustUpdate=true;const diffRosObj:object=await myDiff(apiRO,dbRO);let rosDiffTxtArr:string[]=[];for(const[k,v]of Object.entries(diffRosObj)){rosDiffTxtArr.push(String(k)+'='+String(v))};const rPA:string=rosPerArea(apiRO);logger.info(nowNice()+' - ( 🕵🏻 | Rosters ) [?MODIFIED]: Roster #'+String(apiRO.Id)+' for '+rPA+': '+rosDiffTxtArr.join(', '))}
              }
            };
            if(mustUpdate){if((await setDayDBSnoopRosArr(tU,dbSnoopObj,apiDayArr))){scOK++}else{scErr++}}
            else{scOK++}
          }else{if(apiDayArr.length>0&&apiDayArr!==[]){if((await setDayDBSnoopRosArr(tU,dbSnoopObj,apiDayArr))){scOK++}else{scErr++}}}
        }else{
          if(getDayDBArr.data==='noDay'){if((await setDayDBSnoopRosArr(tU,getDayDBArr.obj,apiDayArr))){scOK++}else{scErr++}}
          else if(getDayDBArr.data==='noObj'){if((await setDayDBSnoopRosArr(tU,null,apiDayArr))){scOK++}else{scErr++}}
          else if(getDayDBArr.data==='error'){scErr++}
        }
      }
    }
  };
  snoopConsCount.count=snoopConsCount.count+1;
  if(scErr===0){
    if(snoopConsCount.count===2||snoopConsCount.init){
      logger.info(nowNice()+' - '+ttlTime(fnST)+' - [Function|dpSnoopCheckTask]  ( 📋 SNOOP ): ✔️ ALL OK');
      snoopConsCount.count===2?snoopConsCount.count=0:snoopConsCount.init=false;
    }
  }else{logger.info(nowNice()+' - '+ttlTime(fnST)+' - [Function|dpSnoopCheckTask] 🕵🏻 SNOOP:'+sqlAllUsers.length+', ✔️ OK:'+scOK+', ❌ Error: '+scErr)};
  return Promise.resolve(true);
}
//////////////////////////////////////////////////
export async function dpWorkEventLogCheckTask():Promise<boolean> {
  const fnST:Date=new Date();let wlOK:number=0,wlErr:number=0;
  const getNewLogArr=async(u:any):Promise<any>=>{
    const gNLParams:any={search:{s1:{field:'UsageType',type:'in',data:[2,10,11,21,22,23,25,26,28]}},sort:{Modified:'desc'},max:500};
    const gNLARes:any=await qPAPI(u,'resource/SystemUsageTracking/QUERY',gNLParams);
    if(gNLARes.r){return Promise.resolve({result:true,data:gNLARes.d})}
    else{return Promise.resolve({result:false,data:'ERROR'})}
  };
  const getPrevLogArr=async(u:any):Promise<any>=>{
    const uDataArr:any[]=(await dbQ('SELECT * FROM `user_data` WHERE `email` = "'+u.email+'"',null)).d;
    if(uDataArr.length>0){const uDataRow:any=uDataArr[0];
      if(uDataRow.work_log!==null&&uDataRow.work_log!=='null'&&uDataRow.work_log!=='NULL'&&uDataRow.work_log!==undefined&&uDataRow.work_log!=='undefined'&&uDataRow.work_log!=='[object Object]'){
        const prevLogArr:any[]=JSON.parse(uDataRow.work_log);
        return Promise.resolve({result:true,data:prevLogArr})
      }else{return Promise.resolve({result:true,data:null})}
    }else{logger.info(nowNice()+' - ERROR: No row found for '+u.email+' in "user_data" Table.');return Promise.resolve({result:false})}
  };
  const setPrevLogArr=async(u:any,newLogArr:any[]):Promise<boolean>=>{
    const newLogStr:string=JSON.stringify(newLogArr);
    const dbRes:any=await dbQ('UPDATE `user_data` SET ? WHERE `email` = ?',[{work_log:newLogStr},u.email]);
    if(dbRes.r){consFn('d','userdata','ok','UPDATED user_data > work_log',dbRes.d.msg+' = 🛠️ '+u.email);return Promise.resolve(true)}
    else{consFn('d','user','err','Failed to UPDATE user_data > work_log',dbRes.d);return Promise.resolve(false)};
  };
  const sqlAllUsers:any[]=await allSQLUTable('users');
  if(sqlAllUsers.length>0){
    for(let i=0;i<sqlAllUsers.length;i++){
      const tU:any=sqlAllUsers[i]; 
      const gPrevLogARes:any=await getPrevLogArr(tU);
      const gNewLogARes:any=await getNewLogArr(tU);
      if(gNewLogARes.result){
        const newLogA:any[]=gNewLogARes.data;
        if(gPrevLogARes.result&&gPrevLogARes.data!==null){
          const prevLogA:any[]=gPrevLogARes.data;
          if(newLogA[0].Id!==prevLogA[0].Id){
            // New Event(s)...
            logger.info(nowNice()+' - (🎉 workEventLog): ✨ NOTIFIED Event for '+tU.email);
            sendWorkEventMsg(tU,Number(newLogA[0].UsageType),newLogA[0]);
            // Regardless, Save New Arr
            setPrevLogArr(tU,newLogA);wlOK++;
          }else{wlOK++};
        }else{
          setPrevLogArr(tU,newLogA);
          if(!gPrevLogARes.result){wlErr++}
          else{wlOK++;logger.info(+nowNice()+' - (🎉 workEventLog): 💾 SAVED 1st Log Array for '+tU.email)}
        };
        // Regardless, if got New Arr, Head Count >12:20am&&<12:21am
        const tdArr:string[]=(strFormat(new Date(),'yyyy,M,d')).split(',');const tdD:Date=new Date(Number(tdArr[0]),Number(tdArr[1])-1,Number(tdArr[2]));
        const tdM20D:Date=addMins(tdD,20);const tdM21D:Date=addMins(tdD,21);const nowD:Date=new Date();
        if(isA(nowD,tdM20D)&&isB(nowD,tdM21D)){
          const todayEvArr:any[]=newLogA.filter(ev=>isSD(new Date(ev.Date),new Date())&&Number(ev.UsageType)===2&&ev.Description.includes('in system on'));
          const todayDate:Date=new Date(todayEvArr[0].Date);
          const todayEmpCount:number=todayEvArr.length;
          let todayEmpIds:any[]=[];for(let i=0;i<todayEvArr.length;i++){todayEmpIds.push(todayEvArr[i].EmpId)};
          const yestDate:Date=subDs(todayDate,1);
          const yestEvArr:any[]=newLogA.filter(ev=>isSD(new Date(ev.Date),yestDate)&&Number(ev.UsageType)===2&&ev.Description.includes('in system on'));
          let yestEmpIds:any[]=[];for(let i=0;i<yestEvArr.length;i++){yestEmpIds.push(yestEvArr[i].EmpId)};
          const addEmp:any[]=todayEmpIds.filter(p=>!yestEmpIds.includes(p));
          const remEmp:any[]=yestEmpIds.filter(p=>!todayEmpIds.includes(p));
          let addRemEmpsObj:any={added:{count:0,emps:[]},removed:{count:0,emps:[]}};
          let notifyChange:boolean=false;
          if(addEmp.length>0){notifyChange=true;
            addRemEmpsObj.added.count=addEmp.length;
            for(let i=0;i<addEmp.length;i++){
              let addEmpName:string=String(addEmp[i]);
              const matchHeadCountEvArr:any=todayEvArr.filter(ev=>Number(ev.EmpId)===Number(addEmp[i])&&Number(ev.UsageType)===2&&ev.Description.includes('in system on'));
              if(matchHeadCountEvArr.length>0){
                const addEmpFNameStr:string=matchHeadCountEvArr[0].split(' in ')[0].replace('Employee ','').trim();
                const shortNArr:string[]=addEmpFNameStr.split(' ');
                if(shortNArr.length>0){addEmpName=shortNArr[0]+' '+shortNArr[1].charAt(0)}
                else{addEmpName=addEmpFNameStr}
              };
              addRemEmpsObj.added.emps.push({id:addEmp[i],name:addEmpName});
            }
          };
          if(remEmp.length>0){notifyChange=true;
            addRemEmpsObj.removed.count=remEmp.length;
            for(let i=0;i<remEmp.length;i++){
              let remEmpName:string=String(remEmp[i]);
              const matchHeadCountEvArr:any=yestEvArr.filter(ev=>Number(ev.EmpId)===Number(remEmp[i])&&Number(ev.UsageType)===2&&ev.Description.includes('in system on'));
              if(matchHeadCountEvArr.length>0){
                const remEmpFNameStr:string=matchHeadCountEvArr[0].split(' in ')[0].replace('Employee ','').trim();
                const shortNArr:string[]=remEmpFNameStr.split(' ');
                if(shortNArr.length>0){remEmpName=shortNArr[0]+' '+shortNArr[1].charAt(0)}
                else{remEmpName=remEmpFNameStr}
              };
              addRemEmpsObj.removed.emps.push({id:remEmp[i],name:remEmpName});
            }
          };
          logger.info(nowNice()+' - ( 🎉 workEventLog | workHeadCount ) - '+tU.email+' - [ 🧑 TOTAL: '+todayEmpCount+' | ADDED: '+addEmp.length+' | REMOVED: '+remEmp.length+' ]');
          if(notifyChange){await sendWorkEventMsg(tU,2,addRemEmpsObj)};
        };
      }else{consFn('d','info','err','Failed to FETCH new log data from DPAPI',gNewLogARes.data);wlErr++}
    };
    workLogConsCount.count=workLogConsCount.count+1;
    if(wlErr===0){
      if(workLogConsCount.count===60||workLogConsCount.init){
        logger.info(nowNice()+' - '+ttlTime(fnST)+' - [Function|dpWorkEventLogCheckTask]  ( 📋 EVENTLOG ): ✔️ ALL OK');
        workLogConsCount.count===60?workLogConsCount.count=0:workLogConsCount.init=false;
      }
    }else{logger.info(nowNice()+' - '+ttlTime(fnST)+' - [Function|dpWorkEventLogCheckTask] ( 📋 EVENTLOG ):'+sqlAllUsers.length+', ✔️ OK:'+wlOK+', ❌ Error: '+wlErr)};
    return Promise.resolve(true);
  }else{return Promise.resolve(true)}
}
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////