const LoginForm = ({
    handleSubmit,
    email,
    setEmail,
    password,
    setPassword
}) => {
    return (
        <form onSubmit={handleSubmit} className="mt-3">
            <div className="form-group mb-3">
                <label className="form-label">Email: </label>
                    <input
                        type="email"
                        className="form-control"
                        placeholder="enter email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>
                <div className="form-group mb-3">
                <label className="form-label">Your password: </label>
                    <input
                        type="password"
                        className="form-control"
                        placeholder="enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>
                <button disabled={!email || !password} className="btn btn-primary">submit</button>
        </form>
    )
    
}

export default LoginForm