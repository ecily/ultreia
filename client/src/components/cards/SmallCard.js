import { currencyFormatter } from "../../actions/stripe"
import { diffDays } from "../../actions/hotel"
import { useHistory, Link } from 'react-router-dom'
import { EditOutlined, DeleteOutlined } from '@ant-design/icons'

const SmallCard = ({h, handlelHotelDelete = (f) => f }) => {

const history = useHistory()

return (
<>
    <div className="card mb-3">
        <div className="row no-gutters">
            <div className="col-md-4">
               {h.image && h.image.contentType ? (
                 <img src={`${process.env.REACT_APP_API}/hotel/image/${h._id}`}
                 alt="default hotel image"
                 className="card-image img img-fluid"
                 ></img>
               ) : (
                <img src="https://via.placeholder.com/900x500.png?text=Ultreia" 
                alt="default hotel image"
                className="card-image img img-fluid"
                ></img>
               )}
            </div>
            <div className="col-md-8">
                <div className="card-body">
                    <h5 className="card-title">
                        {h.title}{' '}
                        <span className="float-right text-primary">
                            {currencyFormatter({
                                amount: h.price,
                                currency: 'eur'
                            })}
                        </span>
                    </h5>
                    <p className="alert alert-info">{h.location}</p>
                    <p className="card-text">{`${h.content.substring(0, 200)}`}</p>
                    <p className="card-text">
                        <span className="float-right text-primary">
                            noch gültig für {diffDays(h.from, h.to)} {diffDays(h.from, h.to) === 1 ? 'Tag' : 'Tage'}
                        </span>
                    </p>
                    <p className="card-text">{h.bed}</p>
                    <p className="card-text">Verfügbar von {new Date(h.from).toLocaleDateString()}</p>
                    <p className="card-text">Verfügbar bis {new Date(h.to).toLocaleDateString()}</p>        
                    <div className="d-flex justify-content-between h4">       
                    <button onClick={() => history.push(`/hotel/${h._id}`)}className="btn btn-primary">Details</button>
                   
                            <Link to={`/hotel/edit/${h._id}`}>
                                <EditOutlined className="text-warning" />
                            </Link>
                            <DeleteOutlined onClick={() => handlelHotelDelete(h._id)} className="text-danger" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</>
)}
export default SmallCard

