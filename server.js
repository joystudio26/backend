const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

// =====================
// Models
// =====================
const Admin = require("./models/Admin");
const Supplier = require("./models/Supplier");
const Product = require("./models/Product");
const Sale = require("./models/Sale");

// =====================
// MongoDB Connection
// =====================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));
// =====================
// Admin Routes
// =====================
app.post("/api/admin/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const exists = await Admin.findOne({ email });
    if (exists) return res.status(400).json({ message: "Admin already exists" });

    const admin = new Admin({ username, email, password });
    await admin.save();

    const token = jwt.sign({ id: admin._id }, "secretkey123", { expiresIn: "1d" });
    res.json({ token, admin });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });
    if (!admin || !(await admin.comparePassword(password)))
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: admin._id }, "secretkey123", { expiresIn: "1d" });
    res.json({ token, admin });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// =====================
// Supplier Routes
// =====================
app.post("/api/supplier/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const exists = await Supplier.findOne({ email });
    if (exists) return res.status(400).json({ message: "Supplier already exists" });

    const supplier = new Supplier({ name, email, password });
    await supplier.save();

    const token = jwt.sign({ id: supplier._id }, "secretkey123", { expiresIn: "1d" });
    res.json({ token, supplier });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/supplier/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const supplier = await Supplier.findOne({ email });
    if (!supplier || !(await supplier.comparePassword(password))) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: supplier._id, role: "supplier" },
      "secretkey123",
      { expiresIn: "1d" }
    );

    res.json({ token, supplier });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// =====================
// Product Routes
// =====================
app.post("/api/products", async (req, res) => {
  try {
    const { name, barcode, supplier, variants } = req.body;

    const exists = await Product.findOne({ barcode });
    if (exists) return res.status(400).json({ message: "Product already exists" });

    const product = new Product({ name, barcode, supplier, variants });
    await product.save();

    res.json(product);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find().populate("supplier");
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.put("/api/products/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    product.name = req.body.name || product.name;
    product.variants = req.body.variants || product.variants;

    await product.save();
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// =====================
// SELL PRODUCT (BARCODE + INVENTORY)
// =====================
app.post("/api/sell", async (req, res) => {
  try {
    const {
      barcode,
      productId,
      variantId,
      quantity,
      paymentType,
      soldBy,
      soldByModel,
    } = req.body;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ message: "Invalid quantity" });
    }

    let product;
    let variant;
    let variantIndex;

    // =====================
    // BARCODE SELL
    // =====================
    if (barcode) {
      product = await Product.findOne({ barcode });
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      variantIndex = 0;
      variant = product.variants[variantIndex];
    }

    // =====================
    // MANUAL / INVENTORY SELL
    // =====================
    else if (productId && variantId) {
      product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      variantIndex = product.variants.findIndex(
        (v) => v._id.toString() === variantId
      );

      if (variantIndex === -1) {
        return res.status(404).json({ message: "Variant not found" });
      }

      variant = product.variants[variantIndex];
    } else {
      return res.status(400).json({ message: "Invalid sell request" });
    }

    // =====================
    // STOCK CHECK
    // =====================
    if (variant.stock < quantity) {
      return res.status(400).json({ message: "Not enough stock" });
    }

    // =====================
    // UPDATE STOCK
    // =====================
    variant.stock -= quantity;
    await product.save();

    // =====================
    // SAVE SALE
    // =====================
    const sale = new Sale({
      product: product._id,
      variantIndex,
      quantity,
      paymentType,
      totalAmount: variant.price * quantity,
      soldBy,
      soldByModel,
    });

    await sale.save();

    res.json({
      message: "Sale successful",
      sale,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
// =====================
// GET SALES HISTORY
// =====================
app.get("/api/sales", async (req, res) => {
  try {
    const sales = await Sale.find()
      .populate("product")
      .populate("soldBy", "username name email")
      .sort({ createdAt: -1 }); // latest first

    res.json(sales);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
// =====================
// REPORTS & ANALYTICS
// =====================

// SALES BY PAYMENT TYPE
app.get("/api/reports/payment-types", async (req, res) => {
  try {
    const data = await Sale.aggregate([
      {
        $group: {
          _id: "$paymentType",
          total: { $sum: "$totalAmount" },
        },
      },
    ]);

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// DAILY SALES (LAST 7 DAYS)
app.get("/api/reports/daily", async (req, res) => {
  try {
    const data = await Sale.aggregate([
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          total: { $sum: "$totalAmount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// MONTHLY SALES (CURRENT YEAR)
app.get("/api/reports/monthly", async (req, res) => {
  try {
    const year = new Date().getFullYear();

    const data = await Sale.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(`${year}-01-01`),
            $lte: new Date(`${year}-12-31`),
          },
        },
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          total: { $sum: "$totalAmount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// YEARLY SALES
app.get("/api/reports/yearly", async (req, res) => {
  try {
    const data = await Sale.aggregate([
      {
        $group: {
          _id: { $year: "$createdAt" },
          total: { $sum: "$totalAmount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// =====================
// STAFF SALES ANALYTICS
// =====================
app.get("/api/reports/staff-sales", async (req, res) => {
  try {
    const sales = await Sale.aggregate([
      {
        $group: {
          _id: {
            soldBy: "$soldBy",
            soldByModel: "$soldByModel",
          },
          totalSales: { $sum: "$totalAmount" },
          totalQty: { $sum: "$quantity" },
        },
      },
    ]);

    // Populate staff info manually
    const results = [];
    for (const s of sales) {
      let staff = null;

      if (s._id.soldByModel === "Admin") {
        staff = await Admin.findById(s._id.soldBy);
      } else {
        staff = await Supplier.findById(s._id.soldBy);
      }

      if (staff) {
        results.push({
          name: staff.username || staff.name,
          role: s._id.soldByModel,
          totalSales: s.totalSales,
          totalQty: s.totalQty,
        });
      }
    }

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// =====================
// SUPPLIER PAYMENT REPORT
// =====================
app.get("/api/reports/supplier-payments", async (req, res) => {
  try {
    const sales = await Sale.aggregate([
      {
        $lookup: {
          from: "products",
          localField: "product",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $group: {
          _id: "$product.supplier",
          totalSales: { $sum: "$totalAmount" },
          totalQty: { $sum: "$quantity" },
        },
      },
    ]);

    const result = [];
    for (const s of sales) {
      const supplier = await Supplier.findById(s._id);
      if (!supplier) continue;

      result.push({
        supplierName: supplier.name,
        email: supplier.email,
        totalSales: s.totalSales,
        totalQty: s.totalQty,
      });
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
// =====================
// GET SINGLE SALE (FOR RECEIPT)
// =====================
app.get("/api/sales/:id", async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate("product")
      .populate("soldBy", "username name email");

    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    res.json(sale);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Start Server
// =====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
