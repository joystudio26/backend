const mongoose = require("mongoose");

const VariantSchema = new mongoose.Schema({
  name: String,
  price: Number,
  stock: Number
});

const ProductSchema = new mongoose.Schema({
  name: String,
  barcode: String,
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier" },
  variants: [VariantSchema]
});

module.exports = mongoose.model("Product", ProductSchema);
