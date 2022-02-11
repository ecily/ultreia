

// 2 Create user-reducer function
// e.g. { type: 'LOGGED_IN_USER', payload: {name: 'Andl', role: 'Seller'}}
//const authReducer = (state = {name:'Andl', role:'Seller'}, action) => {
    export const authReducer = (state = {}, action) => {
        switch(action.type) {
          case "LOGGED_IN_USER":
            return { ...state, ...action.payload }
          case "LOGOUT":
            return action.payload
          default:
            return state
        }
      }