//////////////////////////////////////////////////
///// IMPORTS
//////////////////////////////////////////////////
import {Router} from 'express';
import {msgController,testMsg,setFCM} from '../controllers/msg.controller';
//////////////////////////////////////////////////
const router:Router=Router();
//////////////////////////////////////////////////
router.route('/sendmsg').post(msgController);
router.route('/testmsg').post(testMsg);
router.route('/setfcm').post(setFCM);
//////////////////////////////////////////////////
export const msgRoutes:Router=router;
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////