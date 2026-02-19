const express = require('express');
const router = express.Router();
const { Group, Expense } = require('../models/schemas');
const authMiddleware = require('../middleware/auth');

// Apply authentication to all routes
router.use(authMiddleware);

// @route   POST /api/groups
// @desc    Create a new group
// @access  Private
router.post('/', async (req, res) => {
  try {
    const { name, members } = req.body;

    // Validation
    if (!name || !members || members.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide group name and at least one member' 
      });
    }

    // Create group
    const group = await Group.create({
      name,
      members,
      createdBy: req.userId
    });

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      group: {
        id: group._id,
        name: group.name,
        members: group.members,
        createdAt: group.createdAt
      }
    });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error creating group' 
    });
  }
});

// @route   GET /api/groups
// @desc    Get all groups for current user
// @access  Private
router.get('/', async (req, res) => {
  try {
    const groups = await Group.find({ createdBy: req.userId })
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      count: groups.length,
      groups: groups.map(group => ({
        id: group._id,
        name: group.name,
        members: group.members,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt
      }))
    });
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error fetching groups' 
    });
  }
});

// @route   GET /api/groups/:id
// @desc    Get single group by ID
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const group = await Group.findOne({
      _id: req.params.id,
      createdBy: req.userId
    });

    if (!group) {
      return res.status(404).json({ 
        success: false, 
        error: 'Group not found' 
      });
    }

    res.json({
      success: true,
      group: {
        id: group._id,
        name: group.name,
        members: group.members,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt
      }
    });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error fetching group' 
    });
  }
});

// @route   PUT /api/groups/:id
// @desc    Update group
// @access  Private
router.put('/:id', async (req, res) => {
  try {
    const { name, members } = req.body;

    const group = await Group.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.userId },
      { 
        name, 
        members, 
        updatedAt: Date.now() 
      },
      { new: true, runValidators: true }
    );

    if (!group) {
      return res.status(404).json({ 
        success: false, 
        error: 'Group not found' 
      });
    }

    res.json({
      success: true,
      message: 'Group updated successfully',
      group: {
        id: group._id,
        name: group.name,
        members: group.members,
        updatedAt: group.updatedAt
      }
    });
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error updating group' 
    });
  }
});

// @route   DELETE /api/groups/:id
// @desc    Delete group and all its expenses
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const group = await Group.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.userId
    });

    if (!group) {
      return res.status(404).json({ 
        success: false, 
        error: 'Group not found' 
      });
    }

    // Delete all expenses in this group
    await Expense.deleteMany({ groupId: req.params.id });

    res.json({
      success: true,
      message: 'Group and all expenses deleted successfully'
    });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error deleting group' 
    });
  }
});

module.exports = router;