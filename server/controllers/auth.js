import User from '../models/user'
import jwt from 'jsonwebtoken'

export const register = async (req, res) => {

    try {
        //console.log(req.body)
        const { name, email, password } = req.body
        if(!name) return res.status(400).send('auth.js: Name is required')
        if(!password || password.length < 6) return res.status(400).send('auth.js Valid Password is required')
        let userExist = await User.findOne({ email }).exec()
        if(userExist) return res.status(400).send('auth.js Email already taken')
        //register physically
        const user = new User(req.body)
        await user.save()
        console.log('USER CREATED')
        return res.json({ ok: true })
    } catch (err) {
        console.log('auth.js User creation failed')
        return res.status(400).send('auth.js Error during saving')
    }
}

export const login = async (req, res) => {
    const { email, password } = req.body
    try {
        let user = await User.findOne({email}).exec()
        // console.log('User', user)
        if (!user) res.status(400).send('This email does not exist')
        //compare password
        user.comparePassword(password, (err, match)=> {
            console.log('COMPARE PASSWORD LOGIN ERROR', err)
            if(!match || err) return res.status(400).send('Incorrect password')
            //console.log('NOW LETS GENERATE TOKEN')
            let token = jwt.sign({_id: user._id}, process.env.JWT_SECRET, {
                expiresIn: '7d'
            })
            res.json({token, user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                stripe_account_id: user.stripe_account_id,
                stripe_seller: user.stripe_seller,
                stripeSession: user.stripeSession
            }})
        })

    } catch (err) {
        console.log('auth.js backend - error', err)
        res.status(400).send('Sign in failed')
    }
}
