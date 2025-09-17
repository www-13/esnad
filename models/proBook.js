// models/proBook.js
const mongoose = require('mongoose');

const proBookSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  author: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  category: { type: String, trim: true },
  pdf: { type: String, required: true },
  image: { type: String, default: '' },
  pages: { type: Number, default: 0 },
  language: { type: String, default: 'English' },
  year: { type: String, default: '' },

  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ProBook', proBookSchema);