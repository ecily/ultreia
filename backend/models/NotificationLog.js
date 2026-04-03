// /models/NotificationLog.js
import mongoose from 'mongoose';

const logSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  offerId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Offer' },
  date: { type: Date, required: true }
});

export default mongoose.model('NotificationLog', logSchema);
