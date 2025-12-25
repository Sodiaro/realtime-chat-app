import { config } from "dotenv";
import { connectDB } from "../lib/db.js";
import User from "../models/user.model.js";

config();

const seedUsers = [
  // Female Users
  {
    email: "harper.walker@example.com",
    fullName: "Harper Walker",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/women/9.jpg",
  },
  {
    email: "ella.harris@example.com",
    fullName: "Ella Harris",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/women/10.jpg",
  },
  {
    email: "grace.lewis@example.com",
    fullName: "Grace Lewis",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/women/11.jpg",
  },
  {
    email: "layla.robinson@example.com",
    fullName: "Layla Robinson",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/women/12.jpg",
  },
  {
    email: "chloe.white@example.com",
    fullName: "Chloe White",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/women/13.jpg",
  },
  {
    email: "lily.hall@example.com",
    fullName: "Lily Hall",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/women/14.jpg",
  },
  {
    email: "aria.young@example.com",
    fullName: "Aria Young",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/women/15.jpg",
  },
  {
    email: "zoe.king@example.com",
    fullName: "Zoe King",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/women/16.jpg",
  },

  // Male Users
  {
    email: "noah.wright@example.com",
    fullName: "Noah Wright",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/men/9.jpg",
  },
  {
    email: "liam.lopez@example.com",
    fullName: "Liam Lopez",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/men/10.jpg",
  },
  {
    email: "ethan.hill@example.com",
    fullName: "Ethan Hill",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/men/11.jpg",
  },
  {
    email: "mason.green@example.com",
    fullName: "Mason Green",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/men/12.jpg",
  },
  {
    email: "logan.adams@example.com",
    fullName: "Logan Adams",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/men/13.jpg",
  },
  {
    email: "jacob.baker@example.com",
    fullName: "Jacob Baker",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/men/14.jpg",
  },
  {
    email: "michael.carter@example.com",
    fullName: "Michael Carter",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/men/15.jpg",
  },
  {
    email: "elijah.rivera@example.com",
    fullName: "Elijah Rivera",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/men/16.jpg",
  },
];

const seedDatabase = async () => {
  try {
    await connectDB();

    await User.insertMany(seedUsers);
    console.log("Database seeded successfully");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
};

// Call the function
seedDatabase();