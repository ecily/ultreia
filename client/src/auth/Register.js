import { useState } from 'react'

const Register = () => {
const [name, setName] = useState('') 
const [email, setEmail] = useState('') 
const [password, setPassword] = useState('') 

const handleSubmit = (e) => {
    e.preventDefault()
    console.table({name, email, password})
}

const registerForm = () => {
    return(
        <form onSubmit={handleSubmit} className="mt-3">
            <div className="form-group mb-3">
                <label className="form-label">Your name: </label>
                <input 
                    type="text" 
                    className="form-control" 
                    placeholder="enter your name" 
                    value={name} 
                    onChange={e => setName(e.target.value)}
                />
            </div>
            <div className="form-group mb-3">
                <label className="form-label">Email: </label>
                    <input 
                        type="email" 
                        className="form-control" 
                        placeholder="enter email" 
                        value={email} 
                        onChange={e => setEmail(e.target.value)}
                    />
                </div>
                <div className="form-group mb-3">
                <label className="form-label">Your password: </label>
                    <input 
                        type="password" 
                        className="form-control" 
                        placeholder="enter your password" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)}
                    />
                </div>
                <button className="btn btn-primary">submit</button>
        </form>
    )
}

    return(
    <>   
        <div className="container-fluid bg-secondary bg-gradient p-5 text-center">
            <h1>Register</h1>
        </div>
        <div className="container">
            <div className="row">
                <div className="col-md-6 offset-md-3">
                    {registerForm()}
                </div>
            </div>
        </div>
    </>
    )
}
export default Register;