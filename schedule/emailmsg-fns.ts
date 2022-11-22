//////////////////////////////////////////////////
///// IMPORTS ////////////////////////////////////
//////////////////////////////////////////////////
import {dbHasU} from './sqldb-helper-fns';
import { consFn } from '../helpers';
//////////////////////////////////////////////////
///// GVARS/GFNS /////////////////////////////////
//////////////////////////////////////////////////
const getSEOpts=(email:string,subject:string,msg:string):any=>{
  let baseOpts:any={
    user:<string>'sheriffappalerts@gmail.com',
    pass:<string>'LifeIsSad123!?',
    to:<string>'',
    from:<string>'Sheriff Alerts',
    replyTo:<string>'noreply@noreply.com',
    subject:<string>'',
    html:<string>''
  };
  baseOpts.to=email;
  baseOpts.subject=subject;
  baseOpts.html=msg;
  return baseOpts
}
//////////////////////////////////////////////////
export async function sendEmailMsg(email:string,subject:string,msg:string):Promise<boolean>{
  if((await dbHasU(email))){
    let seOpts:any={
      user:<string>'sheriffappalerts@gmail.com',
      pass:<string>'LifeIsSad123!?',
      to:<string>email,
      from:<string>'Sheriff Alerts',
      replyTo:<string>'noreply@noreply.com',
      subject:<string>'',
      html:<string>''
    };
    if(subject.includes('Access')){seOpts.subject='🔐'+subject}else{subject.includes('Server')?seOpts.subject='🟢'+subject:seOpts.subject='🚨'+subject};
    let msgTxt:string='';
    const rawMsgArr:string[]=msg.split('\n');
    for(let i=0;i<rawMsgArr.length;i++){
      if(i===0){msgTxt+='<div style="font-size:16px;font-weight:bold">'+rawMsgArr[i]+'</div>'}
      else{msgTxt+='<div style="font-size:16px;font-weight:normal">'+rawMsgArr[i]+'</div>'}
    };
    msgTxt+='<div style="font-size:13px"><br></br></div><div style="font-size:13px;color:#aaaaaa">Best Wishes 🙏 & Big Love ❤️,</div><div style="font-size:13px"><br></br></div><div style="font-size:16px;font-weight:bold;font-style:italic;letter-spacing:1.5px">SHERIFF</div><div style="font-size:13px"><br></br></div><div><img src="https://zer0ne.dev/sheriff/sheriffalert.png"></div>';
    seOpts.html=msgTxt;
    const sendEmail=require('gmail-send')(seOpts);
    try{
      const{result}=await sendEmail();
      consFn('emailmsg','emailsend','ok',email,result);
      return Promise.resolve(true)
    }catch(e){consFn('emailmsg','emailsend','err',' - '+email+' - ',JSON.stringify(e));return Promise.resolve(false)}
  }else{consFn('emailmsg','emailsend','err','(sendEmailMsg)','Email: '+email+' - Not Matched in DB - Skipped');return Promise.resolve(false)}
}
//////////////////////////////////////////////////
//////////////////////////////////////////////////