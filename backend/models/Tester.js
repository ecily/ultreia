import mongoose from "mongoose";

const testerSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true },

    validatedAt: { type: Date },
    acceptedAt: { type: Date },
    ndaVersion: { type: String },
    gateModalMessage: { type: String },
    status: { type: String, enum: ["pending", "validated", "accepted"], default: "pending" },
  },
  { timestamps: true }
);

export default mongoose.model("Tester", testerSchema);
