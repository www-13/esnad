const express = require('express');
const router = express.Router();
const User = require('../models/customerSchema');
const Book = require('../models/book');  // Adjust the path if needed
const methodOverride = require('method-override');
router.use(methodOverride('_method'));

// Middleware to check if user is logged in
function isLoggedIn(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/login');
  }
}

// Middleware to check if user has selected topics
async function hasSelectedTopics(req, res, next) {
  try {
    const user = await User.findById(req.session.userId);
    if (user && user.favoriteTopics && user.favoriteTopics.length > 0) {
      next();
    } else {
      res.redirect('/favorite-topics');
    }
  } catch (err) {
    console.error(err);
    res.redirect('/login');
  }
}

// Middleware to protect admin routes
function isAdmin(req, res, next) {
  if (req.session.isAdmin) {
    next();
  } else {
    res.redirect('/login');
  }
}

// Redirect root URL (/) to guest page
router.get('/', (req, res) => {
  res.redirect('/landing');
});

router.get('/landing', (req, res) => {
  res.render('landing')
});

// Render login page
router.get('/login', (req, res) => {
  res.render('login', { 
    loginError: null, 
    signupError: null,
    showFavoriteTopics: false 
  });
});

// Handle signup
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).render('login', {
        signupError: 'Email already registered',
        loginError: null,
        showFavoriteTopics: false
      });
    }

    const newUser = new User({ name, email, password });
    await newUser.save();

    req.session.userId = newUser._id;
    req.session.userName = newUser.name;
    
    // Redirect to favorite topics instead of index
    res.redirect('/favorite-topics');
  } catch (err) {
    console.error(err);
    res.status(500).render('login', {
      signupError: 'Server error',
      loginError: null,
      showFavoriteTopics: false
    });
  }
});

// Handle login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Admin accounts list
  const adminUsers = [
    { email: 'adamprog13@gmail.com', password: 'adam-abed-elprog_13' },
    { email: 'aser15abed@gmail.com', password: 'aser_abed15' },
    { email: 'farag123@gmail.com', password: '123123' },
    { email: 'hamzamsakr@gmail.com', password: 'H@mza2012' },
    { email: 'omar123@gmail.com', password: '123123' },
  ];

  // Check if user is admin
  const admin = adminUsers.find(
    (user) => user.email === email && user.password === password
  );

  if (admin) {
    req.session.isAdmin = true;
    req.session.adminEmail = email;
    return res.redirect('/admin'); // Redirect admins to /admin page
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).render('login', {
        loginError: 'No account found with that email',
        signupError: null,
        showFavoriteTopics: false
      });
    }

    if (user.password.trim() !== password.trim()) {
      return res.status(400).render('login', {
        loginError: 'Incorrect password',
        signupError: null,
        showFavoriteTopics: false
      });
    }

    req.session.userId = user._id;
    req.session.userName = user.name;

    if (user.favoriteTopics && user.favoriteTopics.length > 0) {
      res.redirect('/index');
    } else {
      res.redirect('/favorite-topics');
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).render('login', {
      loginError: 'Server error',
      signupError: null,
      showFavoriteTopics: false
    });
  }
});

// Favorite topics selection page
router.get('/favorite-topics', isLoggedIn, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (user.favoriteTopics && user.favoriteTopics.length > 0) {
      return res.redirect('/index');
    }
    
    res.render('login', { 
      showFavoriteTopics: true,
      loginError: null,
      signupError: null
    });
  } catch (err) {
    console.error(err);
    res.redirect('/login');
  }
});

// Handle favorite topics submission
router.post('/favorite-topics', isLoggedIn, async (req, res) => {
  try {
    const topics = Array.isArray(req.body.topics) 
      ? req.body.topics 
      : [req.body.topics].filter(Boolean);

    await User.findByIdAndUpdate(req.session.userId, {
      favoriteTopics: topics
    });

    res.redirect('/index');
  } catch (err) {
    console.error(err);
    res.redirect('/favorite-topics');
  }
});

