/* global L */

// Start on Bhopal
const map = L.map("map").setView([23.2599, 77.4126], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const statusEl = document.getElementById("location-status");
const button = document.getElementById("location-btn");

let marker = null;
let circle = null;
let watchId = null;

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function showPosition(pos) {
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  const accuracy = pos.coords.accuracy;

  if (!marker) {
    marker = L.marker([lat, lng]).addTo(map).bindPopup("You are here");
    circle = L.circle([lat, lng], { radius: accuracy }).addTo(map);
    map.flyTo([lat, lng], 16); // fly only the first time
  } else {
    marker.setLatLng([lat, lng]);
    circle.setLatLng([lat, lng]).setRadius(accuracy);
  }
  setStatus("Location found (accuracy about " + Math.round(accuracy) + " m)");
}

function showError(err) {
  if (err.code === 1) setStatus("Location permission denied. Allow it in your browser settings.");
  else if (err.code === 2) setStatus("Location unavailable. Check GPS or internet.");
  else setStatus("Location request timed out.");
  watchId = null;
}

if (button) {
  button.addEventListener("click", () => {
    if (!("geolocation" in navigator)) {
      setStatus("Your browser does not support location.");
      return;
    }
    if (watchId !== null) {
      // already tracking, just fly back to the marker
      if (marker) map.flyTo(marker.getLatLng(), 16);
      return;
    }
    setStatus("Finding your location...");
    watchId = navigator.geolocation.watchPosition(showPosition, showError, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000,
    });
  });
}

const searchBtn = document.getElementById("search-btn");
const cityInput = document.getElementById("city-input");

if (searchBtn) {
    searchBtn.addEventListener("click", searchLocation);
}

if (cityInput) {
    cityInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            searchLocation();
        }
    });
}

async function searchLocation() {
    const city = cityInput.value.trim();

    if (!city) {
        setStatus("Please enter a city or location.");
        return;
    }

    setStatus("Searching for " + city + "...");

    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1`;

        const response = await fetch(url);
        const results = await response.json();

        if (results.length === 0) {
            setStatus("Location not found. Try another name.");
            return;
        }

        const place = results[0];
        const lat = Number(place.lat);
        const lng = Number(place.lon);

        map.flyTo([lat, lng], 14);

        if (marker) {
            marker.setLatLng([lat, lng]);
        } else {
            marker = L.marker([lat, lng]).addTo(map);
        }

        marker.bindPopup(place.display_name).openPopup();

        if (circle) {
            map.removeLayer(circle);
            circle = null;
        }

        setStatus("Showing results for " + place.display_name);

    } catch (error) {
        console.error(error);
        setStatus("Could not search location. Please try again.");
    }
}
