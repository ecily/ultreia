import { useState } from 'react'
import { toast } from 'react-toastify'
import ReactGoogleAutocomplete from "react-google-autocomplete";
import { DatePicker, Select } from 'antd'
import moment from 'moment'
import { createHotel } from '../actions/hotel'
import { useSelector } from 'react-redux'

const config = process.env.REACT_APP_GOOGLEPLACES_API_KEY
const { Option } = Select

const NewHotel = () => {
// redux - get state, destructure state and get auth from there
const { auth } =useSelector((state) => ({ ...state }))
const { token } = auth
//state
    const [values, setValues] = useState({
        title: '',
        content: '',
        
        image: '',
        price: '',
        from: '',
        to: '',
        bed: ''
    })

const [preview, setPreview] = useState('https://via.placeholder.com/100x100.png?text=PREVIEW')

const [location, setLocation] = useState('')
//destructure form state
const { title, content, image, price, from, to, bed } = values
const handleSubmit = async (e) => {
    e.preventDefault()

    //create form data for the hotelData variable. all is in state already
    let hotelData = new FormData()
    hotelData.append('title', title)
    hotelData.append('content', content)
    hotelData.append('location', location)
    hotelData.append('price', price)
    image && hotelData.append('image', image)
    hotelData.append('from', from)
    hotelData.append('to', to)
    hotelData.append('bed', bed)



    let res =  await createHotel(token, hotelData)
    console.log(res)
    toast('New offer is posted')
    //empty the input fields
    setTimeout(() => {
        window.location.reload()
    }, 1000)
}
const handleImageChange = (e) => {
    //here are the files in e.target.files
    //console.log(e.target.files[0])
    setPreview(URL.createObjectURL(e.target.files[0]))
    setValues({...values, image: e.target.files[0]})
}
const handleChange = (e) => {
    setValues({...values, [e.target.name]: e.target.value })
}

const hotelForm = () => (
    <form onSubmit={handleSubmit}>

    <div className='form-group'>
        <label className='btn btn-outline-secondary btn-block m-2 text-left'>
            Select your images
        <input 
            type='file'
            name='image'
            onChange={handleImageChange}
            accept='image/*'
            hidden
            className='form-control m-2'
        />
        </label>
        <input 
            type='text' 
            name='title' 
            onChange={handleChange} 
            placeholder='What is the name of your business?'
            className='form-control m-t' 
            value={title}
            className='form-control m-2'>
        </input>
        <textarea 
            name='content' 
            onChange={handleChange} 
            placeholder='Describe your business a little bit.'
            className='form-control m-2' 
            value={content}>
        </textarea>
        <ReactGoogleAutocomplete
          className="form-control m-2"
          placeholder="In order to best help you, we need your exact address."
          apiKey={config}

        //   onPlaceSelected={(place) => {
        //     setValues({...values, location: place.formatted_address})}}
        //onPlaceSelected={({place}) => setLocation(place.formatted_address)}
          onPlaceSelected={(place) => {
             setLocation({...location, location: place.formatted_address})}}
          
          options={{
                types: ["address"],
                componentRestrictions: { country: "at" },
              }}
          style={{ height: "50px" }}
        />
        <input 
            type='number' 
            name='price' 
            onChange={handleChange} 
            placeholder='Price'
            className='form-control m-2' 
            value={price}>
        </input>
        <Select onChange={(value) => setValues({...values, bed:value })}
        className="w-100 m-2" size="large"
        placeholder="Radius">
            <Option key={1}>{'1-10 meter'}</Option>
            <Option key={2}>{'11- 30 meter'}</Option>
            <Option key={3}>{'31-50 meter'}</Option>
            <Option key={4}>{'50-100 meter'}</Option>
        </Select>
    </div>
    <DatePicker 
    placeholder = "from Date" 
    className="form-control m-2"
    onChange={(date, dateString) => setValues({...values, from: dateString})}
    disabledDate={(current) => current && current.valueOf() < moment().subtract(1, 'days')}
    />
    
    <DatePicker 
    placeholder = "to Date" 
    className="form-control m-2"
    onChange={(date, dateString) => setValues({...values, to: dateString})}
    disabledDate={(current) => current && current.valueOf() < moment().subtract(1, 'days')}
    />

    <button className='btn btn-outline-primary m-2'>Save</button>
    </form>
)
    
    return(
        <>
        <div className="container-fluid bg-secondary p-5 text-center">
           <h2>Erstelle jetzt dein lokalisiertes Angebot!</h2>
        </div>
        <div className="container-fluid">
            <div className="row">
                <div className="col-md-6">
                    <br />
                    {hotelForm()}
                </div>
                <div className="col-md-6">
                    <img src={preview} alt='Preview image' className='img img-fluid m-2'/>
                    <pre>
                        {JSON.stringify(values, null, 4)}
                        {JSON.stringify(location, null, 4)}
                        
                    </pre>
                </div>
            </div>
        </div>
        </>
    )
}
export default NewHotel;