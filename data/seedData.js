const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('../models/userModel');
const Profile = require('../models/profileModel');
const Post = require('../models/postModel');
const Group = require('../models/groupModel');
const Lineage = require('../models/lineageModel');
const Relationship = require('../models/relationshipModel');
const Media = require('../models/mediaModel');

// Load environment variables
dotenv.config({ path: './config.env' });

const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD
);

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(DB, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Profile.deleteMany({});
    await Post.deleteMany({});
    await Group.deleteMany({});
    await Lineage.deleteMany({});
    await Relationship.deleteMany({});
    await Media.deleteMany({});

    // Create users
    const users = [
      {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'password',
        passwordConfirm: 'password',
        role: 'user'
      },
      {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        password: 'password',
        passwordConfirm: 'password',
        role: 'user'
      },
      {
        firstName: 'Michael',
        lastName: 'Johnson',
        email: 'michael@example.com',
        password: 'password',
        passwordConfirm: 'password',
        role: 'user'
      },
      {
        firstName: 'Sarah',
        lastName: 'Williams',
        email: 'sarah@example.com',
        password: 'password',
        passwordConfirm: 'password',
        role: 'user'
      },
      {
        firstName: 'David',
        lastName: 'Brown',
        email: 'david@example.com',
        password: 'password',
        passwordConfirm: 'password',
        role: 'user'
      },
      {
        firstName: 'Emily',
        lastName: 'Davis',
        email: 'emily@example.com',
        password: 'password',
        passwordConfirm: 'password',
        role: 'user'
      },
      {
        firstName: 'Robert',
        lastName: 'Wilson',
        email: 'robert@example.com',
        password: 'password',
        passwordConfirm: 'password',
        role: 'user'
      },
      {
        firstName: 'Lisa',
        lastName: 'Taylor',
        email: 'lisa@example.com',
        password: 'password',
        passwordConfirm: 'password',
        role: 'user'
      }
    ];

    // Hash passwords and create users
    const createdUsers = await Promise.all(
      users.map(async user => {
        const hashedPassword = await bcrypt.hash(user.password, 12);
        return User.create({
          ...user,
          password: hashedPassword,
          passwordConfirm: hashedPassword
        });
      })
    );

    // Create profiles for some users
    const profiles = [
      {
        user: createdUsers[0]._id,
        userId: createdUsers[0]._id.toString(),
        firstName: 'John',
        lastName: 'Doe',
        gender: 'Male',
        dateOfBirth: new Date('1980-01-15'),
        bio: 'Software engineer and family man',
        createdBy: createdUsers[0]._id,
        visibility: {
          firstName: 1,
          lastName: 1,
          bio: 1,
          photo: 1,
          gender: 1,
          dateOfBirth: 1,
          phoneNumber: 2,
          address: 2,
          primarySchool: 3,
          secondarySchool: 3,
          tertiarySchool: 3,
          facebook: 4,
          twitter: 4,
          linkedin: 4
        }
      },
      {
        user: createdUsers[1]._id,
        userId: createdUsers[1]._id.toString(),
        firstName: 'Jane',
        lastName: 'Smith',
        gender: 'Female',
        dateOfBirth: new Date('1982-05-20'),
        bio: 'Artist and mother',
        createdBy: createdUsers[1]._id,
        visibility: {
          firstName: 1,
          lastName: 1,
          bio: 1,
          photo: 1,
          gender: 1,
          dateOfBirth: 1,
          phoneNumber: 2,
          address: 2,
          primarySchool: 3,
          secondarySchool: 3,
          tertiarySchool: 3,
          facebook: 4,
          twitter: 4,
          linkedin: 4
        }
      },
      {
        user: createdUsers[2]._id,
        userId: createdUsers[2]._id.toString(),
        firstName: 'Michael',
        lastName: 'Johnson',
        gender: 'Male',
        dateOfBirth: new Date('1975-11-30'),
        bio: 'Business owner',
        createdBy: createdUsers[2]._id,
        visibility: {
          firstName: 1,
          lastName: 1,
          bio: 1,
          photo: 1,
          gender: 1,
          dateOfBirth: 1,
          phoneNumber: 2,
          address: 2,
          primarySchool: 3,
          secondarySchool: 3,
          tertiarySchool: 3,
          facebook: 4,
          twitter: 4,
          linkedin: 4
        }
      },
      {
        user: createdUsers[3]._id,
        userId: createdUsers[3]._id.toString(),
        firstName: 'Sarah',
        lastName: 'Williams',
        gender: 'Female',
        dateOfBirth: new Date('1978-03-10'),
        bio: 'Teacher and community leader',
        createdBy: createdUsers[3]._id,
        visibility: {
          firstName: 1,
          lastName: 1,
          bio: 1,
          photo: 1,
          gender: 1,
          dateOfBirth: 1,
          phoneNumber: 2,
          address: 2,
          primarySchool: 3,
          secondarySchool: 3,
          tertiarySchool: 3,
          facebook: 4,
          twitter: 4,
          linkedin: 4
        }
      }
    ];

    const createdProfiles = await Profile.create(profiles);

    // Create groups
    const groups = [
      {
        groupName: 'Tech Enthusiasts',
        description: 'A group for technology lovers',
        createdBy: createdUsers[0]._id,
        members: [
          { user: createdUsers[0]._id, isAdmin: true },
          { user: createdUsers[1]._id, isAdmin: false },
          { user: createdUsers[2]._id, isAdmin: false }
        ]
      },
      {
        groupName: 'Art Lovers',
        description: 'A group for art enthusiasts',
        createdBy: createdUsers[1]._id,
        members: [
          { user: createdUsers[1]._id, isAdmin: true },
          { user: createdUsers[3]._id, isAdmin: false }
        ]
      }
    ];

    const createdGroups = await Group.create(groups);

    // Create posts
    const posts = [
      {
        title: 'My First Post',
        content: 'Hello everyone! This is my first post on the platform.',
        author: createdUsers[0]._id,
        forPerson: createdProfiles[0]._id,
        isGroupPost: true,
        group: createdGroups[0]._id,
        commentsEnabled: true
      },
      {
        title: 'Art Exhibition',
        content: 'Check out my latest artwork!',
        author: createdUsers[1]._id,
        forPerson: createdProfiles[1]._id,
        isGroupPost: true,
        group: createdGroups[1]._id,
        commentsEnabled: true
      },
      {
        title: 'Business Update',
        content: 'Exciting news about our company!',
        author: createdUsers[2]._id,
        forPerson: createdProfiles[2]._id,
        isGroupPost: false,
        commentsEnabled: true
      },
      {
        title: 'Teaching Experience',
        content: 'Sharing my teaching journey...',
        author: createdUsers[3]._id,
        forPerson: createdProfiles[3]._id,
        isGroupPost: false,
        commentsEnabled: true
      }
    ];

    await Post.create(posts);

    // Create relationships
    const relationships = [
      {
        profileId: createdProfiles[0]._id,
        parents: [
          {
            profile: createdProfiles[2]._id,
            relationshipType: 'father',
            isBiological: true
          },
          {
            profile: createdProfiles[3]._id,
            relationshipType: 'mother',
            isBiological: true
          }
        ],
        spouses: [
          {
            profile: createdProfiles[1]._id,
            relationshipType: 'wife',
            isCurrent: true,
            marriageDate: new Date('2010-06-15')
          }
        ],
        children: [
          {
            profile: createdProfiles[3]._id,
            relationshipType: 'daughter',
            isBiological: true
          }
        ]
      }
    ];

    await Relationship.create(relationships);

    // Create lineage
    await Lineage.create({
      name: 'Johnson-Williams Family',
      description: 'Main family lineage',
      createdBy: createdUsers[2]._id,
      members: [
        { user: createdUsers[2]._id },
        { user: createdUsers[3]._id },
        { user: createdUsers[0]._id },
        { user: createdUsers[1]._id }
      ]
    });

    // Create media items
    const mediaItems = [
      {
        name: 'Profile Picture',
        description: 'John Doe\'s profile picture',
        mediaType: 'image',
        url: 'https://example.com/profile1.jpg',
        user: createdProfiles[0]._id,
        for: createdProfiles[0]._id,
        viewableBy: 'self'
      },
      {
        name: 'Artwork',
        description: 'Jane Smith\'s latest artwork',
        mediaType: 'image',
        url: 'https://example.com/artwork1.jpg',
        user: createdProfiles[1]._id,
        for: createdProfiles[1]._id,
        viewableBy: 'self'
      },
      {
        name: 'Business Video',
        description: 'Michael Johnson\'s business presentation',
        mediaType: 'video',
        url: 'https://example.com/business.mp4',
        user: createdProfiles[2]._id,
        for: createdProfiles[2]._id,
        viewableBy: 'self'
      }
    ];

    await Media.create(mediaItems);

    console.log('Database seeded successfully!');
    await mongoose.disconnect();
    process.exit();
  } catch (error) {
    console.error('Error seeding database:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

// Run the seed function
seedDatabase(); 