import User from '../models/user'
import Stripe from 'stripe'
//import and execute right away
import queryString from 'query-string'

const stripe = Stripe(process.env.STRIPE_SECRET)

export const createConnectAccount = async (req, res) => {
    
    //find user in db
    const user = await User.findById(req.user._id).exec()
    //console.log(user)
    //if no stripe id yet, create one
    if(!user.stripe_account_id) {
        console.log('user created')
        const account = await stripe.accounts.create({
            type: 'express'
        })
        
        user.stripe_account_id = account.id
        //save account id from stripe in mongo

        user.save()
    }
    //create a stripe login-link based on the account id
    //npm i query-string
    let accountLink = await stripe.accountLinks.create({
        account: user.stripe_account_id,
        refresh_url: process.env.STRIPE_REDIRECT_URL,
        return_url: process.env.STRIPE_REDIRECT_URL,
        type: 'account_onboarding'
    })
    //prefill stripe form
    accountLink = Object.assign(accountLink, {
        "stripe_user[email]": user.email || undefined,
    })
    //console.log(accountLink)
    //generate link and send to frontend
    let link = `${accountLink.url}?${queryString.stringify(accountLink)}`
    console.log('LOGIN LINK ', link)
    res.send(link)
}