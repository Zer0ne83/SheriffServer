//////////////////////////////////////////////////
///// IMPORTS
//////////////////////////////////////////////////
import {fireAuth,UserRecord} from '../fire/config';
import {logger} from '../logger';
import {consFn} from '../helpers';
//////////////////////////////////////////////////
export const getUserByEmail=async(email:string):Promise<object>=>{
  consFn('d','user','info','getUserByEmail',null);
  try{
    const gUBERes:UserRecord=await fireAuth.getUserByEmail(email);
    return Promise.resolve({result:true,data:gUBERes.toJSON()
    })}
  catch(gUBEErr){return Promise.resolve({result:false,data:gUBEErr})}
}
//////////////////////////////////////////////////
export function getAllFireUsers() {
  fireAuth.listUsers(1000).then((userRecords)=>{
    userRecords.users.forEach((user)=>{
      logger.info(user.toJSON());
    })
  })
}
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////