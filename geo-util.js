const axios = require("axios");

const GOOGLE_API_KEY = ""; // Replace with your Google API Key

const getCityFromComponents = (components) => {
  // List of potential types that might represent a city
  const potentialCityTypes = ["locality", "sublocality"];

  for (let component of components) {
    for (let type of potentialCityTypes) {
      if (component.types.includes(type)) {
        return component.long_name;
      }
    }
  }
  // Return undefined or a fallback if no city found
  return undefined;
};

async function getLoc({ lat, lng }) {
  if (!lat || !lng) {
    return res.status(400).send("Please provide lat and lng query parameters.");
  }

  try {
    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`
    );
    const results = response.data.results;

    if (results && results.length > 0) {
      const parts = results[0].address_components.reduce(
        (acc, curr) => {
          if (curr.types.includes("street_number")) {
            acc.street = curr.long_name;
          } else if (curr.types.includes("route")) {
            acc.street += ` ${curr.long_name}`;
          } else if (curr.types.includes("administrative_area_level_1")) {
            acc.state = curr.short_name;
          } else if (curr.types.includes("postal_code")) {
            acc.zip = curr.long_name;
          }
          acc.city = getCityFromComponents(results[0].address_components);

          return acc;
        },
        {}
      );

      console.log(parts);
      // return parts;
      return results[0].formatted_address;
    } else {
      return "Location not found.";
    }
  } catch (error) {
    return "Error connecting to Google Maps API.";
  }
}

// getLoc({ lat: 37.7749, lng: -122.4194 });
// getLoc({ lat: 40.714224, lng: -73.961452 });

module.exports = { getLoc };