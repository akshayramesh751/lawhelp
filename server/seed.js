const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Lawyer = require('./models/Lawyer');

dotenv.config();

const mockLawyers = [
  {
    name: "Adv. Priya Sharma",
    specializations: ["Labour Law", "Employment"],
    city: "Delhi",
    experience: 8,
    rating: 4.6,
    reviews: 42,
    cost: 799,
    languages: ["Hindi", "English"],
    bio: "Experienced in employment disputes, wrongful termination, and salary recovery cases. Known for securing favorable outcomes for employees in complex labor disputes.",
    education: "LLB - Delhi University",
    barReg: "DL/2015/04821"
  },
  {
    name: "Adv. Rahul Mehta",
    specializations: ["Labour Law"],
    city: "Mumbai",
    experience: 12,
    rating: 4.8,
    reviews: 87,
    cost: 1299,
    languages: ["Hindi", "English", "Marathi"],
    bio: "Senior advocate with expertise in corporate employment law and labor disputes. Extensive experience representing both employees and employers in complex cases.",
    education: "LLB - Mumbai University",
    barReg: "MH/2011/12345"
  },
  {
    name: "Adv. Sanya Iyer",
    specializations: ["Family Law", "Divorce"],
    city: "Bangalore",
    experience: 6,
    rating: 4.4,
    reviews: 31,
    cost: 599,
    languages: ["English", "Kannada", "Tamil"],
    bio: "Compassionate family law attorney helping clients navigate divorce, custody, and property matters. Focus on amicable settlements and protecting children's interests.",
    education: "LLB - NLSIU Bangalore",
    barReg: "KA/2018/09832"
  },
  {
    name: "Adv. Vikram Nair",
    specializations: ["Property Law", "Real Estate"],
    city: "Chennai",
    experience: 15,
    rating: 4.9,
    reviews: 120,
    cost: 1999,
    languages: ["Tamil", "English"],
    bio: "Top-rated property lawyer with extensive experience in land disputes and real estate transactions. Known for meticulous documentation and strong litigation skills.",
    education: "LLB - Madras Law College",
    barReg: "TN/2009/03201"
  },
  {
    name: "Adv. Deepa Kulkarni",
    specializations: ["Criminal Law"],
    city: "Pune",
    experience: 10,
    rating: 4.5,
    reviews: 58,
    cost: 999,
    languages: ["Marathi", "Hindi", "English"],
    bio: "Criminal defense specialist with a strong track record in bail hearings and trial representation. Committed to ensuring fair trials and protecting constitutional rights.",
    education: "LLB - Pune University",
    barReg: "MH/2013/07654"
  },
  {
    name: "Adv. Arjun Gupta",
    specializations: ["Consumer Law", "Financial Fraud"],
    city: "Delhi",
    experience: 7,
    rating: 4.3,
    reviews: 29,
    cost: 699,
    languages: ["Hindi", "English"],
    bio: "Consumer rights advocate specializing in cheque bounce cases and financial fraud recovery. Strong track record in consumer forum litigation.",
    education: "LLB - Amity Law School",
    barReg: "DL/2017/05523"
  },
  {
    name: "Adv. Meera Pillai",
    specializations: ["Family Law"],
    city: "Hyderabad",
    experience: 9,
    rating: 4.7,
    reviews: 63,
    cost: 899,
    languages: ["Telugu", "English", "Hindi"],
    bio: "Family law expert handling divorce, alimony, child custody, and domestic violence cases. Known for sensitive handling of emotionally charged situations.",
    education: "LLB - NALSAR",
    barReg: "TS/2015/11209"
  },
  {
    name: "Adv. Suresh Patil",
    specializations: ["Labour Law", "Service Law"],
    city: "Mumbai",
    experience: 20,
    rating: 4.9,
    reviews: 210,
    cost: 2499,
    languages: ["Hindi", "Marathi", "English"],
    bio: "Veteran labour lawyer with 20+ years handling complex employment and service law matters. Renowned for representing government employees and handling service-related disputes.",
    education: "LLB - ILS Law College",
    barReg: "MH/2004/00391"
  },
  {
    name: "Adv. Karan Singh",
    specializations: ["Corporate Law", "Intellectual Property"],
    city: "Bangalore",
    experience: 14,
    rating: 4.8,
    reviews: 145,
    cost: 2200,
    languages: ["English", "Hindi", "Kannada"],
    bio: "Expert in corporate restructuring, mergers & acquisitions, and IP rights protection. Dedicated to helping startups and established businesses with their legal needs.",
    education: "LLB - NLS Bangalore",
    barReg: "KA/2010/01234"
  },
  {
    name: "Adv. Anjali Desai",
    specializations: ["Consumer Law", "Civil Litigation"],
    city: "Ahmedabad",
    experience: 5,
    rating: 4.2,
    reviews: 22,
    cost: 500,
    languages: ["Gujarati", "Hindi", "English"],
    bio: "Focused on consumer protection cases and civil litigation. Providing accessible legal guidance to ordinary citizens fighting against corporate neglect.",
    education: "LLB - Gujarat University",
    barReg: "GJ/2019/08192"
  },
  {
    name: "Adv. Rohit Verma",
    specializations: ["Criminal Law", "Cyber Law"],
    city: "Delhi",
    experience: 11,
    rating: 4.6,
    reviews: 80,
    cost: 1500,
    languages: ["Hindi", "English"],
    bio: "Specializing in cybercrimes, data privacy, and electronic evidence, mixed with profound knowledge of traditional criminal defense.",
    education: "LLM - NLU Delhi",
    barReg: "DL/2013/09423"
  },
  {
    name: "Adv. Neha Choudhary",
    specializations: ["Family Law", "Property Law"],
    city: "Kolkata",
    experience: 18,
    rating: 4.9,
    reviews: 198,
    cost: 1800,
    languages: ["Bengali", "English", "Hindi"],
    bio: "Highly respected in family dispute resolutions and ancestral property claims. Known to advocate strongly for women's rights in property succession.",
    education: "LLB - Calcutta University",
    barReg: "WB/2006/07331"
  },
  {
    name: "Adv. Manish Agarwal",
    specializations: ["Tax Law", "Corporate Law"],
    city: "Mumbai",
    experience: 9,
    rating: 4.5,
    reviews: 65,
    cost: 2100,
    languages: ["Hindi", "English", "Marathi"],
    bio: "Chartered Accountant and Lawyer specializing in complex tax tribunals and corporate tax planning. Efficiently handling GST and income tax litigation.",
    education: "LLB - GLC Mumbai",
    barReg: "MH/2015/02283"
  },
  {
    name: "Adv. Shalini Rao",
    specializations: ["Immigration Law", "Civil Litigation"],
    city: "Chennai",
    experience: 7,
    rating: 4.4,
    reviews: 44,
    cost: 1200,
    languages: ["Tamil", "English"],
    bio: "Dedicated immigration lawyer assisting individuals and companies with visas, citizenship issues, and deportation defense.",
    education: "LLB - Madras Law College",
    barReg: "TN/2017/05011"
  },
  {
    name: "Adv. Tariq Khan",
    specializations: ["Real Estate", "Constitutional Law"],
    city: "Hyderabad",
    experience: 25,
    rating: 5.0,
    reviews: 320,
    cost: 3000,
    languages: ["Urdu", "Telugu", "English"],
    bio: "One of the most senior advocates dealing with high-profile constitutional matters and major real estate disputes in the High Court.",
    education: "LLB - Osmania University",
    barReg: "TS/1999/00088"
  }
];

const seedDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.warn('MongoDB URI not provided! Please add it to .env');
      return;
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected for Seeding...');

    await Lawyer.deleteMany();
    console.log('Cleared existing lawyers.');

    const formattedLawyers = mockLawyers.map(lawyer => ({
      name: lawyer.name,
      specializations: lawyer.specializations,
      city: lawyer.city,
      experience: lawyer.experience,
      rating: lawyer.rating,
      totalReviews: lawyer.reviews,
      cost: lawyer.cost,
      languages: lawyer.languages,
      bio: lawyer.bio,
      education: lawyer.education,
      barRegNo: lawyer.barReg,
      casesHandled: Math.floor(Math.random() * 500) + 100,
      winRate: Math.floor(Math.random() * 15) + 85,
      phone: '+919902746555', 
      email: process.env.EMAIL_USER || 'lawyer@example.com', // Set lawyer email to the developer's email so they can receive the test booking requests
      isVerified: true
    }));

    await Lawyer.insertMany(formattedLawyers);
    console.log('Mock lawyers seeded successfully!');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDB();
