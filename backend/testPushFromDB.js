// testPushFromDB.js
import mongoose from 'mongoose';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config(); // lädt .env für MONGODB_URI usw.

async function sendPushToUser(email) {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB verbunden');

    const user = await User.findOne({ email });
    if (!user) {
      console.error('❌ Kein User mit dieser E-Mail gefunden');
      return;
    }

    if (!user.expoPushToken) {
      console.error('⚠️ User hat keinen gespeicherten Push-Token');
      return;
    }

    const message = {
      to: user.expoPushToken,
      sound: 'default',
      title: '🚀 Testnachricht aus der Datenbank',
      body: `Hallo ${user.email}, das ist ein automatischer Push-Test!`,
      data: { screen: 'OfferDetails', offerId: 'demo-123' },
    };

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    const result = await res.json();
    console.log('📤 Push-Ergebnis:', result);
  } catch (err) {
    console.error('❌ Fehler beim Push-Test:', err);
  } finally {
    mongoose.connection.close();
  }
}

// 👉 HIER DIE TEST-E-MAIL EINES USERS EINTRAGEN:
sendPushToUser('andl.f@gmx.at');
