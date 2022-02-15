import { userSelector, useSelector, useStore } from 'react-redux'

const Home = () => {
    const { auth } = useSelector((state) => ({...state}))
    return(
        <div className="container-fluid h1 p-5 text-center">
            Home: {JSON.stringify(auth)}
        </div>
    )
}
export default Home;