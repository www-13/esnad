const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  favoriteTopics: [{
    type: String,
    enum: ['Fiction', 'Science Fiction', 'Mystery', 'Romance', 'Fantasy', 
           'History', 'Biography', 'Self Help', 'Technology', 'Travel', 
           'Health', 'Business']
  }],
  recentlyBooks: [{
    bookId: {
      type: mongoose.Schema.Types.ObjectId, // ID of the book from the books collection
      ref: 'Book'
    },
    title: String,
    author: String,
    category: String,
    coverImage: String, // optional
    pdf: String,        // PDF link added here
    viewedAt: {
      type: Date,
      default: Date.now
    }
  }],
  plan: {
    type: String,
    enum: ['free', 'pro'],
    default: 'free'
  },
  planStart: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);