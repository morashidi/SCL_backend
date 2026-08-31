const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Token = require('../models/token.model');

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        message: 'Username and password are required',
      });
    }

    const user = await User.findOne({
      username: username.toLowerCase(),
    });

    if (!user) {
      return res.status(401).json({
        message: 'Invalid username or password',
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: 'Invalid username or password',
      });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '7d',
      },
    );

    await Token.create({
      token: token,
      userId: user._id,
      status: 'active',
    });

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);

    return res.status(500).json({
      message: 'Server error',
    });
  }
};

const me = async (req, res) => {
  try {
    const user = req.user;

    return res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Get current user error:', error);

    return res.status(500).json({
      message: 'Server error',
    });
  }
};

const logout = async (req, res) => {
  try {
    await Token.updateOne(
      {
        userId: req.user._id,
        token: req.token,
        status: 'active',
      },
      {
        status: 'inactive',
      },
    );

    return res.status(200).json({
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout error:', error);

    return res.status(500).json({
      message: 'Server error',
    });
  }
};

module.exports = {
  login,
  me,
  logout,
};
