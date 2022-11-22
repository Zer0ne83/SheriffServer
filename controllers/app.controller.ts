//////////////////////////////////////////////////
///// IMPORTS ////////////////////////////////////
//////////////////////////////////////////////////
import {Request,Response} from 'express';
import {logger} from '../logger';
import shell from 'shelljs';
import {promises as fs} from 'fs';
import {ssAuthCheck} from '../schedule/sqldb-helper-fns';
import { consFn } from '../helpers';
import { nowNice } from '../schedule/timedate-fns';
import {appNotifCheckTask} from '../schedule/app-notif-sched';
import {publish,subscribe,destroy} from '../services/events';
import {getDPFirstAuth,rawDPAuthO} from '../schedule/dpapi-helper-fns';
import {snoopHrs} from '../schedule/usnoop-sched';
import _ from 'lodash';
//////////////////////////////////////////////////
export function exitController(req:Request,res:Response) {
  logger.info(nowNice()+' - ✈️ Request ['+req.method+'] > App [/app] > Exit [/exit]');
  logger.info('Shutting Down Sheriff-Admin Server...');
  let cDown:number=4;
  const exitLoop=setInterval(()=>{cDown--;
    if(cDown!==0){logger.info('in '+cDown+'s...')}
    else{clearInterval(exitLoop);logger.info('[TERMINATED]');process.exit()}
  },1000);
}
//////////////////////////////////////////////////
export async function restartController(req:Request,res:Response) {
  logger.info(nowNice()+' - ✈️ Request ['+req.method+'] > App [/app] > Restart [/restart]');
  shell.exec('sudo restart.sh',{silent:true});
  let cDown:number=4;
  const exitLoop=setInterval(()=>{cDown--;
    if(cDown!==0){logger.info('in '+cDown+'s...')}
    else{clearInterval(exitLoop);logger.info('[RESTART]');process.exit()};
  },1000);
}
//////////////////////////////////////////////////
export async function snoopHours(req:Request,res:Response) {
  const reqT:string=nowNice()+' - ✈️ Request ['+req.method+'] > App [/app] > Log [/snoophrs] - '+req.body.email;
  if(
    req.body.hasOwnProperty('ssauth')
    &&typeof req.body.ssauth==='string'
    &&req.body.ssauth
    &&req.body.hasOwnProperty('email')
    &&typeof req.body.email==='string'
    &&req.body.email
  ){
    if((await ssAuthCheck(req.body.email,req.body.ssauth))){
      const userSHrsRes:any=await snoopHrs(req.body.email);
      if(userSHrsRes.result){
        const daysCount:number=Object.keys(userSHrsRes.data).length;
        consFn('req','req','ok',reqT,'Found ['+daysCount+'] Snoop Days');return res.status(200).send(userSHrsRes.data)
      }else{consFn('req','req','err',reqT,'Database Returned No Data &| Result=false');return res.status(200).send('Database Returned No Data &| Result=false')}
    }else{const eM:string='User Email|DPToken Mismatch';consFn('req','req','err',reqT,eM);return res.status(401).send('(CODE): '+String(401)+' (MSG): '+eM)}
  }else{const eM:string='Missing/Invalid Body Pty(s) {ssauth,email}';consFn('req','req','err',reqT,eM);return res.status(500).send('(CODE): '+String(500)+' (MSG): '+eM)}
}
//////////////////////////////////////////////////
export async function doIABLogin(req:Request,res:Response) {
  const reqT:string=nowNice()+' - ✈️ Request ['+req.method+'] > App [/app] > Log [/iablogin]';
  if(
    req.body.hasOwnProperty('email')
    &&typeof req.body.email==='string'
    &&req.body.email.length>6 
    &&req.body.email.includes('@')
    &&req.body.hasOwnProperty('password')
    &&typeof req.body.password==='string'
    &&req.body.password
    &&req.body.password.length>3
  ){
    subscribe('dpLoginDone',tf=>{
      destroy('');
      if(tf&&!_.isEmpty(rawDPAuthO)){const authO:any=rawDPAuthO;consFn('req','req','ok',reqT,'IAB Login Succeeded');return res.status(200).send(authO)}
      else{consFn('req','req','err',reqT,'Scrape &| Save Failed');return res.status(500).send('(CODE): '+String(500)+' (MSG): Scrape &| Save Failed')}
    });
    getDPFirstAuth(req.body.email,req.body.password);
  }else{consFn('req','req','err',reqT,'Missing/Invalid Body Pty(s) {email,password}');return res.status(500).send('(CODE): '+String(500)+' (MSG): Missing/Invalid Body Pty(s) {email,password}')}
}
//////////////////////////////////////////////////
export async function getServerLog(req:Request,res:Response) {
  const reqT:string=nowNice()+' - ✈️ Request ['+req.method+'] > App [/app] > Log [/log]';
  if(
    req.body.hasOwnProperty('ssauth')
    &&req.body.ssauth
    &&req.body.hasOwnProperty('email')
    &&req.body.email
  ){
    if((await ssAuthCheck(req.body.email,req.body.ssauth))){
      try{const logData:any=await fs.readFile('/var/www/sheriff.zer0ne.dev/logs/sheriff-admin-server.log');
        return res.status(200).send(logData);
      }catch(lDErr){const eM:string=JSON.stringify(lDErr);consFn('req','req','err',reqT,eM);return res.status(500).send('(CODE): '+String(500)+' (MSG): '+eM)}
    }else{const eM:string='User Email|DPToken Mismatch';consFn('req','req','err',reqT,eM);return res.status(401).send('(CODE): '+String(401)+' (MSG): '+eM)}
  }else{const eM:string='Missing/Invalid Body Pty(s) {ssauth,email}';consFn('req','req','err',reqT,eM);return res.status(500).send('(CODE): '+String(500)+' (MSG): '+eM)}
}
//////////////////////////////////////////////////
export async function getServerNotif(req:Request,res:Response) {
  const reqT:string=nowNice()+' - ✈️ Request ['+req.method+'] > App [/app] > Log [/notif]';
  if(
    req.body.hasOwnProperty('ssauth')
    &&req.body.ssauth
    &&req.body.hasOwnProperty('email')
    &&req.body.email
  ){
    if((await ssAuthCheck(req.body.email,req.body.ssauth))){
      const gNRes:string=await appNotifCheckTask(req.body.email,true);
      return res.status(200).send(gNRes);
    }else{const eM:string='User Email|DPToken Mismatch';consFn('req','req','err',reqT,eM);return res.status(401).send('(CODE): '+String(401)+' (MSG): '+eM)}
  }else{const eM:string='Missing/Invalid Body Pty(s) {ssauth,email}';consFn('req','req','err',reqT,eM);return res.status(500).send('(CODE): '+String(500)+' (MSG): '+eM)}
}
//////////////////////////////////////////////////
//////////////////////////////////////////////////