const express = require('express');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const router = express.Router();
const User = require('../models/customerSchema');
const Book = require('../models/book');  // Adjust the path if needed
const Pro = require('../models/proBook');  // Adjust the path if needed
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

// Middleware to check and handle Pro plan expiry
async function checkPlanExpiry(req, res, next) {
  try {
    const user = await User.findById(req.session.userId);
    
    if (user && user.plan === 'pro' && user.planStart) {
      const currentDate = new Date();
      const planStartDate = new Date(user.planStart);
      const monthsElapsed = (currentDate.getTime() - planStartDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
      
      // If more than 1 month has passed, downgrade to free
      if (monthsElapsed >= 1) {
        await User.findByIdAndUpdate(req.session.userId, {
          plan: 'free',
          planStart: null
        });
        
        console.log(`User ${req.session.userId} Pro plan expired, downgraded to free`);
        
        // Set a flag to show expiry message
        req.planExpired = true;
      }
    }
    
    next();
  } catch (err) {
    console.error('Plan expiry check error:', err);
    next();
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
  const adminUsers = JSON.parse(process.env.ADMIN_USERS);

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
      // Check user's plan and redirect accordingly
      if (user.plan === 'pro') {
        res.redirect('/pro');
      } else {
        res.redirect('/index');
      }
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
      // Check user's plan and redirect accordingly
      if (user.plan === 'pro') {
        return res.redirect('/pro');
      } else {
        return res.redirect('/index');
      }
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

    const user = await User.findByIdAndUpdate(req.session.userId, {
      favoriteTopics: topics
    }, { new: true }); // Return updated user

    // Check user's plan and redirect accordingly
    if (user.plan === 'pro') {
      res.redirect('/pro');
    } else {
      res.redirect('/index');
    }
  } catch (err) {
    console.error(err);
    res.redirect('/favorite-topics');
  }
});

// Protected index route (requires topics selection)
router.get('/index', isLoggedIn, checkPlanExpiry, hasSelectedTopics, async (req, res) => {
  try {
    const books = await Book.find();
    console.log('Books fetched:', books.length);  // Should print number of books
    res.render('index', { userName: req.session.userName, books });
  } catch (err) {
    console.error('Error loading books:', err);
    res.status(500).send('Server error loading books.');
  }
});

