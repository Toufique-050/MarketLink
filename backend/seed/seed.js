require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const connectDB = require("../src/config/db");

const User = require("../src/models/User");
const Market = require("../src/models/Market");
const Category = require("../src/models/Category");
const Product = require("../src/models/Product");
const PickupSlot = require("../src/models/PickupSlot");
const Order = require("../src/models/Order");
const Favorite = require("../src/models/Favorite");
const Review = require("../src/models/Review");
const Notification = require("../src/models/Notification");
const WeeklyStock = require("../src/models/WeeklyStock");

async function seed() {
  await connectDB();

  await Promise.all([
    User.deleteMany({}),
    Market.deleteMany({}),
    Category.deleteMany({}),
    Product.deleteMany({}),
    PickupSlot.deleteMany({}),
    Order.deleteMany({}),
    Favorite.deleteMany({}),
    Review.deleteMany({}),
    Notification.deleteMany({}),
    WeeklyStock.deleteMany({})
  ]);

  const password = await bcrypt.hash("MarketLink@123", 12);

  const admin = await User.create({
    name: "MarketLink Admin", email: "admin@marketlink.com", password, role: "admin"
  });

  const farmer = await User.create({
    name: "Green Valley Farmer",
    email: "farmer@marketlink.com",
    password,
    phone: "0300-1111111",
    address: "Karachi, Pakistan",
    role: "farmer",
    farmerProfile: {
      stallName: "Green Valley Produce",
      contactPerson: "Ahmed Khan",
      businessAddress: "Karachi, Pakistan",
      operatingDays: ["Saturday", "Sunday"],
      pickupWindowStart: "09:00",
      pickupWindowEnd: "15:00",
      cutoffMinutes: 120,
      latitude: 24.8607,
      longitude: 67.0011,
      approvalStatus: "approved"
    }
  });

  const customer = await User.create({
    name: "Demo Customer",
    email: "customer@marketlink.com",
    password,
    phone: "0300-2222222",
    address: "Karachi, Pakistan",
    role: "customer"
  });

  const market = await Market.create({
    name: "City Fresh Farmers Market",
    address: "Karachi, Pakistan",
    operatingDays: ["Saturday", "Sunday"],
    openingTime: "08:00",
    closingTime: "16:00",
    latitude: 24.8607,
    longitude: 67.0011,
    mapProvider: "OpenStreetMap",
    farmers: [farmer._id]
  });

  farmer.farmerProfile.markets = [market._id];
  await farmer.save();

  const names = ["Vegetables", "Fruits", "Dairy", "Baked Goods", "Herbs"];
  const categories = await Category.insertMany(names.map(name => ({ name, description: `${name} products` })));

  const byName = Object.fromEntries(categories.map(c => [c.name, c]));

  await Product.deleteMany({});
  const products = await Product.insertMany([
    { farmer: farmer._id, market: market._id, category: byName.Vegetables._id, name: "Fresh Tomatoes", description: "Locally grown tomatoes", price: 250, unit: "kg", quantityAvailable: 30 },
    { farmer: farmer._id, market: market._id, category: byName.Vegetables._id, name: "Organic Spinach", description: "Fresh weekly spinach", price: 180, unit: "bunch", quantityAvailable: 25 },
    { farmer: farmer._id, market: market._id, category: byName.Fruits._id, name: "Mangoes", description: "Seasonal sweet mangoes", price: 450, unit: "kg", quantityAvailable: 20 },
    { farmer: farmer._id, market: market._id, category: byName.Dairy._id, name: "Farm Fresh Milk", description: "Fresh local milk", price: 300, unit: "liter", quantityAvailable: 15 },
    { farmer: farmer._id, market: market._id, category: byName["Baked Goods"]._id, name: "Whole Wheat Bread", description: "Fresh baked bread", price: 220, unit: "loaf", quantityAvailable: 12 },
    { farmer: farmer._id, market: market._id, category: byName.Herbs._id, name: "Fresh Coriander", description: "Fresh coriander bunches", price: 80, unit: "bunch", quantityAvailable: 40 }
  ]);

  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  const day = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() + (day === 0 ? -6 : 1 - day));
  await WeeklyStock.insertMany(products.map(product => ({
    product: product._id, farmer: farmer._id, weekStart, quantity: product.quantityAvailable,
    unit: product.unit, price: product.price, soldOut: false
  })));

  const pickupDate = new Date();
  pickupDate.setHours(0, 0, 0, 0);
  // Choose the next Saturday so the seeded slots always match the farmer/market schedule.
  const daysUntilSaturday = (6 - pickupDate.getDay() + 7) % 7 || 7;
  pickupDate.setDate(pickupDate.getDate() + daysUntilSaturday);

  await PickupSlot.create([
    { farmer: farmer._id, market: market._id, date: pickupDate, startTime: "09:00", endTime: "10:00", capacity: 10 },
    { farmer: farmer._id, market: market._id, date: pickupDate, startTime: "10:00", endTime: "11:00", capacity: 10 },
    { farmer: farmer._id, market: market._id, date: pickupDate, startTime: "11:00", endTime: "12:00", capacity: 10 }
  ]);

  await Notification.create({
    user: customer._id, type: "ANNOUNCEMENT", title: "Welcome to MarketLink",
    message: "Browse local farmers, products and pickup markets."
  });

  console.log("Seed complete.");
  console.log("Admin   : admin@marketlink.com/ MarketLink@123");
  console.log("Farmer  : farmer@marketlink.com / MarketLink@123");
  console.log("Customer: customer@marketlink.com / MarketLink@123");

  await mongoose.connection.close();
}

seed().catch(async err => {
  console.error("Seed failed:", err);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
