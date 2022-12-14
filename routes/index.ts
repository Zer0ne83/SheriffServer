//////////////////////////////////////////////////
///// IMPORTS
//////////////////////////////////////////////////
import {Router} from 'express';
import {appCtrlRoutes} from './app.routes';
import {baseRoutes} from './base.routes';
import {usersRoutes} from './users.routes';
import {msgRoutes} from './msg.routes';
import {fctRoutes} from './fct.routes';
import {schedRoutes} from './sched.routes';
//////////////////////////////////////////////////
const router:Router=Router();
//////////////////////////////////////////////////
router.use('/',baseRoutes);
router.use('/users',usersRoutes);
router.use('/app',appCtrlRoutes);
router.use('/msg',msgRoutes);
router.use('/fct',fctRoutes);
router.use('/sched',schedRoutes);
//////////////////////////////////////////////////
export const MainRouter:Router=router;
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////