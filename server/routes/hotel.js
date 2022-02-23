//because image is sent, we need a middleware in order to receive data
import formidable from 'express-formidable'
import { requireSignin } from '../middlewares'

import express from 'express'
const router = express.Router()
//controllers
import { create } from '../controllers/hotel' 

router.post('/create-hotel', requireSignin, formidable(), create)

module.exports = router