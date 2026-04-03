import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const SubcategorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

SubcategorySchema.index({ category: 1, slug: 1 }, { unique: true, name: 'subcategory_category_slug_unique' });
SubcategorySchema.index({ category: 1, name: 1 }, { name: 'subcategory_category_name' });

export default model('Subcategory', SubcategorySchema);
