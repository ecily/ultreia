import mongoose from 'mongoose'

const { Schema } = mongoose
const { ObjectId } = mongoose.Schema

const hotelSchema = new Schema({
    title: {
        type: String,
        required: 'The title is required'
    },
    content: {
        type: String,
        required: 'Content is required',
        maxlength: 10000,
    },
    location: {
        type: String,
        required: 'The location is required'
    },
    price: {
        type: Number,
        required: 'The price is required',
        trim: true
    },
    postedBy: {
        type: ObjectId,
        red: "User"
    },
    
    //think of uploading to cloudinary in production
    image: {
        data: Buffer,
        contentType: String,
    },
    from: {
        type: Date,
    },
    to: {
        type: Date,
    },
    bed: {
        type: Number
    }        
}, {timestamps: true})

export default mongoose.model('Hotel', hotelSchema)