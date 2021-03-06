import { BrowserRouter, Switch, Route } from "react-router-dom"
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import PrivateRoute from './components/PrivateRoute'
//components
import Home from './booking/Home'
import Login from './auth/Login'
import Register from './auth/Register'
import TopNav from './components/TopNav'
import Dashboard from './user/Dashboard'
import DashboardSeller from './user/DashboardSeller' 
import NewHotel from './hotels/NewHotel'
import stripeCallback from "./stripe/StripeCallback"

function App() {
  return (
    <div className="App">
      <BrowserRouter>
      <TopNav />
      <ToastContainer 
            position='top-center'
        />
      <Switch>
        <Route exact path="/" component = {Home}/>
        <Route exact path="/login" component = {Login}/>
        <Route exact path="/register" component = {Register}/>
        <PrivateRoute exact path="/dashboard" component = {Dashboard}/>
        <PrivateRoute exact path="/dashboard/seller" component = {DashboardSeller}/>
        <PrivateRoute exact path="/hotels/new" component = {NewHotel}/>
        <PrivateRoute exact path="/stripe/callback" component = {stripeCallback}/>
      </Switch>
      </BrowserRouter>
    </div>
  );
}

export default App;
