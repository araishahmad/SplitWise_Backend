require('dotenv').config();
const mongoose = require('mongoose');
const { User, Group, Expense } = require('./models/schemas');
const bcrypt = require('bcryptjs');

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Group.deleteMany({});
    await Expense.deleteMany({});

    // Create a test user
    const hashedPassword = await bcrypt.hash('password123', 10);
    const user = await User.create({
      name: 'John Doe',
      email: 'john@example.com',
      password: hashedPassword,
      phone: '+92300123456'
    });

    // Create a test group
    const group = await Group.create({
      name: 'Roommates',
      members: ['John', 'Sarah', 'Mike'],
      createdBy: user._id
    });

    // Create a test expense
    await Expense.create({
      groupId: group._id,
      title: 'Groceries',
      amount: 1500,
      paidBy: 'John',
      date: new Date(),
      splitAmong: ['John', 'Sarah', 'Mike'],
      splitMethod: 'equal',
      category: 'Groceries',
      createdBy: user._id
    });

    console.log('✅ Database seeded successfully!');
    console.log('Test user: john@example.com / password123');
    
    mongoose.connection.close();
  } catch (error) {
    console.error('Error seeding database:', error);
    mongoose.connection.close();
  }
}

seedDatabase();