const mongoose = require('mongoose');

// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true, 
    trim: true 
  },
  password: { type: String, required: true, minlength: 6 },
  phone: { type: String, trim: true, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

userSchema.index({ email: 1 });

// Group Schema
const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  members: [{ type: String, required: true }],
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

groupSchema.index({ createdBy: 1 });

// Expense Schema
const expenseSchema = new mongoose.Schema({
  groupId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Group', 
    required: true 
  },
  title: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0.01 },
  paidBy: { type: String, required: true },
  date: { type: Date, required: true },
  splitAmong: [{ type: String, required: true }],
  splitMethod: { 
    type: String, 
    enum: ['equal', 'custom'], 
    default: 'equal' 
  },
  customAmounts: { type: Map, of: Number, default: null },
  category: { 
    type: String, 
    enum: ['Food', 'Housing', 'Groceries', 'Transport', 'Entertainment', 'Other'],
    default: 'Other' 
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

expenseSchema.index({ groupId: 1, date: -1 });

module.exports = {
  User: mongoose.model('User', userSchema),
  Group: mongoose.model('Group', groupSchema),
  Expense: mongoose.model('Expense', expenseSchema)
};