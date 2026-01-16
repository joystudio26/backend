const mongoose = require("mongoose");

const SaleSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  variantIndex: Number,
  quantity: { type: Number, required: true },
  paymentType: {
    type: String,
    enum: ["Cash", "Card", "MobilePay"],
    required: true,
  },
  totalAmount: { type: Number, required: true },

  soldBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: "soldByModel",
  },
  soldByModel: {
    type: String,
    enum: ["Admin", "Supplier"],
    required: true,
  },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Sale", SaleSchema);
