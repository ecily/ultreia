import { useState, useEffect } from 'react'
import { allHotels } from '../actions/hotel'
import SmallCard from '../components/cards/SmallCard'


const Home = () => {
    const [hotels, setHotels] = useState([])

    useEffect(() => {
        loadAllhotels()
    }, [])
  
    const loadAllhotels = async () => {
        let res = await allHotels()
        setHotels(res.data)
    }

    return (
    <>    
    <div className="container-fluid bg-secondary p-5 text-center mb-3">
        <h1>All offers</h1>
    </div>
    <div className="container-fluid">
        {/* <pre>{JSON.stringify(hotels, null, 4)}</pre> */}
        {hotels.map((h) => <SmallCard key={h._id} h={h}/>)}
    </div>
    </>
    )
}

export default Home;