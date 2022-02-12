import User from '../models/user'

export const register = async (req, res) => {
    console.log(req.body)
    const { name, email, password } = req.body

    if(!name) return res.status(400).send('auth.js: Name is required')
    if(!password || password.length < 6) return res.status(400).send('auth.js Valid Password is required')

    let userExist = await User.findOne({ email }).exec()
    if(userExist) return res.status(400).send('auth.js Email already taken')

    //register physically
    const user = new User(req.body)
    try {
        await user.save()
        console.log('USER CREATED')
        return res.json({ ok: true })
    } catch (err) {
        console.log('auth.js User creation failed')
        return res.status(400).send('auth.js Error during saving')
    }
}
