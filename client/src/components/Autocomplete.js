import React from 'react';
import GooglePlacesAutocomplete from 'react-google-places-autocomplete';

const Autocomplete = () => (
  <div>
    <GooglePlacesAutocomplete
      apiKey={process.env.REACT_APP_GOOGLE_MAPS_API}
    />
  </div>
);

export default Autocomplete;