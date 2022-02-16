import expressJwt from 'express-jwt'

//if token is valid - information in req.user
export const requireSignin = expressJwt({
    // secret, expiry date check
    secret: process.env.JWT_SECRET,
    algorithms: ["HS256"]
})