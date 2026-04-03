import mongoose from 'mongoose';

const clientDiagLogSchema = new mongoose.Schema(
  {
    deviceId: { type: String, index: true },
    platform: { type: String, index: true },
    appVersion: { type: String },
    buildNumber: { type: String },
    event: { type: String, required: true, index: true },
    level: { type: String, default: 'info' },
    data: { type: mongoose.Schema.Types.Mixed },
    receivedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

// Auto-expire logs after 14 days by default (configurable)
clientDiagLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: Number(process.env.CLIENT_DIAG_TTL_SECONDS || 14 * 24 * 60 * 60) }
);

export default mongoose.model('ClientDiagLog', clientDiagLogSchema);
