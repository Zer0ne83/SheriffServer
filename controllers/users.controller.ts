//////////////////////////////////////////////////
///// IMPORTS
//////////////////////////////////////////////////
import {Request,Response} from 'express';
import {pool} from '../db/config';
import {AppUser} from '../interfaces/AppUser';
import {consFn} from '../helpers';
import {logger} from '../logger';
// GET SINGLE /////////////////////////////////////
export async function getSingleAppUser(req:Request,res:Response):Promise<Response> {
  consFn('d','user','info','getSingleAppUser',null);
  const email:string=req.params.email;
  try{const db=await pool.getConnection();
    if(db){
      const gSAURes:any=await db.query('SELECT * FROM `users` WHERE `email` = ?',[email]);
      if(gSAURes[0].length<1){
        consFn('d','user','err','getSingleAppUser','AppUser NOT FOUND');
        return Promise.resolve(res.status(200).json({result:false,data:null}))
      }else{
        consFn('d','user','ok','getSingleAppUser','AppUser FOUND');
        return Promise.resolve(res.status(200).json({result:true,data:gSAURes[0][0]}))
      };
    }else{consFn('d','user','err','getSingleAppUser','DB Connection Failed.');return Promise.resolve(res.status(500).json({result:false,error:'DB Connection Failed.'}))}
  }catch(qErr){consFn('d','user','err','getSingleAppUser',JSON.stringify(qErr));return Promise.resolve(res.status(500).json({result:false,error:JSON.stringify(qErr)}))}
}
// GET ALL ///////////////////////////////////////
export async function getAllAppUsers(req:Request,res:Response):Promise<Response> {
  consFn('d','user','info','getAllAppUsers',null);
  try{const db=await pool.getConnection();
    if(db){
      const allUsers:any=await db.query('SELECT * FROM `users`');
      consFn('d','user','ok','getAllAppUsers','['+allUsers[0].length+'] AppUsers Found');
      return Promise.resolve(res.status(200).json({result:true,data:allUsers[0]}))
    }else{consFn('d','user','err','getAllAppUsers','DB Connection Failed.');return Promise.resolve(res.status(500).json({result:false,error:'DB Connection Failed.'}))}
  }catch(qErr){consFn('d','user','err','getAllAppUsers',JSON.stringify(qErr));return Promise.resolve(res.status(500).json({result:false,error:JSON.stringify(qErr)}))}
}
// POST/ADD //////////////////////////////////////
export async function addAppUser(req:Request,res:Response) {
  consFn('d','user','info','addAppUser',null);
  const newAU:any=req.body;
  logger.info(newAU);
  try{const db=await pool.getConnection();
    if(db){  
      await db.query('INSERT INTO `users` SET ?',[newAU]);
      consFn('d','user','ok','addAppUser','User Added!');
      return Promise.resolve(res.status(200).json({result:true}))
    }else{return Promise.resolve(res.status(500).json({result:false,error:'DB Connection Failed'}))}
  }catch(qErr){consFn('d','user','err','addAppUser',JSON.stringify(qErr));return Promise.resolve(res.status(500).json({result:false,error:JSON.stringify(qErr)}))}
}
// PUT/UPDATE ////////////////////////////////////
export async function updateAppUser(req:Request,res:Response) {
  consFn('d','user','info','updateAppUser',null);
  const email:string=req.params.email;
  const revAU:AppUser=req.body;
  try{const db=await pool.getConnection();
    if(db){
      await db.query('UPDATE `users` SET ? WHERE `email` = ?',[revAU,email]);
      consFn('d','user','ok','updateAppUser','User Updated!');
      return Promise.resolve(res.status(200).json({result:true}))
    }else{return Promise.resolve(res.status(500).json({result:false,error:'DB Connection Failed'}))}
  }catch(qErr){consFn('d','user','err','updateAppUser',JSON.stringify(qErr));return Promise.resolve(res.status(500).json({result:false,error:JSON.stringify(qErr)}))}
}
// -----------------------------------------------
export async function updateDPToken(req:Request,res:Response) {  
  consFn('d','user','info','updateDPToken',null);
  const email:string=String(req.query.email);
  const newDPTObj={dp_token:String(req.query.token),dp_refresh:String(req.query.refresh),dp_expires:Number(req.query.expires)};
  try{const db=await pool.getConnection();
    if(db){
      await db.query('UPDATE `users` SET ? WHERE `email` = ?',[newDPTObj,email]);
      consFn('d','user','ok','updateDPToken','DP Token Updated!');
      return Promise.resolve(res.status(200).json({result:true}))
    }else{return Promise.resolve(res.status(500).json({result:false,error:'DB Connection Failed'}))}
  }catch(qErr){consFn('d','user','err','updateDPToken',JSON.stringify(qErr));return Promise.resolve(res.status(500).json({result:false,error:JSON.stringify(qErr)}))}
}
// -----------------------------------------------
export async function updateFCMToken(req:Request,res:Response) {  
  consFn('d','user','info','updateFCMToken',null);
  const email:string=String(req.query.email);
  const newFCMTObj={fcm_token:String(req.query.token)};
  try{const db=await pool.getConnection();
    if(db){
      await db.query('UPDATE `users` SET ? WHERE `email` = ?',[newFCMTObj,email]);
      consFn('d','user','ok','updateFCMToken','FCM Token Updated!');
      return Promise.resolve(res.status(200).json({result:true}))
    }else{return Promise.resolve(res.status(500).json({result:false,error:'DB Connection Failed'}))}
  }catch(qErr){consFn('d','user','err','updateFCMToken',JSON.stringify(qErr));return Promise.resolve(res.status(500).json({result:false,error:JSON.stringify(qErr)}))}
}
// DELETE ////////////////////////////////////////
export async function deleteAppUser(req:Request,res:Response) {
  consFn('d','user','info','deleteAppUser',null);
  const email:string=req.params.email;
  try{const db=await pool.getConnection();
    if(db){
      await db.query('DELETE FROM `users` WHERE `email` = ?',[email]);
      consFn('d','user','ok','updateAppUser','User Updated!');
      return Promise.resolve(res.status(200).json({result:true}))
    }else{return Promise.resolve(res.status(500).json({result:false,error:'DB Connection Failed'}))}
  }catch(qErr){consFn('d','user','err','deleteAppUser',JSON.stringify(qErr));return Promise.resolve(res.status(500).json({result:false,error:JSON.stringify(qErr)}))}
}
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////