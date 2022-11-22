export interface AppUser {
  id?:number|null,
  email:string,
  password:string,
  dp_token:string,
  dp_refresh:string,
  dp_expires?:number,
  dp_domain?:string,
  fcm_token?:string,
  fb_uid?:string,
  app_uuk?:string,
  app_prefs?:boolean,
  app_dbbu?:boolean,
  modified?:number|null
}