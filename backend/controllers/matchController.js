// /controllers/matchController.js
import User from '../models/User.js';
import Offer from '../models/Offer.js';
import NotificationLog from '../models/NotificationLog.js';
import sendPushNotification from '../utils/sendPushNotification.js';
import moment from 'moment';

export const checkForMatchingOffers = async (req, res) => {
  console.log('📥 Match-Check gestartet mit:', req.body);

  try {
    const { userId, location } = req.body;
    if (!userId || !location?.lat || !location?.lng) {
      return res.status(400).json({ message: 'userId und vollständige location erforderlich' });
    }

    const user = await User.findById(userId);
    if (!user || !user.expoPushToken) {
      return res.status(404).json({ message: 'User oder Push-Token nicht gefunden' });
    }

    const userInterests = user.interests || [];
    const maxRadius = user.preferredRadius || 500;

    const offers = await Offer.find({
      subcategory: { $in: userInterests },
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [location.lng, location.lat]
          },
          $maxDistance: maxRadius
        }
      }
    });

    const now = moment();
    const weekday = now.format('dddd');
    let sent = 0;

    for (const offer of offers) {
      const { validDates, validDays, validTimes } = offer;

      const isDayValid = validDays?.includes(weekday);
      const isDateValid = now.isBetween(moment(validDates?.from), moment(validDates?.to).endOf('day'), null, '[]');
      const isTimeValid = isWithinTimeRange(validTimes?.start, validTimes?.end, now);

      if (!isDayValid || !isDateValid || !isTimeValid) {
        console.log(`⏱️ Angebot ${offer.name} nicht gültig – übersprungen`);
        continue;
      }

      const alreadyNotified = await NotificationLog.findOne({
        userId,
        offerId: offer._id,
        date: { $gte: moment().startOf('day').toDate() }
      });

      if (alreadyNotified) {
        console.log(`🔁 Bereits benachrichtigt: ${offer.name}`);
        continue;
      }

      const payload = {
        title: `🎯 ${offer.name}`,
        body: offer.description || 'Jetzt in deiner Nähe aktiv!',
        data: {
          screen: 'OfferDetails',
          offerId: offer._id.toString()
        }
      };

      console.log('📦 Push Payload:', payload);

      const result = await sendPushNotification(user.expoPushToken, payload);
      console.log('📲 Push-Ergebnis:', result);

      await NotificationLog.create({
        userId,
        offerId: offer._id,
        date: new Date()
      });

      console.log(`✅ Push gesendet: ${offer.name} an ${user.email}`);
      sent++;

      // Nur **eine** Notification pro Durchlauf
      return res.json({
        message: `Notification: ${offer.name}`,
        offerId: offer._id.toString()
      });
    }

    res.json({ message: 'Keine passenden Angebote im Radius & Zeitfenster gefunden.' });
  } catch (err) {
    console.error('❌ Match-Check Fehler:', err);
    res.status(500).json({ message: 'Serverfehler beim Matching.' });
  }
};

// ⏱️ Hilfsfunktion zur Zeitprüfung
function isWithinTimeRange(startTime, endTime, now) {
  if (!startTime || !endTime) return false;
  const format = 'HH:mm';
  const start = moment(startTime, format);
  const end = moment(endTime, format);

  // Umgang mit übernachtenden Zeitfenstern (z. B. 22:00 – 03:00)
  if (end.isBefore(start)) {
    return now.isAfter(start) || now.isBefore(end);
  }

  return now.isBetween(start, end);
}
