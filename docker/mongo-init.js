/**
 * MongoDB Initialization Script
 *
 * This script runs when the MongoDB container is first initialized.
 * It creates an application user with read/write access to the tourism database.
 */

// Switch to the application database
db = db.getSiblingDB('sih-2025-jharkhand-tourism');

// Create application user with readWrite role
db.createUser({
    user: 'app_user',
    pwd: 'app_password',
    roles: [
        {
            role: 'readWrite',
            db: 'sih-2025-jharkhand-tourism'
        }
    ]
});

// Create indexes for better query performance
// These will be created when the collections are first accessed

print('MongoDB initialization completed successfully');
print('Database: sih-2025-jharkhand-tourism');
print('User: app_user created with readWrite access');
