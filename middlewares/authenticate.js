import { db } from "../firebaseAdminConfig.js";
import jwt from "jsonwebtoken";
import "dotenv/config";

const { JWT_SECRET } = process.env;

const authenticate = async (req, res, next) => {
  try {
    const { authorization = "" } = req.headers;

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization header must start with Bearer" });
    }

    const token = authorization.split(" ")[1]; 
    if (!token) {
      return res.status(401).json({ message: "Token not provided" });
    }

    let decoded;
    try {

      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {

      if (error.name === "TokenExpiredError") {
        await removeExpiredToken(token); 
        return res.status(401).json({ message: "Token expired, please login again" });
      }
      return res.status(401).json({ message: "Invalid token" });
    }

    const userRef = db.collection("users").doc(decoded.id);
    const userDoc = await userRef.get();

    if (!userDoc.exists || userDoc.data().token !== token) {
      return res.status(401).json({ message: "Користувач не авторизований" });
    }

    req.user = { ...userDoc.data(), id: decoded.id };
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  } catch (error) {
    console.error("Error during authentication:", error);
    return res.status(401).json({ message: "Unauthorized" });
  }
};


const removeExpiredToken = async (token) => {
  const snapshot = await db.collection("users").where("token", "==", token).get();
  if (!snapshot.empty) {
    const userDoc = snapshot.docs[0];
    await userDoc.ref.update({ token: null }); 
  }
};

export default authenticate;
