const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
    origin: "https://split-wise-frontend.vercel.app"
}));

app.use(express.json());

// MongoDB Connection
// NEW CODE (use this)
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/splitwise')
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Models
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: String,
    createdAt: { type: Date, default: Date.now }
});

const groupSchema = new mongoose.Schema({
    name: { type: String, required: true },
    members: [String],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

const expenseSchema = new mongoose.Schema({
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
    title: { type: String, required: true },
    amount: { type: Number, required: true },
    paidBy: { type: String, required: true },
    date: { type: Date, required: true },
    splitAmong: [String],
    splitMethod: { type: String, enum: ['equal', 'custom'], default: 'equal' },
    customAmounts: { type: Map, of: Number },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Group = mongoose.model('Group', groupSchema);
const Expense = mongoose.model('Expense', expenseSchema);

// Auth Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Routes

// Auth Routes
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({
            name,
            email,
            password: hashedPassword,
            phone
        });

        await user.save();

        const token = jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            user: { id: user._id, name: user.name, email: user.email, phone: user.phone }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            user: { id: user._id, name: user.name, email: user.email, phone: user.phone }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Group Routes
app.post('/api/groups', authenticateToken, async (req, res) => {
    try {
        const { name, members } = req.body;
        const group = new Group({
            name,
            members,
            createdBy: req.user.id
        });
        await group.save();
        res.json({ success: true, group });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/groups', authenticateToken, async (req, res) => {
    try {
        const groups = await Group.find({ createdBy: req.user.id });
        
        const transformedGroups = groups.map(group => ({
            id: group._id.toString(),
            name: group.name,
            members: group.members,
            createdBy: group.createdBy,
            createdAt: group.createdAt
        }));
        res.json({ success: true, groups: transformedGroups });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/groups/:id', authenticateToken, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }
    
        const transformedGroup = {
            id: group._id.toString(),
            name: group.name,
            members: group.members,
            createdBy: group.createdBy,
            createdAt: group.createdAt
        };
        res.json({ success: true, group: transformedGroup });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/groups/:id', authenticateToken, async (req, res) => {
    try {
        await Group.findByIdAndDelete(req.params.id);
        await Expense.deleteMany({ groupId: req.params.id });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Expense Routes
app.post('/api/expenses', authenticateToken, async (req, res) => {
    try {
        const expense = new Expense(req.body);
        await expense.save();
        res.json({ success: true, expense });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/expenses/group/:groupId', authenticateToken, async (req, res) => {
    try {
        const expenses = await Expense.find({ groupId: req.params.groupId }).sort({ date: -1 });

        const transformedExpenses = expenses.map(exp => ({
            id: exp._id.toString(),
            groupId: exp.groupId,
            title: exp.title,
            amount: exp.amount,
            paidBy: exp.paidBy,
            date: exp.date,
            splitAmong: exp.splitAmong,
            splitMethod: exp.splitMethod,
            customAmounts: exp.customAmounts,
            createdAt: exp.createdAt
        }));
        res.json({ success: true, expenses: transformedExpenses });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/expenses', authenticateToken, async (req, res) => {
    try {
        const groups = await Group.find({ createdBy: req.user.id });
        const groupIds = groups.map(g => g._id);
        const expenses = await Expense.find({ groupId: { $in: groupIds } }).sort({ date: -1 });
        res.json({ success: true, expenses });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/expenses/:id', authenticateToken, async (req, res) => {
    try {
        await Expense.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Analytics Routes
app.get('/api/analytics/group/:groupId', authenticateToken, async (req, res) => {
    try {
        const expenses = await Expense.find({ groupId: req.params.groupId });
        const group = await Group.findById(req.params.groupId);

        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        const analytics = calculateGroupAnalytics(expenses, group.members);
        res.json({ success: true, analytics });
    } catch (error) {
        console.error('Group analytics error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/analytics/user', authenticateToken, async (req, res) => {
    try {
        const groups = await Group.find({ createdBy: req.user.id });
        const groupIds = groups.map(g => g._id);
        const expenses = await Expense.find({ groupId: { $in: groupIds } });

        const analytics = calculateUserAnalytics(expenses);
        res.json({ success: true, analytics });
    } catch (error) {
        console.error('User analytics error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Helper Functions
function calculateGroupAnalytics(expenses, members) {
    const totalSpending = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const balances = {};
    
    members.forEach(member => {
        balances[member] = 0;
    });

    expenses.forEach(expense => {
        balances[expense.paidBy] = (balances[expense.paidBy] || 0) + expense.amount;

        if (expense.splitMethod === 'custom' && expense.customAmounts) {
            expense.splitAmong.forEach(member => {
                // Handle both Map and plain object
                const amount = expense.customAmounts instanceof Map 
                    ? expense.customAmounts.get(member) || 0
                    : expense.customAmounts[member] || 0;
                balances[member] = (balances[member] || 0) - amount;
            });
        } else {
            const splitAmount = expense.amount / expense.splitAmong.length;
            expense.splitAmong.forEach(member => {
                balances[member] = (balances[member] || 0) - splitAmount;
            });
        }
    });

    const settlements = calculateSettlements(balances);

    // Transform recent expenses for frontend
    const recentExpenses = expenses.slice(0, 10).map(exp => ({
        id: exp._id.toString(),
        title: exp.title,
        amount: exp.amount,
        paidBy: exp.paidBy,
        date: exp.date
    }));

    // Calculate category data
    const categoryData = {};
    expenses.forEach(expense => {
        const category = expense.title.split(' ')[0] || 'Uncategorized';
        categoryData[category] = (categoryData[category] || 0) + expense.amount;
    });

    return {
        totalSpending: totalSpending || 0,
        splitPerPerson: members.length > 0 ? totalSpending / members.length : 0,
        averageExpense: expenses.length > 0 ? totalSpending / expenses.length : 0,
        totalExpenses: expenses.length,
        balances,
        settlements,
        categoryData,
        recentExpenses
    };
}

function calculateUserAnalytics(expenses) {
    const totalSpending = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const categoryData = {};
    
    expenses.forEach(expense => {
        const category = expense.title.split(' ')[0];
        categoryData[category] = (categoryData[category] || 0) + expense.amount;
    });

    // Transform recent expenses for frontend
const recentExpenses = expenses
    .sort((a, b) => new Date(b.date) - new Date(a.date)) // Sort by date, newest first
    .slice(0, 10)
    .map(exp => ({
        id: exp._id.toString(),
        title: exp.title,
        amount: exp.amount,
        paidBy: exp.paidBy,
        date: exp.date
    }));
    
    return {
        totalSpending,
        averageExpense: expenses.length > 0 ? totalSpending / expenses.length : 0,
        totalExpenses: expenses.length,
        categoryData,
        recentExpenses
    };
}

function calculateSettlements(balances) {
    const settlements = [];
    const debtors = [];
    const creditors = [];

    Object.entries(balances).forEach(([person, balance]) => {
        if (balance < -0.01) {
            debtors.push({ person, amount: -balance });
        } else if (balance > 0.01) {
            creditors.push({ person, amount: balance });
        }
    });

    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
        const amount = Math.min(debtors[i].amount, creditors[j].amount);
        settlements.push({
            from: debtors[i].person,
            to: creditors[j].person,
            amount
        });

        debtors[i].amount -= amount;
        creditors[j].amount -= amount;

        if (debtors[i].amount < 0.01) i++;
        if (creditors[j].amount < 0.01) j++;
    }

    return settlements;
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});