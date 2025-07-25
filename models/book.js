const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  category: { type: String, required: true },
  image: { type: String }, // Optional book cover
  pdf: { type: String, required: true },
  
  // 🆕 New fields
  description: { type: String },
  pages: { type: Number },
  language: { type: String },
  year: { type: String }
  
}, { timestamps: true });

const Book = mongoose.models.Book || mongoose.model('Book', bookSchema);

module.exports = Book;
