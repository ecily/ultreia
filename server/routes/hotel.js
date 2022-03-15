//because image is sent, we need a middleware in order to receive data
import formidable from 'express-formidable'
import { requireSignin } from '../middlewares'
import { create, hotels, sellerHotels, image } from '../controllers/hotel' 
import express from 'express'
const router = express.Router()
//controllers

router.post('/create-hotel', requireSignin, formidable(), create)
router.get('/hotels', hotels)
router.get('/hotel/image/:hotelId', image)
router.get('/seller-hotels', requireSignin, sellerHotels)

module.exports = router