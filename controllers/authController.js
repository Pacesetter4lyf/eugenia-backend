const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const Profile = require('../models/profileModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');

const signToken = id => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

const createSendToken = (user, statusCode, req, res) => {
  const token = signToken(user._id);
  const tokenExpirationDate = new Date(
    Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
  );

  res.cookie('jwt', token, {
    expires: tokenExpirationDate,
    httpOnly: true,
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    sameSite: 'strict'
  });

  // Remove sensitive data from output
  user.password = undefined;
  user.emailVerified = undefined;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.emailVerifyToken = undefined;
  user.emailVerifyExpires = undefined;

  res.status(statusCode).json({
    status: 'success',
    expiry: tokenExpirationDate,
    token,
    data: { user }
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const { email, password, passwordConfirm } = req.body;

  if (!email || !password || !passwordConfirm) {
    return next(new AppError('Please provide email and password details', 400));
  }

  // Create user with just email and password
  const newUser = await User.create({
    email,
    password,
    passwordConfirm,
    role: 'user'
  });

  // Generate verification token
  const verifyToken = newUser.createEmailVerifyToken();
  await newUser.save({ validateBeforeSave: false });

  try {
    const verifyURL = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/users/verifyEmail/${email}/${verifyToken}`;

    await new Email(newUser, verifyURL).sendWelcome();

    res.status(201).json({
      status: 'success',
      message: 'Verification email sent successfully!'
    });
  } catch (err) {
    // Cleanup tokens if email fails
    newUser.emailVerifyToken = undefined;
    newUser.emailVerifyExpires = undefined;
    await newUser.save({ validateBeforeSave: false });

    return next(
      new AppError('Failed to send verification email. Please try again.', 500)
    );
  }
});

exports.resendVerifyEmail = catchAsync(async (req, res, next) => {
  const { email } = req.body;
  if (!email) {
    return next(new AppError('Please provide your email address', 400));
  }

  const user = await User.findOne({ email });

  if (!user) {
    return next(new AppError('No user found with that email address', 404));
  }

  if (user.emailVerified) {
    return next(new AppError('This email is already verified', 400));
  }

  const verifyToken = user.createEmailVerifyToken();
  await user.save({ validateBeforeSave: false });

  try {
    const verifyURL = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/users/verifyEmail/${email}/${verifyToken}`;

    await new Email(user, verifyURL).sendWelcome();

    res.status(200).json({
      status: 'success',
      message: 'Verification email resent successfully!'
    });
  } catch (err) {
    user.emailVerifyToken = undefined;
    user.emailVerifyExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError('Failed to send verification email. Please try again.', 500)
    );
  }
});

exports.verifyEmail = catchAsync(async (req, res, next) => {
  const { email, token } = req.params;

  if (!email || !token) {
    return next(new AppError('Invalid verification link', 400));
  }

  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  const user = await User.findOne({
    email,
    emailVerifyToken: hashedToken,
    emailVerifyExpires: { $gt: Date.now() }
  });

  if (!user) {
    return next(new AppError('Invalid or expired verification link', 400));
  }

  user.emailVerified = true;
  user.emailVerifyToken = undefined;
  user.emailVerifyExpires = undefined;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: 'success',
    message: 'Email verified successfully. Please log in.'
  });
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }

  const user = await User.findOne({ email }).select('+password emailVerified');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Invalid email or password', 401));
  }

  if (!user.emailVerified) {
    return next(new AppError('Please verify your email address first', 401));
  }

  createSendToken(user, 200, req, res);
});

exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    sameSite: 'strict'
  });

  res.status(200).json({ status: 'success' });
};

exports.protect = catchAsync(async (req, res, next) => {
  // Extract token from Authorization header or cookies
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(new AppError('Please log in to access this resource', 401));
  }

  try {
    // Verify token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // Check if user still exists
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return next(new AppError('User no longer exists', 401));
    }

    // Check if password was changed after token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return next(
        new AppError('Password was recently changed. Please log in again', 401)
      );
    }

    // Attach user data
    const user = await User.findOne({ userId: decoded.id });
    if (user) {
      currentUser.userId = user.id;
      currentUser.lineage = user.lineage;
      currentUser.createdBy = user.createdBy;
      currentUser.adminOf = user.adminOf;
    }

    // Attach profile data
    const profile = await Profile.findOne({ userId: currentUser.id });
    if (profile) {
      currentUser.profileId = profile._id;
    }

    req.user = currentUser;
    res.locals.user = currentUser;
    next();
  } catch (err) {
    return next(new AppError('Invalid token. Please log in again', 401));
  }
});

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new AppError('Please provide your email address', 400));
  }

  const user = await User.findOne({ email });
  if (!user) {
    return next(new AppError('No user found with that email address', 404));
  }

  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  try {
    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/users/resetPassword/${resetToken}`;

    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'Password reset instructions sent to your email'
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError(
        'Failed to send password reset email. Please try again.',
        500
      )
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  const { token } = req.params;
  const { password, passwordConfirm } = req.body;

  if (!password || !passwordConfirm) {
    return next(new AppError('Please provide new password details', 400));
  }

  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });

  if (!user) {
    return next(new AppError('Invalid or expired password reset token', 400));
  }

  user.password = password;
  user.passwordConfirm = passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  createSendToken(user, 200, req, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  const { passwordCurrent, password, passwordConfirm } = req.body;

  if (!passwordCurrent || !password || !passwordConfirm) {
    return next(new AppError('Please provide all password details', 400));
  }

  const user = await User.findById(req.user.id).select('+password');

  if (!user || !(await user.correctPassword(passwordCurrent, user.password))) {
    return next(new AppError('Current password is incorrect', 401));
  }

  user.password = password;
  user.passwordConfirm = passwordConfirm;
  await user.save();

  createSendToken(user, 200, req, res);
});
