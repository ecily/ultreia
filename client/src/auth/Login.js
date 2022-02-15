import { useState } from 'react';
import { toast } from 'react-toastify';
import { login } from '../actions/auth';
import LoginForm from '../components/LoginForm';
import { useDispatch } from 'react-redux';

const Login = ({ history }) => {

    const [email, setEmail] = useState('') 
    const [password, setPassword] = useState('') 

    const dispatch = useDispatch()

    const handleSubmit = async (e) => {
        e.preventDefault()
        console.log('SENDING LOGIN DATA', {email, password})
        try {

            let res = await login({ email, password })
            console.log(res.data)

            if(res.data) {
            console.log('SAVE USER RESPONSE IN REDUX AND LOCAL STORAGE THEN REDIRECT')
            console.log(res.data)
            //save user and token to local storage and then to redux
            window.localStorage.setItem('auth', JSON.stringify(res.data))
            //store in redux state (keine ahnung, warum ich das in den dev tools nicht unter state sehe)
            dispatch({
                type: "LOGGED_IN_USER",
                payload: res.data,
            });
            //now redirect to dashboard
            history.push('/dashboard')
        }
        } catch (err) {
            console.log(err)
            if(err.response.status === 400) toast.error(err.response.data)
        }
    }
    return(
        <>
        <div className="container-fluid bg-secondary p-5 text-center">
            <h1>Login</h1>
        </div>
        <div className="container">
            <div className="row">
                <div className="col-md-6 offset-md-3">
                    <LoginForm 
                     handleSubmit={handleSubmit}
                     email={email}
                        setEmail={setEmail}
                        password={password}
                        setPassword={setPassword}
                    />
                </div>
            </div>
        </div>
        </>
    )
}
export default Login;