import { AndroidConfig, AndroidNotification, ApnsConfig, FcmOptions, NotificationMessagePayload } from 'firebase-admin/messaging';
import { addMins,gUT,dUT,subMins,addHrs,addSecs} from './schedule/timedate-fns';
//////////////////////////////////////////////////
export type MyMsgBaseMessage={token:string,data?:MyMsgData,notification?:MyMsgNotification,android?:MyMsgAndroidConfig,webpush?:MyMsgWebPushConfig,fcmOptions?:MyMsgFCMConfig,apns?:ApnsConfig};
export type MyMsgData={inAppDisplay:'none'|'toast'|'alert'|'modal'|string|null,fnType?:'auth'|string|null,[key:string]:any|null};
export type MyMsgNotification={body?:string,image?:string|null,title?:string};
export type MyMsgAndroidConfig={collapseKey?:string,priority?:'high'|'normal',ttl?:string,restrictedPackageName?:string,data?:MyMsgData,notification?:MyMsgAndroidNotification,fcmOptions?:MyMsgAndroidFCMOptions};
export type MyMsgAndroidNotification={title?:string,body?:string,icon?:string,color?:string,sound?:string,tag?:string,imageUrl?:string,clickAction?:string,channelId?:string,sticky?:boolean,priority?:'min'|'low'|'default'|'high'|'max',defaultSound?:boolean,lightSettings?:MyMsgLightSettings,defaultLightSettings?:boolean,visibility?:'private'|'public'|'secret',notificationCount?:number|string|null};
export type MyMsgLightSettings={color:string,lightOnDurationMillis:number,lightOffDurationMillis:number};
export type MyMsgAndroidFCMOptions={analyticsLabel?:string};
export type MyMsgWebPushConfig={headers?:{[key:string]:string};data?:MyMsgData,notification?:MyMsgWebPushNotification,fcmOptions?:MyMsgWebPushFCMOptions};
export type MyMsgWebPushNotification={title?:string;actions?:Array<{action:string,icon?:string,title:string}>,badge?:string|number|null,body?:string,data?:any,dir?:'auto'|'ltr'|'rtl',icon?:string,image?:string,lang?:string,renotify?:boolean,requireInteraction?:boolean,silent?:boolean,tag?:string,timestamp?:number,vibrate?:number|number[],[key:string]:any};
export type MyMsgWebPushFCMOptions={link?:string};
export type MyMsgFCMConfig={analyticsLabel?:string};
//////////////////////////////////////////////////
export function defaultAU():AppUser {
  const defObj:AppUser={
    id:null,
    email:'',
    password:'',
    dp_token:'',
    dp_refresh:'',
    dp_expires:'',
    dp_domain:'',
    fcm_token:'',
    fb_uid:'',
    app_uuk:'',
    app_prefs:'',
    app_dbbu:'',
    signedin:'',
    modified:null
  };
  return defObj;
}
//////////////////////////////////////////////////
export type AppUser = {
  id:null,              //AUTO
  email:string,         //64
  password:string,      //64
  dp_token:string,      //32
  dp_refresh:string,    //32
  dp_expires:string,    //10
  dp_domain:string,     //28
  fcm_token:string,     //163
  fb_uid:string,        //28
  app_uuk:string,       //64
  app_prefs:string,     //1
  app_dbbu:string,      //1
  signedin:string,      //10
  modified:null         //AUTO
}
//////////////////////////////////////////////////
export function defaultAUSettings():AppUserSettings {
  let dAUS:AppUserSettings={
    alerts:{
      showSection:true,
      options:{
        alertCal:{value:null,info:false},
        alertMethods:{value:{phone:true,calendar:true,email:false},info:false},
        alertEvents:{value:{shift:true,tsheet:true,task:false},info:false},
        alertBefore:{value:{task:{range:2,mins:60},shift:{range:1,mins:30},tsheet:{range:2,mins:10}},info:false}
      }
    },
    database:{
      showSection:true,
      options:{
        backupMode:{value:'auto',info:false},
        backupActions:{info:false}
      }
    },
    profile:{
      showSection:false,
      options:{alwaysSync:{value:false,info:false}}
    },
    payrates:{
      showSection:false,
      options:{show:{value:true,info:false}}
    },
    snoop:{
      showSection:false,
      options:{activated:{value:true,info:false}}
    }
  };
  return dAUS;
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
export type DBUserNotif = {
  id:number|null,
  email:string|null,
  shift:any|null,
  tsheeton:any|null,
  tsheetoff:any|null,
  task:any|null,
  memo:any|null,
  snoop:any|null,
  sheriff:any|null,
  test:any|null
}
//////////////////////////////////////////////////
export function defaultDBUNotif(uEmail:string|null):DBUserNotif{
  let defDBUN:DBUserNotif={
    id:null,
    email:null,
    shift:null,
    tsheeton:null,
    tsheetoff:null,
    task:null,
    memo:null,
    snoop:null,
    sheriff:null,
    test:null
  };
  if(uEmail!==null){defDBUN.email=String(uEmail)};
  return defDBUN;
}
//////////////////////////////////////////////////
export function defaultDBUData(uEmail:string|null):DBUserData{
  let defDBUD:DBUserData={
    id:null,
    email:null,
    me:null,
    my:null,
    colleagues:null,
    rosters:null,
    timesheets:null,
    tasks:null,
    memos:null,
    work_log:null,
    custom_token:null,
    snoop:null
  };
  uEmail!==null?defDBUD.email=uEmail:defDBUD.email=null;
  return defDBUD;
}
//////////////////////////////////////////////////
export type DBUserData = {
  id:number|null,
  email:string|null,
  me:any|null,
  my:any|null,
  colleagues:any|null,
  rosters:any|null,
  timesheets:any|null,
  tasks:any|null,
  memos:any|null,
  work_log:any|null,
  custom_token:any|null,
  snoop:any|null
}
//////////////////////////////////////////////////
export function defaultDBUserSettings(uEmail:string|null,uSettings:any|null):DBUserSettings{
  let defDBUS:DBUserSettings={
    id:null,
    email:null,
    settings:null
  };
  uEmail!==null?defDBUS.email=uEmail:defDBUS.email=null;
  if(uSettings!==null){typeof uSettings==='object'?defDBUS.settings=JSON.stringify(uSettings):defDBUS.settings=uSettings}
  else{const defAUSettObj:any=defaultAUSettings();defDBUS.settings=JSON.stringify(defAUSettObj)};
  return defDBUS
}
//////////////////////////////////////////////////
export type DBUserSettings = {
  id:number|null;
  email:string|null;
  settings:any|null;
}
//////////////////////////////////////////////////////////////////////////////
export type AppUserSettings = {
  profile:{
    showSection:boolean,
    options:{alwaysSync:{value:boolean,info:boolean}}
  },
  payrates:{
    showSection:boolean,
    options:{show:{value:boolean,info:boolean}}
  },
  alerts:{
    showSection:boolean,
    options:{
      alertCal:{value:number|null,info:boolean},
      alertMethods:{value:{phone:boolean,calendar:boolean,email:boolean},info:boolean},
      alertEvents:{value:{shift:boolean,task:boolean,tsheet:boolean},info:boolean},
      alertBefore:{value:{task:{range:number&1|2|3|4|5|6,mins:number&30|60|90|120|360|720},shift:{range:number&1|2|3|4|5|6,mins:number&30|60|90|120|360|720},tsheet:{range:number&1|2|3|4|5|6,mins:number&5|10|15|20|25|30}},info:boolean}
    }
  },
  database:{
    showSection:boolean,
    options:{
      backupMode:{value:'user'|'auto'|'none',info:boolean},
      backupActions:{info:boolean}
    }
  },
  snoop:{
    showSection:boolean,
    options:{activated:{value:boolean,info:boolean}}
  }
}
//////////////////////////////////////////////////
export const testRosArr:any[]=[
  { Id: 9999,
    Date: '2022-03-11T00:00:00+08:00',
    StartTime: 1647594000,
    EndTime: 1647617400,
    Mealbreak: '2022-03-15T00:00:00+08:00',
    Slots: [ [Object] ],
    TotalTime: 6.5,
    Cost: 0,
    OperationalUnit: 6,
    Employee: 421,
    Comment: '',
    Warning: '',
    WarningOverrideComment: '',
    Published: true,
    MatchedByTimesheet: 6969,
    CustomFieldData: null,
    Open: false,
    ApprovalRequired: false,
    ConfirmStatus: 0,
    ConfirmComment: '',
    ConfirmBy: 0,
    ConfirmTime: 0,
    SwapStatus: 0,
    SwapManageBy: null,
    ShiftTemplate: 1,
    ConnectStatus: null,
    Creator: 406,
    Created: '2022-03-07T10:39:17+08:00',
    Modified: '2022-03-11T16:56:28+08:00',
    OperationalUnitObject: 
     { Id: 6,
       Creator: 1,
       Created: '2018-12-31T19:42:41+08:00',
       Modified: '2020-09-01T14:30:35+08:00',
       Company: 1,
       WorkType: null,
       ParentOperationalUnit: 0,
       OperationalUnitName: 'Bar',
       Active: true,
       PayrollExportName: '',
       Address: 162,
       Contact: null,
       RosterSortOrder: 1,
       ShowOnRoster: true,
       Colour: '#f93c3c',
       RosterActiveHoursSchedule: null,
       DailyRosterBudget: null,
       OperationalUnitType: 0,
       CompanyCode: 'DOG',
       CompanyName: 'Duke Of George',
       AddressObject: [Object] },
    OnCost: 0,
    StartTimeLocalized: '2022-03-11T17:00:00+08:00',
    EndTimeLocalized: '2022-03-11T23:30:00+08:00',
    ExternalId: null,
    ConnectCreator: null,
    _DPMetaData: 
     { System: 'Roster',
       CreatorInfo: [Object],
       OperationalUnitInfo: [Object],
       EmployeeInfo: [Object],
       SwapManageByInfo: [] },
    BidsCount: null },
  { Id: 7291,
    Date: '2022-03-12T00:00:00+08:00',
    StartTime: 1647682200,
    EndTime: 1647703800,
    Mealbreak: '2022-03-15T00:00:00+08:00',
    Slots: [ [Object] ],
    TotalTime: 6,
    Cost: 0,
    OperationalUnit: 6,
    Employee: 421,
    Comment: '',
    Warning: '',
    WarningOverrideComment: '',
    Published: true,
    MatchedByTimesheet: 6972,
    CustomFieldData: null,
    Open: false,
    ApprovalRequired: false,
    ConfirmStatus: 0,
    ConfirmComment: '',
    ConfirmBy: 0,
    ConfirmTime: 0,
    SwapStatus: 0,
    SwapManageBy: null,
    ShiftTemplate: 1,
    ConnectStatus: null,
    Creator: 406,
    Created: '2022-03-07T10:39:26+08:00',
    Modified: '2022-03-12T17:19:33+08:00',
    OperationalUnitObject: 
     { Id: 6,
       Creator: 1,
       Created: '2018-12-31T19:42:41+08:00',
       Modified: '2020-09-01T14:30:35+08:00',
       Company: 1,
       WorkType: null,
       ParentOperationalUnit: 0,
       OperationalUnitName: 'Bar',
       Active: true,
       PayrollExportName: '',
       Address: 162,
       Contact: null,
       RosterSortOrder: 1,
       ShowOnRoster: true,
       Colour: '#f93c3c',
       RosterActiveHoursSchedule: null,
       DailyRosterBudget: null,
       OperationalUnitType: 0,
       CompanyCode: 'DOG',
       CompanyName: 'Duke Of George',
       AddressObject: [Object] },
    OnCost: 0,
    StartTimeLocalized: '2022-03-12T17:30:00+08:00',
    EndTimeLocalized: '2022-03-12T23:30:00+08:00',
    ExternalId: null,
    ConnectCreator: null,
    _DPMetaData: 
     { System: 'Roster',
       CreatorInfo: [Object],
       OperationalUnitInfo: [Object],
       EmployeeInfo: [Object],
       SwapManageByInfo: [] },
    BidsCount: null },
  { Id: 7292,
    Date: '2022-03-13T00:00:00+08:00',
    StartTime: 1647765000,
    EndTime: 1647784800,
    Mealbreak: '2022-03-15T00:00:00+08:00',
    Slots: [ [Object] ],
    TotalTime: 5.5,
    Cost: 0,
    OperationalUnit: 6,
    Employee: 421,
    Comment: '',
    Warning: '',
    WarningOverrideComment: '',
    Published: true,
    MatchedByTimesheet: 6976,
    CustomFieldData: null,
    Open: false,
    ApprovalRequired: false,
    ConfirmStatus: 0,
    ConfirmComment: '',
    ConfirmBy: 0,
    ConfirmTime: 0,
    SwapStatus: 0,
    SwapManageBy: null,
    ShiftTemplate: 1,
    ConnectStatus: null,
    Creator: 406,
    Created: '2022-03-07T10:39:31+08:00',
    Modified: '2022-03-13T16:20:07+08:00',
    OperationalUnitObject: 
     { Id: 6,
       Creator: 1,
       Created: '2018-12-31T19:42:41+08:00',
       Modified: '2020-09-01T14:30:35+08:00',
       Company: 1,
       WorkType: null,
       ParentOperationalUnit: 0,
       OperationalUnitName: 'Bar',
       Active: true,
       PayrollExportName: '',
       Address: 162,
       Contact: null,
       RosterSortOrder: 1,
       ShowOnRoster: true,
       Colour: '#f93c3c',
       RosterActiveHoursSchedule: null,
       DailyRosterBudget: null,
       OperationalUnitType: 0,
       CompanyCode: 'DOG',
       CompanyName: 'Duke Of George',
       AddressObject: [Object] },
    OnCost: 0,
    StartTimeLocalized: '2022-03-13T16:30:00+08:00',
    EndTimeLocalized: '2022-03-13T22:00:00+08:00',
    ExternalId: null,
    ConnectCreator: null,
    _DPMetaData: 
     { System: 'Roster',
       CreatorInfo: [Object],
       OperationalUnitInfo: [Object],
       EmployeeInfo: [Object],
       SwapManageByInfo: [] },
    BidsCount: null } 
];
export const getTestR=():any=>{
  let testO:any = {
    Id: 9999,
    Date: '2022-03-13T00:00:00+08:00',
    StartTime: 1647765000,
    EndTime: 1647784800,
    Mealbreak: '2022-03-15T00:00:00+08:00',
    Slots: [ [Object] ],
    TotalTime: 5.5,
    Cost: 0,
    OperationalUnit: 6,
    Employee: 421,
    Comment: '',
    Warning: '',
    WarningOverrideComment: '',
    Published: true,
    MatchedByTimesheet: 6976,
    CustomFieldData: null,
    Open: false,
    ApprovalRequired: false,
    ConfirmStatus: 0,
    ConfirmComment: '',
    ConfirmBy: 0,
    ConfirmTime: 0,
    SwapStatus: 0,
    SwapManageBy: null,
    ShiftTemplate: 1,
    ConnectStatus: null,
    Creator: 406,
    Created: '2022-03-07T10:39:31+08:00',
    Modified: '2022-03-13T16:20:07+08:00',
    OperationalUnitObject: 
    { Id: 6,
      Creator: 1,
      Created: '2018-12-31T19:42:41+08:00',
      Modified: '2020-09-01T14:30:35+08:00',
      Company: 1,
      WorkType: null,
      ParentOperationalUnit: 0,
      OperationalUnitName: 'Bar',
      Active: true,
      PayrollExportName: '',
      Address: 162,
      Contact: null,
      RosterSortOrder: 1,
      ShowOnRoster: true,
      Colour: '#f93c3c',
      RosterActiveHoursSchedule: null,
      DailyRosterBudget: null,
      OperationalUnitType: 0,
      CompanyCode: 'DOG',
      CompanyName: 'Duke Of George',
      AddressObject: [Object] },
    OnCost: 0,
    StartTimeLocalized: '2022-03-13T16:30:00+08:00',
    EndTimeLocalized: '2022-03-13T22:00:00+08:00',
    ExternalId: null,
    ConnectCreator: null,
    _DPMetaData: 
    { System: 'Roster',
      CreatorInfo: [Object],
      OperationalUnitInfo: [Object],
      EmployeeInfo: [Object],
      SwapManageByInfo: [] },
    BidsCount: null 
  };
  const fauxSD:Date=addMins(new Date(),45);
  const fauxSUTS:number=gUT(fauxSD);
  const fauxED:Date=addHrs(fauxSD,Number(testO.TotalTime));
  const fauxEUTS:number=gUT(fauxED);
  testO.StartTime=fauxSUTS;
  testO.EndTime=fauxEUTS;
  return testO;
} 
//////////////////////////////////////////////////
//////////////////////////////////////////////////