// Protected index route (requires topics selection)
router.get('/index', isLoggedIn, hasSelectedTopics, async (req, res) => {
  try {
    const books = await Book.find();
    console.log('Books fetched:', books.length);  // Should print number of books
    res.render('index', { userName: req.session.userName, books });
  } catch (err) {
    console.error('Error loading books:', err);
    res.status(500).send('Server error loading books.');
  }
});

// Logout route
router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) console.error(err);
    res.redirect('/login');
  });
});

// Guest button route — no profile, just render index with books
router.get('/guest', async (req, res) => {
  req.session.userId = null;
  req.session.userName = 'Guest';

  try {
    const books = await Book.find();
    res.render('index', { userName: 'Guest', books });
  } catch (err) {
    console.error(err);
    res.render('index', { userName: 'Guest', books: [] });
  }
});

// Dynamic book detail page
router.get('/book/:id', async (req, res) => {
  try {
    const bookId = req.params.id;
    const book = await Book.findById(bookId);

    if (!book) {
      return res.status(404).send('Book not found');
    }

    res.render('bookp', { book, userName: req.session.userName }); // Send book data to bookp.ejs
  } catch (err) {
    console.error('Error fetching book:', err);
    res.status(500).send('Server error');
  }
});


// API route to get all books
router.get('/api/books', async (req, res) => {
  try {
    const books = await Book.find(); // Fetch all books from MongoDB
    res.json(books);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /books/view/:id - Add book to user's recently viewed
router.post('/books/view/:id', isLoggedIn, async (req, res) => {
  try {
    const bookId = req.params.id;

    // Find book details
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).send('Book not found');
    }

    // Find user
    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.redirect('/login');
    }

    // Check if book is already in recentlyBooks
    const alreadyExists = user.recentlyBooks.find(
      (b) => b.bookId.toString() === bookId
    );

    if (!alreadyExists) {
      // Add to recentlyBooks
      user.recentlyBooks.unshift({
        bookId: book._id,
        title: book.title,
        author: book.author,
        category: book.category,
        coverImage: book.image, // optional
        pdf: book.pdf // Add the pdf link
      });

      // Limit recentlyBooks to 10
      if (user.recentlyBooks.length > 10) {
        user.recentlyBooks = user.recentlyBooks.slice(0, 10);
      }

      await user.save();
    }

    // Redirect to the book PDF
    res.redirect(book.pdf);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// ======= Admin Routes =======

// GET /admin - render admin dashboard with books list
router.get('/admin', isAdmin, async (req, res) => {
  try {
    const books = await Book.find();
    res.render('admin', { books, message: null });
  } catch (err) {
    console.error(err);
    res.render('admin', { books: [], message: 'Error loading books' });
  }
});

// POST /admin - add new book
router.post('/admin', isAdmin, async (req, res) => {
  const {
    title,
    author,
    category,
    image,
    pdf,
    description,
    pages,
    language,
    year
  } = req.body;

  try {
    const newBook = new Book({
      title,
      author,
      category,
      image,
      pdf,
      description,
      pages,
      language,
      year
    });

    await newBook.save();
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    try {
      const books = await Book.find();
      res.render('admin', { books, message: 'Error adding book. Please try again.' });
    } catch {
      res.render('admin', { books: [], message: 'Error adding book and loading books.' });
    }
  }
});

// POST /admin/delete/:id - delete a book by ID
router.post('/admin/delete/:id', isAdmin, async (req, res) => {
  try {
    await Book.findByIdAndDelete(req.params.id);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.redirect('/admin');
  }
});


// Updated profile route with recentlyBooks (only for logged-in users)
router.get('/profile', isLoggedIn, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).lean();

    res.render('profile', {
      user: {
        name: user.name,
        email: user.email,
        favoriteTopics: user.favoriteTopics || [],
        booksRead: user.booksRead || [],
        currentlyReading: user.currentlyReading || [],
        recentlyBooks: user.recentlyBooks || []
      }
    });
  } catch (err) {
    console.error(err);
    res.redirect('/login');
  }
});

router.delete('/profile/recentlyBooks/:bookId', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.userId; // use session userId here
    const bookId = req.params.bookId;

    await User.updateOne(
      { _id: userId },
      { $pull: { recentlyBooks: { bookId: bookId } } }
    );

    res.redirect('/profile');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});


module.exports = router;


/* 

*/
