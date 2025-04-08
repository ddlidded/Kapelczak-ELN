const { db } = require('../db');
const { users } = require('../../shared/schema');
const bcrypt = require('bcrypt');

async function createAdminUser() {
  try {
    console.log('Checking if admin user already exists...');
    
    // Check if admin user already exists
    const existingAdmin = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.username, 'admin')
    });
    
    if (existingAdmin) {
      console.log('Admin user already exists.');
      return;
    }
    
    console.log('Creating admin user...');
    
    // Hash password
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    // Create admin user
    const [adminUser] = await db.insert(users).values({
      username: 'admin',
      displayName: 'Administrator',
      email: 'admin@kapelczak-notes.com',
      password: hashedPassword,
      isAdmin: true,
      isVerified: true,
      role: 'Administrator',
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    
    console.log('Admin user created successfully:', {
      id: adminUser.id,
      username: adminUser.username,
      email: adminUser.email
    });
    
    console.log('\nDefault admin credentials:');
    console.log('Username: admin');
    console.log('Password: admin123');
    console.log('\nPLEASE CHANGE THIS PASSWORD AFTER LOGGING IN!');
    
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    // Close the DB connection if necessary
    process.exit(0);
  }
}

// Run the function
createAdminUser();