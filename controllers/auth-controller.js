import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import 'dotenv/config';
import { db } from '../firebaseAdminConfig.js'; 
import { userSignupSchema, userSigninSchema } from '../models/user.js';

export const register = async (req, res) => {
  const { JWT_SECRET } = process.env;
  const { email, password, username } = req.body;

  const { error } = userSignupSchema.validate({ email, password, username });

  if (error) return res.status(400).json({ message: error.details[0].message });

  const collection = 'users';

  try {
    const ref = db.collection(collection);
    
    const snapshot = await ref.where('email', '==', email).get();
    if (!snapshot.empty) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const docRef = await ref.add({ 
      email, 
      password: hashedPassword, 
      username 
    });

    const token = jwt.sign(
      { email, id: docRef.id },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    await docRef.update({ token });

    res.status(201).json({
      id: docRef.id,
      email,
      username,
      token 
    });
  } catch (error) {
    console.error("Error adding data:", error);
    res.status(500).json({ message: 'Error adding user data', error: error.message });
  }
};



export const signin = async (req, res) => {
  const { JWT_SECRET } = process.env;
  const { email, password } = req.body;

  const { error } = userSigninSchema.validate({ email, password });
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const ref = db.collection('users');
    const snapshot = await ref.where('email', '==', email.toLowerCase()).get();

    if (snapshot.empty) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userDoc = snapshot.docs[0];
    const user = userDoc.data();

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (user.token) {
      try {
        const decoded = jwt.verify(user.token, JWT_SECRET);

        return res.status(200).json({
          id: userDoc.id,
          email: user.email,
          username: user.username,
          token: user.token,
        });
      } catch (err) {
        console.log('Token expired or invalid, generating a new one');
      }
    }

    const newToken = jwt.sign({ id: userDoc.id, email: user.email }, JWT_SECRET, { expiresIn: '8h' });
    await userDoc.ref.update({ token: newToken });

    res.status(200).json({
      id: userDoc.id,
      email: user.email,
      username: user.username,
      token: newToken,
    });

  } catch (error) {
    console.error('Error signing in:', error);
    res.status(500).json({ message: 'Error signing in', error: error.message });
  }
};




export const logout = async (req, res) => {
  try {
    const userId = req.user.id; 
    console.log(userId)
    const ref = db.collection('users');
    await ref.doc(userId).update({ token: '' });

    res.status(200).json({ message: 'User logged out successfully' });
  } catch (error) {
    console.error("Error logging out:", error);
    res.status(500).json({ message: 'Error during logout', error: error.message });
  }
};


export const getCurrent = (req, res) => {
  const { email, username } = req.user;

  res.json({
    email,
    username
  });
};

