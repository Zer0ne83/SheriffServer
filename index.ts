import {promises as fs} from 'fs';
import express,{Application,Request,Response} from 'express';
import {verifyFireConnect} from './fire/config';
import {verifyDBConnect} from './db/config';
import {subscribe,destroy} from './services/events';
import dotenv from 'dotenv';
import {MainRouter} from './routes';
import {cLine} from './helpers';
import {logger} from './logger';
import {ToadScheduler,SimpleIntervalJob,Task} from 'toad-scheduler';
import {initFireSQLSync,startFBUserDocListen,initDPAuthCheck,startFBSettingsDocListen,fbCustTokenCheckTask} from './schedule/fire-sql-sync';
import {appNotifCheckTask} from './schedule/app-notif-sched';
import {sendServerSUPMsg} from './schedule/pushmsg-fns';
import {dpWorkEventLogCheckTask,dpSnoopCheckTask} from './schedule/usnoop-sched';
import {dpSyncUserDataTask} from './schedule/udata-sched'; 
import {format} from 'date-fns';
import shelljs from 'shelljs';
const scheduler=new ToadScheduler();
const startLogMsgs:string[]=[];
if(shelljs.touch('/var/www/sheriff.zer0ne.dev/logs/sheriff-admin-server.log')){
  shelljs.cp('/var/www/sheriff.zer0ne.dev/logs/sheriff-admin-server.log','/var/www/sheriff.zer0ne.dev/logs/temp.log');
  startLogMsgs.push('[index|buLogs] Copied sheriff-admin-server.log > temp.log - OK');
  shelljs.rm('/var/www/sheriff.zer0ne.dev/logs/sheriff-admin-server.log');
  startLogMsgs.push('[index|buLogs] Removed sheriff-admin-server.log - OK');
}else{startLogMsgs.push('[index|buLogs] (Warning) Missing sheriff-admin-server.log File.')};  
const nowNice=()=>{return format(new Date(),'dd/MM/yyyy hh:mmaaa')};
dotenv.config();
const app:Application=express();
const port:number=6969;  
const rB=(b:object)=>{return JSON.stringify(b)}; 
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(MainRouter);
//////////////////////////////////////////////////
app.get('/',async(req:Request,res:Response):Promise<Response>=>{
  logger.info(nowNice()+' - Request ['+req.method.toUpperCase()+'] > Route [/] > Endpoint [/] - Body: '+rB(req.body));
  return Promise.resolve(res.status(200).send({result:true,data:'Sheriff-Admin Server'}));
});
//////////////////////////////////////////////////
app.post('/',async(req:Request,res:Response):Promise<Response>=>{
  logger.info(nowNice()+' - Request ['+req.method.toUpperCase()+'] > Route [/] > Endpoint [/] - Body: '+rB(req.body));
  return Promise.resolve(res.status(200).send({result:true,data:'Sheriff-Admin Server'}));
});
//////////////////////////////////////////////////
///// MAIN SERVER INIT FNS
//////////////////////////////////////////////////
export const serverMode:string='debug';
export const serverMon:boolean=true;
//////////////////////////////////////////////////
let initChecksCount:number=0;let initErr:boolean=false;   
subscribe('initChecks',async tf=>{ 
  initChecksCount++;if(!tf){initErr=true};
  if(initChecksCount===2){destroy('initChecks'); 
    if(!initErr){ 
      cLine();
      logger.info(nowNice()+' - <<<-[ 🛡️ 𝗦𝗛𝗘𝗥𝗜𝗙𝗙-𝗔𝗗𝗠𝗜𝗡 𝗦𝗘𝗥𝗩𝗘𝗥 🛡️ ]->>>');
      logger.info(nowNice()+' - 🟢 STARTED: http://sheriff.zer0ne.dev:'+port);    
      cLine();
      logger.info('STARTED: '+nowNice()+'\n');
      // INIT EXPRESS API --------------------
      app.listen(port,():void=>{});
      // INIT FIRE>SQL SYNC ------------------  
      const{result,data}=await initFireSQLSync(); 
      if(result){
        await sendServerSUPMsg();
        await startFBUserDocListen(data);
        await startFBSettingsDocListen(data);
        setTimeout(async() => {
          const initDPAuthTokenCheckRes:boolean=await initDPAuthCheck();
          if(initDPAuthTokenCheckRes){
            // START SCHEDULERS ------------------ 
            const dpSyncUserDataTaskFn=new Task('dpSyncUserDataTask',()=>{dpSyncUserDataTask()});
            const dpSyncUserDataTaskJobFn=new SimpleIntervalJob({minutes:1,runImmediately:true},dpSyncUserDataTaskFn,'dpSyncUserDataTaskJob');
            scheduler.addSimpleIntervalJob(dpSyncUserDataTaskJobFn);
            subscribe('authDataChecks',async()=>{
              destroy('authDataChecks');
              await appNotifCheckTask(null,false);
              //----------------
              const fbCustTokenCheckTaskFn=new Task('fbCustTokenCheckTask',()=>{fbCustTokenCheckTask()});
              const fbCustTokenCheckJobFn=new SimpleIntervalJob({minutes:55,runImmediately:true},fbCustTokenCheckTaskFn,'fbCustTokenCheckJob'); 
              scheduler.addSimpleIntervalJob(fbCustTokenCheckJobFn);
              //----------------
              const dpWorkLogCheckTaskFn=new Task('dpWorkEventLogCheckTask',()=>{dpWorkEventLogCheckTask()});
              const dpWorkLogCheckJobFn=new SimpleIntervalJob({minutes:1,runImmediately:true},dpWorkLogCheckTaskFn,'dpWorkLogCheckJob'); 
              scheduler.addSimpleIntervalJob(dpWorkLogCheckJobFn);
              //----------------
              const dpSnoopCheckTaskFn=new Task('dpSnoopCheckTask',()=>{dpSnoopCheckTask()});
              const dpSnoopCheckJobFn=new SimpleIntervalJob({minutes:30,runImmediately:true},dpSnoopCheckTaskFn,'dpSnoopCheckJob');
              scheduler.addSimpleIntervalJob(dpSnoopCheckJobFn);
            });
          }else{logger.info(nowNice()+' - 🔴 STOPPED: No Users with Valid DPAuth')}
        },6000);
      }
    }else{ 
      cLine();
      logger.info(nowNice()+' - <<<-[ 🛡️ 𝗦𝗛𝗘𝗥𝗜𝗙𝗙-𝗔𝗗𝗠𝗜𝗡 𝗦𝗘𝗥𝗩𝗘𝗥 🛡️ ]->>>'); 
      logger.info(nowNice()+' - 🔴 ERROR: 𝗦𝗲𝗿𝘃𝗲𝗿 𝗦𝘁𝗼𝗽𝗽𝗲𝗱.');
      cLine();
    }
  }
});
//////////////////////////////////////////////////
async function buLogs(){
  const mlogFP:string='/var/www/sheriff.zer0ne.dev/logs/logs-master/master.log';
  const rlogFP:string='/var/www/sheriff.zer0ne.dev/logs/temp.log';
  try{
    const rlogData:any=await fs.readFile(rlogFP);
    await fs.appendFile(mlogFP,rlogData);
    if(shelljs.touch('/var/www/sheriff.zer0ne.dev/logs/temp.log')){
      shelljs.rm('/var/www/sheriff.zer0ne.dev/logs/temp.log');
      startLogMsgs.push('[index|buLogs] Old temp.log File Removed - OK')
    }else{startLogMsgs.push('[index|buLogs] (Warning) Missing temp.log File')};
    console.clear();
    logger.clearContext();
    //////////////////////////////////////////////////
    // SHOW LOGS INIT RESULTS
    //////////////////////////////////////////////////
    if(startLogMsgs.length>0){for(let i=0;i<startLogMsgs.length;i++){logger.info(startLogMsgs[i])}};
    //////////////////////////////////////////////////
    // START APP
    //////////////////////////////////////////////////
    verifyFireConnect(); 
    verifyDBConnect(); 
  }catch(buLogsErr){console.log('🔴 ERROR: Backup Running > Master Log Failed!');return Promise.resolve(false)}
};buLogs()
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////
