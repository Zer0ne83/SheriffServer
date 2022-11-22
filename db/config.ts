//////////////////////////////////////////////////
///// IMPORTS
//////////////////////////////////////////////////
import {createPool} from 'mysql2/promise';
import {publish} from '../services/events';
import {icoObj,consFn} from '../helpers';
import {logger} from '../logger';
import {nowNice} from '../schedule/timedate-fns'
let connThreadIds:number[]=[];
//////////////////////////////////////////////////
export const pool=createPool({host:'localhost',user:'sheriffadmin',password:'lotto12',database:'sheriff',connectionLimit:50,waitForConnections:true,queueLimit:50});
pool.on('acquire',(c)=>{
  if(!connThreadIds.includes(c.threadId)){logger.info(nowNice()+' - ('+icoObj.listen+'): New Connection %d ACQUIRED',c.threadId);connThreadIds.push(c.threadId)};
});
pool.on('connection',(c)=>{c.query('SET SESSION auto_increment_increment=1')});
pool.on('release',(c)=>{
  if(!connThreadIds.includes(c.threadId)){logger.info(nowNice()+' - ('+icoObj.listen+'): Connection %d RELEASED',c.threadId);connThreadIds.push(c.threadId)};
});
pool.on('enqueue',()=>{logger.info(+nowNice()+' - ('+icoObj.listen+'): Connection ENQUEUED')});
//////////////////////////////////////////////////
export async function verifyDBConnect(){
  consFn('d','plug','info','verifyDBConnect',null);
  const db=await pool.getConnection();
  if(db){publish('initChecks',true);consFn('d','plug','ok','verifyDBConnect','Thread:'+db.threadId);db.release()}
  else{publish('initChecks',false);consFn('d','plug','ok','verifyDBConnect','DB Connect Error.')}
}
//////////////////////////////////////////////////  
//////////////////////////////////////////////////
////////////////////////////////////////////////// 