import Home from './booking/Home'
import { BrowserRouter, Switch, Route } from "react-router-dom"
import Login from './auth/Login'
import Register from './auth/Register'
import TopNav from './components/TopNav'

function App() {
  return (
    <div className="App">
      <BrowserRouter>
      <TopNav />
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
