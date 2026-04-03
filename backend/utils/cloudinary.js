// backend/utils/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Cloudinary Config
 *
 * Variante A: Nutzt CLOUDINARY_URL (empfohlen von Cloudinary selbst)
 *   CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
 *
 * Variante B: Nutzt 3 einzelne Variablen
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 */
if (process.env.CLOUDINARY_URL) {
  // Cloudinary parst automatisch CLOUDINARY_URL
  cloudinary.config(true);
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// Debug-Log nur in Development
if (process.env.NODE_ENV !== 'production') {
  console.log('🔧 Cloudinary konfiguriert:', {
    cloud_name: cloudinary.config().cloud_name ? '✅ gesetzt' : '❌ fehlt',
    api_key: cloudinary.config().api_key ? '✅ gesetzt' : '❌ fehlt',
  });
}

export default cloudinary;
