//because image is sent, we need a middleware in order to receive data
import formidable from 'express-formidable'
import { requireSignin } from '../middlewares'

import express from 'express'
const router = express.Router()
//controllers
import { create, hotels } from '../controllers/hotel' 

router.post('/create-hotel', requireSignin, formidable(), create)
router.get('/hotels', hotels)

module.exports = router