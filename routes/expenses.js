const express = require('express');
const router = express.Router();
const { Expense, Group } = require('../models/schemas');
const authMiddleware = require('../middleware/auth');

// Apply authentication to all routes
router.use(authMiddleware);

// Helper function to categorize expenses
function categorizeExpense(title) {
  const lower = title.toLowerCase();
  if (lower.includes('food') || lower.includes('dinner') || 
      lower.includes('lunch') || lower.includes('breakfast')) {
    return 'Food';
  }
  if (lower.includes('rent') || lower.includes('hotel')) {
    return 'Housing';
  }
  if (lower.includes('grocery') || lower.includes('groceries') || 
      lower.includes('vegetable')) {
    return 'Groceries';
  }
  if (lower.includes('transport') || lower.includes('uber') || 
      lower.includes('taxi')) {
    return 'Transport';
  }
  if (lower.includes('movie') || lower.includes('entertainment')) {
    return 'Entertainment';
  }
  return 'Other';
}

// @route   POST /api/expenses
// @desc    Create a new expense
// @access  Private
router.post('/', async (req, res) => {
  try {
    const { 
      groupId, 
      title, 
      amount, 
      paidBy, 
      date, 
      splitAmong, 
      splitMethod, 
      customAmounts 
    } = req.body;

    // Validation
    if (!groupId || !title || !amount || !paidBy || !date || !splitAmong) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide all required fields' 
      });
    }

    // Verify group exists and user has access
    const group = await Group.findOne({
      _id: groupId,
      createdBy: req.userId
    });

    if (!group) {
      return res.status(404).json({ 
        success: false, 
        error: 'Group not found' 
      });
    }

    // Validate custom amounts if splitMethod is custom
    if (splitMethod === 'custom') {
      if (!customAmounts) {
        return res.status(400).json({ 
          success: false, 
          error: 'Custom amounts required for custom split method' 
        });
      }

      const totalCustom = Object.values(customAmounts).reduce((sum, amt) => sum + amt, 0);
      if (Math.abs(totalCustom - amount) >= 0.01) {
        return res.status(400).json({ 
          success: false, 
          error: 'Custom amounts must sum to total amount' 
        });
      }
    }

    // Auto-categorize expense
    const category = categorizeExpense(title);

    // Create expense
    const expense = await Expense.create({
      groupId,
      title,
      amount,
      paidBy,
      date,
      splitAmong,
      splitMethod: splitMethod || 'equal',
      customAmounts: splitMethod === 'custom' ? customAmounts : null,
      category,
      createdBy: req.userId
    });

    // Update group's updatedAt
    await Group.findByIdAndUpdate(groupId, { updatedAt: Date.now() });

    res.status(201).json({
      success: true,
      message: 'Expense created successfully',
      expense: {
        id: expense._id,
        groupId: expense.groupId,
        title: expense.title,
        amount: expense.amount,
        paidBy: expense.paidBy,
        date: expense.date,
        splitAmong: expense.splitAmong,
        splitMethod: expense.splitMethod,
        customAmounts: expense.customAmounts,
        category: expense.category,
        createdAt: expense.createdAt
      }
    });
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error creating expense' 
    });
  }
});

// @route   GET /api/expenses/group/:groupId
// @desc    Get all expenses for a specific group
// @access  Private
router.get('/group/:groupId', async (req, res) => {
  try {
    // Verify group exists and user has access
    const group = await Group.findOne({
      _id: req.params.groupId,
      createdBy: req.userId
    });

    if (!group) {
      return res.status(404).json({ 
        success: false, 
        error: 'Group not found' 
      });
    }

    const expenses = await Expense.find({ groupId: req.params.groupId })
      .sort({ date: -1, createdAt: -1 });

    res.json({
      success: true,
      count: expenses.length,
      expenses: expenses.map(expense => ({
        id: expense._id,
        groupId: expense.groupId,
        title: expense.title,
        amount: expense.amount,
        paidBy: expense.paidBy,
        date: expense.date,
        splitAmong: expense.splitAmong,
        splitMethod: expense.splitMethod,
        customAmounts: expense.customAmounts,
        category: expense.category,
        createdAt: expense.createdAt
      }))
    });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error fetching expenses' 
    });
  }
});

// @route   GET /api/expenses
// @desc    Get all expenses for current user (across all groups)
// @access  Private
router.get('/', async (req, res) => {
  try {
    // Get all user's groups
    const groups = await Group.find({ createdBy: req.userId });
    const groupIds = groups.map(g => g._id);

    // Get all expenses in those groups
    const expenses = await Expense.find({ groupId: { $in: groupIds } })
      .sort({ date: -1, createdAt: -1 });

    res.json({
      success: true,
      count: expenses.length,
      expenses: expenses.map(expense => ({
        id: expense._id,
        groupId: expense.groupId,
        title: expense.title,
        amount: expense.amount,
        paidBy: expense.paidBy,
        date: expense.date,
        splitAmong: expense.splitAmong,
        splitMethod: expense.splitMethod,
        customAmounts: expense.customAmounts,
        category: expense.category,
        createdAt: expense.createdAt
      }))
    });
  } catch (error) {
    console.error('Get all expenses error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error fetching expenses' 
    });
  }
});

// @route   GET /api/expenses/:id
// @desc    Get single expense by ID
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ 
        success: false, 
        error: 'Expense not found' 
      });
    }

    // Verify user has access to this expense's group
    const group = await Group.findOne({
      _id: expense.groupId,
      createdBy: req.userId
    });

    if (!group) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied' 
      });
    }

    res.json({
      success: true,
      expense: {
        id: expense._id,
        groupId: expense.groupId,
        title: expense.title,
        amount: expense.amount,
        paidBy: expense.paidBy,
        date: expense.date,
        splitAmong: expense.splitAmong,
        splitMethod: expense.splitMethod,
        customAmounts: expense.customAmounts,
        category: expense.category,
        createdAt: expense.createdAt
      }
    });
  } catch (error) {
    console.error('Get expense error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error fetching expense' 
    });
  }
});

// @route   DELETE /api/expenses/:id
// @desc    Delete expense
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ 
        success: false, 
        error: 'Expense not found' 
      });
    }

    // Verify user has access to this expense's group
    const group = await Group.findOne({
      _id: expense.groupId,
      createdBy: req.userId
    });

    if (!group) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied' 
      });
    }

    await Expense.findByIdAndDelete(req.params.id);

    // Update group's updatedAt
    await Group.findByIdAndUpdate(expense.groupId, { updatedAt: Date.now() });

    res.json({
      success: true,
      message: 'Expense deleted successfully'
    });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error deleting expense' 
    });
  }
});

module.exports = router;