import Hotel from '../models/hotel'
//read the image
import fs from 'fs'

export const create = async (req, res) => {
    // console.log('req fields', req.fields)
    // console.log('req files', req.files)
    try {
        let fields = req.fields
        let files = req.files

        let hotel = new Hotel(fields)
        //handle the image
        if(files.image) {
            hotel.image.data = fs.readFileSync(files.image.path)
            hotel.image.contentType = files.image.type
        }
        hotel.save((err, result) => {
            if(err) {
                console.log('Saving hotel error', err)
                res.status(400).send('Error while saving')
            }
            res.json(result)
        })
    } catch (err) {
        console.log(err)
    //     res.send(400).json({
    //         err: err.message 
    //     })
    }

}