//////////////////////////////////////////////////
///// IMPORTS
//////////////////////////////////////////////////
import {Request,Response} from 'express';
import {logger} from '../logger';
import {requestFCT} from '../schedule/fire-sql-sync';
import {nowNice} from '../schedule/timedate-fns';
//////////////////////////////////////////////////
export async function getFCT(req:Request,res:Response):Promise<Response> {
  logger.info(nowNice()+' - 🚩 REQUEST ['+req.method+'] > ROUTE: fct | ENDPOINT /getfct');
  let reqUEmail:string|null=null,
  reqToken:string|null=null,
  emailErr:any={isE:<boolean>false,isM:<boolean>false,isIV:<boolean>false},
  tokenErr:any={isE:<boolean>false,isM:<boolean>false,isIV:<boolean>false};
  if(req.body.hasOwnProperty('email')&&req.body.email){
    if(req.body.email.length>6&&req.body.email.includes('@')){reqUEmail=req.body.email}else{emailErr.isE=true;emailErr.isIV=true;reqUEmail=null}
  }else{emailErr.isE=true;emailErr.isM=true;reqUEmail=null};
  if(req.body.hasOwnProperty('token')&&req.body.token){
    if(req.body.token.length===32||req.body.token.length===16){reqToken=req.body.token}else{tokenErr.isE=true;tokenErr.isIV=true;reqToken=null}
  }else{tokenErr.isE=true;tokenErr.isM=true;reqToken=null};
  if(reqUEmail&&reqToken){
    let tType:string='';if(reqToken.length===32){tType='-viaDPT='+reqToken}else{tType='-viaFET='+reqToken};
    try{
      const getFCTRes:any=await requestFCT(reqUEmail,reqToken);
      if(getFCTRes.result){logger.info(nowNice()+' - 🚩 🎟️ 🟢 [getFCT'+tType+'] (SUCCESS): '+reqUEmail+' - CT: '+getFCTRes.data.custom_token.substring(0,16)+'... | FE: '+getFCTRes.data.fe_token.substring(0,16)+'... | EXP: '+String(getFCTRes.data.expires_at));return res.status(200).json(getFCTRes.data)}
      else{logger.info(nowNice()+' - 🚩 🎟️ 🔴 [getFCT'+tType+'] (ERROR): CODE:'+getFCTRes.data.code+' | MSG: '+getFCTRes.data.msg);return res.status(getFCTRes.data.code).json('(ERROR) '+getFCTRes.data.msg)}
    }catch(gFCTErr){logger.info(nowNice()+' - 🚩 🎟️ 🔴 [getFCT'+tType+'] '+JSON.stringify(gFCTErr));return res.status(500).json('(ERROR) '+JSON.stringify(gFCTErr))}
  }else{
    let eMsg:string='(REQUEST ERROR): ',m:string=' value is missing/blank',iv:string=' value is invalid/old';
    const eM=(f:string,eO:any)=>{let fT='';if(f==='email'){fT='EMAIL'}else{f==='type'?fT='TYPE':fT='TOKEN'};if(eO.isE){eMsg+=fT;eO.isM?eMsg+=m:eMsg+=iv}};
    eM('email',emailErr);
    if(emailErr.isE&&tokenErr.isE){eMsg+=' AND '};
    eM('token',tokenErr);
    logger.info(nowNice()+' - 🚩 🎟️ 🔴 [getFCT] '+eMsg);
    return res.status(500).send(eMsg);
  }
}
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////