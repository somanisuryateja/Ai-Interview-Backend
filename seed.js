require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

// Demo users data
const demoUsers = [
  {
    name: 'Admin User',
    email: 'admin@demo.com',
    password: 'admin123',
    role: 'admin'
  },
  {
    name: 'Manager User',
    email: 'manager@demo.com',
    password: 'manager123',
    role: 'manager'
  },
  {
    name: 'John Doe',
    email: 'user@demo.com',
    password: 'user123',
    role: 'user'
  },
  {
    name: 'Jane Smith',
    email: 'jane@demo.com',
    password: 'jane123',
    role: 'user'
  },
  {
    name: 'Mike Johnson',
    email: 'mike@demo.com',
    password: 'mike123',
    role: 'manager'
  }
];

const seedDatabase = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb+srv://suryaUser:Surya123%402025@suryacluster.hxsysgp.mongodb.net/framewise-clone';
    console.log('🔍 MONGO_URI:', mongoUri);
    
    // Connect to MongoDB
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Connected to MongoDB');

    // Clear existing users (optional - remove this if you want to keep existing users)
    await User.deleteMany({});
    console.log('🗑️ Cleared existing users');

    // Hash passwords and create users
    for (const userData of demoUsers) {
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      
      const user = new User({
        name: userData.name,
        email: userData.email,
        password: hashedPassword,
        role: userData.role,
        isActive: true
      });

      await user.save();
      console.log(`✅ Created ${userData.role}: ${userData.email}`);
    }

    console.log('\n🎉 Demo users created successfully!');
    console.log('\n📋 Demo Login Credentials:');
    console.log('================================');
    demoUsers.forEach(user => {
      console.log(`👤 ${user.name} (${user.role})`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Password: ${user.password}`);
      console.log('');
    });
    console.log('================================');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
};

// Run the seed function
seedDatabase();
