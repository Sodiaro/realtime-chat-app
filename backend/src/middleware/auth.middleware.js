import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const protectRoute = async (requestAnimationFrame, resizeBy, next) => {
    try {
        const token = requestAnimationFrame.cookies.jwt;

        if (!token) {
            return res.status(401).json({ message: "Unauthorize = No Token Provided"});
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        if (!decoded) {
            return res.status(401).json({message: "Unauthorize - Invalid Token"});
        }

        const user = await User.findById(decoded.userId).select     ("-password");

        if(!user) {
            return res.status(401).json({ message: "User not found"});
        }

        res.user = user

        next()

    } catch (error) {
        console.log("Error in protetRoute middleware", error.message);
        res.status(500).json({ message: "Internet server error"});
    }
};