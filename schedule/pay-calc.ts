import { myPublicHolidays } from './fairworkVars';
import { intervalToDuration, isSameDay, getYear, getMonth, getDate, endOfDay, startOfDay, addMinutes } from 'date-fns';
import { dUT,gD,gUT,gY,parseStr,isSD } from './timedate-fns';
import * as _ from 'lodash';
////////////////////////////////////////////////////////////////////////////////////////////////////
export const mPR:any = { base: { 0:38.36, 1:27.40, 2:27.40, 3:27.40, 4:27.40, 5:27.40, 6:32.88 }, penalty: { hrs: { night: { start:{h:0,m:0,s:0}, end:{h:5,m:59,s:59} }, eve: { start:{h:22,m:0,s:0}, end:{h:23,m:59,s:59} } }, 0: {night:0,eve:0}, 1: {night:3.40,eve:2.27}, 2: {night:3.40,eve:2.27}, 3: {night:3.40,eve:2.27}, 4: {night:3.40,eve:2.27}, 5: {night:3.40,eve:2.27}, 6: {n:0,e:0} }, ph: 54.80 };
////////////////////////////////////////////////////////////////////////////////////////////////////
export function r2d(no:number):number{const rN:number=Math.round((no+Number.EPSILON)*100)/100;const rS:string=rN.toFixed(2);const nN:number=+rS; return nN};
////////////////////////////////////////////////////////////////////////////////////////////////////
export async function getShiftPay(shiftObj:any):Promise<any> {
  const sO:any=shiftObj;let shiftCalcArr:any[]=[];
  //let hasPH:boolean;this.inclPublicHoliday(sO).s.res||this.inclPublicHoliday(sO).e.res?hasPH=true:hasPH=false;if(hasPH){console.log('Includes Public Holiday - Skipping.');return};
  const sTDate:Date=dUT(sO.StartTime);const eTDate:Date=dUT(sO.EndTime);const sTDay:number=gD(sTDate);const eTDay:number=gD(eTDate);
  const getNoSplitDur=():any=>{let gNSDRes:any=[{day:<number>sTDay,start:<Date>sTDate,end:<Date>eTDate,dur:<Duration>{}}];gNSDRes[0].dur=intervalToDuration({start:sTDate,end:eTDate});return gNSDRes};
  const getSplitDur=():any=>{let gSDRes:any=[{day:<number>sTDay,start:<Date|null>null,end:<Date|null>null,dur:<Duration>{}},{day:<number>eTDay,start:<Date|null>null,end:<Date|null>null,dur:<Duration>{}}];gSDRes[0].start=sTDate;gSDRes[0].end=endOfDay(sTDate);gSDRes[0].dur=intervalToDuration({start:sTDate,end:(endOfDay(sTDate))});gSDRes[1].start=startOfDay(eTDate);gSDRes[1].end=eTDate;gSDRes[1].dur=intervalToDuration({start:(startOfDay(eTDate)),end:eTDate});return gSDRes};
  let isSplit:boolean;if(isSameDay(sTDate,eTDate)){isSplit=false}else{isSplit=true};
  isSplit?shiftCalcArr=getSplitDur():shiftCalcArr=getNoSplitDur();
  ///////////////////////////////////////////////////////////////
  let basePay:number=0;let penaltyPay:number=0;let payTotal:number=0;
  for(let sSec=0;sSec<shiftCalcArr.length;sSec++){
    const tSSec:any=shiftCalcArr[sSec];
    // Base Pay
    const secBRate:number=mPR.base[tSSec.day];
    const secBRateHrs:number=tSSec.dur.hours+(r2d(tSSec.dur.minutes/60));
    const secBPay:number=r2d((secBRateHrs*secBRate));
    basePay+=secBPay;
    // Penalty Pay
    if(tSSec.day>=1&&tSSec.day<=5){
      const ePSA:any[]=[(getYear(tSSec.start)),(getMonth(tSSec.start)),(getDate(tSSec.start)),mPR.penalty.hrs.eve.start.h,mPR.penalty.hrs.eve.start.m,mPR.penalty.hrs.eve.start.s];
      const ePSD:Date=new Date(ePSA[0],ePSA[1],ePSA[2],ePSA[3],ePSA[4],ePSA[5]);const ePSU:number=gUT(ePSD);
      const ePEA:any[]=[(getYear(tSSec.start)),(getMonth(tSSec.start)),(getDate(tSSec.start)),mPR.penalty.hrs.eve.end.h,mPR.penalty.hrs.eve.end.m,mPR.penalty.hrs.eve.end.s];
      const ePED:Date=new Date(ePEA[0],ePEA[1],ePEA[2],ePEA[3],ePEA[4],ePEA[5]);const ePEU:number=gUT(ePED);
      const isEveP=(tT:number):boolean=>{if(tT>=ePSU&&tT<=ePEU){return true}else{return false}};
      const nPSA:any[]=[(getYear(tSSec.start)),(getMonth(tSSec.start)),(getDate(tSSec.start)),mPR.penalty.hrs.night.start.h,mPR.penalty.hrs.night.start.m,mPR.penalty.hrs.night.start.s];
      const nPSD:Date=new Date(nPSA[0],nPSA[1],nPSA[2],nPSA[3],nPSA[4],nPSA[5]);const nPSU:number=gUT(nPSD);
      const nPEA:any[]=[(getYear(tSSec.start)),(getMonth(tSSec.start)),(getDate(tSSec.start)),mPR.penalty.hrs.night.end.h,mPR.penalty.hrs.night.end.m,mPR.penalty.hrs.night.end.s];
      const nPED:Date=new Date(nPEA[0],nPEA[1],nPEA[2],nPEA[3],nPEA[4],nPEA[5]);const nPEU:number=gUT(nPED);
      const isNightP=(tT:number):boolean=>{if(tT>=nPSU&&tT<=nPEU){return true}else{return false}};
      const tSecStartUT:number=gUT(tSSec.start);const tSecEndUT:number=gUT(tSSec.end);
      const isShiftSec=(tT:number):boolean=>{if(tT>=tSecStartUT&&tT<=tSecEndUT){return true}else{return false}};
      // Evening Penalty
      if(isShiftSec(ePSU)||isShiftSec(ePEU)){
        const secPEveRate:number=mPR.penalty[tSSec.day].eve;
        let secPEveDur:any={hours:0,minutes:0};let secAllEveMinsCount=0;
        const secAllEveMins:number=tSSec.dur.minutes+(tSSec.dur.hours*60);
        for(let secMs=0;secMs<secAllEveMins;secMs++){const etTUnixMin:number=gUT((addMinutes(tSSec.start,secMs)));if(isEveP(etTUnixMin)){secPEveDur.minutes++}};
        if(secAllEveMinsCount>0){secPEveDur.hours=Math.floor(secAllEveMins/60);secPEveDur.minutes=secAllEveMins-(secPEveDur.hours*60)};
        const secPEveRateHrs:number=secPEveDur.hours+(r2d(secPEveDur.minutes/60));
        const secPEvePay:number=r2d((secPEveRateHrs*secPEveRate));
        penaltyPay+=secPEvePay;
      }
      // Night Penalty
      if(isShiftSec(nPSU)||isShiftSec(nPEU)){
        const secPNightRate:number=mPR.penalty[tSSec.day].night;
        let secPNightDur:any={hours:0,minutes:0};let secAllNightMinsCount=0;
        const secAllNightMins:number=tSSec.dur.minutes+(tSSec.dur.hours*60);
        for(let secMs=0;secMs<secAllNightMins;secMs++){const ntTUnixMin:number=gUT((addMinutes(tSSec.start,secMs)));if(isNightP(ntTUnixMin)){secPNightDur.minutes++}};
        if(secAllNightMinsCount>0){secPNightDur.hours=Math.floor(secAllNightMins/60);secPNightDur.minutes=secAllNightMins-(secPNightDur.hours*60)};
        const secPNightRateHrs:number=secPNightDur.hours+(r2d(secPNightDur.minutes/60));
        const secPNightPay:number=r2d((secPNightRateHrs*secPNightRate));
        penaltyPay+=secPNightPay;
      }
    }
  }
  ///////////////////////////////////////////////////////////////
  r2d(basePay);
  r2d(penaltyPay);
  payTotal=basePay+penaltyPay;
  r2d(payTotal);
  return Promise.resolve({b:basePay,p:penaltyPay,t:payTotal});
}
////////////////////////////////////////////////////////////////////////////////////////////////////
export function inclPublicHoliday(sO:any):any {
  const sDate:Date=dUT(sO.StartTime);const eDate:Date=dUT(sO.EndTime);
  const sSY:number=gY(sDate);const sEY:number=gY(eDate);
  let pHolsYrs:any[]=[];let pHolsDates:any[]=[];
  sSY===sEY?pHolsYrs=[sSY]:pHolsYrs=[sSY,sEY];
  for(let y=0;y<pHolsYrs.length;y++){
    const tYHols:any[]=myPublicHolidays[pHolsYrs[y]];
    for(let h=0;h<tYHols.length;h++){
      const tHolDate:Date=parseStr(tYHols[h],'dd/MM/yyyy');
      pHolsDates.push(tHolDate)
    }
  };
  let sOnPH:any={res:false,ph:null};let eOnPH:any={res:false,ph:null};
  const sMatch:any[]=pHolsDates.filter(pH=>isSD(sDate,pH));
  if(sMatch.length>0){sOnPH.res=true;sOnPH.ph=sMatch[0]};
  const eMatch:any[]=pHolsDates.filter(pH=>isSD(eDate,pH));
  if(eMatch.length>0){eOnPH.res=true;eOnPH.ph=eMatch[0]};
  return {s:sOnPH,e:eOnPH}
}
////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
