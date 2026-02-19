const express = require('express');
const router = express.Router();
const { Group, Expense } = require('../models/schemas');
const authMiddleware = require('../middleware/auth');

// Apply authentication to all routes
router.use(authMiddleware);

// Helper function to calculate balances
function calculateBalances(expenses, members) {
  const balances = {};
  members.forEach(member => {
    balances[member] = 0;
  });
  
  expenses.forEach(expense => {
    if (expense.splitMethod === 'custom' && expense.customAmounts) {
      // Use custom amounts
      for (const [member, amount] of expense.customAmounts) {
        if (balances.hasOwnProperty(member)) {
          balances[member] -= amount;
        }
      }
    } else {
      // Equal split
      const splitCount = expense.splitAmong.length;
      const sharePerPerson = expense.amount / splitCount;
      
      expense.splitAmong.forEach(member => {
        if (balances.hasOwnProperty(member)) {
          balances[member] -= sharePerPerson;
        }
      });
    }
    
    // Add full amount to person who paid
    if (balances.hasOwnProperty(expense.paidBy)) {
      balances[expense.paidBy] += expense.amount;
    }
  });
  
  return balances;
}

// Helper function to calculate settlements
function calculateSettlements(balances) {
  const settlements = [];
  const members = Object.keys(balances);
  const balanceCopy = { ...balances };
  
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const member1 = members[i];
      const member2 = members[j];
      const balance1 = balanceCopy[member1];
      const balance2 = balanceCopy[member2];
      
      if (balance1 > 0.01 && balance2 < -0.01) {
        const amount = Math.min(balance1, -balance2);
        settlements.push({ 
          from: member2, 
          to: member1, 
          amount: amount 
        });
        balanceCopy[member1] -= amount;
        balanceCopy[member2] += amount;
      }
    }
  }
  
  return settlements;
}

// @route   GET /api/analytics/group/:groupId
// @desc    Get analytics for a specific group
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

    const expenses = await Expense.find({ groupId: req.params.groupId });

    // Calculate totals
    const totalSpending = expenses.reduce((sum, e) => sum + e.amount, 0);
    const averageExpense = expenses.length > 0 ? totalSpending / expenses.length : 0;
    const splitPerPerson = totalSpending / group.members.length;

    // Category breakdown
    const categoryData = {};
    expenses.forEach(expense => {
      const category = expense.category || 'Other';
      categoryData[category] = (categoryData[category] || 0) + expense.amount;
    });

    // Calculate balances and settlements
    const balances = calculateBalances(expenses, group.members);
    const settlements = calculateSettlements(balances);

    // Recent expenses
    const recentExpenses = expenses
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    res.json({
      success: true,
      analytics: {
        totalSpending,
        averageExpense,
        splitPerPerson,
        totalExpenses: expenses.length,
        categoryData,
        balances,
        settlements,
        recentExpenses: recentExpenses.map(e => ({
          id: e._id,
          title: e.title,
          amount: e.amount,
          paidBy: e.paidBy,
          date: e.date,
          category: e.category
        }))
      }
    });
  } catch (error) {
    console.error('Get group analytics error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error fetching analytics' 
    });
  }
});

// @route   GET /api/analytics/user
// @desc    Get analytics for all user's groups
// @access  Private
router.get('/user', async (req, res) => {
  try {
    // Get all user's groups
    const groups = await Group.find({ createdBy: req.userId });
    const groupIds = groups.map(g => g._id);

    // Get all expenses
    const expenses = await Expense.find({ groupId: { $in: groupIds } });

    // Calculate totals
    const totalSpending = expenses.reduce((sum, e) => sum + e.amount, 0);
    const averageExpense = expenses.length > 0 ? totalSpending / expenses.length : 0;

    // Category breakdown
    const categoryData = {};
    expenses.forEach(expense => {
      const category = expense.category || 'Other';
      categoryData[category] = (categoryData[category] || 0) + expense.amount;
    });

    // Recent expenses
    const recentExpenses = expenses
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);

    res.json({
      success: true,
      analytics: {
        totalSpending,
        averageExpense,
        totalExpenses: expenses.length,
        totalGroups: groups.length,
        categoryData,
        recentExpenses: recentExpenses.map(e => ({
          id: e._id,
          title: e.title,
          amount: e.amount,
          paidBy: e.paidBy,
          date: e.date,
          category: e.category
        }))
      }
    });
  } catch (error) {
    console.error('Get user analytics error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error fetching analytics' 
    });
  }
});

module.exports = router;