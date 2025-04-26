const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const compression = require('compression');
const cors = require('cors');

const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const { startSession } = require('mongoose');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const bookingController = require('./controllers/bookingController');
const viewRouter = require('./routes/viewRoutes');
const userDataRouter = require('./routes/userDataRoutes');
const resourceRouter = require('./routes/resourceRoutes');
const chatRouter = require('./routes/chatRoutes');
const joinCodeRouter = require('./routes/joinCodeRoutes');
const postRouter = require('./routes/postRoutes');
const profileRouter = require('./routes/profileRoutes');
const mediaRouter = require('./routes/mediaRoutes');

function createApp(databaseURL) {
  // Start express app
  const app = express();

  app.enable('trust proxy');

  app.set('view engine', 'pug');
  app.set('views', path.join(__dirname, 'views'));

  // 1) GLOBAL MIDDLEWARES
  // Implement CORS
  app.use(cors());
  // Access-Control-Allow-Origin *
  // api.natours.com, front-end natours.com
  // app.use(cors({
  //   origin: 'https://www.natours.com'
  // }))

  app.options('*', cors());
  // app.options('/api/v1/tours/:id', cors());

  // Serving static files
  app.use(express.static(path.join(__dirname, 'public')));

  // Set security HTTP headers
  app.use(helmet());

  // Development logging
  if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
  }

  // Limit requests from same API
  const limiter = rateLimit({
    max: 1000,
    windowMs: 60 * 60 * 1000,
    message: 'Too many requests from this IP, please try again in an hour!'
  });
  app.use('/api', limiter);

  // Stripe webhook, BEFORE body-parser, because stripe needs the body as stream
  app.post(
    '/webhook-checkout',
    bodyParser.raw({ type: 'application/json' }),
    bookingController.webhookCheckout
  );

  // Body parser, reading data from body into req.body
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));
  app.use(cookieParser());

  // Data sanitization against NoSQL query injection
  app.use(mongoSanitize());

  // Data sanitization against XSS
  app.use(xss());

  // Prevent parameter pollution
  app.use(
    hpp({
      whitelist: [
        'duration',
        'ratingsQuantity',
        'ratingsAverage',
        'maxGroupSize',
        'difficulty',
        'price'
      ]
    })
  );

  app.use(compression());

  // Test middleware
  app.use((req, res, next) => {
    req.requestTime = new Date().toISOString();
    // console.log(req.cookies);
    next();
  });

  // Middleware to start session
  app.use(async (req, res, next) => {
    try {
      const session = await mongoose.startSession();
      req.session = session;
      next();
    } catch (error) {
      console.error('Error occurred while starting session:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  // 3) ROUTES
  app.use('/', viewRouter);
  app.use('/api/v1/tours', tourRouter);
  app.use('/api/v1/users', userRouter);
  app.use('/api/v1/reviews', reviewRouter);
  app.use('/api/v1/bookings', bookingRouter);
  app.use('/api/v1/userdata', userDataRouter);
  app.use('/api/v1/resource', resourceRouter);
  app.use('/api/v1/chat', chatRouter);
  app.use('/api/v1/joincode', joinCodeRouter);
  app.use('/api/v1/post', postRouter);
  app.use('/api/v1/profile', profileRouter);
  app.use('/api/v1/media', mediaRouter);
  
  app.all('*', (req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
  });

  // Error handling middleware
  app.use(async (err, req, res, next) => {
    console.error('Error occurred:', err);
    // Abort the transaction if it exists
    if (req.session) {
      try {
        await req.session.abortTransaction();
        console.log('Transaction aborted successfully');
      } catch (error) {
        console.error('Error occurred while aborting transaction:', error);
      } finally {
        req.session.endSession();
      }
    }
    // Pass the error to the next error-handling middleware or default error handler
    next(err);
  });

  app.use(globalErrorHandler);
  return app;
}

module.exports = createApp;
