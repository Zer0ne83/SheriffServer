//////////////////////////////////////////////////
///// IMPORTS ////////////////////////////////////
//////////////////////////////////////////////////
import {Request,Response} from 'express';
import {logger} from '../logger';
import {promises as fs} from 'fs';
import {dbHasU} from '../schedule/sqldb-helper-fns';
import {getSchedJobs} from '../schedule/cron-jobs-sched';
//////////////////////////////////////////////////
export async function getSchedList(req:Request,res:Response) {
  logger.info('Request ['+req.method+'] > Sched [/sched] > Log [/schedlist]');
  if(req.body.hasOwnProperty('zer0ne')
  &&req.body.zer0ne==='meowcats123'
  &&req.body.hasOwnProperty('email')
  &&req.body.email.length>5
  &&req.body.email.includes('@')
  ){
    if((await dbHasU(req.body.email))){await getSchedJobs(req.body.email);return res.status(200).send('OK')}
    else{const eM:string='[sched.controller|getSchedList] (ERROR): Provided User/Email Not in Database';logger.info(eM);return res.status(500).send(eM)}
  }else{const eM:string='[sched.controller|getSchedList] (ERROR): Missing/Invalid Auth Header|Body Pty (email)';logger.info(eM);return res.status(500).send(eM)}
}
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////