// Protected pro route (requires topics selection and pro plan)
router.get('/pro', isLoggedIn, checkPlanExpiry, hasSelectedTopics, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    
    // Check if plan just expired
    if (req.planExpired) {
      return res.redirect('/pricing?expired=true');
    }
    
    // Check if user has pro plan
    if (user.plan !== 'pro') {
      return res.redirect('/pricing');
    }
    
    const books = await Book.find();
    res.render('pro', { 
      userName: req.session.userName, 
      books,
      message: null
    });
  } catch (err) {
    console.error('Error loading pro page:', err);
    res.status(500).send('Server error loading pro page.');
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
router.get('/book/:id', isLoggedIn, async (req, res) => {
  try {
    const bookId = req.params.id;
    const book = await Book.findById(bookId);
    if (!book) return res.status(404).send('Book not found');

    // 🔹 Fetch the logged-in user, like in /profile
    const user = await User.findById(req.session.userId).lean();

    res.render('bookp', {
      book,
      userName: user.name, // or req.session.userName if you prefer
      user                // pass full user object to EJS so you can check user.plan
    });
  } catch (err) {
    console.error('Error fetching book:', err);
    res.status(500).send('Server error');
  }
});

router.get('/google-book/:id', isLoggedIn, async (req, res) => {
  const bookId = req.params.id;
  
  try {
    // Fetch book from Google Books API
    const response = await fetch(`https://www.googleapis.com/books/v1/volumes/${bookId}`);
    
    if (!response.ok) {
      console.error('Google Books API error:', response.statusText);
      return res.status(500).send('Error fetching books');
    }

    const googleBook = await response.json();
    console.log(googleBook)

    // Fetch logged-in user info for header
    const user = await User.findById(req.session.userId).lean();

    // Render the Google Books EJS page
    res.render('googleBP', {
      googleBook,
      userName: user.name,
      user
    });

  } catch (err) {
    console.error('Error fetching Google Book:', err);
    res.status(500).send('Server error fetching Book');
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

// POST /pro/books - add a new book (Pro users only)
router.post('/pro/books', isLoggedIn, async (req, res) => {
  try {
    const {
      title,
      author,
      description,
      category,
      pdf,
      image,
      pages,
      language,
      year
    } = req.body;

    // Make sure the user is Pro
    const user = await User.findById(req.session.userId);
    if (!user || user.plan !== 'pro') {
      return res.status(403).send('Only Pro users can add books.');
    }

    // Add book to main Book collection
    const newBook = new Book({
      title,
      author,
      description,
      category,
      pdf,
      image,
      pages,
      language,
      year,
      uploadedBy: user._id,   // track who uploaded it
      source: 'pro',           // optional flag
      price: 'Coming Soon'     // default
    });

    await newBook.save();
    res.redirect('/pro'); // redirect back to the Pro homepage
  } catch (err) {
    console.error('Error adding book:', err);
    res.status(500).send('Server error while adding book.');
  }
});

// GET /pro/books - optional: list books uploaded by the logged-in Pro user
router.get('/pro/books', isLoggedIn, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user || user.plan !== 'pro') {
      return res.status(403).send('Access denied.');
    }

    const books = await Book.find({ uploadedBy: user._id }).sort({ createdAt: -1 });

    // You can just send JSON or redirect somewhere
    res.json(books); // no separate view
  } catch (err) {
    console.error('Error fetching Pro books:', err);
    res.status(500).send('Server error.');
  }
});


// ======= Pricing and Payment Routes =======

// GET /pricing - render pricing page
router.get('/pricing', (req, res) => {
  const expired = req.query.expired === 'true';
  res.render('pricing', { 
    userName: req.session.userName || 'Guest',
    expired: expired
  });
});

// POST /pay - create PayPal order and return approval link
router.post('/pay', isLoggedIn, async (req, res) => {
  try {
    // Hardcoded PayPal credentials (as requested)
    const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID; // Replace with actual client ID
    const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET; // Replace with actual client secret
    const PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL; // Use sandbox for testing
    
    // Get PayPal access token
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
    
    const tokenResponse = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    
    // Create PayPal order
    const orderResponse = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'USD',
            value: '9.99'
          },
          description: 'Esnad Pro Monthly Subscription'
        }],
        application_context: {
          return_url: `${req.protocol}://${req.get('host')}/success`,
          cancel_url: `${req.protocol}://${req.get('host')}/pricing`
        }
      })
    });
    
    const orderData = await orderResponse.json();
    
    if (orderData.id) {
      // Find approval URL from links
      const approvalUrl = orderData.links.find(link => link.rel === 'approve').href;
      
      res.json({
        success: true,
        approvalUrl: approvalUrl
      });
    } else {
      throw new Error('Failed to create PayPal order');
    }
    
  } catch (err) {
    console.error('PayPal order creation error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Payment processing error. Please try again.' 
    });
  }
});

// GET /success - capture PayPal payment and upgrade user
router.get('/success', isLoggedIn, async (req, res) => {
  try {
    const { token } = req.query; // PayPal order ID
    
    if (!token) {
      return res.redirect('/pricing?error=invalid_payment');
    }
    
    // Hardcoded PayPal credentials (same as above)
    const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID; // Replace with actual client ID
    const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET; // Replace with actual client secret
    const PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL; // Use sandbox for testing
    
    // Get PayPal access token
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
    
    const tokenResponse = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    
    // Capture the payment
    const captureResponse = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${token}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const captureData = await captureResponse.json();
    
    // Check if payment was completed successfully
    if (captureData.status === 'COMPLETED') {
      // Update user's plan to 'pro' and set planStart date
      const userId = req.session.userId;
      
      await User.findByIdAndUpdate(userId, {
        plan: 'pro',
        planStart: new Date()
      });
      
      console.log(`User ${userId} upgraded to Pro plan successfully at ${new Date().toISOString()}`);
      
      // Render pro.ejs page
      const books = await Book.find();
      res.render('pro', {
        userName: req.session.userName,
        books: books,
        message: 'Welcome to Esnad Pro! Your payment was successful.'
      });
    } else {
      // Payment was not completed
      console.error('PayPal payment not completed:', captureData);
      res.redirect('/pricing?error=payment_failed');
    }
    
  } catch (err) {
    console.error('Payment capture error:', err);
    res.redirect('/pricing?error=payment_error');
  }
});


module.exports = router;


/* 

*/

