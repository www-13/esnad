
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const allRoutes = require('./routes/allRoutes');
const path = require('path');
const booksRoutes = require('./routes/books');

const app = express();
const port = process.env.PORT || 3001;

// Connect to MongoDB
mongoose.connect(process.env.MONG_URL)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set true only if HTTPS
}));

app.use((req, res, next) => {
  console.log('Session:', req.session);
  next();
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/', allRoutes);
app.use(booksRoutes);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});




