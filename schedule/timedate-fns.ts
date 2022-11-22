//////////////////////////////////////////////////
///// IMPORTS ////////////////////////////////////
//////////////////////////////////////////////////
import {getUnixTime,format,fromUnixTime,intervalToDuration,formatDuration,isBefore,isAfter,getTime,addMinutes,isSameDay,isSameMinute,subDays, isYesterday, isTomorrow, subMonths, isSameYear, subMinutes, addSeconds,subSeconds,addDays,getDay,getYear,parse,isSameSecond, addHours} from 'date-fns';
//////////////////////////////////////////////////
export function strFormat(d:Date,s:string):string{return format(d,s)};
export function nowNice():string{return format(new Date(),'dd/MM/yyyy hh:mmaaa')};
export function gUT(d:any):number{return getUnixTime(new Date(d))};
export function dUT(uts:any):Date{return fromUnixTime(Number(uts))};
export function durToNow(d:Date):string{const dO:Duration=intervalToDuration({start:new Date(),end:d});return formatDuration(dO,{delimiter:', ',format:['hours','minutes']})};
export function longDurToNow(d:Date):string{const dO:Duration=intervalToDuration({start:new Date(),end:d});return formatDuration(dO,{delimiter:', ',format:['days','hours','minutes']})};
export function ttlTime(sT:Date):string{const stMS:number=getTime(sT);const eTMS:number=getTime(new Date());return '(⏲️ '+((eTMS-stMS)/1000).toFixed(1)+'s)'};
export function isSD(d1:Date,d2:Date):boolean{return isSameDay(d1,d2)};
export function isYD(d:Date):boolean{return isYesterday(d)};
export function isB(d1:Date,d2:Date){return isBefore(d1,d2)};
export function isA(d1:Date,d2:Date){return isAfter(d1,d2)};
export function addMins(d:Date,m:number){return addMinutes(d,m)};
export function subMins(d:Date,m:number){return subMinutes(d,m)};
export function addSecs(d:Date,s:number){return addSeconds(d,s)};
export function addHrs(d:Date,h:number){return addHours(d,h)};
export function subSecs(d:Date,s:number){return subSeconds(d,s)};
export function addDs(d:Date,ds:number){return addDays(d,ds)};
export function subDs(d:Date,ds:number){return subDays(d,ds)};
export function isSM(d1:Date,d2:Date){return isSameMinute(d1,d2)};
export function gD(d:Date):number{return getDay(d)};
export function gY(d:Date):number{return getYear(d)};
export function parseStr(Dstr:string,strF:string):Date{return parse(Dstr,strF,new Date())};
export function isTM(d:Date):boolean{return isTomorrow(d)};
export function isSY(d1:Date,d2:Date):boolean{return isSameYear(d1,d2)};
export function isSS(d1:Date,d2:Date):boolean{return isSameSecond(d1,d2)};
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////