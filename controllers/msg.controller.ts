//////////////////////////////////////////////////
///// IMPORTS
//////////////////////////////////////////////////
import {Request,Response} from 'express';
import {logger} from '../logger';
import {ssAuthCheck,setFCMToken} from '../schedule/sqldb-helper-fns';
import {sendMsg,sendMyMsg,testWorkMsg} from '../schedule/pushmsg-fns';
import {consFn} from '../helpers';
import {setFBUFCMToken} from '../schedule/firebase-helper';
import { nowNice } from '../schedule/timedate-fns';
//////////////////////////////////////////////////
export async function msgController(req:Request,res:Response):Promise<Response> {
  logger.info(nowNice()+' - ✈️ Request ['+req.method+'] > Route [msg] > Endpoint [/]');
  const sMRes:any=await sendMsg(req.body.token,req.body.title,req.body.body,req.body.data);
  if(sMRes){return res.json('🛡️Sheriff-Admin Server🛡️ >>> sendMsg: SUCCESS')}
  else{return res.json('🛡️Sheriff-Admin Server🛡️ >>> sendMsg: FAILED')} 
}
//////////////////////////////////////////////////
export async function testMsg(req:Request,res:Response):Promise<Response> {
  const mmRes:boolean=await testWorkMsg(req.body);
  if(mmRes){return res.status(200).send()}
  else{return res.status(500).send()}
}
//////////////////////////////////////////////////
export async function setFCM(req:Request,res:Response):Promise<Response> {
  const reqT:string=nowNice()+' - ✈️ Request ['+req.method+'] > Route [msg] > Endpoint [setfcm]';
  if(req.body.hasOwnProperty('ssauth')&&req.body.ssauth&&req.body.hasOwnProperty('email')&&req.body.email&&req.body.hasOwnProperty('fcm')&&req.body.fcm){
    if((await ssAuthCheck(req.body.email,req.body.ssauth))){
      await setFBUFCMToken(req.body.email,req.body.fcm);
      if((await setFCMToken(req.body.email,req.body.fcm))){const eM:string='OK';consFn('req','req','ok',reqT,eM);return res.status(200).json({result:true,data:'OK'})}
      else{const eM:string='Server Error: Updating DB (user > fcm_token)';consFn('req','req','err',reqT,eM);return res.status(500).json({code:'500',msg:eM})}
    }else{const eM:string='User Email|DPToken Mismatch';consFn('req','req','err',reqT,eM);return res.status(401).json({code:'401',msg:eM})}
  }else{const eM:string='Missing/Invalid Body Pty(s) {ssauth,email,fcm}';consFn('req','req','err',reqT,eM);return res.status(500).json({code:'500',msg:eM})}
}
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////