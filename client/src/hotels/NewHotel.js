//Algolia search alternative needed - google or mapbox?
//trying out google maps

import Autocomplete from '../components/Autocomplete'

const NewHotel = () => {
    
    return(
        <div className="container-fluid h1 p-5 text-center">
            
           <h1>New hotel</h1>
           <Autocomplete />
          
        </div>
    )
}
export default NewHotel;