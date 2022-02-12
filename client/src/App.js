import Home from './booking/Home'
import { BrowserRouter, Switch, Route } from "react-router-dom"
import Login from './auth/Login'
import Register from './auth/Register'
import TopNav from './components/TopNav'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

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
      </Switch>
      </BrowserRouter>
    </div>
  );
}

export default App;
