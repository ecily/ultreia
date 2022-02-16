import DashboardNav from '../components/DashboardNav'
import ConnectNav from '../components/ConnectNav'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useState } from 'react'
import { HomeOutlined } from '@ant-design/icons'
import { createConnectAccount } from '../actions/stripe'
import { toast } from 'react-toastify'

const DashboardSeller = () => {
    const { auth } = useSelector((state) => ({ ...state }))
    const [ loading, setLoading ] = useState(false)

    const handleClick = async () => {
        setLoading(true)
        try {
            let res = await createConnectAccount(auth.token) //try to get the stripe login link
            console.log(res.data)
            window.location.href = res.data
        } catch (err) {
            console.log(err)
            toast.error('Stipe connection failed, please try again later')
            setLoading(false)
        }
    }
    const connected = () => (

        <div className="container-fluid">
                <div className="row">
                    <div className="col-md-10">
                        <h2>Your offer: </h2>
                    </div>
                    <div className="col-md-2">
                        <Link to="/hotels/new" className="btn btn-primary">+ add new</Link>
                    </div>
                </div>
            </div>

    )

    const notConnected = () => (

        <div className="container-fluid">
                <div className="row">
                    <div className="col-md-6 offset-md-3 text-center">
                        <div className="p-5 pointer">
                            <HomeOutlined className="h1"/>
                            <h4>Setup payments with Stripe to post your offers</h4>
                            <p className="lead">ultreia partners with Stripe to transfer earnings to your account</p>
                            <button disabled={loading} onClick={handleClick} className="btn btn-primary mb-3">
                                {loading ? 'Processing ..' : 'Setup payouts'}
                            </button>
                            <p className="text-muted"><small>You will be redirected to Stripe to complete the onboarding process</small></p>
                        </div>
                        
                    </div>
                </div>
            </div>
    )

    return (
        <>
            <div className="container-fluid bg-secondary p-5">
                <ConnectNav />
            </div>

            <div className="container-fluid p-4">
                <DashboardNav/>
            </div>

            {auth && auth.user && auth.user.stripe_seller && auth.user.stripe_seller.charges_enabled 
            ? connected() 
            : notConnected()}
            {/* <pre>{JSON.stringify(auth, null, 4)}</pre> */}
            
        </>
    )
}

export default DashboardSeller