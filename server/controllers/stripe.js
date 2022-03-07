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

const updateDelayDays = async (accountId) => {
    const account = await stripe.account.update(accountId, {
        settings: {
            payouts: {
            schedule: {
                delay_days: 7,
            }
        }
    }})
    return account
}

export const getAccountStatus = async (req, res) => {
    //console.log('GET ACCOUNT STATUS')
    //find user in db
    const user = await User.findById(req.user._id).exec()
    const account = await stripe.accounts.retrieve(user.stripe_account_id)
    //console.log('user account retrieve', account)
    //update delay days
    const updatedAccount = await updateDelayDays(account.id)
    const updatedUser = await User.findByIdAndUpdate(user._id, {
        stripe_seller: updatedAccount,
    },
    { new: true}
    ).select('-password')
    .exec()
    console.log(updatedUser)
    res.json(updatedUser)
}

export const getAccountBalance = async(req, res) => {
    const user = await User.findById(req.user._id).exec()

    try {
        const balance = await stripe.balance.retrieve({
            stripeAccount: user.stripe_account_id
        })
        //console.log(balance)
        res.json(balance)
    } catch (err) {
        //console.log(err)
    }
}

export const payoutSetting = async(req, res) => {
    try {
        const user = await User.findById(req.user._id).exec()
        const loginLink = await stripe.accounts.createLoginLink(user.stripe_seller.id, {
            redirect_url: process.env.STRIPE_SETTING_REDIRECT_URL
        })
        //console.log('LOGIN LINK', loginLink)
        res.json(loginLink)
    } catch (err) {
        console.log(err)
    }
}